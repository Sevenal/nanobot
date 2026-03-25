"""测试沙箱系统导入"""

import sys
from pathlib import Path

# 设置 UTF-8 输出
if sys.platform == "win32":
    import codecs
    sys.stdout = codecs.getwriter("utf-8")(sys.stdout.detach())

# 添加项目路径
sys.path.insert(0, str(Path(__file__).parent.parent))

def test_imports():
    """测试所有沙箱相关模块的导入"""
    print("=" * 60)
    print("测试沙箱系统导入")
    print("=" * 60)

    try:
        print("\n1. 导入配置...")
        from nanobot.config.schema import SandboxConfig, DockerSandboxConfig
        print("   ✅ 配置模块导入成功")

        print("\n2. 导入沙箱管理器...")
        from nanobot.agent.sandbox.manager import SandboxManager
        print("   ✅ 沙箱管理器导入成功")

        print("\n3. 导入进化工作流...")
        from nanobot.agent.evolution.workflow import SkillEvolutionWorkflow
        print("   ✅ 进化工作流导入成功")

        print("\n4. 导入进化历史管理器...")
        from nanobot.agent.evolution.history import EvolutionHistoryManager
        print("   ✅ 进化历史管理器导入成功")

        print("\n5. 导入 Git 版本管理器...")
        from nanobot.agent.evolution.git_manager import GitVersionManager
        print("   ✅ Git 版本管理器导入成功")

        print("\n6. 导入回滚管理器...")
        from nanobot.agent.evolution.rollback import RollbackManager
        print("   ✅ 回滚管理器导入成功")

        print("\n7. 导入决策引擎...")
        from nanobot.agent.evolution.decider import EvolutionTrigger
        print("   ✅ 决策引擎导入成功")

        print("\n8. 导入验证系统...")
        from nanobot.agent.evolution.verification import EvolutionVerifier
        print("   ✅ 验证系统导入成功")

        print("\n9. 导入沙箱工具...")
        from nanobot.agent.tools.sandbox import SandboxTool
        print("   ✅ 沙箱工具导入成功")

        print("\n" + "=" * 60)
        print("所有模块导入成功！")
        print("=" * 60)
        return True

    except Exception as e:
        print(f"\n错误: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = test_imports()
    sys.exit(0 if success else 1)
