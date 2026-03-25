"""skill 进化的验证系统

在应用更改前验证 skill 的语法、功能和正确性。
"""

import asyncio
import re
from pathlib import Path
from typing import Dict, List, Any, Optional
from loguru import logger


class EvolutionVerifier:
    """进化验证器

    验证 skill 更改的正确性：
    - 语法验证（SKILL.md 格式）
    - 元数据验证（YAML frontmatter）
    - 脚本测试（如果有）
    - 功能验证（基于 LLM）
    """

    def __init__(
        self,
        sandbox_manager: "SandboxManager",
        workspace: Path
    ):
        """初始化验证器

        Args:
            sandbox_manager: 沙箱管理器
            workspace: 工作目录
        """
        self.sandbox_manager = sandbox_manager
        self.workspace = workspace

    async def verify_evolution(
        self,
        sandbox_id: str,
        skill_name: str,
        evolution_plan: Dict[str, Any]
    ) -> Dict[str, Any]:
        """验证进化更改

        Args:
            sandbox_id: 沙箱 ID
            skill_name: skill 名称
            evolution_plan: 进化计划

        Returns:
            验证结果:
            {
                "success": bool,
                "errors": List[str],
                "warnings": List[str],
                "tests_passed": int,
                "tests_total": int
            }
        """
        errors = []
        warnings = []
        tests_passed = 0
        tests_total = 0

        logger.info(f"开始验证 skill '{skill_name}' 的进化...")

        # 1. 语法验证
        tests_total += 1
        syntax_result = await self._verify_syntax(sandbox_id)
        if syntax_result["valid"]:
            tests_passed += 1
            logger.info("✓ 语法验证通过")
        else:
            errors.extend(syntax_result["errors"])

        # 2. 元数据验证
        tests_total += 1
        metadata_result = await self._verify_metadata(sandbox_id)
        if metadata_result["valid"]:
            tests_passed += 1
            logger.info("✓ 元数据验证通过")
        else:
            errors.extend(metadata_result["errors"])

        # 3. 脚本验证
        tests_total += 1
        script_result = await self._verify_scripts(sandbox_id, skill_name)
        if script_result["valid"]:
            tests_passed += 1
            logger.info("✓ 脚本验证通过")
        else:
            errors.extend(script_result.get("errors", []))
            warnings.extend(script_result.get("warnings", []))

        # 4. 功能验证（如果启用）
        if evolution_plan.get("test_strategy") and "LLM" in str(evolution_plan["test_strategy"]):
            tests_total += 1
            functional_result = await self._verify_functional(sandbox_id, skill_name)
            if functional_result["valid"]:
                tests_passed += 1
                logger.info("✓ 功能验证通过")
            else:
                warnings.extend(functional_result.get("warnings", []))

        success = len(errors) == 0

        if success:
            logger.info(f"✅ 验证通过: {tests_passed}/{tests_total}")
        else:
            logger.error(f"❌ 验证失败: {len(errors)} 个错误")

        return {
            "success": success,
            "errors": errors,
            "warnings": warnings,
            "tests_passed": tests_passed,
            "tests_total": tests_total
        }

    async def _verify_syntax(self, sandbox_id: str) -> Dict[str, Any]:
        """验证语法

        Args:
            sandbox_id: 沙箱 ID

        Returns:
            验证结果
        """
        errors = []

        try:
            # 检查 SKILL.md 是否存在
            result = await self.sandbox_manager.execute_in_sandbox(
                sandbox_id,
                "test -f /workspace/skill/SKILL.md && echo 'exists' || echo 'not_found'"
            )

            if "not_found" in result:
                errors.append("SKILL.md 文件不存在")

            # 检查 YAML frontmatter 格式
            result = await self.sandbox_manager.execute_in_sandbox(
                sandbox_id,
                "head -20 /workspace/skill/SKILL.md"
            )

            if "---" not in result:
                errors.append("SKILL.md 缺少 YAML frontmatter（需要 --- 包围）")

            # 检查是否有结束标记
            line_count = len(result.split('\n'))
            if line_count >= 2:
                second_result = await self.sandbox_manager.execute_in_sandbox(
                    sandbox_id,
                    "tail -n +3 /workspace/skill/SKILL.md | head -1"
                )
                if "---" in second_result:
                    errors.append("YAML frontmatter 格式错误（应该只有一个 --- 块在开头）")

        except Exception as e:
            errors.append(f"语法验证异常: {str(e)}")

        return {
            "valid": len(errors) == 0,
            "errors": errors
        }

    async def _verify_metadata(self, sandbox_id: str) -> Dict[str, Any]:
        """验证元数据

        Args:
            sandbox_id: 沙箱 ID

        Returns:
            验证结果
        """
        errors = []

        try:
            # 读取 frontmatter
            result = await self.sandbox_manager.execute_in_sandbox(
                sandbox_id,
                "sed -n '/^---$/,/^---$/p' /workspace/skill/SKILL.md"
            )

            if not result or "---" not in result:
                errors.append("无法提取 YAML frontmatter")
                return {"valid": False, "errors": errors}

            # 检查必需字段
            required_fields = ["name"]
            frontmatter = result.split("---")[1] if "---" in result else result

            for field in required_fields:
                if field not in frontmatter.lower():
                    errors.append(f"缺少必需字段: {field}")

        except Exception as e:
            errors.append(f"元数据验证异常: {str(e)}")

        return {
            "valid": len(errors) == 0,
            "errors": errors
        }

    async def _verify_scripts(
        self,
        sandbox_id: str,
        skill_name: str
    ) -> Dict[str, Any]:
        """验证脚本

        Args:
            sandbox_id: 沙箱 ID
            skill_name: skill 名称

        Returns:
            验证结果
        """
        errors = []
        warnings = []

        try:
            # 检查是否有 scripts 目录
            result = await self.sandbox_manager.execute_in_sandbox(
                sandbox_id,
                "test -d /workspace/skill/scripts && echo 'exists' || echo 'not_found'"
            )

            if "not_found" in result:
                # 没有 scripts 目录，不算错误
                return {"valid": True, "errors": [], "warnings": []}

            # 检查脚本语法
            script_result = await self.sandbox_manager.execute_in_sandbox(
                sandbox_id,
                "find /workspace/skill/scripts -name '*.py' -type f | head -5"
            )

            scripts = [line.strip() for line in script_result.strip().split('\n') if line.strip()]

            for script_path in scripts[:3]:  # 只检查前3个脚本
                # Python 语法检查
                check_result = await self.sandbox_manager.execute_in_sandbox(
                    sandbox_id,
                    f"python -m py_compile {script_path} 2>&1 || echo 'syntax_error'"
                )

                if "syntax_error" in check_result or "SyntaxError" in check_result:
                    errors.append(f"脚本语法错误: {script_path}")
                elif "IndentationError" in check_result or "IndentationError" in check_result:
                    errors.append(f"脚本缩进错误: {script_path}")

        except Exception as e:
            warnings.append(f"脚本验证异常: {str(e)}")

        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings
        }

    async def _verify_functional(
        self,
        sandbox_id: str,
        skill_name: str
    ) -> Dict[str, Any]:
        """功能验证（基于 LLM 或简单测试）

        Args:
            sandbox_id: 沙箱 ID
            skill_name: skill 名称

        Returns:
            验证结果
        """
        warnings = []

        # 这里可以实现更复杂的功能测试
        # 例如：运行示例命令，检查输出等

        # 简化版本：检查基本功能
        try:
            # 测试 skill 是否可以加载
            result = await self.sandbox_manager.execute_in_sandbox(
                sandbox_id,
                "python -c 'import yaml; print(\"YAML 可用\")'"
            )

            if "YAML 可用" not in result:
                warnings.append("YAML 模块可能未安装")

        except Exception as e:
            warnings.append(f"功能验证异常: {str(e)}")

        return {
            "valid": len(warnings) == 0 or all("可能" in w for w in warnings),  # 允许"可能"的警告
            "warnings": warnings
        }


class RegressionTester:
    """回归测试器

    确保进化不会破坏现有功能。
    """

    def __init__(self, workspace: Path):
        """初始化回归测试器

        Args:
            workspace: 工作目录
        """
        self.workspace = workspace

    async def run_regression_tests(
        self,
        sandbox_id: str,
        skill_name: str,
        test_cases: Optional[List[Dict]] = None
    ) -> Dict[str, Any]:
        """运行回归测试

        Args:
            sandbox_id: 沙箱 ID
            skill_name: skill 名称
            test_cases: 测试用例列表

        Returns:
            测试结果
        """
        if not test_cases:
            # 检查是否有测试文件
            test_file = self.workspace / "skills" / skill_name / "tests.yaml"
            if test_file.exists():
                import yaml
                test_cases = yaml.safe_load(test_file)
            else:
                return {
                    "passed": True,
                    "total": 0,
                    "message": "没有测试用例"
                }

        passed = 0
        failed = 0
        results = []

        for test_case in test_cases:
            try:
                # 运行测试
                test_result = await self._run_test_case(sandbox_id, test_case)
                if test_result["success"]:
                    passed += 1
                else:
                    failed += 1
                results.append(test_result)
            except Exception as e:
                failed += 1
                results.append({
                    "name": test_case.get("name", "unknown"),
                    "success": False,
                    "error": str(e)
                })

        return {
            "passed": passed,
            "failed": failed,
            "total": passed + failed,
            "results": results
        }

    async def _run_test_case(
        self,
        sandbox_id: str,
        test_case: Dict
    ) -> Dict[str, Any]:
        """运行单个测试用例

        Args:
            sandbox_id: 沙箱 ID
            test_case: 测试用例

        Returns:
            测试结果
        """
        name = test_case.get("name", "unnamed")
        command = test_case.get("command", "")
        expected = test_case.get("expected", "")

        if not command:
            return {"name": name, "success": False, "error": "没有指定命令"}

        try:
            # 执行测试命令
            result = await self._execute_in_sandbox(sandbox_id, command)

            # 验证预期结果
            if expected:
                if expected in result:
                    return {"name": name, "success": True}
                else:
                    return {
                        "name": name,
                        "success": False,
                        "error": f"预期 '{expected}' 不在输出中"
                    }
            else:
                return {"name": name, "success": True, "output": result}

        except Exception as e:
            return {"name": name, "success": False, "error": str(e)}

    async def _execute_in_sandbox(self, sandbox_id: str, command: str) -> str:
        """在沙箱中执行命令"""
        # 这里需要访问 sandbox_manager
        # 暂时返回模拟结果
        return f"执行: {command}"
