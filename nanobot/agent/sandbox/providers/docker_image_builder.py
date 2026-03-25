"""Docker 镜像构建器 - 支持依赖管理和预构建镜像

此模块提供 Docker 镜像构建功能，支持：
- 从 Dockerfile 构建
- 从 requirements.txt 构建
- 常用依赖预装
"""

import asyncio
import tempfile
import os
from pathlib import Path
from typing import List, Optional, Dict, Any
from loguru import logger


class DockerImageBuilder:
    """Docker 镜像构建器

    用于为特定技能预构建自定义镜像，支持：
    - 从 Dockerfile 构建
    - 从 requirements.txt 构建
    - 常用依赖预装
    """

    @staticmethod
    async def build_from_dockerfile(
        dockerfile_path: str,
        image_tag: str,
        build_context: Optional[str] = None
    ) -> str:
        """从 Dockerfile 构建镜像

        Args:
            dockerfile_path: Dockerfile 路径
            image_tag: 镜像标签（如 nanobot/web-scraper:latest）
            build_context: 构建上下文路径（默认为 Dockerfile 所在目录）

        Returns:
            构建的镜像标签
        """
        build_context = build_context or str(Path(dockerfile_path).parent)

        cmd = [
            "docker", "build",
            "-f", dockerfile_path,
            "-t", image_tag,
            build_context
        ]

        result = await DockerImageBuilder._run_command(cmd, timeout=600)

        if result.returncode != 0:
            raise RuntimeError(f"构建镜像失败: {result.stderr}")

        logger.info(f"成功构建镜像: {image_tag}")
        return image_tag

    @staticmethod
    async def build_from_requirements(
        base_image: str,
        requirements: List[str],
        image_tag: str,
        system_packages: Optional[List[str]] = None
    ) -> str:
        """从依赖列表构建镜像

        Args:
            base_image: 基础镜像（如 python:3.11-slim）
            requirements: Python 依赖列表
            image_tag: 目标镜像标签
            system_packages: 可选的系统包列表

        Returns:
            构建的镜像标签
        """
        # 创建临时 Dockerfile
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='_Dockerfile') as f:
            f.write(f"FROM {base_image}\n")
            f.write("WORKDIR /workspace\n")

            # 安装系统包
            if system_packages:
                packages = " ".join(system_packages)
                f.write(f"RUN apt-get update && apt-get install -y {packages} && apt-get clean\n")

            # 安装 Python 依赖
            if requirements:
                req_content = "\n".join(requirements)
                f.write(f"RUN echo '{req_content}' > /tmp/requirements.txt && "
                       f"pip install --no-cache-dir -r /tmp/requirements.txt && "
                       f"rm /tmp/requirements.txt\n")

            dockerfile_path = f.name

        try:
            return await DockerImageBuilder.build_from_dockerfile(
                dockerfile_path, image_tag
            )
        finally:
            os.unlink(dockerfile_path)

    @staticmethod
    async def build_base_images(
        base_image: str = "python:3.11-slim"
    ) -> Dict[str, str]:
        """构建常用基础镜像

        Args:
            base_image: 基础镜像

        Returns:
            镜像类型到标签的映射
        """
        logger.info("开始构建基础镜像...")
        images = {}

        # 通用 Python 镜像
        try:
            images["python-general"] = await DockerImageBuilder.build_from_requirements(
                base_image=base_image,
                requirements=[
                    "requests>=2.31.0",
                    "httpx>=0.24.0",
                    "beautifulsoup4>=4.12.0",
                    "lxml>=4.9.0",
                    "pyyaml>=6.0",
                    "python-dotenv>=1.0.0",
                ],
                system_packages=["git", "curl", "wget", "vim"],
                image_tag="nanobot/python-general:latest"
            )
        except Exception as e:
            logger.warning(f"构建 python-general 镜像失败: {e}")

        # 数据科学镜像
        try:
            images["python-data"] = await DockerImageBuilder.build_from_requirements(
                base_image=base_image,
                requirements=[
                    "pandas>=2.0.0",
                    "numpy>=1.24.0",
                    "matplotlib>=3.7.0",
                    "seaborn>=0.12.0",
                    "scikit-learn>=1.3.0",
                    "jupyter>=1.0.0",
                ],
                system_packages=["git", "curl", "gcc", "g++"],
                image_tag="nanobot/python-data:latest"
            )
        except Exception as e:
            logger.warning(f"构建 python-data 镜像失败: {e}")

        # Web 抓取镜像
        try:
            images["web-scraper"] = await DockerImageBuilder.build_from_requirements(
                base_image=base_image,
                requirements=[
                    "requests>=2.31.0",
                    "httpx>=0.24.0",
                    "beautifulsoup4>=4.12.0",
                    "lxml>=4.9.0",
                    "selenium>=4.15.0",
                    "playwright>=1.40.0",
                ],
                system_packages=["git", "curl"],
                image_tag="nanobot/web-scraper:latest"
            )
        except Exception as e:
            logger.warning(f"构建 web-scraper 镜像失败: {e}")

        logger.info(f"基础镜像构建完成: {list(images.keys())}")
        return images

    @staticmethod
    async def check_image_exists(image_tag: str) -> bool:
        """检查镜像是否存在"""
        cmd = ["docker", "inspect", "-f", "{{.Id}}", image_tag]
        result = await DockerImageBuilder._run_command(cmd, timeout=10)
        return result.returncode == 0

    @staticmethod
    async def get_image_size(image_tag: str) -> str:
        """获取镜像大小"""
        cmd = ["docker", "images", image_tag, "--format", "{{.Size}}"]
        result = await DockerImageBuilder._run_command(cmd, timeout=10)
        if result.returncode == 0:
            return result.stdout.strip()
        return "Unknown"

    @staticmethod
    async def list_images() -> List[str]:
        """列出所有 nanobot 镜像"""
        cmd = ["docker", "images", "nanobot/*", "--format", "{{.Repository}}:{{.Tag}}"]
        result = await DockerImageBuilder._run_command(cmd, timeout=10)
        if result.returncode == 0:
            return [line.strip() for line in result.stdout.split('\n') if line.strip()]
        return []

    @staticmethod
    async def _run_command(cmd: list, timeout: int = 60) -> Any:
        """运行 shell 命令"""
        import subprocess

        loop = asyncio.get_event_loop()

        def _run():
            return subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=timeout
            )

        return await loop.run_in_executor(None, _run)
