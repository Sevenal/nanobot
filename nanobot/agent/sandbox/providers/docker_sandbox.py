"""Docker 沙箱提供商

本模块实现 Docker 沙箱环境管理，参考 Open-SWE 的 SandboxEnvironment 接口设计，
但使用本地 Docker daemon 而非云端提供商。
"""

from __future__ import annotations

import asyncio
import json
import uuid
from pathlib import Path
from typing import Optional, Dict, Any, List
from datetime import datetime
from loguru import logger


class DockerSandboxEnvironment:
    """Docker 沙箱环境实现

    参考 Open-SWE 的 SandboxEnvironment 接口设计，使用本地 Docker。
    支持动态依赖安装和预构建镜像。
    """

    def __init__(self, config: Any):
        """初始化 Docker 沙箱环境

        Args:
            config: 沙箱配置对象，需包含以下属性:
                - base_image: 基础镜像
                - workspace_path: 工作目录
                - host_workspace: 宿主机挂载目录
                - common_packages: 常用 Python 包
                - common_tools: 常用系统工具
                - timeout: 默认超时时间
        """
        self.config = config
        self.base_image = getattr(config, "base_image", "python:3.11-slim")
        self.workspace_path = getattr(config, "workspace_path", "/workspace")
        self.host_workspace = getattr(config, "host_workspace", "/tmp/nanobot-sandbox")
        self.common_packages = getattr(config, "common_packages", [])
        self.common_tools = getattr(config, "common_tools", [])
        self.default_timeout = getattr(config, "timeout", 300)
        self._containers: Dict[str, Dict] = {}
        self._lock = asyncio.Lock()

    async def create(
        self,
        name: str,
        instructions: Optional[str] = None,
        base_image: Optional[str] = None,
        requirements: Optional[List[str]] = None
    ) -> str:
        """创建新的沙箱环境

        Args:
            name: 沙箱名称
            instructions: 可选的初始化指令
            base_image: 可选的自定义基础镜像
            requirements: 可选的 Python 依赖列表

        Returns:
            沙箱 ID
        """
        async with self._lock:
            container_id = f"sb-{uuid.uuid4().hex[:8]}"
            container_name = f"nanobot-{name}-{container_id}"

            # 使用自定义镜像或默认镜像
            image = base_image or self.base_image

            # 确保宿主机工作目录存在
            Path(self.host_workspace).mkdir(parents=True, exist_ok=True)

            logger.info(f"创建 Docker 容器: {container_name}, 镜像: {image}")

            # 启动 Docker 容器
            cmd = [
                "docker", "run", "-d",
                "--name", container_name,
                "-v", f"{self.host_workspace}:{self.workspace_path}",
                "-w", self.workspace_path,
                image,
                "sleep", "infinity"  # 保持容器运行
            ]

            result = await self._run_command(cmd)

            if result.returncode != 0:
                raise RuntimeError(f"创建容器失败: {result.stderr}")

            # 跟踪容器
            self._containers[container_id] = {
                "name": container_name,
                "image": image,
                "created_at": datetime.now(),
                "status": "running"
            }

            logger.info(f"容器创建成功: {container_id}")

            # 安装常用工具
            if self.common_tools:
                await self._install_common_tools(container_id)

            # 安装常用 Python 包
            if self.common_packages:
                await self._install_common_packages(container_id)

            # 安装特定依赖
            if requirements:
                await self._install_requirements(container_id, requirements)

            # 执行初始化指令（如果有）
            if instructions:
                await self.execute(container_id, instructions)

            return container_id

    async def _install_common_tools(self, sandbox_id: str) -> None:
        """安装常用系统工具"""
        if not self.common_tools:
            return

        tools = " ".join(self.common_tools)
        cmd = f"apt-get update && apt-get install -y {tools} && apt-get clean"

        logger.info(f"安装常用工具: {tools}")
        await self.execute(sandbox_id, cmd, timeout=300)

    async def _install_common_packages(self, sandbox_id: str) -> None:
        """安装常用 Python 包"""
        if not self.common_packages:
            return

        packages = " ".join(self.common_packages)
        cmd = f"pip install --no-cache-dir {packages}"

        logger.info(f"安装常用包: {packages}")
        await self.execute(sandbox_id, cmd, timeout=300)

    async def _install_requirements(
        self,
        sandbox_id: str,
        requirements: List[str]
    ) -> None:
        """安装 Python 依赖"""
        if not requirements:
            return

        # 创建临时 requirements.txt
        import tempfile
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='_req.txt') as f:
            f.write("\n".join(requirements))
            temp_req = f.name

        try:
            # 上传到容器
            container_name = self._containers[sandbox_id]["name"]
            cmd = ["docker", "cp", temp_req, f"{container_name}:/tmp/requirements.txt"]
            await self._run_command(cmd)

            # 安装
            cmd_str = "pip install --no-cache-dir -r /tmp/requirements.txt"
            await self.execute(sandbox_id, cmd_str, timeout=600)

            # 清理
            await self.execute(sandbox_id, "rm /tmp/requirements.txt")
        finally:
            import os
            os.unlink(temp_req)

    async def execute(
        self,
        sandbox_id: str,
        command: str,
        timeout: Optional[int] = None,
        workdir: Optional[str] = None
    ) -> Dict[str, Any]:
        """在沙箱中执行命令

        Args:
            sandbox_id: 沙箱 ID
            command: 要执行的命令
            timeout: 超时时间（秒）
            workdir: 工作目录

        Returns:
            包含执行结果的字典:
            {
                "returncode": int,
                "stdout": str,
                "stderr": str
            }
        """
        if sandbox_id not in self._containers:
            raise ValueError(f"沙箱 {sandbox_id} 未找到")

        container_name = self._containers[sandbox_id]["name"]
        timeout = timeout or self.default_timeout

        # 构建执行命令
        if workdir:
            cmd = [
                "docker", "exec",
                "-w", workdir,
                container_name,
                "sh", "-c", command
            ]
        else:
            cmd = [
                "docker", "exec",
                container_name,
                "sh", "-c", command
            ]

        result = await self._run_command(cmd, timeout=timeout)

        # 更新状态
        self._containers[sandbox_id]["last_used"] = datetime.now()

        return {
            "returncode": result.returncode,
            "stdout": result.stdout,
            "stderr": result.stderr
        }

    async def upload(
        self,
        sandbox_id: str,
        local_path: str,
        remote_path: str
    ) -> None:
        """上传文件到沙箱

        Args:
            sandbox_id: 沙箱 ID
            local_path: 本地文件路径
            remote_path: 远程文件路径
        """
        if sandbox_id not in self._containers:
            raise ValueError(f"沙箱 {sandbox_id} 未找到")

        container_name = self._containers[sandbox_id]["name"]

        # 使用 docker cp 上传文件
        cmd = [
            "docker", "cp", local_path,
            f"{container_name}:{remote_path}"
        ]

        result = await self._run_command(cmd)

        if result.returncode != 0:
            raise RuntimeError(f"上传文件失败: {result.stderr}")

        logger.debug(f"文件已上传: {local_path} -> {remote_path}")

    async def download(
        self,
        sandbox_id: str,
        remote_path: str,
        local_path: str
    ) -> None:
        """从沙箱下载文件

        Args:
            sandbox_id: 沙箱 ID
            remote_path: 远程文件路径
            local_path: 本地文件路径
        """
        if sandbox_id not in self._containers:
            raise ValueError(f"沙箱 {sandbox_id} 未找到")

        container_name = self._containers[sandbox_id]["name"]

        # 使用 docker cp 下载文件
        cmd = [
            "docker", "cp",
            f"{container_name}:{remote_path}",
            local_path
        ]

        result = await self._run_command(cmd)

        if result.returncode != 0:
            raise RuntimeError(f"下载文件失败: {result.stderr}")

        logger.debug(f"文件已下载: {remote_path} -> {local_path}")

    async def destroy(self, sandbox_id: str) -> None:
        """销毁沙箱环境

        Args:
            sandbox_id: 沙箱 ID
        """
        async with self._lock:
            if sandbox_id not in self._containers:
                return

            container_name = self._containers[sandbox_id]["name"]

            logger.info(f"销毁容器: {container_name}")

            # 停止并删除容器
            await self._run_command(["docker", "stop", container_name])
            await self._run_command(["docker", "rm", container_name])

            del self._containers[sandbox_id]

            logger.info(f"容器已销毁: {sandbox_id}")

    async def _run_command(
        self,
        cmd: list,
        timeout: int = 60
    ) -> Any:
        """运行 shell 命令"""
        import subprocess

        loop = asyncio.get_event_loop()

        def _run():
            return subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=timeout
            )

        return await loop.run_in_executor(None, _run)

    def get_active_sandboxes(self) -> Dict[str, Dict]:
        """获取活动沙箱列表"""
        return self._containers.copy()

    def get_container_status(self, sandbox_id: str) -> Optional[Dict]:
        """获取容器状态"""
        if sandbox_id not in self._containers:
            return None

        container_name = self._containers[sandbox_id]["name"]

        try:
            cmd = ["docker", "inspect", "--format", "{{json .State}}", container_name]
            result = asyncio.get_event_loop().run_until_complete(
                self._run_command(cmd, timeout=10)
            )

            if result.returncode == 0:
                return json.loads(result.stdout)
        except Exception as e:
            logger.warning(f"获取容器状态失败: {e}")

        return None
