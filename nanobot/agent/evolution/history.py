"""进化记录持久化管理器"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from loguru import logger


class EvolutionHistoryManager:
    """进化历史持久化管理器"""

    def __init__(self, workspace: Path):
        """初始化进化历史管理器

        Args:
            workspace: 工作空间路径
        """
        self.workspace = workspace
        self.history_dir = workspace / ".nanobot" / "evolution"
        self.history_file = self.history_dir / "history.jsonl"
        self.summary_file = self.history_dir / "summary.json"

        # 确保目录存在
        self.history_dir.mkdir(parents=True, exist_ok=True)

        # 内存缓存
        self._cache: Dict[str, List[Dict]] = {}

        # 启动时加载历史
        self._load_history()

    def _load_history(self) -> None:
        """从文件加载进化历史"""
        try:
            if self.history_file.exists():
                with open(self.history_file, 'r', encoding='utf-8') as f:
                    for line in f:
                        if line.strip():
                            record = json.loads(line)
                            skill_name = record.get('skill_name', 'unknown')
                            if skill_name not in self._cache:
                                self._cache[skill_name] = []
                            self._cache[skill_name].append(record)

                logger.info(f"已加载 {len(self._cache)} 个 skills 的进化历史")

            # 加载摘要
            if self.summary_file.exists():
                with open(self.summary_file, 'r', encoding='utf-8') as f:
                    self._summary = json.load(f)
            else:
                self._summary = {"total_evolutions": 0, "last_updated": None}

        except Exception as e:
            logger.error(f"加载进化历史失败: {e}")
            self._cache = {}
            self._summary = {"total_evolutions": 0, "last_updated": None}

    def _save_summary(self) -> None:
        """保存摘要统计"""
        try:
            total = sum(len(records) for records in self._cache.values())
            self._summary = {
                "total_evolutions": total,
                "last_updated": datetime.now().isoformat(),
                "skills": list(self._cache.keys()),
                "evolutions_per_skill": {
                    skill: len(records)
                    for skill, records in self._cache.items()
                }
            }

            with open(self.summary_file, 'w', encoding='utf-8') as f:
                json.dump(self._summary, f, indent=2, ensure_ascii=False)

        except Exception as e:
            logger.error(f"保存摘要失败: {e}")

    def add_record(
        self,
        skill_name: str,
        reason: str,
        status: str,
        changes: List[Dict],
        error_context: Optional[str] = None,
        rollback_info: Optional[Dict] = None,
        duration_seconds: Optional[float] = None,
    ) -> str:
        """添加进化记录

        Args:
            skill_name: skill 名称
            reason: 进化原因
            status: 状态 (success/failed/rollback)
            changes: 更改列表
            error_context: 错误上下文
            rollback_info: 回滚信息
            duration_seconds: 执行时长

        Returns:
            记录 ID
        """
        record_id = f"{skill_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        record = {
            "id": record_id,
            "skill_name": skill_name,
            "timestamp": datetime.now().isoformat(),
            "reason": reason,
            "status": status,
            "changes": changes,
            "error_context": error_context,
            "rollback_info": rollback_info,
            "duration_seconds": duration_seconds,
        }

        # 添加到内存缓存
        if skill_name not in self._cache:
            self._cache[skill_name] = []
        self._cache[skill_name].append(record)

        # 追加到文件（JSONL 格式，便于追加和查询）
        try:
            with open(self.history_file, 'a', encoding='utf-8') as f:
                f.write(json.dumps(record, ensure_ascii=False) + '\n')

            # 更新摘要
            self._save_summary()

            logger.info(f"已保存进化记录: {record_id}")

        except Exception as e:
            logger.error(f"保存进化记录失败: {e}")

        return record_id

    def get_history(
        self,
        skill_name: Optional[str] = None,
        limit: int = 100,
        status_filter: Optional[str] = None
    ) -> List[Dict]:
        """获取进化历史

        Args:
            skill_name: skill 名称（None 表示获取所有）
            limit: 最大返回数量
            status_filter: 状态过滤 (success/failed/rollback)

        Returns:
            进化记录列表
        """
        records = []

        if skill_name:
            records = self._cache.get(skill_name, [])
        else:
            # 合并所有 skill 的记录
            for skill_records in self._cache.values():
                records.extend(skill_records)

        # 按时间倒序排序
        records.sort(key=lambda x: x['timestamp'], reverse=True)

        # 状态过滤
        if status_filter:
            records = [r for r in records if r.get('status') == status_filter]

        # 限制数量
        return records[:limit]

    def get_skill_summary(self, skill_name: str) -> Dict[str, Any]:
        """获取 skill 的进化摘要

        Args:
            skill_name: skill 名称

        Returns:
            摘要字典
        """
        records = self._cache.get(skill_name, [])

        if not records:
            return {
                "skill_name": skill_name,
                "total_evolutions": 0,
                "successful": 0,
                "failed": 0,
                "rolled_back": 0,
                "last_evolution": None,
                "common_reasons": [],
            }

        successful = sum(1 for r in records if r['status'] == 'success')
        failed = sum(1 for r in records if r['status'] == 'failed')
        rolled_back = sum(1 for r in records if r['status'] == 'rollback')

        # 统计常见原因
        reason_counts = {}
        for r in records:
            reason = r.get('reason', 'unknown')
            reason_counts[reason] = reason_counts.get(reason, 0) + 1

        common_reasons = sorted(
            reason_counts.items(),
            key=lambda x: x[1],
            reverse=True
        )[:5]

        return {
            "skill_name": skill_name,
            "total_evolutions": len(records),
            "successful": successful,
            "failed": failed,
            "rolled_back": rolled_back,
            "success_rate": f"{successful / len(records) * 100:.1f}%",
            "last_evolution": records[-1]['timestamp'],
            "common_reasons": common_reasons,
        }

    def get_all_summaries(self) -> Dict[str, Dict]:
        """获取所有 skills 的摘要"""
        return {
            skill_name: self.get_skill_summary(skill_name)
            for skill_name in self._cache.keys()
        }

    def export_to_markdown(
        self,
        output_path: Optional[Path] = None
    ) -> str:
        """导出进化历史为 Markdown 格式

        Args:
            output_path: 输出路径（None 表示返回字符串）

        Returns:
            Markdown 内容
        """
        lines = []
        lines.append("# Skill 进化历史\n")
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")

        # 总体统计
        lines.append("## 总体统计\n")
        lines.append(f"- 总进化次数: {self._summary.get('total_evolutions', 0)}")
        lines.append(f"- 涉及 Skills: {len(self._cache)}")
        lines.append(f"- 最后更新: {self._summary.get('last_updated', 'N/A')}\n")

        # 按 skill 分组
        for skill_name in sorted(self._cache.keys()):
            summary = self.get_skill_summary(skill_name)
            lines.append(f"## {skill_name}\n")
            lines.append(f"- 总进化次数: {summary['total_evolutions']}")
            lines.append(f"- 成功率: {summary['success_rate']}")
            lines.append(f"- 最后进化: {summary['last_evolution']}")

            if summary['common_reasons']:
                lines.append("\n### 常见进化原因")
                for reason, count in summary['common_reasons']:
                    lines.append(f"- {reason}: {count} 次")

            # 最近 5 条记录
            lines.append("\n### 最近进化记录")
            records = self._cache[skill_name][-5:]
            for record in records:
                status_emoji = {
                    'success': '✅',
                    'failed': '❌',
                    'rollback': '⏪'
                }.get(record['status'], '❓')

                lines.append(f"\n#### {status_emoji} {record['timestamp']}")
                lines.append(f"- **原因**: {record['reason']}")
                lines.append(f"- **状态**: {record['status']}")

                if record.get('changes'):
                    lines.append(f"- **更改**: {len(record['changes'])} 项")
                    for change in record['changes'][:3]:
                        lines.append(f"  - {change.get('description', 'N/A')}")
                lines.append("")

        content = '\n'.join(lines)

        if output_path:
            output_path.write_text(content, encoding='utf-8')
            logger.info(f"已导出进化历史到: {output_path}")

        return content

    def clear_old_records(
        self,
        days: int = 30,
        keep_successful: bool = True
    ) -> int:
        """清理旧记录

        Args:
            days: 保留最近多少天的记录
            keep_successful: 是否保留成功的记录

        Returns:
            删除的记录数
        """
        from datetime import timedelta

        cutoff = datetime.now() - timedelta(days=days)
        deleted = 0

        # 重写文件
        new_records = []
        for skill_name, records in self._cache.items():
            for record in records:
                record_time = datetime.fromisoformat(record['timestamp'])

                # 保留条件：在时间范围内 或 是成功记录且启用了保留
                if (record_time > cutoff or
                    (keep_successful and record['status'] == 'success')):
                    new_records.append(record)
                else:
                    deleted += 1

        # 重写文件
        if deleted > 0:
            try:
                with open(self.history_file, 'w', encoding='utf-8') as f:
                    for record in new_records:
                        f.write(json.dumps(record, ensure_ascii=False) + '\n')

                # 重新加载
                self._load_history()
                logger.info(f"已清理 {deleted} 条旧记录")

            except Exception as e:
                logger.error(f"清理记录失败: {e}")

        return deleted
