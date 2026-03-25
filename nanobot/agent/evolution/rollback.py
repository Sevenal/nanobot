"""失败 skill 进化的回滚机制

支持基于 Git 和文件系统快照的回滚机制。
"""

import shutil
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
from loguru import logger


class RollbackManager:
    """管理失败 skill 进化的回滚

    支持两种回滚方式：
    1. Git 回滚：对于 git 仓库，使用 git commit/hash
    2. 文件系统快照：对于非 git 仓库，复制整个目录
    """

    def __init__(self, workspace: Path):
        """初始化回滚管理器

        Args:
            workspace: 工作目录路径
        """
        self.workspace = workspace
        self.rollback_history: Dict[str, List[Dict]] = {}
        self.snapshots_dir = workspace / ".snapshots"
        self.snapshots_dir.mkdir(exist_ok=True)

    async def create_rollback_point(self, skill_name: str) -> str:
        """在进化前创建回滚点

        Args:
            skill_name: skill 名称

        Returns:
            回滚点标识符（git commit hash 或快照路径）
        """
        skill_path = self.workspace / "skills" / skill_name

        if not skill_path.exists():
            raise ValueError(f"Skill 目录不存在: {skill_path}")

        # 检查是否是 git 仓库
        if (skill_path / ".git").exists():
            # 使用 git 进行回滚
            commit = await self._git_commit_before_evolution(skill_name)
            self._record_rollback_point(skill_name, "git", commit)
            logger.info(f"为 skill '{skill_name}' 创建 git 回滚点: {commit[:8]}")
            return commit
        else:
            # 使用文件系统快照
            snapshot_path = await self._create_snapshot(skill_name)
            self._record_rollback_point(skill_name, "snapshot", snapshot_path)
            logger.info(f"为 skill '{skill_name}' 创建快照: {snapshot_path}")
            return snapshot_path

    def _record_rollback_point(
        self,
        skill_name: str,
        point_type: str,
        identifier: str
    ) -> None:
        """记录回滚点

        Args:
            skill_name: skill 名称
            point_type: 回滚点类型（git 或 snapshot）
            identifier: 回滚点标识符
        """
        if skill_name not in self.rollback_history:
            self.rollback_history[skill_name] = []

        self.rollback_history[skill_name].append({
            "type": point_type,
            "identifier": identifier,
            "timestamp": datetime.now().isoformat()
        })

    async def _git_commit_before_evolution(self, skill_name: str) -> str:
        """在进化前创建 git 提交

        Args:
            skill_name: skill 名称

        Returns:
            提交 hash
        """
        skill_path = self.workspace / "skills" / skill_name

        # 添加所有文件
        subprocess.run(
            ["git", "add", "."],
            cwd=skill_path,
            capture_output=True,
            check=True
        )

        # 创建提交
        result = subprocess.run(
            ["git", "commit", "-m", f"进化前快照 - {datetime.now().isoformat()}"],
            cwd=skill_path,
            capture_output=True,
            text=True,
            check=True
        )

        # 提取提交 hash
        commit_hash = self._extract_commit_hash(result.stderr)
        return commit_hash

    def _extract_commit_hash(self, git_output: str) -> str:
        """从 git 输出中提取提交 hash

        Args:
            git_output: git 命令输出

        Returns:
            提交 hash（短格式）
        """
        import re
        match = re.search(r'\[([a-f0-9]+)\]', git_output)
        return match.group(1) if match else "unknown"

    async def _create_snapshot(self, skill_name: str) -> str:
        """创建文件系统快照

        Args:
            skill_name: skill 名称

        Returns:
            快照路径
        """
        skill_path = self.workspace / "skills" / skill_name
        skill_snapshots_dir = self.snapshots_dir / skill_name
        skill_snapshots_dir.mkdir(parents=True, exist_ok=True)

        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        snapshot_path = skill_snapshots_dir / timestamp

        # 复制整个 skill 目录
        shutil.copytree(skill_path, snapshot_path)

        return str(snapshot_path)

    async def rollback(
        self,
        skill_name: str,
        rollback_point: Optional[str] = None
    ) -> bool:
        """将 skill 回滚到之前的状态

        Args:
            skill_name: skill 名称
            rollback_point: 可选的回滚点标识符（默认使用最新的）

        Returns:
            是否回滚成功
        """
        history = self.rollback_history.get(skill_name, [])
        if not history:
            logger.warning(f"Skill '{skill_name}' 没有回滚点")
            return False

        # 使用最新的回滚点（如果未指定）
        if not rollback_point:
            record = history[-1]
            point_type = record["type"]
            rollback_point = record["identifier"]
        else:
            # 查找匹配的回滚点
            for record in reversed(history):
                if record["identifier"] == rollback_point:
                    point_type = record["type"]
                    break
            else:
                logger.warning(f"回滚点 {rollback_point} 未找到")
                return False

        logger.info(f"回滚 skill '{skill_name}' 到 {point_type}:{rollback_point}")

        if point_type == "git":
            return await self._git_rollback(skill_name, rollback_point)
        else:
            return await self._restore_snapshot(skill_name, rollback_point)

    async def _git_rollback(
        self,
        skill_name: str,
        commit_hash: str
    ) -> bool:
        """使用 git 回滚

        Args:
            skill_name: skill 名称
            commit_hash: 目标提交 hash

        Returns:
            是否回滚成功
        """
        skill_path = self.workspace / "skills" / skill_name

        try:
            subprocess.run(
                ["git", "reset", "--hard", commit_hash],
                cwd=skill_path,
                capture_output=True,
                check=True
            )
            logger.info(f"Git 回滚成功: {commit_hash[:8]}")
            return True
        except subprocess.CalledProcessError as e:
            logger.error(f"Git 回滚失败: {e}")
            return False

    async def _restore_snapshot(
        self,
        skill_name: str,
        snapshot_path: str
    ) -> bool:
        """从文件系统快照恢复

        Args:
            skill_name: skill 名称
            snapshot_path: 快照路径

        Returns:
            是否恢复成功
        """
        skill_path = self.workspace / "skills" / skill_name
        snapshot_path = Path(snapshot_path)

        if not snapshot_path.exists():
            logger.error(f"快照不存在: {snapshot_path}")
            return False

        # 备份当前状态
        backup_path = skill_path.parent / f"{skill_name}.failed"
        if backup_path.exists():
            shutil.rmtree(backup_path)
        shutil.move(str(skill_path), str(backup_path))

        try:
            # 恢复快照
            shutil.copytree(snapshot_path, skill_path)
            logger.info(f"快照恢复成功: {snapshot_path}")
            return True
        except Exception as e:
            logger.error(f"快照恢复失败: {e}")
            # 如果快照恢复失败，恢复备份
            if backup_path.exists():
                shutil.rmtree(skill_path)
                shutil.move(str(backup_path), str(skill_path))
            return False

    def get_rollback_history(self, skill_name: str) -> List[Dict]:
        """获取 skill 的回滚历史

        Args:
            skill_name: skill 名称

        Returns:
            回滚历史列表
        """
        return self.rollback_history.get(skill_name, [])

    def list_snapshots(self, skill_name: Optional[str] = None) -> List[str]:
        """列出可用的快照

        Args:
            skill_name: 可选的 skill 名称

        Returns:
            快照路径列表
        """
        if skill_name:
            skill_snapshots_dir = self.snapshots_dir / skill_name
            if skill_snapshots_dir.exists():
                return [str(p) for p in skill_snapshots_dir.iterdir() if p.is_dir()]
            return []
        else:
            snapshots = []
            for skill_dir in self.snapshots_dir.iterdir():
                if skill_dir.is_dir():
                    snapshots.extend([
                        str(p) for p in skill_dir.iterdir() if p.is_dir()
                    ])
            return snapshots
