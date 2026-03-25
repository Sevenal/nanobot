"""基于 Git 的 skills 版本管理

支持 git 仓库的初始化、分支管理、提交和回滚。
"""

import subprocess
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional, List
from loguru import logger


class GitVersionManager:
    """使用 git 管理 skill 版本

    提供：
    - Git 仓库初始化
    - 版本信息查询
    - 进化分支管理
    - 提交和合并
    - 回滚
    """

    def __init__(self, workspace: Path):
        """初始化 Git 版本管理器

        Args:
            workspace: 工作目录路径
        """
        self.workspace = workspace
        self.skills_dir = workspace / "skills"

    def get_skill_version(self, skill_name: str) -> Dict:
        """获取 skill 的当前版本信息

        Args:
            skill_name: skill 名称

        Returns:
            版本信息字典:
            {
                "type": "git" | "file",
                "commit": str,  # git commit hash
                "branch": str,  # 分支名
                "message": str,  # 提交消息
                "date": str,  # 提交日期
                "last_modified": str  # 文件修改时间
            }
        """
        skill_path = self.skills_dir / skill_name

        if not skill_path.exists():
            return {"error": "Skill 未找到"}

        # 检查 skill 是否是 git 仓库
        git_dir = skill_path / ".git"
        if git_dir.exists():
            return self._get_git_version(skill_path)
        else:
            return self._get_file_version(skill_path)

    def _get_git_version(self, skill_path: Path) -> Dict:
        """从 git 历史获取版本

        Args:
            skill_path: skill 目录路径

        Returns:
            Git 版本信息
        """
        try:
            # 获取最新提交
            result = subprocess.run(
                ["git", "log", "-1", "--format=%H|%ai|%s"],
                cwd=skill_path,
                capture_output=True,
                text=True,
                check=False
            )

            if result.returncode == 0 and result.stdout:
                parts = result.stdout.split("|")
                if len(parts) >= 3:
                    commit_hash, commit_date, commit_msg = parts[0], parts[1], parts[2]
                    return {
                        "type": "git",
                        "commit": commit_hash[:8],
                        "full_commit": commit_hash,
                        "date": commit_date,
                        "message": commit_msg,
                        "branch": self._get_current_branch(skill_path)
                    }
        except Exception as e:
            logger.warning(f"获取 git 版本失败: {e}")

        return {"type": "file", "error": "不是 git 仓库"}

    def _get_file_version(self, skill_path: Path) -> Dict:
        """从文件修改时间获取版本

        Args:
            skill_path: skill 目录路径

        Returns:
            文件版本信息
        """
        skill_file = skill_path / "SKILL.md"
        if skill_file.exists():
            mtime = datetime.fromtimestamp(skill_file.stat().st_mtime)
            return {
                "type": "file",
                "last_modified": mtime.isoformat(),
                "files": self._list_skill_files(skill_path)
            }

        return {"type": "file", "error": "SKILL.md 未找到"}

    def _get_current_branch(self, skill_path: Path) -> str:
        """获取当前分支

        Args:
            skill_path: skill 目录路径

        Returns:
            分支名
        """
        try:
            result = subprocess.run(
                ["git", "branch", "--show-current"],
                cwd=skill_path,
                capture_output=True,
                text=True,
                check=False
            )
            if result.returncode == 0:
                return result.stdout.strip()
        except Exception:
            pass

        return "unknown"

    def _list_skill_files(self, skill_path: Path) -> List[str]:
        """列出 skill 文件

        Args:
            skill_path: skill 目录路径

        Returns:
            文件列表
        """
        files = []
        for file_path in skill_path.rglob("*"):
            if file_path.is_file() and ".git" not in str(file_path):
                files.append(str(file_path.relative_to(skill_path)))
        return files

    async def init_git_repo(self, skill_path: Path) -> bool:
        """初始化 git 仓库

        Args:
            skill_path: skill 目录路径

        Returns:
            是否成功
        """
        # 创建 .gitignore
        gitignore = skill_path / ".gitignore"
        gitignore_content = """# Evolution artifacts
.evolution-*.md
.snapshots/

# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python

# Virtual environments
venv/
env/
ENV/

# IDE
.vscode/
.idea/
*.swp
*.swo
*~
"""
        gitignore.write_text(gitignore_content)

        # 初始化仓库
        try:
            subprocess.run(
                ["git", "init"],
                cwd=skill_path,
                capture_output=True,
                check=True
            )

            # 配置用户信息
            subprocess.run(
                ["git", "config", "user.email", "nanobot@localhost"],
                cwd=skill_path,
                capture_output=True,
                check=False
            )
            subprocess.run(
                ["git", "config", "user.name", "Nanobot AI"],
                cwd=skill_path,
                capture_output=True,
                check=False
            )

            # 添加所有文件
            subprocess.run(
                ["git", "add", "."],
                cwd=skill_path,
                capture_output=True,
                check=True
            )

            # 初始提交
            subprocess.run(
                ["git", "commit", "-m", "初始提交"],
                cwd=skill_path,
                capture_output=True,
                check=True
            )

            logger.info(f"Git 仓库初始化成功: {skill_path}")
            return True
        except subprocess.CalledProcessError as e:
            logger.error(f"Git 仓库初始化失败: {e}")
            return False

    async def create_evolution_branch(
        self,
        skill_name: str,
        reason: str
    ) -> tuple[str, str]:
        """为 skill 进化创建新分支

        Args:
            skill_name: skill 名称
            reason: 进化原因

        Returns:
            (分支名, skill 路径)
        """
        skill_path = self.skills_dir / skill_name

        # 如果不存在则初始化 git 仓库
        if not (skill_path / ".git").exists():
            success = await self.init_git_repo(skill_path)
            if not success:
                raise RuntimeError(f"无法初始化 git 仓库: {skill_path}")

        # 创建进化分支
        timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
        branch_name = f"evolution/{timestamp}"

        try:
            # 创建并切换到新分支
            subprocess.run(
                ["git", "checkout", "-b", branch_name],
                cwd=skill_path,
                capture_output=True,
                check=True
            )

            # 提交当前状态作为基线
            subprocess.run(
                ["git", "add", "."],
                cwd=skill_path,
                capture_output=True,
                check=True
            )

            subprocess.run(
                ["git", "commit", "-m", f"进化前基线: {reason}"],
                cwd=skill_path,
                capture_output=True,
                text=True,
                check=True
            )

            logger.info(f"创建进化分支: {branch_name}")
            return branch_name, str(skill_path)

        except subprocess.CalledProcessError as e:
            logger.error(f"创建进化分支失败: {e}")
            raise

    async def commit_evolution_changes(
        self,
        skill_path: str,
        summary: str
    ) -> str:
        """提交进化更改

        Args:
            skill_path: skill 目录路径
            summary: 更改摘要

        Returns:
            提交 hash
        """
        commit_msg = f"""进化: {summary}

时间: {datetime.now().isoformat()}

此提交由 nanobot 自动生成。"""

        try:
            # 添加所有更改
            subprocess.run(
                ["git", "add", "."],
                cwd=skill_path,
                capture_output=True,
                check=True
            )

            # 提交
            result = subprocess.run(
                ["git", "commit", "-m", commit_msg],
                cwd=skill_path,
                capture_output=True,
                text=True,
                check=True
            )

            # 提取提交 hash
            commit_hash = self._extract_commit_hash(result.stderr)

            logger.info(f"提交进化更改: {commit_hash[:8]}")
            return commit_hash

        except subprocess.CalledProcessError as e:
            logger.error(f"提交进化更改失败: {e}")
            raise

    def _extract_commit_hash(self, git_output: str) -> str:
        """从 git 输出中提取提交 hash

        Args:
            git_output: git commit 命令的 stderr 输出

        Returns:
            提交 hash（短格式）
        """
        import re
        match = re.search(r'\[([a-f0-9]+)\]', git_output)
        return match.group(1) if match else "unknown"

    async def merge_to_main(
        self,
        skill_name: str,
        branch_name: str,
        commit_hash: str
    ) -> bool:
        """将进化分支合并到主分支

        Args:
            skill_name: skill 名称
            branch_name: 进化分支名
            commit_hash: 提交 hash

        Returns:
            是否合并成功
        """
        skill_path = self.skills_dir / skill_name

        try:
            # 切换到主分支
            subprocess.run(
                ["git", "checkout", "main"],
                cwd=skill_path,
                capture_output=True,
                check=True
            )

            # 合并进化分支
            subprocess.run(
                ["git", "merge", "--no-ff", branch_name, "-m", f"合并进化 {commit_hash}"],
                cwd=skill_path,
                capture_output=True,
                check=True
            )

            logger.info(f"合并进化分支成功: {branch_name} -> main")
            return True

        except subprocess.CalledProcessError as e:
            # 合并冲突 - 回滚
            logger.error(f"合并冲突: {e}")
            subprocess.run(["git", "merge", "--abort"], cwd=skill_path)
            return False

    async def rollback_evolution(
        self,
        skill_name: str,
        previous_commit: str
    ) -> bool:
        """回滚到之前版本

        Args:
            skill_name: skill 名称
            previous_commit: 之前的提交 hash

        Returns:
            是否回滚成功
        """
        skill_path = self.skills_dir / skill_name

        try:
            subprocess.run(
                ["git", "reset", "--hard", previous_commit],
                cwd=skill_path,
                capture_output=True,
                check=True
            )
            logger.info(f"回滚成功: {previous_commit[:8]}")
            return True
        except subprocess.CalledProcessError as e:
            logger.error(f"回滚失败: {e}")
            return False

    def get_remote_url(self, skill_path: Path) -> Optional[str]:
        """获取远程仓库 URL

        Args:
            skill_path: skill 目录路径

        Returns:
            远程仓库 URL，如果不存在则返回 None
        """
        try:
            result = subprocess.run(
                ["git", "remote", "get-url", "origin"],
                cwd=skill_path,
                capture_output=True,
                text=True,
                check=False
            )
            if result.returncode == 0:
                return result.stdout.strip()
        except Exception:
            pass

        return None

    def get_current_branch(self, skill_path: Path) -> str:
        """获取当前分支名

        Args:
            skill_path: skill 目录路径

        Returns:
            分支名
        """
        try:
            result = subprocess.run(
                ["git", "branch", "--show-current"],
                cwd=skill_path,
                capture_output=True,
                text=True,
                check=False
            )
            if result.returncode == 0:
                return result.stdout.strip()
        except Exception:
            pass

        return "unknown"

    def is_git_repo(self, skill_path: Path) -> bool:
        """检查是否是 git 仓库

        Args:
            skill_path: skill 目录路径

        Returns:
            是否是 git 仓库
        """
        return (skill_path / ".git").exists()

    def list_commits(self, skill_name: str, limit: int = 10) -> List[Dict]:
        """列出最近的提交

        Args:
            skill_name: skill 名称
            limit: 最大返回数量

        Returns:
            提交列表
        """
        skill_path = self.skills_dir / skill_name

        if not self.is_git_repo(skill_path):
            return []

        try:
            result = subprocess.run(
                ["git", "log", "-{}".format(limit), "--format=%H|%ai|%s"],
                cwd=skill_path,
                capture_output=True,
                text=True,
                check=True
            )

            commits = []
            for line in result.stdout.split('\n'):
                if line.strip():
                    parts = line.split('|')
                    if len(parts) >= 3:
                        commits.append({
                            "hash": parts[0][:8],
                            "date": parts[1],
                            "message": parts[2]
                        })

            return commits

        except subprocess.CalledProcessError as e:
            logger.warning(f"获取提交历史失败: {e}")
            return []
