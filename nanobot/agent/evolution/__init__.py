"""Skill 进化模块

提供 skill 自进化的完整功能：
- 决策引擎
- 工作流程
- Git 版本管理
- 回滚机制
- 验证系统
"""

from nanobot.agent.evolution.decider import EvolutionTrigger, EvolutionMetrics
from nanobot.agent.evolution.workflow import SkillEvolutionWorkflow
from nanobot.agent.evolution.git_manager import GitVersionManager
from nanobot.agent.evolution.rollback import RollbackManager
from nanobot.agent.evolution.verification import EvolutionVerifier, RegressionTester

__all__ = [
    "EvolutionTrigger",
    "EvolutionMetrics",
    "SkillEvolutionWorkflow",
    "GitVersionManager",
    "RollbackManager",
    "EvolutionVerifier",
    "RegressionTester",
]
