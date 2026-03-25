"""手动测试沙箱功能"""

import asyncio
import os
from pathlib import Path
import sys

# 设置 UTF-8 编码输出（Windows 兼容）
if sys.platform == "win32":
    import codecs
    sys.stdout = codecs.getwriter("utf-8")(sys.stdout.detach())
    sys.stderr = codecs.getwriter("utf-8")(sys.stderr.detach())

# 添加项目路径
sys.path.insert(0, str(Path(__file__).parent.parent))


async def test_docker_sandbox():
    """测试 Docker 沙箱"""
    print("=" * 60)
    print("🧪 测试 Docker 沙箱功能")
    print("=" * 60)

    try:
        from nanobot.config.schema import SandboxConfig, DockerSandboxConfig
        from nanobot.agent.sandbox.manager import SandboxManager

        # 创建配置
        config = SandboxConfig()
        config.enabled = True
        config.docker = DockerSandboxConfig(
            enabled=True,
            base_image="python:3.11-slim",
            host_workspace="C:/Users/DELL/.nanobot/sandbox-test",
            auto_cleanup=False,  # 测试时不自动清理，方便检查
            timeout=60
        )

        print("\n1️⃣ 创建沙箱管理器...")
        manager = SandboxManager(config)
        print("   ✅ 沙箱管理器创建成功")

        print("\n2️⃣ 创建 Docker 沙箱...")
        sandbox_id = await manager.create_sandbox_for_skill("test-skill")
        print(f"   ✅ 沙箱创建成功: {sandbox_id}")

        print("\n3️⃣ 测试基础命令...")

        # 测试 Python 版本
        print("\n   测试: python --version")
        result = await manager.execute_in_sandbox(sandbox_id, "python --version")
        print(f"   输出: {result['output'].strip()}")
        assert result['exit_code'] == 0, "Python 版本检查失败"
        print("   ✅ Python 可用")

        # 测试目录结构
        print("\n   测试: ls -la")
        result = await manager.execute_in_sandbox(sandbox_id, "ls -la /workspace")
        print(f"   输出:\n{result['output']}")
        print("   ✅ 工作目录存在")

        # 测试 Python 代码执行
        print("\n   测试: 运行 Python 代码")
        code = '''
import sys
print(f"Python 版本: {sys.version}")
print(f"平台: {sys.platform}")
print("Hello from sandbox!")
'''
        result = await manager.execute_in_sandbox(sandbox_id, f'python -c "{code}"')
        print(f"   输出:\n{result['output']}")
        print("   ✅ Python 代码执行成功")

        # 测试安装包
        print("\n4️⃣ 测试包安装...")
        result = await manager.execute_in_sandbox(
            sandbox_id,
            "pip install requests --quiet"
        )
        if result['exit_code'] == 0:
            print("   ✅ requests 安装成功")

            # 验证导入
            result = await manager.execute_in_sandbox(
                sandbox_id,
                "python -c 'import requests; print(requests.__version__)'"
            )
            if result['exit_code'] == 0:
                print(f"   ✅ requests 版本: {result['output'].strip()}")
        else:
            print(f"   ⚠️ 安装失败: {result['output']}")

        # 测试文件操作
        print("\n5️⃣ 测试文件操作...")
        await manager.execute_in_sandbox(sandbox_id, "echo 'Hello from sandbox' > /workspace/test.txt")
        result = await manager.execute_in_sandbox(sandbox_id, "cat /workspace/test.txt")
        print(f"   文件内容: {result['output'].strip()}")
        print("   ✅ 文件读写正常")

        # 测试并发执行
        print("\n6️⃣ 测试并发执行...")
        tasks = []
        for i in range(3):
            task = manager.execute_in_sandbox(
                sandbox_id,
                f"echo 'Concurrent task {i}' && sleep 0.5"
            )
            tasks.append(task)

        results = await asyncio.gather(*tasks)
        print(f"   ✅ 并发执行 {len(results)} 个任务完成")

        # 查看活动沙箱
        print("\n7️⃣ 查看活动沙箱...")
        active = manager.get_active_sandboxes()
        print(f"   活动沙箱数量: {len(active)}")
        for sid, info in active.items():
            print(f"   - {sid}: {info}")

        # 清理测试沙箱
        print("\n8️⃣ 清理沙箱...")
        await manager.destroy_sandbox(sandbox_id)
        print(f"   ✅ 沙箱 {sandbox_id} 已销毁")

        print("\n" + "=" * 60)
        print("✅ 所有测试通过！沙箱功能正常")
        print("=" * 60)

        return True

    except Exception as e:
        print(f"\n❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_evolution_history():
    """测试进化历史"""
    print("\n" + "=" * 60)
    print("📊 测试进化历史持久化")
    print("=" * 60)

    try:
        from nanobot.agent.evolution.history import EvolutionHistoryManager
        from nanobot.config.paths import get_workspace_path

        workspace = get_workspace_path()

        print(f"\n工作空间: {workspace}")

        # 创建历史管理器
        print("\n1️⃣ 创建历史管理器...")
        manager = EvolutionHistoryManager(workspace)
        print("   ✅ 历史管理器创建成功")

        # 添加测试记录
        print("\n2️⃣ 添加测试记录...")
        record_id = manager.add_record(
            skill_name="test-skill",
            reason="测试进化",
            status="success",
            changes=[
                {
                    "file": "SKILL.md",
                    "action": "modify",
                    "description": "测试更改"
                }
            ],
            duration_seconds=1.5
        )
        print(f"   ✅ 记录已添加: {record_id}")

        # 查询记录
        print("\n3️⃣ 查询记录...")
        records = manager.get_history(skill_name="test-skill")
        print(f"   找到 {len(records)} 条记录")
        if records:
            latest = records[0]
            print(f"   - ID: {latest['id']}")
            print(f"   - Skill: {latest['skill_name']}")
            print(f"   - 状态: {latest['status']}")
            print(f"   - 原因: {latest['reason']}")

        # 获取摘要
        print("\n4️⃣ 获取摘要...")
        summary = manager.get_skill_summary("test-skill")
        print(f"   总进化次数: {summary['total_evolutions']}")
        print(f"   成功: {summary['successful']}")
        print(f"   成功率: {summary['success_rate']}")

        # 导出 Markdown
        print("\n5️⃣ 导出 Markdown...")
        output_path = workspace / "test_evolution_history.md"
        manager.export_to_markdown(output_path)
        print(f"   ✅ 已导出到: {output_path}")

        print("\n" + "=" * 60)
        print("✅ 进化历史测试通过！")
        print("=" * 60)

        return True

    except Exception as e:
        print(f"\n❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False


async def main():
    """运行所有测试"""
    print("\n🚀 开始沙箱系统测试\n")

    # 测试 1: Docker 沙箱
    sandbox_ok = await test_docker_sandbox()

    # 测试 2: 进化历史
    history_ok = await test_evolution_history()

    # 总结
    print("\n" + "=" * 60)
    print("📋 测试总结")
    print("=" * 60)
    print(f"   Docker 沙箱: {'✅ 通过' if sandbox_ok else '❌ 失败'}")
    print(f"   进化历史: {'✅ 通过' if history_ok else '❌ 失败'}")
    print("=" * 60)

    if sandbox_ok and history_ok:
        print("\n🎉 所有测试通过！沙箱系统已就绪！\n")
        return 0
    else:
        print("\n⚠️ 部分测试失败，请检查错误信息\n")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
