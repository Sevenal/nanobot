"""
演示：Agent Loop 与沙箱进化系统的集成

展示如何使用集成后的系统进行 skill 进化。
"""

import asyncio
from pathlib import Path

from nanobot.agent.loop import AgentLoop
from nanobot.bus.queue import MessageBus
from nanobot.config.schema import SandboxConfig, DockerSandboxConfig
from nanobot.providers.anthropic import AnthropicProvider


async def main():
    """主函数"""
    workspace = Path.cwd()

    # 配置沙箱系统
    sandbox_config = SandboxConfig()
    sandbox_config.enabled = True
    sandbox_config.docker = DockerSandboxConfig(
        enabled=True,
        base_image="python:3.11-slim",
        host_workspace="/tmp/nanobot-sandbox",
        auto_cleanup=True,
        timeout=300
    )

    # 创建 LLM Provider（需要配置 API key）
    # provider = AnthropicProvider(api_key="your-api-key")

    # 创建消息总线
    bus = MessageBus()

    # 创建 Agent Loop（集成沙箱系统）
    # loop = AgentLoop(
    #     bus=bus,
    #     provider=provider,
    #     workspace=workspace,
    #     sandbox_config=sandbox_config
    # )

    print("✅ Agent Loop 已创建，集成了以下功能：")
    print("  - 沙箱管理器 (SandboxManager)")
    print("  - 进化工作流 (SkillEvolutionWorkflow)")
    print("  - Git 版本管理器 (GitVersionManager)")
    print("  - 沙箱工具 (SandboxTool)")
    print()

    print("📋 使用示例：")
    print()
    print("1. 直接使用沙箱工具：")
    print('   response = await loop.process_direct(')
    print('       "使用 sandbox 工具创建一个沙箱环境"')
    print('   )')
    print()
    print("2. 自动触发进化：")
    print("   - 当 skill 重复失败 3 次以上")
    print("   - 当出现特定的错误模式（command not found, module not found 等）")
    print("   - 当执行时间超过阈值（300 秒）")
    print("   - 当错误率超过 50%")
    print()
    print("3. 手动触发进化：")
    print("   from nanobot.agent.evolution.decider import EvolutionTrigger")
    print("   EvolutionTrigger.should_evolve(")
    print("       skill_name='web-scraper',")
    print("       error_message='command not found',")
    print("       failure_count=3")
    print("   )")
    print()
    print("4. 查看进化历史：")
    print("   history = loop.evolution_workflow.get_evolution_history()")
    print()
    print("5. 查看 skill 状态：")
    print("   status = await loop.evolution_workflow.get_skill_status('web-scraper')")
    print()

    print("🔧 配置选项：")
    print()
    print("在 config.yaml 中配置：")
    print("""
tools:
  sandbox:
    enabled: true
    docker:
      enabled: true
      base_image: "python:3.11-slim"
      host_workspace: "/tmp/nanobot-sandbox"
      timeout: 300
      max_concurrent: 3
      auto_cleanup: true
      common_packages:
        - requests
        - httpx
        - pyyaml
      common_tools:
        - git
        - curl
    """)
    print()

    print("📊 监控和调试：")
    print()
    print("- 查看活动沙箱：loop.sandbox_manager.get_active_sandboxes()")
    print("- 查看失败计数：loop.skill_failures")
    print("- 查看进化历史：loop.evolution_workflow.get_evolution_history()")
    print("- 清理空闲沙箱：await loop.sandbox_manager.cleanup_idle_sandboxes()")
    print()

    print("⚠️  注意事项：")
    print()
    print("1. 确保 Docker daemon 正在运行")
    print("2. 首次运行会拉取基础镜像，可能需要较长时间")
    print("3. 进化过程会在后台异步执行，不会阻塞主 agent")
    print("4. 建议启用 auto_cleanup 以自动清理沙箱资源")
    print("5. 对于重要技能，建议使用 git 进行版本管理")
    print()


if __name__ == "__main__":
    asyncio.run(main())
