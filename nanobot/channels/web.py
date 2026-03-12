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
        self._channel_manager: Any = None
        self._subagent_manager: Any = None

    def set_services(self, agent_loop: Any = None, session_manager: Any = None, cron_service: Any = None, channel_manager: Any = None, subagent_manager: Any = None) -> None:
        """Set references to core services for API access."""
        self._agent_loop = agent_loop
        self._session_manager = session_manager
        self._cron_service = cron_service
        self._channel_manager = channel_manager
        self._subagent_manager = subagent_manager

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

        # ============================================================================
        # SSE Endpoint for real-time updates
        # ============================================================================

        import asyncio
        from fastapi.responses import StreamingResponse

        # SSE client queue - use asyncio.Queue for async operations
        self._sse_queues: dict[str, asyncio.Queue] = {}
        self._sse_connected: dict[str, bool] = {}

        @app.get("/sse")
        async def sse_endpoint(client_id: str = Query(None)):
            """Server-Sent Events endpoint for real-time updates."""
            import uuid

            # Use provided client_id or generate a new one
            if not client_id:
                client_id = str(uuid.uuid4())
            queue: asyncio.Queue = asyncio.Queue()

            self._sse_queues[client_id] = queue
            self._sse_connected[client_id] = True

            logger.info("SSE: Client connected: {}", client_id)

            async def event_stream():
                """Send events to the SSE client."""
                try:
                    while self._sse_connected.get(client_id, False):
                        try:
                            # Wait for events with timeout
                            data = await asyncio.wait_for(
                                queue.get(),
                                timeout=1.0
                            )
                            yield f"data: {data}\n\n"
                        except asyncio.TimeoutError:
                            # Send keep-alive ping every second
                            yield "data: {\"type\":\"ping\"}\n\n"
                except asyncio.CancelledError:
                    pass
                finally:
                    self._sse_connected.pop(client_id, None)
                    self._sse_queues.pop(client_id, None)
                    logger.info("SSE: Client disconnected: {}", client_id)

            return StreamingResponse(
                event_stream(),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no",
                },
            )

        @app.post("/api/message")
        async def send_message(request: dict):
            """Send a message via SSE with streaming support."""
            content = request.get("content", "")
            if not content:
                raise HTTPException(status_code=400, detail="Content is required")

            sender_id = request.get("sender_id", "web")
            chat_id = request.get("chat_id", "web")
            sse_client_id = request.get("sse_client_id", "")

            logger.info("Web: Message from {}: {}", sender_id, content[:100])

            # Create progress callback for streaming (sends only to the requesting client)
            async def progress_callback(text: str, tool_hint: bool = False):
                """Send progress updates via SSE to the specific client."""
                if not sse_client_id:
                    return
                message = json.dumps({
                    "type": "progress",
                    "content": text,
                    "tool_hint": tool_hint
                })
                # Send only to the specific client that requested this
                queue = self._sse_queues.get(sse_client_id)
                if queue and self._sse_connected.get(sse_client_id):
                    await queue.put(message)

            # If agent loop is available, use it directly with progress callback
            if self._agent_loop:
                from nanobot.bus.events import InboundMessage

                # Check permissions
                if not self.is_allowed(sender_id):
                    raise HTTPException(status_code=403, detail="Access denied")

                msg = InboundMessage(
                    channel=self.name,
                    sender_id=str(sender_id),
                    chat_id=str(chat_id),
                    content=content,
                    metadata={"sse_client_id": sse_client_id} if sse_client_id else {},
                )

                # Process message with progress callback for streaming
                response = await self._agent_loop._process_message(
                    msg,
                    on_progress=progress_callback
                )

                if response:
                    # Send the final response via SSE to the specific client
                    message_data = json.dumps({
                        "type": "message",
                        "content": response.content,
                        "timestamp": response.metadata.get("timestamp") if response.metadata else None,
                    })
                    queue = self._sse_queues.get(sse_client_id)
                    if queue and self._sse_connected.get(sse_client_id):
                        await queue.put(message_data)
            else:
                # Fallback to message bus (no streaming)
                await self._handle_message(
                    sender_id=sender_id,
                    chat_id=chat_id,
                    content=content,
                    metadata={"sse_client_id": sse_client_id}
                )

            return {"status": "sent"}

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
            # Add message_count to each session by counting lines in the file
            for session in sessions:
                try:
                    session_path = session.get("path")
                    if session_path:
                        with open(session_path, encoding="utf-8") as f:
                            # Count non-empty lines, excluding the metadata line
                            count = 0
                            for line in f:
                                line = line.strip()
                                if line:
                                    try:
                                        data = json.loads(line)
                                        if data.get("_type") != "metadata":
                                            count += 1
                                    except json.JSONDecodeError:
                                        pass
                            session["message_count"] = count
                except Exception:
                    session["message_count"] = 0

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
        # REST API: Channels
        # ============================================================================

        @app.get("/api/channels/status")
        async def get_channels_status():
            """Get status of all communication channels."""
            try:
                if not self._channel_manager:
                    return {"channels": []}

                channel_status = self._channel_manager.get_status()
                channels = []

                for name, status_info in channel_status.items():
                    # Map backend status to frontend expected status
                    running = status_info.get("running", False)
                    enabled = status_info.get("enabled", True)

                    if not enabled:
                        status = "disconnected"
                    elif running:
                        status = "connected"
                    elif status_info.get("error"):
                        status = "error"
                    else:
                        status = "disconnected"

                    channels.append({
                        "id": name,
                        "name": name.capitalize(),
                        "status": status,
                        "messagesSent": status_info.get("messages_sent", 0),
                        "messagesReceived": status_info.get("messages_received", 0),
                        "lastActivity": status_info.get("last_activity"),
                        "error": status_info.get("error"),
                    })

                return {"channels": channels}
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error getting channels status: {e}")

        # ============================================================================
        # REST API: Skills
        # ============================================================================

        @app.get("/api/skills")
        async def list_skills():
            """List available skills from the skills directory."""
            try:
                from nanobot.config.paths import get_workspace_path
                workspace = get_workspace_path()
                skills_dir = workspace / "skills"

                skills = []
                if skills_dir.exists():
                    for skill_file in skills_dir.glob("*.md"):
                        try:
                            content = skill_file.read_text(encoding="utf-8")
                            # Extract skill name from first heading
                            name = skill_file.stem
                            description = ""

                            # Parse frontmatter or first heading
                            lines = content.split("\n")
                            for line in lines:
                                if line.startswith("# "):
                                    name = line[2:].strip()
                                    break

                            # Get first paragraph as description
                            in_content = False
                            for i, line in enumerate(lines):
                                if not in_content and line.startswith("# "):
                                    in_content = True
                                elif in_content and line.strip() and not line.startswith("#"):
                                    description = line.strip()
                                    break

                            # Extract triggers if present
                            triggers = []
                            for line in lines:
                                if "trigger:" in line.lower() or "触发:" in line:
                                    trigger_parts = line.split(":")
                                    if len(trigger_parts) > 1:
                                        triggers.extend([t.strip() for t in trigger_parts[1].split(",")])

                            skills.append({
                                "id": skill_file.stem,
                                "name": name,
                                "description": description,
                                "triggers": triggers,
                                "source": str(skill_file.relative_to(workspace)),
                            })
                        except Exception as e:
                            logger.warning("Failed to parse skill file {}: {}", skill_file, e)

                return {"skills": skills, "total": len(skills)}
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error listing skills: {e}")

        @app.get("/api/skills/{skill_id}/source")
        async def get_skill_source(skill_id: str):
            """Get the source code of a specific skill."""
            try:
                from nanobot.config.paths import get_workspace_path
                workspace = get_workspace_path()
                skill_file = workspace / "skills" / f"{skill_id}.md"

                if not skill_file.exists():
                    raise HTTPException(status_code=404, detail=f"Skill not found: {skill_id}")

                content = skill_file.read_text(encoding="utf-8")
                return {"content": content, "file": str(skill_file)}
            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error reading skill: {e}")

        # ============================================================================
        # REST API: Subagent Tasks
        # ============================================================================

        @app.get("/api/subagents/tasks")
        async def list_subagent_tasks():
            """List running subagent tasks."""
            try:
                if not self._subagent_manager:
                    return {"tasks": []}

                tasks = self._subagent_manager.get_all_tasks()
                return {"tasks": tasks}
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error listing subagent tasks: {e}")

        @app.get("/api/subagents/tasks/{task_id}")
        async def get_subagent_task(task_id: str):
            """Get a specific subagent task."""
            try:
                if not self._subagent_manager:
                    raise HTTPException(status_code=503, detail="Subagent manager not available")

                task = self._subagent_manager.get_task(task_id)
                if not task:
                    raise HTTPException(status_code=404, detail=f"Task not found: {task_id}")

                return task
            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error getting task: {e}")

        @app.delete("/api/subagents/tasks/{task_id}")
        async def cancel_subagent_task(task_id: str):
            """Cancel a running subagent task."""
            try:
                if not self._subagent_manager:
                    raise HTTPException(status_code=503, detail="Subagent manager not available")

                success = self._subagent_manager.cancel_task(task_id)
                if not success:
                    raise HTTPException(status_code=404, detail=f"Task not found or already completed: {task_id}")

                return {"message": "Task cancelled"}
            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error cancelling task: {e}")

        # ============================================================================
        # REST API: MCP Servers
        # ============================================================================

        @app.get("/api/mcp/servers")
        async def list_mcp_servers():
            """List connected MCP servers and their tools."""
            try:
                if not self._agent_loop or not hasattr(self._agent_loop, 'tools'):
                    return {"servers": []}

                # Get MCP tools from the agent loop
                tools = self._agent_loop.tools.get_definitions()
                mcp_tools = {}

                for tool_def in tools:
                    if isinstance(tool_def, dict):
                        func = tool_def.get("function", {})
                        tool_name = func.get("name", "")
                        # Check if this is an MCP tool (usually has specific patterns)
                        if "mcp_" in tool_name or hasattr(func.get("parameters", {}), "mcp_server"):
                            server_name = func.get("parameters", {}).get("mcp_server", "unknown")
                            if server_name not in mcp_tools:
                                mcp_tools[server_name] = []
                            mcp_tools[server_name].append({
                                "name": tool_name,
                                "description": func.get("description", "")
                            })

                servers = []
                for server_name, tools_list in mcp_tools.items():
                    servers.append({
                        "id": server_name,
                        "name": server_name,
                        "status": "connected",
                        "toolCount": len(tools_list),
                        "tools": [t["name"] for t in tools_list],
                    })

                return {"servers": servers}
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error listing MCP servers: {e}")

        # ============================================================================
        # Health Check
        # ============================================================================

        @app.get("/health")
        async def health_check():
            return {"status": "ok", "connections": len(self._websocket_connections)}

        # ============================================================================
        # Serve Static Files (Dashboard)
        # ============================================================================

        from fastapi.responses import FileResponse

        dashboard_dist = Path(__file__).parent.parent / "web" / "dashboard" / "dist"
        index_path = dashboard_dist / "index.html" if dashboard_dist.exists() else None

        if dashboard_dist.exists():
            # Serve static assets
            @app.get("/assets/{file_path:path}")
            async def serve_asset(file_path: str):
                """Serve static assets from the dist directory."""
                asset_path = dashboard_dist / "assets" / file_path
                if asset_path.exists() and asset_path.is_file():
                    return FileResponse(asset_path)
                raise HTTPException(status_code=404, detail="Asset not found")

            # Serve favicon
            favicon_path = dashboard_dist / "favicon.svg"
            if favicon_path.exists():
                @app.get("/favicon.svg")
                async def serve_favicon():
                    return FileResponse(favicon_path)

            # Serve index.html for root path
            @app.get("/")
            async def serve_root():
                """Serve the SPA for root path."""
                if index_path and index_path.exists():
                    return FileResponse(index_path)
                raise HTTPException(status_code=404, detail="Dashboard not found")

            # Catch-all route for SPA routing
            # This must be LAST so it only catches unmatched routes
            @app.get("/{full_path:path}")
            async def serve_spa(full_path: str):
                """Serve the SPA for all unmatched paths (client-side routing)."""
                # Skip API routes, SSE, health check, and static assets
                # These should be handled by their specific routes above
                if full_path.startswith("api/") or full_path.startswith("sse") or full_path == "health":
                    raise HTTPException(status_code=404, detail="Not found")

                # For all other paths, serve index.html for SPA routing
                if index_path and index_path.exists():
                    return FileResponse(index_path)
                raise HTTPException(status_code=404, detail="Dashboard not found")

        self._server = app
        self._running = True

        # Run server in background task
        config = uvicorn.Config(
            app,
            host=self._host,
            port=self._port,
            log_level="info",
            ws_ping_interval=20,
            ws_ping_timeout=20,
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
        """Send a message to the web client via SSE."""
        # Broadcast to all SSE clients
        import json

        message_data = json.dumps({
            "type": "message",
            "content": msg.content,
            "timestamp": msg.metadata.get("timestamp") if msg.metadata else None,
        })

        for client_id, queue in list(self._sse_queues.items()):
            if self._sse_connected.get(client_id):
                await queue.put(message_data)

        # Track sent message
        await self._track_sent()

    def get_connection_count(self) -> int:
        """Get number of active SSE connections."""
        return len(self._sse_connected)

    async def broadcast_event(self, event_type: str, data: dict) -> None:
        """Broadcast an event to all connected SSE clients."""
        import json
        message = json.dumps({"type": event_type, **data})

        for client_id, queue in list(self._sse_queues.items()):
            if self._sse_connected.get(client_id):
                await queue.put(message)
