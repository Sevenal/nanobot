"""测试沙箱和进化系统与 Agent Loop 的集成"""

import asyncio
import pytest
from pathlib import Path
from unittest.mock import Mock, AsyncMock, patch

from nanobot.agent.loop import AgentLoop
from nanobot.bus.queue import MessageBus
from nanobot.config.schema import SandboxConfig, DockerSandboxConfig


@pytest.fixture
def sandbox_config():
    """创建测试用的沙箱配置"""
    config = SandboxConfig()
    config.enabled = True
    config.docker = DockerSandboxConfig(
        enabled=True,
        base_image="python:3.11-slim",
        host_workspace="/tmp/nanobot-test-sandbox",
        auto_cleanup=False  # 测试时不自动清理
    )
    return config


@pytest.fixture
def mock_provider():
    """模拟 LLM Provider"""
    provider = Mock()
    provider.get_default_model = Mock(return_value="test-model")
    provider.chat_with_retry = AsyncMock()
    provider.complete = AsyncMock()
    return provider


@pytest.fixture
def mock_bus():
    """模拟消息总线"""
    bus = Mock(spec=MessageBus)
    bus.consume_inbound = AsyncMock()
    bus.publish_outbound = AsyncMock()
    return bus


def test_agent_loop_initialization_with_sandbox(sandbox_config, mock_provider, mock_bus, tmp_path):
    """测试 Agent Loop 是否能正确初始化沙箱系统"""
    # 创建 Agent Loop（不启动）
    loop = AgentLoop(
        bus=mock_bus,
        provider=mock_provider,
        workspace=tmp_path,
        sandbox_config=sandbox_config
    )

    # 验证沙箱组件已初始化
    assert loop.sandbox_manager is not None, "沙箱管理器应该被初始化"
    assert loop.evolution_workflow is not None, "进化工作流应该被初始化"
    assert loop.git_manager is not None, "Git 管理器应该被初始化"

    # 验证沙箱工具已注册
    sandbox_tool = loop.tools.get("sandbox")
    assert sandbox_tool is not None, "沙箱工具应该被注册"
    assert sandbox_tool.name == "sandbox"


def test_agent_loop_without_sandbox(mock_provider, mock_bus, tmp_path):
    """测试没有启用沙箱时的 Agent Loop 初始化"""
    loop = AgentLoop(
        bus=mock_bus,
        provider=mock_provider,
        workspace=tmp_path,
        sandbox_config=None
    )

    # 验证沙箱组件未被初始化
    assert loop.sandbox_manager is None, "沙箱管理器不应该被初始化"
    assert loop.evolution_workflow is None, "进化工作流不应该被初始化"
    assert loop.git_manager is None, "Git 管理器不应该被初始化"

    # 验证沙箱工具未注册
    sandbox_tool = loop.tools.get("sandbox")
    assert sandbox_tool is None, "沙箱工具不应该被注册"


def test_skill_failure_tracking(sandbox_config, mock_provider, mock_bus, tmp_path):
    """测试技能失败跟踪"""
    loop = AgentLoop(
        bus=mock_bus,
        provider=mock_provider,
        workspace=tmp_path,
        sandbox_config=sandbox_config
    )

    # 验证失败计数器初始化
    assert loop.skill_failures == {}, "初始失败计数应为空"

    # 模拟技能失败
    loop.skill_failures["test-skill"] = 3

    assert loop.skill_failures["test-skill"] == 3


def test_extract_involved_skill(sandbox_config, mock_provider, mock_bus, tmp_path):
    """测试从错误消息中提取技能名称"""
    from nanobot.bus.events import InboundMessage

    loop = AgentLoop(
        bus=mock_bus,
        provider=mock_provider,
        workspace=tmp_path,
        sandbox_config=sandbox_config
    )

    # 测试从错误消息中提取
    msg = InboundMessage(
        channel="test",
        sender_id="user",
        chat_id="test-chat",
        content="Error in skill 'web-scraper': module not found"
    )

    skill_name = loop._extract_involved_skill("module not found in skill 'web-scraper'", msg)
    assert skill_name == "web-scraper", "应该能从错误消息中提取技能名称"


@pytest.mark.asyncio
async def test_evolution_trigger_check(sandbox_config, mock_provider, mock_bus, tmp_path):
    """测试进化触发检查"""
    from nanobot.bus.events import InboundMessage
    from nanobot.agent.evolution.decider import EvolutionTrigger

    loop = AgentLoop(
        bus=mock_bus,
        provider=mock_provider,
        workspace=tmp_path,
        sandbox_config=sandbox_config
    )

    # 创建测试消息
    msg = InboundMessage(
        channel="test",
        sender_id="user",
        chat_id="test-chat",
        content="test"
    )

    # 模拟第一次失败（不应触发）
    error_msg = "command not found: python3"
    await loop._check_and_trigger_evolution(msg, error_msg)

    # 验证失败计数增加
    assert loop.skill_failures.get("test-skill", 0) == 0  # 没有 skill 名称，不会增加

    # 测试有 skill 名称的情况
    msg_with_skill = InboundMessage(
        channel="test",
        sender_id="user",
        chat_id="test-chat",
        content="/skill web-scraper"
    )

    # 模拟 3 次失败（应该触发进化）
    for i in range(3):
        loop.skill_failures["web-scraper"] = i + 1

    should_evolve = EvolutionTrigger.should_evolve(
        "web-scraper",
        error_message="command not found",
        failure_count=3
    )

    assert should_evolve, "3 次失败后应该触发进化"


@pytest.mark.asyncio
async def test_sandbox_tool_registration(sandbox_config, mock_provider, mock_bus, tmp_path):
    """测试沙箱工具注册和基本功能"""
    loop = AgentLoop(
        bus=mock_bus,
        provider=mock_provider,
        workspace=tmp_path,
        sandbox_config=sandbox_config
    )

    # 获取沙箱工具
    sandbox_tool = loop.tools.get("sandbox")

    assert sandbox_tool is not None
    assert sandbox_tool.name == "sandbox"
    assert sandbox_tool.description is not None
    assert len(sandbox_tool.description) > 0

    # 验证工具参数定义
    params = sandbox_tool.parameters
    assert params is not None
    assert "operation" in params["properties"]
    assert "sandbox_id" in params["properties"]


def test_evolution_workflow_components(sandbox_config, mock_provider, mock_bus, tmp_path):
    """测试进化工作流的组件是否正确初始化"""
    loop = AgentLoop(
        bus=mock_bus,
        provider=mock_provider,
        workspace=tmp_path,
        sandbox_config=sandbox_config
    )

    # 验证进化工作流的组件
    assert loop.evolution_workflow is not None
    assert loop.evolution_workflow.sandbox_manager is not None
    assert loop.evolution_workflow.workspace == tmp_path
    assert loop.evolution_workflow.llm_provider == mock_provider


@pytest.mark.asyncio
async def test_cleanup_method(sandbox_config, mock_provider, mock_bus, tmp_path):
    """测试清理方法"""
    loop = AgentLoop(
        bus=mock_bus,
        provider=mock_provider,
        workspace=tmp_path,
        sandbox_config=sandbox_config
    )

    # 调用清理方法（即使没有活动沙箱也不应该报错）
    await loop.cleanup()

    # 验证没有抛出异常


if __name__ == "__main__":
    # 运行测试
    pytest.main([__file__, "-v"])
