"""沙箱执行工具，用于安全的 skill 进化"""

from typing import Any
from loguru import logger

from nanobot.agent.tools.base import Tool


class SandboxTool(Tool):
    """在隔离的 Docker 沙箱环境中执行任务

    此工具提供安全的沙箱环境，用于：
    - 测试 skill 修改
    - 执行不受信任的代码
    - 隔离环境依赖
    """

    def __init__(self, manager: "SandboxManager"):
        """初始化沙箱工具

        Args:
            manager: SandboxManager 实例
        """
        self.manager = manager

    @property
    def name(self) -> str:
        return "sandbox"

    @property
    def description(self) -> str:
        return """在隔离的 Docker 沙箱中执行任务以实现安全的 skill 进化。

支持的沙箱操作：
- create: 创建新的沙箱环境
- create_for_skill: 为特定 skill 创建沙箱（自动解析依赖）
- execute: 在沙箱中运行命令
- clone_repo: 将 git 仓库克隆到沙箱
- destroy: 销毁沙箱
- upload_file: 上传文件到沙箱
- download_file: 从沙箱下载文件
- list: 列出活动沙箱

在应用更改前用于安全地测试 skill 修改。

使用示例：
- 创建沙箱：create(skill_name="test")
- 执行命令：execute(sandbox_id="sb-xxx", command="ls -la")
- 克隆仓库：clone_repo(sandbox_id="sb-xxx", repo_url="https://github.com/user/repo.git")
"""

    @property
    def parameters(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "operation": {
                    "type": "string",
                    "enum": [
                        "create",
                        "create_for_skill",
                        "execute",
                        "clone_repo",
                        "destroy",
                        "upload_file",
                        "download_file",
                        "list"
                    ],
                    "description": "要执行的沙箱操作"
                },
                "sandbox_id": {
                    "type": "string",
                    "description": "沙箱标识符（由 create 返回）"
                },
                "skill_name": {
                    "type": "string",
                    "description": "Skill 名称（用于 create 或 create_for_skill 操作）"
                },
                "command": {
                    "type": "string",
                    "description": "要执行的命令（用于 execute 操作）"
                },
                "repo_url": {
                    "type": "string",
                    "description": "Git 仓库 URL（用于 clone_repo 操作）"
                },
                "branch": {
                    "type": "string",
                    "description": "要克隆的分支（默认: main）"
                },
                "local_path": {
                    "type": "string",
                    "description": "本地文件路径（用于 upload/download 操作）"
                },
                "remote_path": {
                    "type": "string",
                    "description": "沙箱中的文件路径（用于 upload/download 操作）"
                },
                "workdir": {
                    "type": "string",
                    "description": "命令执行的工作目录"
                },
                "timeout": {
                    "type": "integer",
                    "description": "超时时间（秒，默认: 300）"
                }
            },
            "required": ["operation"]
        }

    async def execute(
        self,
        operation: str,
        sandbox_id: str | None = None,
        skill_name: str | None = None,
        command: str | None = None,
        repo_url: str | None = None,
        branch: str = "main",
        local_path: str | None = None,
        remote_path: str | None = None,
        workdir: str | None = None,
        timeout: int | None = None,
        **kwargs
    ) -> str:
        """执行沙箱操作"""

        try:
            if operation == "create":
                return await self._create_sandbox(skill_name, **kwargs)

            elif operation == "create_for_skill":
                return await self._create_sandbox_for_skill(skill_name, **kwargs)

            elif operation == "execute":
                return await self._execute_in_sandbox(
                    sandbox_id, command, workdir, timeout
                )

            elif operation == "clone_repo":
                return await self._clone_repo(
                    sandbox_id, repo_url, branch
                )

            elif operation == "destroy":
                await self._destroy_sandbox(sandbox_id)
                return f"沙箱 {sandbox_id} 已销毁"

            elif operation == "upload_file":
                return await self._upload_file(
                    sandbox_id, local_path, remote_path
                )

            elif operation == "download_file":
                return await self._download_file(
                    sandbox_id, remote_path, local_path
                )

            elif operation == "list":
                return self._list_sandboxes()

            else:
                return f"未知操作: {operation}"

        except Exception as e:
            logger.error(f"沙箱操作失败: {e}")
            return f"错误: {str(e)}"

    async def _create_sandbox(
        self,
        skill_name: str | None = None,
        **kwargs
    ) -> str:
        """创建新的沙箱环境"""
        sandbox_id = await self.manager.create_sandbox(
            skill_name=skill_name
        )
        return f"沙箱已创建: {sandbox_id}"

    async def _create_sandbox_for_skill(
        self,
        skill_name: str,
        **kwargs
    ) -> str:
        """为特定 skill 创建沙箱（自动解析依赖）"""
        sandbox_id = await self.manager.create_sandbox_for_skill(
            skill_name=skill_name
        )
        return f"沙箱已创建: {sandbox_id}"

    async def _execute_in_sandbox(
        self,
        sandbox_id: str | None,
        command: str | None,
        workdir: str | None,
        timeout: int | None
    ) -> str:
        """在沙箱中执行命令"""
        if not sandbox_id:
            return "错误: execute 操作需要 sandbox_id"
        if not command:
            return "错误: execute 操作需要 command"

        return await self.manager.execute_in_sandbox(
            sandbox_id, command, timeout, workdir
        )

    async def _clone_repo(
        self,
        sandbox_id: str | None,
        repo_url: str | None,
        branch: str
    ) -> str:
        """克隆 git 仓库到沙箱"""
        if not sandbox_id or not repo_url:
            return "错误: clone_repo 需要 sandbox_id 和 repo_url"

        return await self.manager.clone_repo_to_sandbox(
            sandbox_id, repo_url, branch
        )

    async def _upload_file(
        self,
        sandbox_id: str | None,
        local_path: str | None,
        remote_path: str | None
    ) -> str:
        """上传文件到沙箱"""
        if not sandbox_id or not local_path or not remote_path:
            return "错误: upload_file 需要 sandbox_id, local_path, remote_path"

        return await self.manager.upload_file_to_sandbox(
            sandbox_id, local_path, remote_path
        )

    async def _download_file(
        self,
        sandbox_id: str | None,
        remote_path: str | None,
        local_path: str | None
    ) -> str:
        """从沙箱下载文件"""
        if not sandbox_id or not remote_path or not local_path:
            return "错误: download_file 需要 sandbox_id, remote_path, local_path"

        return await self.manager.download_file_from_sandbox(
            sandbox_id, remote_path, local_path
        )

    async def _destroy_sandbox(self, sandbox_id: str | None) -> None:
        """销毁沙箱"""
        if not sandbox_id:
            raise ValueError("destroy 操作需要 sandbox_id")

        await self.manager.destroy_sandbox(sandbox_id)

    def _list_sandboxes(self) -> str:
        """列出活动沙箱"""
        sandboxes = self.manager.get_active_sandboxes()

        if not sandboxes:
            return "当前没有活动沙箱"

        lines = ["活动沙箱列表:"]
        for sb_id, info in sandboxes.items():
            skill_name = info.get("skill_name", "未知")
            created = info.get("created_at", "未知")
            lines.append(f"- {sb_id}: skill={skill_name}, 创建于={created}")

        return "\n".join(lines)
