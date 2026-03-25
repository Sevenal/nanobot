"""Skill 依赖解析器

从 skill 的 SKILL.md 或 requirements.txt 解析依赖
"""

import re
import tempfile
from pathlib import Path
from typing import List, Dict, Optional
from loguru import logger


class SkillDependencyResolver:
    """Skill 依赖解析器

    从 skill 的 SKILL.md 或 requirements.txt 解析依赖
    """

    @staticmethod
    def parse_skill_dependencies(skill_path: Path) -> Dict:
        """解析 skill 的依赖配置

        Args:
            skill_path: skill 目录路径

        Returns:
            依赖配置字典:
            {
                "python": List[str],  # Python 依赖
                "system": List[str],  # 系统包依赖
                "dockerfile": str | None,  # Dockerfile 路径
                "base_image": str | None,  # 基础镜像
                "image_type": str,  # 镜像类型: dynamic | custom | prebuilt
                "prebuilt_image": str | None  # 预构建镜像名称
            }
        """
        skill_file = skill_path / "SKILL.md"

        if not skill_file.exists():
            # 如果没有 SKILL.md，尝试读取 requirements.txt
            return {
                "python": SkillDependencyResolver.get_requirements_txt(skill_path),
                "system": [],
                "dockerfile": None,
                "base_image": "python:3.11-slim",
                "image_type": "dynamic",
                "prebuilt_image": None
            }

        # 读取 YAML frontmatter
        try:
            import yaml
        except ImportError:
            logger.warning("PyYAML not installed, skipping YAML parsing")
            return {
                "python": SkillDependencyResolver.get_requirements_txt(skill_path),
                "system": [],
                "dockerfile": None,
                "base_image": "python:3.11-slim",
                "image_type": "dynamic",
                "prebuilt_image": None
            }

        content = skill_file.read_text()

        # 提取 YAML frontmatter
        yaml_match = re.match(r'^---\n(.*?)\n---\n', content, re.DOTALL)

        if not yaml_match:
            return {
                "python": SkillDependencyResolver.get_requirements_txt(skill_path),
                "system": [],
                "dockerfile": None,
                "base_image": "python:3.11-slim",
                "image_type": "dynamic",
                "prebuilt_image": None
            }

        try:
            frontmatter = yaml.safe_load(yaml_match.group(1))
            if not isinstance(frontmatter, dict):
                frontmatter = {}

            deps = frontmatter.get("dependencies", {})
            sandbox_config = frontmatter.get("sandbox", {})

            return {
                "python": deps.get("python", []),
                "system": deps.get("system", []),
                "dockerfile": deps.get("dockerfile"),
                "base_image": deps.get("base_image", sandbox_config.get("base_image", "python:3.11-slim")),
                "image_type": sandbox_config.get("image_type", deps.get("image_type", "dynamic")),
                "prebuilt_image": sandbox_config.get("prebuilt_image", deps.get("prebuilt_image"))
            }
        except yaml.YAMLError as e:
            logger.warning(f"Failed to parse YAML in {skill_file}: {e}")
            return {
                "python": SkillDependencyResolver.get_requirements_txt(skill_path),
                "system": [],
                "dockerfile": None,
                "base_image": "python:3.11-slim",
                "image_type": "dynamic",
                "prebuilt_image": None
            }

    @staticmethod
    def get_requirements_txt(skill_path: Path) -> List[str]:
        """从 requirements.txt 读取依赖

        Args:
            skill_path: skill 目录路径

        Returns:
            依赖列表
        """
        req_file = skill_path / "requirements.txt"

        if not req_file.exists():
            return []

        requirements = []
        for line in req_file.read_text().split('\n'):
            line = line.strip()
            # 跳过注释和空行
            if line and not line.startswith('#'):
                requirements.append(line)

        return requirements

    @staticmethod
    def create_dockerfile(
        skill_path: Path,
        output_path: Optional[Path] = None
    ) -> Path:
        """为 skill 创建 Dockerfile

        Args:
            skill_path: skill 目录路径
            output_path: 输出 Dockerfile 路径（默认为 skill_path/Dockerfile）

        Returns:
            Dockerfile 路径
        """
        deps = SkillDependencyResolver.parse_skill_dependencies(skill_path)
        output_path = output_path or (skill_path / "Dockerfile")

        base_image = deps["base_image"] or "python:3.11-slim"

        dockerfile_content = f"FROM {base_image}\n"
        dockerfile_content += "WORKDIR /workspace\n"

        # 安装系统包
        if deps["system"]:
            packages = " ".join(deps["system"])
            dockerfile_content += f"RUN apt-get update && apt-get install -y {packages} && apt-get clean\n"

        # 安装 Python 依赖
        python_deps = deps["python"]
        if not python_deps:
            # 如果没有在 frontmatter 中指定，尝试从 requirements.txt 读取
            python_deps = SkillDependencyResolver.get_requirements_txt(skill_path)

        if python_deps:
            # 创建 requirements.txt 内容
            req_content = "\n".join(python_deps)
            dockerfile_content += f"COPY requirements.txt /tmp/\n"
            dockerfile_content += f"RUN pip install --no-cache-dir -r /tmp/requirements.txt && rm /tmp/requirements.txt\n"

        output_path.write_text(dockerfile_content)
        logger.info(f"Created Dockerfile at {output_path}")

        return output_path
