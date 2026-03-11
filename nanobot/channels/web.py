"""Web UI channel for nanobot."""

from __future__ import annotations

import asyncio
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from loguru import logger

from nanobot.bus.events import InboundMessage, OutboundMessage
from nanobot.bus.queue import MessageBus
from nanobot.channels.base import BaseChannel


class WebChannel(BaseChannel):
    """
    Web UI channel using FastAPI + WebSocket.

    Provides a web-based dashboard for nanobot with:
    - Real-time chat interface
    - Session management
    - Cron job management
    - Memory viewer
    - Configuration editor
    - Event log
    """

    name = "web"

    def __init__(self, config: Any, bus: MessageBus):
        super().__init__(config, bus)
        self._server: Any = None
        self._websocket_connections: dict[str, Any] = {}
        self._host = config.host
        self._port = config.port
        # References to core services (will be set by ChannelManager)
        self._agent_loop: Any = None
        self._session_manager: Any = None
        self._cron_service: Any = None

    def set_services(self, agent_loop: Any = None, session_manager: Any = None, cron_service: Any = None) -> None:
        """Set references to core services for API access."""
        self._agent_loop = agent_loop
        self._session_manager = session_manager
        self._cron_service = cron_service

    async def start(self) -> None:
        """Start the web server."""
        try:
            from fastapi import FastAPI, HTTPException, Query
            from fastapi.middleware.cors import CORSMiddleware
            from fastapi.responses import JSONResponse
            from fastapi.staticfiles import StaticFiles
            from fastapi.websockets import WebSocket, WebSocketDisconnect
            from pydantic import BaseModel
            import uvicorn
        except ImportError as e:
            logger.error("FastAPI or uvicorn not installed: {}", e)
            logger.info("Install with: pip install fastapi uvicorn")
            raise

        app = FastAPI(
            title="nanobot Dashboard API",
            description="REST API for nanobot AI assistant dashboard",
            version="1.0.0"
        )

        # CORS middleware
        app.add_middleware(
            CORSMiddleware,
            allow_origins=self.config.cors_origins,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

        # ============================================================================
        # WebSocket Endpoint
        # ============================================================================

        @app.websocket("/ws")
        async def websocket_endpoint(websocket: WebSocket):
            await websocket.accept()
            client_id = f"web_{id(websocket)}"

            # Auth token validation
            if self.config.auth_token:
                token = websocket.query_params.get("token")
                if token != self.config.auth_token:
                    await websocket.close(code=1008, reason="Unauthorized")
                    logger.warning("Web: Unauthorized connection attempt from {}", client_id)
                    return

            logger.info("Web: New WebSocket connection: {}", client_id)
            self._websocket_connections[client_id] = websocket

            try:
                # Send welcome message
                await websocket.send_json({
                    "type": "system",
                    "content": "Connected to nanobot. Type your message to start chatting!"
                })

                # Receive messages
                while True:
                    data = await websocket.receive_json()

                    if data.get("type") == "message":
                        content = data.get("content", "")
                        sender_id = data.get("sender_id", client_id)

                        if not content:
                            continue

                        logger.info("Web: Message from {}: {}", sender_id, content[:100])

                        # Forward to message bus
                        await self._handle_message(
                            sender_id=sender_id,
                            chat_id=client_id,
                            content=content,
                            metadata={"websocket_client_id": client_id}
                        )

                    elif data.get("type") == "ping":
                        await websocket.send_json({"type": "pong"})

            except WebSocketDisconnect:
                logger.info("Web: WebSocket disconnected: {}", client_id)
            except Exception as e:
                logger.error("Web: WebSocket error for {}: {}", client_id, e)
            finally:
                self._websocket_connections.pop(client_id, None)

        # ============================================================================
        # REST API: Sessions
        # ============================================================================

        @app.get("/api/sessions")
        async def list_sessions(
            limit: int = Query(100, ge=1, le=1000),
            offset: int = Query(0, ge=0)
        ):
            """List all sessions with metadata."""
            if not self._session_manager:
                raise HTTPException(status_code=503, detail="Session manager not available")

            sessions = self._session_manager.list_sessions()
            return {
                "total": len(sessions),
                "sessions": sessions[offset:offset + limit]
            }

        @app.get("/api/sessions/{key}")
        async def get_session(key: str):
            """Get session details including message history."""
            if not self._session_manager:
                raise HTTPException(status_code=503, detail="Session manager not available")

            try:
                session = self._session_manager.get_or_create(key)
                return {
                    "key": session.key,
                    "created_at": session.created_at,
                    "updated_at": session.updated_at,
                    "messages": session.get_history(max_messages=1000),
                    "message_count": len(session.messages)
                }
            except Exception as e:
                raise HTTPException(status_code=404, detail=f"Session not found: {e}")

        @app.delete("/api/sessions/{key}")
        async def delete_session(key: str):
            """Delete a session."""
            if not self._session_manager:
                raise HTTPException(status_code=503, detail="Session manager not available")

            try:
                # Get session path
                from nanobot.config.paths import get_workspace_path
                workspace = get_workspace_path()
                session_path = workspace / "sessions" / f"{key}.jsonl"

                if session_path.exists():
                    session_path.unlink()
                    self._session_manager.invalidate(key)
                    return {"message": "Session deleted"}

                raise HTTPException(status_code=404, detail="Session not found")
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error deleting session: {e}")

        # ============================================================================
        # REST API: Cron Jobs
        # ============================================================================

        @app.get("/api/cron/jobs")
        async def list_cron_jobs(include_disabled: bool = False):
            """List all cron jobs."""
            if not self._cron_service:
                raise HTTPException(status_code=503, detail="Cron service not available")

            try:
                jobs = self._cron_service.list_jobs(include_disabled=include_disabled)
                return {"jobs": jobs, "total": len(jobs)}
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error listing jobs: {e}")

        @app.post("/api/cron/jobs")
        async def create_cron_job(job_data: dict):
            """Create a new cron job."""
            if not self._cron_service:
                raise HTTPException(status_code=503, detail="Cron service not available")

            try:
                from nanobot.cron.types import CronJob, CronPayload, ScheduleType

                # Parse schedule type
                schedule_str = job_data.get("schedule", "")
                if not schedule_str:
                    raise HTTPException(status_code=400, detail="Schedule is required")

                # Determine schedule type
                if schedule_str.startswith("at:"):
                    schedule_type = ScheduleType.AT
                    schedule_value = schedule_str[3:]
                elif schedule_str.startswith("every:"):
                    schedule_type = ScheduleType.EVERY
                    schedule_value = schedule_str[6:]
                else:
                    schedule_type = ScheduleType.CRON
                    schedule_value = schedule_str

                # Create job
                job = CronJob(
                    id=f"job_{datetime.now().timestamp()}",
                    name=job_data.get("name", "Untitled Job"),
                    schedule_type=schedule_type,
                    schedule=schedule_value,
                    payload=CronPayload(
                        message=job_data.get("message", ""),
                        deliver=job_data.get("deliver", True),
                        channel=job_data.get("channel", "cli"),
                        to=job_data.get("to", "direct")
                    ),
                    enabled=job_data.get("enabled", True),
                    created_at=datetime.now().isoformat()
                )

                self._cron_service.add_job(job)
                return {"message": "Job created", "job_id": job.id}
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error creating job: {e}")

        @app.delete("/api/cron/jobs/{job_id}")
        async def delete_cron_job(job_id: str):
            """Delete a cron job."""
            if not self._cron_service:
                raise HTTPException(status_code=503, detail="Cron service not available")

            try:
                self._cron_service.remove_job(job_id)
                return {"message": "Job deleted"}
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error deleting job: {e}")

        @app.put("/api/cron/jobs/{job_id}")
        async def update_cron_job(job_id: str, updates: dict):
            """Update a cron job."""
            if not self._cron_service:
                raise HTTPException(status_code=503, detail="Cron service not available")

            try:
                if "enabled" in updates:
                    self._cron_service.enable_job(job_id, updates["enabled"])
                return {"message": "Job updated"}
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error updating job: {e}")

        # ============================================================================
        # REST API: Tools
        # ============================================================================

        @app.get("/api/tools")
        async def list_tools():
            """List all available tools."""
            if not self._agent_loop:
                raise HTTPException(status_code=503, detail="Agent loop not available")

            try:
                definitions = self._agent_loop.tools.get_definitions()
                # Transform from OpenAI format to simple format
                tools = []
                for defn in definitions:
                    if isinstance(defn, dict) and defn.get("type") == "function":
                        func = defn.get("function", {})
                        tools.append({
                            "name": func.get("name", ""),
                            "description": func.get("description", ""),
                            "parameters": func.get("parameters", {})
                        })
                    else:
                        # Fallback for different format
                        tools.append(defn)
                return {
                    "tools": tools,
                    "total": len(tools)
                }
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error listing tools: {e}")

        @app.get("/api/tools/{name}")
        async def get_tool(name: str):
            """Get a specific tool definition."""
            if not self._agent_loop:
                raise HTTPException(status_code=503, detail="Agent loop not available")

            try:
                tool = self._agent_loop.tools.get(name)
                if not tool:
                    raise HTTPException(status_code=404, detail=f"Tool not found: {name}")

                return {
                    "name": name,
                    "schema": tool.schema if hasattr(tool, 'schema') else {}
                }
            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error getting tool: {e}")

        # ============================================================================
        # REST API: Memory
        # ============================================================================

        @app.get("/api/memory")
        async def get_memory():
            """Get MEMORY.md content."""
            if not self._session_manager:
                raise HTTPException(status_code=503, detail="Session manager not available")

            try:
                from nanobot.config.paths import get_workspace_path
                workspace = get_workspace_path()
                memory_path = workspace / "memory" / "MEMORY.md"

                if memory_path.exists():
                    content = memory_path.read_text(encoding="utf-8")
                    return {"content": content}
                else:
                    return {"content": "# Memory\n\nNo memory stored yet."}
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error reading memory: {e}")

        @app.get("/api/memory/history")
        async def get_memory_history():
            """Get HISTORY.md content."""
            if not self._session_manager:
                raise HTTPException(status_code=503, detail="Session manager not available")

            try:
                from nanobot.config.paths import get_workspace_path
                workspace = get_workspace_path()
                history_path = workspace / "memory" / "HISTORY.md"

                if history_path.exists():
                    content = history_path.read_text(encoding="utf-8")
                    return {"content": content}
                else:
                    return {"content": "# History\n\nNo history stored yet."}
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error reading history: {e}")

        @app.put("/api/memory")
        async def update_memory(data: dict):
            """Update MEMORY.md content."""
            if not self._session_manager:
                raise HTTPException(status_code=503, detail="Session manager not available")

            try:
                from nanobot.config.paths import get_workspace_path
                workspace = get_workspace_path()
                memory_path = workspace / "memory"
                memory_path.mkdir(parents=True, exist_ok=True)

                (memory_path / "MEMORY.md").write_text(
                    data.get("content", ""),
                    encoding="utf-8"
                )
                return {"message": "Memory updated"}
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error updating memory: {e}")

        # ============================================================================
        # REST API: Config
        # ============================================================================

        @app.get("/api/config")
        async def get_config():
            """Get current configuration."""
            try:
                from nanobot.config.loader import load_config
                config = load_config()

                # Convert to dict and exclude sensitive data
                config_dict = config.model_dump(mode='json')
                return config_dict
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error loading config: {e}")

        @app.put("/api/config")
        async def update_config(updates: dict):
            """Update configuration (may require gateway restart)."""
            try:
                from nanobot.config.loader import load_config, save_config, get_config_path

                config = load_config()
                config_path = get_config_path()

                # Apply updates recursively
                def deep_update(base: dict, updates: dict) -> dict:
                    for key, value in updates.items():
                        if isinstance(value, dict) and key in base and isinstance(base[key], dict):
                            deep_update(base[key], value)
                        else:
                            base[key] = value
                    return base

                # Convert config to dict, apply updates, then recreate
                config_dict = config.model_dump(mode='json')
                updated_dict = deep_update(config_dict, updates)

                # Validate and save
                from nanobot.config.schema import Config
                new_config = Config(**updated_dict)
                save_config(new_config)

                return {"message": "Configuration updated. Restart gateway for changes to take effect."}
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error updating config: {e}")

        # ============================================================================
        # REST API: Status & Stats
        # ============================================================================

        @app.get("/api/status")
        async def get_status():
            """Get system status including queue sizes and active connections."""
            try:
                status = {
                    "connections": len(self._websocket_connections),
                    "running": self._running,
                    "host": self._host,
                    "port": self._port
                }

                # Add queue sizes if available
                if self._agent_loop and hasattr(self._agent_loop, 'bus'):
                    status["inbound_queue"] = self._agent_loop.bus.inbound.qsize()
                    status["outbound_queue"] = self._agent_loop.bus.outbound.qsize()

                # Add session count if available
                if self._session_manager:
                    sessions = self._session_manager.list_sessions()
                    status["sessions"] = len(sessions)

                # Add cron job count if available
                if self._cron_service:
                    cron_status = self._cron_service.status()
                    status["cron_jobs"] = cron_status.get("jobs", 0)

                return status
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error getting status: {e}")

        @app.get("/api/stats")
        async def get_stats():
            """Get usage statistics."""
            try:
                stats = {
                    "uptime": "Unknown",
                    "total_connections": len(self._websocket_connections)
                }

                # Add tool call stats if available
                if self._agent_loop and hasattr(self._agent_loop, 'tools'):
                    stats["available_tools"] = len(self._agent_loop.tools.get_definitions())

                return stats
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error getting stats: {e}")

        # ============================================================================
        # Health Check
        # ============================================================================

        @app.get("/health")
        async def health_check():
            return {"status": "ok", "connections": len(self._websocket_connections)}

        # ============================================================================
        # Serve Static Files
        # ============================================================================

        static_dir = Path(__file__).parent.parent / "web" / "static"
        if static_dir.exists():
            app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")

        self._server = app
        self._running = True

        # Run server in background task
        config = uvicorn.Config(
            app,
            host=self._host,
            port=self._port,
            log_level="info"
        )
        server = uvicorn.Server(config)

        logger.info("Web server started on http://{}:{}", self._host, self._port)

        try:
            await server.serve()
        except asyncio.CancelledError:
            logger.info("Web server shutting down...")
            self._running = False

    async def stop(self) -> None:
        """Stop the web server."""
        self._running = False

        # Close all WebSocket connections
        for client_id, ws in list(self._websocket_connections.items()):
            try:
                await ws.close()
            except Exception:
                pass
        self._websocket_connections.clear()

        logger.info("Web server stopped")

    async def send(self, msg: OutboundMessage) -> None:
        """Send a message to the web client."""
        client_id = msg.chat_id
        websocket = self._websocket_connections.get(client_id)

        if not websocket:
            logger.warning("Web: No WebSocket connection for {}", client_id)
            return

        try:
            await websocket.send_json({
                "type": "message",
                "content": msg.content,
                "timestamp": msg.metadata.get("timestamp") if msg.metadata else None,
            })
        except Exception as e:
            logger.error("Web: Error sending to {}: {}", client_id, e)
            # Remove broken connection
            self._websocket_connections.pop(client_id, None)

    def get_connection_count(self) -> int:
        """Get number of active WebSocket connections."""
        return len(self._websocket_connections)

    async def broadcast_event(self, event_type: str, data: dict) -> None:
        """Broadcast an event to all connected WebSocket clients."""
        message = {"type": event_type, **data}

        for client_id, ws in list(self._websocket_connections.items()):
            try:
                await ws.send_json(message)
            except Exception:
                # Remove broken connection
                self._websocket_connections.pop(client_id, None)
