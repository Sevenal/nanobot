"""Docker 沙箱测试

测试 Docker 沙箱的基本功能。
注意：这些测试需要本地运行的 Docker daemon。
"""

import asyncio
import pytest
from pathlib import Path

from nanobot.config.schema import DockerSandboxConfig, SandboxConfig
from nanobot.agent.sandbox.manager import SandboxManager


@pytest.fixture
def sandbox_config():
    """创建测试用的沙箱配置"""
    config = SandboxConfig()
    config.docker = DockerSandboxConfig(
        enabled=True,
        base_image="python:3.11-slim",
        host_workspace="/tmp/nanobot-test-sandbox",
        timeout=60,
        max_concurrent=2,
        auto_cleanup=True,
        common_packages=[],
        common_tools=[]
    )
    return config


@pytest.mark.asyncio
async def test_create_sandbox(sandbox_config):
    """测试 Docker 沙箱创建"""
    from unittest.mock import Mock

    # Mock workspace path
    workspace = Path("/tmp/nanobot-test-workspace")

    # Create manager with mocked config
    manager = SandboxManager(sandbox_config, workspace)

    # Create sandbox
    sandbox_id = await manager.create_sandbox(
        skill_name="test-skill"
    )

    assert sandbox_id is not None
    assert sandbox_id in manager.get_active_sandboxes()

    # Cleanup
    await manager.destroy_sandbox(sandbox_id)
    assert sandbox_id not in manager.get_active_sandboxes()


@pytest.mark.asyncio
async def test_execute_command(sandbox_config):
    """测试命令执行"""
    from unittest.mock import Mock

    workspace = Path("/tmp/nanobot-test-workspace")
    manager = SandboxManager(sandbox_config, workspace)

    sandbox_id = await manager.create_sandbox()

    result = await manager.execute_in_sandbox(
        sandbox_id,
        "echo 'Hello from sandbox'"
    )

    assert "Hello from sandbox" in result

    await manager.destroy_sandbox(sandbox_id)


@pytest.mark.asyncio
async def test_dependency_resolution():
    """测试依赖解析"""
    from nanobot.agent.sandbox.providers.skill_dependency_resolver import SkillDependencyResolver

    # 创建临时 skill 目录
    import tempfile
    import os

    with tempfile.TemporaryDirectory() as tmpdir:
        skill_path = Path(tmpdir)

        # 测试 requirements.txt 解析
        req_file = skill_path / "requirements.txt"
        req_file.write_text("requests>=2.31.0\nhttpx>=0.24.0\n# Comment line\n")

        deps = SkillDependencyResolver.parse_skill_dependencies(skill_path)

        assert "python" in deps
        assert len(deps["python"]) == 2
        assert "requests>=2.31.0" in deps["python"]


def test_config_schema():
    """测试配置 schema"""
    config = SandboxConfig()

    # 验证默认值
    assert config.enabled is False
    assert config.docker.enabled is False
    assert config.docker.base_image == "python:3.11-slim"
    assert config.docker.workspace_path == "/workspace"
    assert config.docker.host_workspace == "/tmp/nanobot-sandbox"
    assert config.docker.timeout == 300
    assert config.docker.max_concurrent == 3
    assert config.docker.auto_cleanup is True
    assert "requests" in config.docker.common_packages
    assert "git" in config.docker.common_tools


@pytest.mark.asyncio
async def test_skill_sandbox_creation(sandbox_config):
    """测试为 skill 创建沙箱（带依赖）"""
    import tempfile

    workspace = Path("/tmp/nanobot-test-workspace")
    manager = SandboxManager(sandbox_config, workspace)

    # 创建临时 skill 目录
    with tempfile.TemporaryDirectory() as tmpdir:
        skill_path = Path(tmpdir)
        skill_name = "test-web-scraper"

        # 创建 SKILL.md with dependencies
        skill_file = skill_path / "SKILL.md"
        skill_file.write_text("""---
name: test-web-scraper
version: "1.0.0"
sandbox:
  image_type: "dynamic"
  base_image: "python:3.11-slim"
dependencies:
  python:
    - requests>=2.31.0
    - beautifulsoup4>=4.12.0
  system:
    - curl
---

# Test Skill
""")

        # 创建沙箱
        sandbox_id = await manager.create_sandbox_for_skill(
            skill_name=skill_name,
            skill_path=skill_path
        )

        assert sandbox_id is not None

        # 测试依赖是否已安装
        result = await manager.execute_in_sandbox(
            sandbox_id,
            "python -c 'import requests; print(requests.__version__)'"
        )

        assert "2.31" in result or "error" not in result.lower()

        # Cleanup
        await manager.destroy_sandbox(sandbox_id)


if __name__ == "__main__":
    # 运行基本测试
    print("运行 Docker 沙箱测试...")

    async def run_tests():
        config = SandboxConfig()
        config.docker = DockerSandboxConfig(
            enabled=True,
            base_image="python:3.11-slim",
            host_workspace="/tmp/nanobot-sandbox-test",
            timeout=60
        )

        workspace = Path("/tmp/nanobot-test-workspace")
        manager = SandboxManager(config, workspace)

        try:
            print("\n1. 创建沙箱...")
            sb_id = await manager.create_sandbox(skill_name="test")
            print(f"   ✓ 沙箱已创建: {sb_id}")

            print("\n2. 执行命令...")
            result = await manager.execute_in_sandbox(sb_id, "python --version")
            print(f"   ✓ Python 版本: {result.strip()}")

            print("\n3. 列出沙箱...")
            await manager._get_docker_env().execute(sb_id, "ls -la /workspace")

            print("\n✓ 所有测试通过!")

        finally:
            if sb_id:
                await manager.destroy_sandbox(sb_id)
                print(f"\n✓ 沙箱已清理: {sb_id}")

    asyncio.run(run_tests())
