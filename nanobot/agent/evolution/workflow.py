"""skills 的自进化工作流程

编排 skill 在沙箱中的完整进化流程。
"""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from typing import Optional, Dict, Any
from datetime import datetime
from loguru import logger

from nanobot.agent.sandbox.manager import SandboxManager
from nanobot.agent.evolution.git_manager import GitVersionManager
from nanobot.agent.evolution.rollback import RollbackManager
from nanobot.agent.evolution.decider import EvolutionTrigger
from nanobot.agent.evolution.history import EvolutionHistoryManager


logger = logging.getLogger(__name__)


class SkillEvolutionWorkflow:
    """编排 skill 在沙箱中的完整进化流程

    工作流程：
    1. 创建隔离沙箱
    2. 克隆 skill 到沙箱
    3. 分析并规划更改（使用 LLM）
    4. 在沙箱中实施更改
    5. 验证更改
    6. 应用更改到主 skill
    7. 清理沙箱
    """

    def __init__(
        self,
        sandbox_manager: SandboxManager,
        workspace: Path,
        llm_provider: Optional[Any] = None
    ):
        """初始化进化工作流程

        Args:
            sandbox_manager: 沙箱管理器
            workspace: 工作目录路径
            llm_provider: LLM provider（用于分析和规划）
        """
        self.sandbox_manager = sandbox_manager
        self.workspace = workspace
        self.llm_provider = llm_provider

        # 初始化辅助管理器
        self.git_manager = GitVersionManager(workspace)
        self.rollback_manager = RollbackManager(workspace)

        # 进化历史管理器（持久化）
        self.history_manager = EvolutionHistoryManager(workspace)

        # 内存中的进化历史（向后兼容）
        self.evolution_history: Dict[str, list[Dict]] = self.history_manager._cache

    async def evolve_skill(
        self,
        skill_name: str,
        reason: str,
        error_context: Optional[str] = None
    ) -> str:
        """执行完整的进化工作流程

        Args:
            skill_name: skill 名称
            reason: 进化原因
            error_context: 错误上下文

        Returns:
            进化结果消息
        """
        logger.info(f"🧬 开始 skill 进化: {skill_name} (原因: {reason})")

        evolution_record = {
            "skill_name": skill_name,
            "reason": reason,
            "error_context": error_context,
            "started_at": datetime.now().isoformat(),
            "status": "in_progress"
        }

        sandbox_id = None
        rollback_point = None

        try:
            # 步骤 1: 创建回滚点
            logger.info(f"💾 创建回滚点...")
            rollback_point = await self.rollback_manager.create_rollback_point(skill_name)
            evolution_record["rollback_point"] = rollback_point

            # 步骤 2: 创建隔离沙箱
            logger.info(f"📦 创建沙箱...")
            sandbox_id = await self.sandbox_manager.create_sandbox_for_skill(
                skill_name=skill_name
            )
            evolution_record["sandbox_id"] = sandbox_id

            # 步骤 3: 克隆 skill 到沙箱
            logger.info(f"📥 准备沙箱环境...")
            skill_path = self.workspace / "skills" / skill_name
            await self._prepare_skill_in_sandbox(sandbox_id, skill_path)

            # 步骤 4: 分析并规划更改
            logger.info(f"🔍 分析 skill 并规划更改...")
            evolution_plan = await self._analyze_and_plan(
                sandbox_id, skill_name, reason, error_context
            )
            evolution_record["plan"] = evolution_plan

            if not evolution_plan["changes"]:
                logger.warning(f"没有需要实施的更改")
                evolution_record["status"] = "skipped"
                return "Skill 无需进化"

            # 步骤 5: 在沙箱中实施更改
            logger.info(f"🔧 在沙箱中实施更改...")
            await self._implement_changes(
                sandbox_id, evolution_plan
            )

            # 步骤 6: 验证更改
            logger.info(f"✅ 验证更改...")
            verification_result = await self._verify_changes(
                sandbox_id, skill_name, evolution_plan
            )
            evolution_record["verification"] = verification_result

            if not verification_result["success"]:
                error_msg = f"验证失败: {verification_result.get('errors', '未知错误')}"
                logger.error(f"❌ {error_msg}")
                evolution_record["status"] = "failed"
                evolution_record["error"] = error_msg

                # 回滚
                logger.info(f"🔄 回滚到之前状态...")
                await self.rollback_manager.rollback(skill_name, rollback_point)
                return error_msg

            # 步骤 7: 应用更改到主 skill
            logger.info(f"📤 应用更改到主 skill...")
            await self._apply_changes(
                skill_name, sandbox_id, evolution_plan["summary"]
            )

            evolution_record["status"] = "completed"
            evolution_record["completed_at"] = datetime.now().isoformat()

            # 记录历史
            self._record_evolution(skill_name, evolution_record)

            logger.info(f"✅ Skill '{skill_name}' 进化成功: {evolution_plan['summary']}")
            return f"Skill '{skill_name}' 成功进化: {evolution_plan['summary']}"

        except Exception as e:
            error_msg = f"进化过程中出错: {str(e)}"
            logger.error(f"❌ {error_msg}")
            evolution_record["status"] = "error"
            evolution_record["error"] = error_msg

            # 尝试回滚
            if rollback_point:
                try:
                    await self.rollback_manager.rollback(skill_name, rollback_point)
                except Exception as rollback_error:
                    logger.error(f"回滚失败: {rollback_error}")

            return error_msg

        finally:
            # 步骤 8: 清理沙箱
            if sandbox_id and self.sandbox_manager.config.docker.auto_cleanup:
                try:
                    await self.sandbox_manager.destroy_sandbox(sandbox_id)
                    logger.info(f"🧹 沙箱 {sandbox_id} 已清理")
                except Exception as e:
                    logger.error(f"清理沙箱时出错: {e}")

    async def _prepare_skill_in_sandbox(
        self,
        sandbox_id: str,
        skill_path: Path
    ) -> None:
        """准备沙箱中的 skill

        Args:
            sandbox_id: 沙箱 ID
            skill_path: skill 目录路径
        """
        # 检查是否是 git 仓库
        if self.git_manager.is_git_repo(skill_path):
            # 克隆 git 仓库
            remote_url = self.git_manager.get_remote_url(skill_path)
            if remote_url:
                branch = self.git_manager.get_current_branch(skill_path)
                await self.sandbox_manager.clone_repo_to_sandbox(
                    sandbox_id, remote_url, branch
                )
                logger.info(f"从远程仓库克隆: {remote_url}")
            else:
                # 本地 git 仓库，复制文件
                await self._copy_skill_to_sandbox(sandbox_id, skill_path)
        else:
            # 不是 git 仓库，直接复制文件
            await self._copy_skill_to_sandbox(sandbox_id, skill_path)

    async def _copy_skill_to_sandbox(
        self,
        sandbox_id: str,
        skill_path: Path
    ) -> None:
        """复制 skill 文件到沙箱

        Args:
            sandbox_id: 沙箱 ID
            skill_path: skill 目录路径
        """
        # 创建 skill 目录
        await self.sandbox_manager.execute_in_sandbox(
            sandbox_id,
            "mkdir -p /workspace/skill"
        )

        # 上传所有文件
        for file_path in skill_path.rglob("*"):
            if file_path.is_file():
                relative_path = file_path.relative_to(skill_path)
                remote_path = f"/workspace/skill/{relative_path}"

                await self.sandbox_manager.upload_file_to_sandbox(
                    sandbox_id,
                    str(file_path),
                    remote_path
                )

        logger.debug(f"已复制 {skill_path} 到沙箱")

    async def _analyze_and_plan(
        self,
        sandbox_id: str,
        skill_name: str,
        reason: str,
        error_context: Optional[str]
    ) -> Dict[str, Any]:
        """使用 LLM 分析并规划进化

        Args:
            sandbox_id: 沙箱 ID
            skill_name: skill 名称
            reason: 进化原因
            error_context: 错误上下文

        Returns:
            进化计划字典
        """
        # 读取 skill 内容
        skill_path = self.workspace / "skills" / skill_name
        skill_file = skill_path / "SKILL.md"

        if not skill_file.exists():
            return {
                "root_cause": "Skill 文件不存在",
                "changes": [],
                "test_strategy": "手动验证",
                "summary": "无法分析"
            }

        skill_content = skill_file.read_text()[:5000]  # 限制长度

        # 如果有 LLM provider，使用它分析
        if self.llm_provider:
            analysis_prompt = f"""分析此 skill 并规划改进以解决问题: {reason}

Skill 内容:
```
{skill_content}
```

错误上下文:
{error_context or '无'}

请提供:
1. 根本原因分析
2. 建议的更改（具体文件和修改）
3. 测试策略
4. 如果更改失败时的回滚计划

以 JSON 格式响应，包含以下字段:
{{
  "root_cause": "根本原因描述",
  "changes": [
    {{"file": "SKILL.md", "description": "更新 skill 文档", "action": "modify"}}
  ],
  "test_strategy": "测试策略",
  "rollback_plan": "回滚计划",
  "summary": "更改摘要"
}}

如果不需要更改，返回空 changes 数组。"""

            try:
                response = await self._call_llm(analysis_prompt)
                return self._parse_evolution_plan(response)
            except Exception as e:
                logger.warning(f"LLM 分析失败: {e}，使用默认策略")
                # 使用默认策略
                return self._default_evolution_plan(reason, error_context)
        else:
            # 没有 LLM，使用默认策略
            return self._default_evolution_plan(reason, error_context)

    def _default_evolution_plan(
        self,
        reason: str,
        error_context: Optional[str]
    ) -> Dict[str, Any]:
        """默认进化规划（当没有 LLM 时）

        Args:
            reason: 进化原因
            error_context: 错误上下文

        Returns:
            默认进化计划
        """
        # 基于错误类型的默认修复策略
        change = {"file": "SKILL.md", "description": f"修复问题: {reason}", "action": "modify"}

        if error_context:
            if "module not found" in error_context.lower():
                change["description"] = "安装缺失的 Python 模块"
            elif "command not found" in error_context.lower():
                change["description"] = "安装缺失的系统命令"
            elif "permission denied" in error_context.lower():
                change["description"] = "修复权限问题"

        return {
            "root_cause": reason,
            "changes": [change],
            "test_strategy": "手动验证修复",
            "rollback_plan": "使用 git 回滚",
            "summary": f"自动修复: {reason}"
        }

    async def _call_llm(self, prompt: str) -> str:
        """调用 LLM 进行分析

        Args:
            prompt: 分析提示

        Returns:
            LLM 响应
        """
        # 这里应该调用实际的 LLM provider
        # 暂时返回模拟响应
        logger.warning("LLM provider 未配置，返回空响应")
        return '{"changes": [], "summary": "无更改"}'

    def _parse_evolution_plan(self, response: str) -> Dict[str, Any]:
        """解析 LLM 响应为进化计划

        Args:
            response: LLM 响应

        Returns:
            进化计划字典
        """
        import json
        import re

        # 尝试提取 JSON
        json_match = re.search(r'```json\s*(.*?)\s*```', response, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group(1))
            except json.JSONDecodeError:
                pass

        # 尝试直接解析 JSON
        try:
            return json.loads(response)
        except json.JSONDecodeError:
            pass

        # 如果没有 JSON，创建基本计划
        return {
            "root_cause": "待分析",
            "changes": [],
            "test_strategy": "手动验证",
            "rollback_plan": "使用 git 回滚",
            "summary": response[:200] if len(response) > 200 else response,
            "raw_response": response
        }

    async def _implement_changes(
        self,
        sandbox_id: str,
        evolution_plan: Dict[str, Any]
    ) -> None:
        """在沙箱中实施更改

        Args:
            sandbox_id: 沙箱 ID
            evolution_plan: 进化计划
        """
        if not evolution_plan.get("changes"):
            logger.info("没有需要实施的更改")
            return

        logger.info(f"实施 {len(evolution_plan['changes'])} 个更改")

        # 对于每个更改，实施相应的修复
        for change in evolution_plan["changes"]:
            file_path = change["file"]
            action = change.get("action", "modify")
            description = change["description"]

            logger.info(f"  - {file_path}: {description}")

            # 这里可以根据 action 类型实施不同的修复
            if action == "modify":
                # 对于文件修改，可以使用 LLM 生成新内容
                # 或使用预定义的修复模式
                pass
            elif action == "install":
                # 安装依赖
                await self._apply_fix(sandbox_id, change)
            elif action == "config":
                # 修改配置
                await self._apply_fix(sandbox_id, change)

    async def _apply_fix(
        self,
        sandbox_id: str,
        change: Dict[str, Any]
    ) -> None:
        """应用修复

        Args:
            sandbox_id: 沙箱 ID
            change: 更改描述
        """
        description = change["description"].lower()

        # 根据描述应用不同的修复
        if "安装缺失的 python 模块" in description:
            # 从错误中提取模块名
            file_path = change.get("file", "")
            if "module" in file_path.lower():
                module_name = file_path.split("'")[-1] if "'" in file_path else file_path
                await self.sandbox_manager.execute_in_sandbox(
                    sandbox_id,
                    f"pip install {module_name}",
                    timeout=120
                )

        elif "安装缺失的系统命令" in description:
            # 安装系统工具
            await self.sandbox_manager.execute_in_sandbox(
                sandbox_id,
                "apt-get update && apt-get install -y curl git",
                timeout=120
            )

    async def _verify_changes(
        self,
        sandbox_id: str,
        skill_name: str,
        evolution_plan: Dict[str, Any]
    ) -> Dict[str, Any]:
        """验证更改

        Args:
            sandbox_id: 沙箱 ID
            skill_name: skill 名称
            evolution_plan: 进化计划

        Returns:
            验证结果
        """
        errors = []

        # 基本验证：检查文件是否可读
        try:
            result = await self.sandbox_manager.execute_in_sandbox(
                sandbox_id,
                "cat /workspace/skill/SKILL.md"
            )
            if result and "---" in result:
                logger.info("✓ SKILL.md 格式验证通过")
            else:
                errors.append("SKILL.md 格式无效")
        except Exception as e:
            errors.append(f"验证失败: {str(e)}")

        # 如果有测试策略，运行测试
        test_strategy = evolution_plan.get("test_strategy", "")
        if test_strategy and "手动验证" not in test_strategy:
            try:
                # 这里可以运行测试命令
                pass
            except Exception as e:
                errors.append(f"测试失败: {str(e)}")

        return {
            "success": len(errors) == 0,
            "errors": errors
        }

    async def _apply_changes(
        self,
        skill_name: str,
        sandbox_id: str,
        summary: str
    ) -> None:
        """应用更改到主 skill

        Args:
            skill_name: skill 名称
            sandbox_id: 沙箱 ID
            summary: 更改摘要
        """
        skill_path = self.workspace / "skills" / skill_name

        # 从沙箱下载更改后的文件
        await self._download_changes_from_sandbox(
            sandbox_id, skill_path
        )

        # 提交更改
        if self.git_manager.is_git_repo(skill_path):
            await self.git_manager.commit_evolution_changes(
                str(skill_path),
                summary
            )

    async def _download_changes_from_sandbox(
        self,
        sandbox_id: str,
        skill_path: Path
    ) -> None:
        """从沙箱下载更改

        Args:
            sandbox_id: 沙箱 ID
            skill_path: skill 目录路径
        """
        # 列出沙箱中的文件
        result = await self.sandbox_manager.execute_in_sandbox(
            sandbox_id,
            "find /workspace/skill -type f -name '*.md' -o -name '*.py' -o -name '*.yaml' -o -name '*.yml' -o -name '*.txt'"
        )

        for line in result.strip().split('\n'):
            remote_path = line.strip()
            if not remote_path or "/workspace/skill/" not in remote_path:
                continue

            # 提取相对路径
            relative_path = remote_path.replace('/workspace/skill/', '')
            local_path = skill_path / relative_path

            # 确保目标目录存在
            local_path.parent.mkdir(parents=True, exist_ok=True)

            # 下载文件
            await self.sandbox_manager.download_file_from_sandbox(
                sandbox_id,
                remote_path,
                str(local_path)
            )

        logger.info(f"已从沙箱下载更改到 {skill_path}")

    def _record_evolution(self, skill_name: str, record: Dict) -> None:
        """记录进化历史（持久化到文件）

        Args:
            skill_name: skill 名称
            record: 进化记录
        """
        # 保存到持久化管理器
        self.history_manager.add_record(
            skill_name=skill_name,
            reason=record.get('reason', 'unknown'),
            status=record.get('status', 'unknown'),
            changes=record.get('changes', []),
            error_context=record.get('error_context'),
            rollback_info=record.get('rollback_info'),
            duration_seconds=record.get('duration_seconds'),
        )

        # 同时保存到内存（向后兼容）
        if skill_name not in self.evolution_history:
            self.evolution_history[skill_name] = []

        self.evolution_history[skill_name].append(record)

    def get_evolution_history(
        self,
        skill_name: Optional[str] = None,
        limit: int = 100,
        status_filter: Optional[str] = None
    ) -> Dict | List[Dict]:
        """获取进化历史（从持久化存储）

        Args:
            skill_name: 可选的 skill 名称
            limit: 最大返回数量
            status_filter: 状态过滤 (success/failed/rollback)

        Returns:
            进化历史
        """
        records = self.history_manager.get_history(
            skill_name=skill_name,
            limit=limit,
            status_filter=status_filter
        )

        if skill_name:
            return records
        return {
            "all": records,
            "summaries": self.history_manager.get_all_summaries()
        }

    async def get_skill_status(self, skill_name: str) -> Dict:
        """获取 skill 的状态

        Args:
            skill_name: skill 名称

        Returns:
            Skill 状态信息
        """
        skill_path = self.workspace / "skills" / skill_name

        return {
            "name": skill_name,
            "exists": skill_path.exists(),
            "git_repo": self.git_manager.is_git_repo(skill_path),
            "version": self.git_manager.get_skill_version(skill_name),
            "evolutions": len(self.evolution_history.get(skill_name, [])),
            "last_evolution": (
                self.evolution_history[skill_name][-1]
                if skill_name in self.evolution_history and self.evolution_history[skill_name]
                else None
            ),
            "summary": self.history_manager.get_skill_summary(skill_name)
        }

    def get_skill_summary(self, skill_name: str) -> Dict:
        """获取 skill 的进化摘要

        Args:
            skill_name: skill 名称

        Returns:
            进化摘要
        """
        return self.history_manager.get_skill_summary(skill_name)

    def get_all_summaries(self) -> Dict[str, Dict]:
        """获取所有 skills 的进化摘要

        Returns:
            所有 skills 的摘要字典
        """
        return self.history_manager.get_all_summaries()

    def export_history_to_markdown(
        self,
        output_path: Optional[Path] = None
    ) -> str:
        """导出进化历史为 Markdown

        Args:
            output_path: 输出路径（默认为 workspace/evolution_history.md）

        Returns:
            Markdown 内容
        """
        if output_path is None:
            output_path = self.workspace / "evolution_history.md"

        return self.history_manager.export_to_markdown(output_path)

    def clear_old_history(self, days: int = 30) -> int:
        """清理旧的进化记录

        Args:
            days: 保留最近多少天的记录

        Returns:
            删除的记录数
        """
        return self.history_manager.clear_old_records(days=days)
