"""skill 进化的决策引擎

根据错误模式、性能指标和失败频率判断是否应该触发 skill 进化。
"""

from __future__ import annotations

import re
from typing import Optional, Dict, List, Any
from loguru import logger


class EvolutionTrigger:
    """skill 进化的触发器

    分析 skill 执行结果，判断是否需要进化。
    支持多种触发条件：
    - 错误模式匹配
    - 性能阈值超限
    - 重复失败次数
    - 高错误率
    """

    # 表明需要进化的错误模式
    ERROR_PATTERNS = [
        r"command not found",
        r"module.*not found",
        r"no such file or directory",
        r"permission denied",
        r"API.*error.*4[0-9]{2}",  # 4xx 客户端错误
        r"API.*error.*50[0-9]{2}",  # 某些 5xx 错误
        r"connection.*refused",
        r"timeout",
        r"failed to",
        r"keyerror",
        r"attributeerror",
        r"importerror",
        r"syntaxerror",
    ]

    # 性能阈值
    MAX_FAILURE_COUNT = 3  # 最大失败次数
    MAX_EXECUTION_TIME = 300  # 最大执行时间（秒）
    MAX_ERROR_RATE = 0.5  # 最大错误率（50%）
    MIN_ATTEMPTS_FOR_RATE = 5  # 计算错误率的最小尝试次数

    @classmethod
    def should_evolve(
        cls,
        skill_name: str,
        error_message: Optional[str] = None,
        execution_time: Optional[float] = None,
        failure_count: int = 0,
        success_count: int = 0
    ) -> bool:
        """判断 skill 是否应该尝试进化

        Args:
            skill_name: skill 名称
            error_message: 错误消息
            execution_time: 执行时间（秒）
            failure_count: 失败次数
            success_count: 成功次数

        Returns:
            是否应该进化
        """
        reasons = []

        # 检查显式错误
        if error_message and cls._matches_error_pattern(error_message):
            reasons.append(f"错误模式匹配: {error_message[:100]}")

        # 检查性能问题
        if execution_time and execution_time > cls.MAX_EXECUTION_TIME:
            reasons.append(f"执行时间过长: {execution_time:.1f}s > {cls.MAX_EXECUTION_TIME}s")

        # 检查重复失败
        if failure_count >= cls.MAX_FAILURE_COUNT:
            reasons.append(f"重复失败: {failure_count} 次 >= {cls.MAX_FAILURE_COUNT}")

        # 检查错误率
        total_attempts = failure_count + success_count
        if total_attempts >= cls.MIN_ATTEMPTS_FOR_RATE:
            error_rate = failure_count / total_attempts
            if error_rate > cls.MAX_ERROR_RATE:
                reasons.append(f"高错误率: {error_rate:.1%} > {cls.MAX_ERROR_RATE:.0%}")

        if reasons:
            logger.info(f"Skill '{skill_name}' 需要进化: {'; '.join(reasons)}")

        return len(reasons) > 0

    @classmethod
    def _matches_error_pattern(cls, error_message: str) -> bool:
        """检查错误消息是否匹配任何模式

        Args:
            error_message: 错误消息

        Returns:
            是否匹配需要进化的错误模式
        """
        error_lower = error_message.lower()

        for pattern in cls.ERROR_PATTERNS:
            if re.search(pattern, error_lower):
                return True

        return False

    @classmethod
    def get_evolution_reason(
        cls,
        skill_name: str,
        error_message: Optional[str] = None,
        execution_time: Optional[float] = None,
        failure_count: int = 0,
        success_count: int = 0
    ) -> str:
        """获取进化原因（用于日志记录和通知）

        Args:
            skill_name: skill 名称
            error_message: 错误消息
            execution_time: 执行时间（秒）
            failure_count: 失败次数
            success_count: 成功次数

        Returns:
            进化原因描述
        """
        reasons = []

        if error_message and cls._matches_error_pattern(error_message):
            reasons.append(f"错误: {error_message[:100]}")

        if execution_time and execution_time > cls.MAX_EXECUTION_TIME:
            reasons.append(f"性能: 执行时间 {execution_time:.1f}s")

        if failure_count >= cls.MAX_FAILURE_COUNT:
            reasons.append(f"稳定性: {failure_count} 次失败")

        if success_count + failure_count >= cls.MIN_ATTEMPTS_FOR_RATE:
            error_rate = failure_count / (success_count + failure_count)
            if error_rate > cls.MAX_ERROR_RATE:
                reasons.append(f"可靠性: {error_rate:.1%} 错误率")

        return "; ".join(reasons) if reasons else "未知原因"

    @classmethod
    def calculate_severity(
        cls,
        skill_name: str,
        error_message: Optional[str] = None,
        execution_time: Optional[float] = None,
        failure_count: int = 0,
        success_count: int = 0
    ) -> str:
        """计算进化严重程度

        Args:
            skill_name: skill 名称
            error_message: 错误消息
            execution_time: 执行时间（秒）
            failure_count: 失败次数
            success_count: 成功次数

        Returns:
            严重程度: low | medium | high | critical
        """
        score = 0

        # 错误模式权重
        if error_message and cls._matches_error_pattern(error_message):
            # 严重错误（如 module not found）权重更高
            if any(pattern in error_message.lower() for pattern in [
                "module.*not found",
                "importerror",
                "syntaxerror"
            ]):
                score += 30
            else:
                score += 20

        # 性能问题权重
        if execution_time:
            if execution_time > cls.MAX_EXECUTION_TIME * 2:
                score += 25
            elif execution_time > cls.MAX_EXECUTION_TIME:
                score += 15

        # 失败次数权重
        if failure_count >= cls.MAX_FAILURE_COUNT * 2:
            score += 30
        elif failure_count >= cls.MAX_FAILURE_COUNT:
            score += 20

        # 错误率权重
        total_attempts = failure_count + success_count
        if total_attempts >= cls.MIN_ATTEMPTS_FOR_RATE:
            error_rate = failure_count / total_attempts
            if error_rate >= 0.8:
                score += 30
            elif error_rate >= cls.MAX_ERROR_RATE:
                score += 20
            elif error_rate >= 0.3:
                score += 10

        # 评级
        if score >= 80:
            return "critical"
        elif score >= 60:
            return "high"
        elif score >= 30:
            return "medium"
        else:
            return "low"


class EvolutionMetrics:
    """进化指标追踪器

    追踪 skill 的执行指标，用于判断是否需要进化。
    """

    def __init__(self):
        self.skill_metrics: Dict[str, Dict] = {}

    def record_execution(
        self,
        skill_name: str,
        success: bool,
        execution_time: Optional[float] = None,
        error_message: Optional[str] = None
    ) -> None:
        """记录执行结果

        Args:
            skill_name: skill 名称
            success: 是否成功
            execution_time: 执行时间（秒）
            error_message: 错误消息
        """
        if skill_name not in self.skill_metrics:
            self.skill_metrics[skill_name] = {
                "success_count": 0,
                "failure_count": 0,
                "total_time": 0.0,
                "last_errors": []
            }

        metrics = self.skill_metrics[skill_name]

        if success:
            metrics["success_count"] += 1
        else:
            metrics["failure_count"] += 1
            if error_message:
                metrics["last_errors"].append(error_message)
                # 只保留最近 10 个错误
                if len(metrics["last_errors"]) > 10:
                    metrics["last_errors"].pop(0)

        if execution_time:
            metrics["total_time"] += execution_time

    def should_evolve(self, skill_name: str) -> tuple[bool, str]:
        """判断 skill 是否应该进化

        Args:
            skill_name: skill 名称

        Returns:
            (是否应该进化, 原因)
        """
        if skill_name not in self.skill_metrics:
            return False, "无执行记录"

        metrics = self.skill_metrics[skill_name]

        return EvolutionTrigger.should_evolve(
            skill_name=skill_name,
            error_message=metrics["last_errors"][-1] if metrics["last_errors"] else None,
            failure_count=metrics["failure_count"],
            success_count=metrics["success_count"]
        ), EvolutionTrigger.get_evolution_reason(
            skill_name=skill_name,
            error_message=metrics["last_errors"][-1] if metrics["last_errors"] else None,
            failure_count=metrics["failure_count"],
            success_count=metrics["success_count"]
        )

    def get_metrics(self, skill_name: str) -> Optional[Dict]:
        """获取 skill 的指标

        Args:
            skill_name: skill 名称

        Returns:
            指标字典，如果 skill 不存在则返回 None
        """
        return self.skill_metrics.get(skill_name)

    def reset_metrics(self, skill_name: str) -> None:
        """重置 skill 的指标

        Args:
            skill_name: skill 名称
        """
        if skill_name in self.skill_metrics:
            del self.skill_metrics[skill_name]
