"""skill 进化的沙箱生命周期管理（基于 Docker）"""

from __future__ import annotations

import asyncio
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional, List
from loguru import logger

from nanobot.agent.sandbox.providers.docker_sandbox import DockerSandboxEnvironment
from nanobot.agent.sandbox.providers.docker_image_builder import DockerImageBuilder
from nanobot.agent.sandbox.providers.skill_dependency_resolver import SkillDependencyResolver


class SandboxManager:
    """管理 Docker 沙箱的创建、执行和清理"""

    def __init__(self, config: Any, workspace: Path):
        """初始化沙箱管理器

        Args:
            config: SandboxConfig 配置对象
            workspace: 工作目录路径
        """
        self.config = config
        self.workspace = workspace
        self._active_sandboxes: Dict[str, Dict[str, Any]] = {}
        self._docker_env = None
        self._lock = asyncio.Lock()

    async def _get_docker_env(self) -> DockerSandboxEnvironment:
        """延迟初始化 Docker 环境"""
        if self._docker_env is None:
            self._docker_env = DockerSandboxEnvironment(self.config.docker)
        return self._docker_env

    async def create_sandbox(
        self,
        skill_name: str | None = None,
        instructions: str | None = None,
        base_image: str | None = None,
        requirements: List[str] | None = None
    ) -> str:
        """创建新的沙箱环境

        Args:
            skill_name: skill 名称
            instructions: 可选的初始化指令
            base_image: 可选的自定义基础镜像
            requirements: 可选的 Python 依赖列表

        Returns:
            沙箱 ID
        """
        async with self._lock:
            if not self.config.docker.enabled:
                raise ValueError("Docker 沙箱未启用")

            docker_env = await self._get_docker_env()

            # 创建沙箱环境
            sandbox_id = await docker_env.create(
                name=f"skill-{skill_name}" if skill_name else "nanobot-sandbox",
                instructions=instructions,
                base_image=base_image,
                requirements=requirements
            )

            # 跟踪活动沙箱
            self._active_sandboxes[sandbox_id] = {
                "created_at": datetime.now(),
                "skill_name": skill_name,
                "status": "active"
            }

            return sandbox_id

    async def create_sandbox_for_skill(
        self,
        skill_name: str,
        skill_path: Optional[Path] = None
    ) -> str:
        """为特定 skill 创建沙箱

        Args:
            skill_name: skill 名称
            skill_path: skill 目录路径（默认为 workspace/skills/{skill_name}）

        Returns:
            沙箱 ID
        """
        if skill_path is None:
            skill_path = self.workspace / "skills" / skill_name

        skill_path = Path(skill_path)

        # 解析 skill 依赖
        resolver = SkillDependencyResolver()
        deps = resolver.parse_skill_dependencies(skill_path)

        logger.info(f"为 skill '{skill_name}' 创建沙箱, 依赖类型: {deps['image_type']}")

        # 根据镜像类型决定如何创建沙箱
        if deps["image_type"] == "prebuilt" and deps.get("prebuilt_image"):
            # 使用预构建镜像
            return await self.create_sandbox(
                skill_name=skill_name,
                base_image=deps["prebuilt_image"]
            )
        elif deps["image_type"] == "custom" and deps.get("dockerfile"):
            # 从 Dockerfile 构建
            dockerfile_path = skill_path / deps["dockerfile"]
            image_tag = f"nanobot/{skill_name}:latest"

            logger.info(f"从 Dockerfile 构建镜像: {dockerfile_path}")
            builder = DockerImageBuilder()
            await builder.build_from_dockerfile(
                str(dockerfile_path),
                image_tag
            )

            return await self.create_sandbox(
                skill_name=skill_name,
                base_image=image_tag
            )
        else:
            # 动态安装依赖（默认）
            python_deps = deps["python"]
            if not python_deps:
                python_deps = resolver.get_requirements_txt(skill_path)

            return await self.create_sandbox(
                skill_name=skill_name,
                base_image=deps.get("base_image"),
                requirements=python_deps
            )

    async def execute_in_sandbox(
        self,
        sandbox_id: str,
        command: str,
        timeout: int | None = None,
        workdir: str | None = None
    ) -> str:
        """在沙箱中执行命令

        Args:
            sandbox_id: 沙箱 ID
            command: 要执行的命令
            timeout: 超时时间（秒）
            workdir: 工作目录

        Returns:
            命令输出（stdout + stderr）
        """
        if sandbox_id not in self._active_sandboxes:
            raise ValueError(f"沙箱 {sandbox_id} 未找到")

        docker_env = await self._get_docker_env()
        timeout = timeout or self.config.docker.timeout

        result = await docker_env.execute(
            sandbox_id,
            command,
            timeout=timeout,
            workdir=workdir
        )

        # 更新沙箱状态
        self._active_sandboxes[sandbox_id]["last_used"] = datetime.now()

        # 返回合并的输出
        return result["stdout"] + result["stderr"]

    async def clone_repo_to_sandbox(
        self,
        sandbox_id: str,
        repo_url: str,
        branch: str = "main",
        target_dir: str = "/workspace/skill"
    ) -> str:
        """将 git 仓库克隆到沙箱

        Args:
            sandbox_id: 沙箱 ID
            repo_url: Git 仓库 URL
            branch: 分支名称
            target_dir: 目标目录

        Returns:
            结果消息
        """
        # 确保目标目录的父目录存在
        await self.execute_in_sandbox(
            sandbox_id,
            f"mkdir -p {Path(target_dir).parent}"
        )

        # 克隆仓库
        command = f"git clone --depth 1 --branch {branch} {repo_url} {target_dir}"
        result = await self.execute_in_sandbox(sandbox_id, command, timeout=120)

        if "fatal" in result.lower():
            raise RuntimeError(f"克隆仓库失败: {result}")

        return f"仓库已克隆到 {target_dir}"

    async def upload_file_to_sandbox(
        self,
        sandbox_id: str,
        local_path: str,
        remote_path: str
    ) -> str:
        """上传文件到沙箱

        Args:
            sandbox_id: 沙箱 ID
            local_path: 本地文件路径
            remote_path: 远程文件路径

        Returns:
            结果消息
        """
        if sandbox_id not in self._active_sandboxes:
            raise ValueError(f"沙箱 {sandbox_id} 未找到")

        docker_env = await self._get_docker_env()

        await docker_env.upload(
            sandbox_id,
            local_path,
            remote_path
        )

        return f"文件已上传到 {remote_path}"

    async def download_file_from_sandbox(
        self,
        sandbox_id: str,
        remote_path: str,
        local_path: str
    ) -> str:
        """从沙箱下载文件

        Args:
            sandbox_id: 沙箱 ID
            remote_path: 远程文件路径
            local_path: 本地文件路径

        Returns:
            结果消息
        """
        if sandbox_id not in self._active_sandboxes:
            raise ValueError(f"沙箱 {sandbox_id} 未找到")

        docker_env = await self._get_docker_env()

        await docker_env.download(
            sandbox_id,
            remote_path,
            local_path
        )

        return f"文件已下载到 {local_path}"

    async def destroy_sandbox(self, sandbox_id: str) -> None:
        """销毁沙箱环境

        Args:
            sandbox_id: 沙箱 ID
        """
        async with self._lock:
            if sandbox_id not in self._active_sandboxes:
                return

            docker_env = await self._get_docker_env()

            try:
                await docker_env.destroy(sandbox_id)
            except Exception as e:
                # 记录错误但继续清理
                logger.error(f"销毁沙箱时出错: {e}")

            del self._active_sandboxes[sandbox_id]

    async def cleanup_idle_sandboxes(self, max_idle_minutes: int = 30) -> int:
        """清理空闲沙箱

        Args:
            max_idle_minutes: 最大空闲时间（分钟）

        Returns:
            清理的沙箱数量
        """
        now = datetime.now()
        to_destroy = []

        for sandbox_id, info in self._active_sandboxes.items():
            last_used = info.get("last_used", info["created_at"])
            idle_time = (now - last_used).total_seconds() / 60

            if idle_time > max_idle_minutes:
                to_destroy.append(sandbox_id)

        for sandbox_id in to_destroy:
            await self.destroy_sandbox(sandbox_id)

        return len(to_destroy)

    def get_active_sandboxes(self) -> Dict[str, Dict[str, Any]]:
        """获取活动沙箱列表"""
        return self._active_sandboxes.copy()
