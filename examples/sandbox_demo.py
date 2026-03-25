"""Docker 沙箱系统使用示例

演示如何使用 nanobot 的 Docker 沙箱系统进行安全的 skill 进化。
"""

import asyncio
from pathlib import Path

from nanobot.config.schema import SandboxConfig, DockerSandboxConfig
from nanobot.agent.sandbox.manager import SandboxManager


async def demo_basic_sandbox():
    """演示基本沙箱功能"""
    print("=" * 60)
    print("Docker 沙箱系统演示")
    print("=" * 60)

    # 配置
    config = SandboxConfig()
    config.docker = DockerSandboxConfig(
        enabled=True,
        base_image="python:3.11-slim",
        host_workspace="/tmp/nanobot-sandbox-demo",
        timeout=300,
        common_packages=["requests", "httpx"],
        common_tools=["git", "curl"]
    )

    workspace = Path.home() / ".nanobot" / "workspace"
    manager = SandboxManager(config, workspace)

    sandbox_id = None

    try:
        # 1. 创建沙箱
        print("\n1. 创建沙箱环境...")
        sandbox_id = await manager.create_sandbox(
            skill_name="demo-skill",
            instructions="echo '沙箱初始化完成'"
        )
        print(f"   ✓ 沙箱已创建: {sandbox_id}")

        # 2. 执行命令
        print("\n2. 执行命令...")
        result = await manager.execute_in_sandbox(
            sandbox_id,
            "python --version && pip list | grep requests"
        )
        print(f"   ✓ 执行结果:\n{result}")

        # 3. 安装依赖
        print("\n3. 安装 Python 依赖...")
        result = await manager.execute_in_sandbox(
            sandbox_id,
            "pip install --no-cache-dir beautifulsoup4 lxml"
        )
        print(f"   ✓ 依赖安装完成")

        # 4. 克隆仓库
        print("\n4. 克隆 Git 仓库...")
        result = await manager.clone_repo_to_sandbox(
            sandbox_id,
            "https://github.com/sevenal/nanobot.git",
            branch="main",
            target_dir="/workspace/nanobot"
        )
        print(f"   ✓ {result}")

        # 5. 上传文件
        print("\n5. 上传文件到沙箱...")
        test_file = workspace / "test.txt"
        test_file.write_text("Hello from nanobot sandbox!")
        result = await manager.upload_file_to_sandbox(
            sandbox_id,
            str(test_file),
            "/workspace/test.txt"
        )
        print(f"   ✓ {result}")

        # 6. 读取文件
        print("\n6. 从沙箱读取文件...")
        result = await manager.execute_in_sandbox(
            sandbox_id,
            "cat /workspace/test.txt"
        )
        print(f"   ✓ 文件内容: {result.strip()}")

        # 7. 列出活动沙箱
        print("\n7. 活动沙箱列表:")
        sandboxes = manager.get_active_sandboxes()
        for sb_id, info in sandboxes.items():
            print(f"   - {sb_id}: {info}")

        print("\n✓ 演示完成!")

    except Exception as e:
        print(f"\n✗ 错误: {e}")

    finally:
        # 清理
        if sandbox_id:
            print(f"\n清理沙箱: {sandbox_id}")
            await manager.destroy_sandbox(sandbox_id)


async def demo_skill_with_dependencies():
    """演示为带依赖的 skill 创建沙箱"""
    print("\n" + "=" * 60)
    print("演示：为带依赖的 Skill 创建沙箱")
    print("=" * 60)

    config = SandboxConfig()
    config.docker = DockerSandboxConfig(
        enabled=True,
        base_image="python:3.11-slim",
        host_workspace="/tmp/nanobot-sandbox-skill"
    )

    workspace = Path.home() / ".nanobot" / "workspace"
    manager = SandboxManager(config, workspace)

    # 创建示例 skill 目录
    import tempfile
    with tempfile.TemporaryDirectory() as tmpdir:
        skill_path = Path(tmpdir)

        # 创建 SKILL.md with frontmatter
        skill_file = skill_path / "SKILL.md"
        skill_file.write_text("""---
name: web-scraper
version: "1.0.0"
sandbox:
  image_type: "dynamic"
dependencies:
  python:
    - requests>=2.31.0
    - beautifulsoup4>=4.12.0
    - lxml>=4.9.0
  system:
    - curl
    - git
---

# Web Scraper Skill

This skill can scrape websites and extract data.
""")

        print(f"\nSkill 配置:")
        from nanobot.agent.sandbox.providers.skill_dependency_resolver import SkillDependencyResolver
        resolver = SkillDependencyResolver()
        deps = resolver.parse_skill_dependencies(skill_path)

        print(f"  - Python 依赖: {deps['python']}")
        print(f"  - 系统工具: {deps['system']}")
        print(f"  - 镜像类型: {deps['image_type']}")

        sandbox_id = None
        try:
            print("\n创建 skill 沙箱...")
            sandbox_id = await manager.create_sandbox_for_skill(
                skill_name="web-scraper",
                skill_path=skill_path
            )
            print(f"✓ 沙箱已创建: {sandbox_id}")

            # 验证依赖
            print("\n验证已安装的依赖:")
            result = await manager.execute_in_sandbox(
                sandbox_id,
                "python -c 'import requests, bs4; print(\"依赖已安装\")'"
            )
            print(f"  {result.strip()}")

        finally:
            if sandbox_id:
                await manager.destroy_sandbox(sandbox_id)


async def main():
    """运行所有演示"""
    await demo_basic_sandbox()
    await demo_skill_with_dependencies()


if __name__ == "__main__":
    print("\n注意：此演示需要本地运行的 Docker daemon")
    print("如未安装 Docker，请先安装 Docker Desktop 或 Docker Engine\n")

    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\n演示已中断")
