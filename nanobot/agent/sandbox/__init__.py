"""Nanobot 沙箱模块

提供基于 Docker 的沙箱环境，用于 skills 的安全进化和测试。
"""

from nanobot.agent.sandbox.manager import SandboxManager

__all__ = ["SandboxManager"]
