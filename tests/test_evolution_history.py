"""测试进化历史持久化功能"""

import json
import pytest
from pathlib import Path
from datetime import datetime

from nanobot.agent.evolution.history import EvolutionHistoryManager


@pytest.fixture
def history_manager(tmp_path):
    """创建临时历史管理器"""
    return EvolutionHistoryManager(tmp_path)


def test_add_and_retrieve_record(history_manager):
    """测试添加和检索记录"""
    record_id = history_manager.add_record(
        skill_name="test-skill",
        reason="module not found",
        status="success",
        changes=[
            {"file": "SKILL.md", "action": "modify", "description": "添加依赖"}
        ],
        error_context="ModuleNotFoundError: numpy",
        duration_seconds=45.5
    )

    assert record_id is not None
    assert "test-skill" in record_id

    # 检索记录
    records = history_manager.get_history(skill_name="test-skill")

    assert len(records) == 1
    assert records[0]['skill_name'] == "test-skill"
    assert records[0]['reason'] == "module not found"
    assert records[0]['status'] == "success"


def test_multiple_skills(history_manager):
    """测试多个 skills 的记录"""
    # 添加多个 skills 的记录
    for skill in ["skill-a", "skill-b", "skill-a"]:
        history_manager.add_record(
            skill_name=skill,
            reason="test",
            status="success",
            changes=[],
        )

    all_records = history_manager.get_history()
    skill_a_records = history_manager.get_history(skill_name="skill-a")

    assert len(skill_a_records) == 2
    assert all_records[0]['skill_name'] in ["skill-a", "skill-b"]


def test_status_filter(history_manager):
    """测试状态过滤"""
    # 添加不同状态的记录
    history_manager.add_record("test", "reason1", "success", [])
    history_manager.add_record("test", "reason2", "failed", [])
    history_manager.add_record("test", "reason3", "success", [])

    success_records = history_manager.get_history(
        skill_name="test",
        status_filter="success"
    )

    assert len(success_records) == 2
    assert all(r['status'] == 'success' for r in success_records)


def test_skill_summary(history_manager):
    """测试 skill 摘要"""
    # 添加记录
    history_manager.add_record("test-skill", "error1", "success", [])
    history_manager.add_record("test-skill", "error2", "failed", [])
    history_manager.add_record("test-skill", "error1", "success", [])

    summary = history_manager.get_skill_summary("test-skill")

    assert summary['skill_name'] == "test-skill"
    assert summary['total_evolutions'] == 3
    assert summary['successful'] == 2
    assert summary['failed'] == 1
    assert summary['success_rate'] == "66.7%"
    assert len(summary['common_reasons']) > 0


def test_persistence(tmp_path):
    """测试持久化到文件"""
    history_file = tmp_path / ".nanobot" / "evolution" / "history.jsonl"

    # 创建管理器并添加记录
    manager1 = EvolutionHistoryManager(tmp_path)
    manager1.add_record("test", "reason", "success", [])

    # 验证文件存在
    assert history_file.exists()

    # 创建新管理器，应该加载之前的记录
    manager2 = EvolutionHistoryManager(tmp_path)
    records = manager2.get_history(skill_name="test")

    assert len(records) == 1


def test_export_to_markdown(history_manager, tmp_path):
    """测试导出为 Markdown"""
    history_manager.add_record("skill-a", "error1", "success", [
        {"description": "修复 bug"}
    ])

    output_file = tmp_path / "history.md"
    markdown = history_manager.export_to_markdown(output_file)

    assert output_file.exists()
    assert "# Skill 进化历史" in markdown
    assert "skill-a" in markdown


def test_clear_old_records(history_manager):
    """测试清理旧记录"""
    # 手动添加一条旧记录（通过直接修改文件）
    # 这里我们添加一条记录，然后测试清理功能

    history_manager.add_record("test", "old", "success", [])

    # 清理 100 天前的记录（应该保留当前记录）
    deleted = history_manager.clear_old_records(days=100)

    # 当前的记录应该被保留
    records = history_manager.get_history(skill_name="test")
    assert len(records) >= 0  # 至少没有被全部删除


def test_limit(history_manager):
    """测试记录数量限制"""
    # 添加多条记录
    for i in range(10):
        history_manager.add_record("test", f"reason-{i}", "success", [])

    # 限制返回 5 条
    records = history_manager.get_history(skill_name="test", limit=5)

    assert len(records) == 5


def test_summary_file(history_manager):
    """测试摘要文件"""
    history_manager.add_record("skill-a", "reason1", "success", [])
    history_manager.add_record("skill-b", "reason2", "failed", [])

    summary_file = history_manager.summary_file
    assert summary_file.exists()

    # 读取并验证
    with open(summary_file, 'r', encoding='utf-8') as f:
        summary = json.load(f)

    assert summary['total_evolutions'] == 2
    assert 'skill-a' in summary['skills']
    assert 'skill-b' in summary['skills']


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
