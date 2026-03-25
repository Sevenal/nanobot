"""AI 优化模块."""

import os
import json
from typing import Dict, Any


class AIOptimizer:
    """AI 商品信息优化器."""

    def __init__(self, config):
        self.config = config
        self.api_key = os.getenv("ANTHROPIC_API_KEY")

    def optimize(self, product: Dict[str, Any], level: str = "standard") -> Dict[str, Any]:
        """优化商品信息."""
        if not self.config.ai.enabled:
            return product

        if level == "basic":
            return self._basic_optimize(product)
        elif level in ["standard", "advanced"]:
            return self._advanced_optimize(product)
        else:
            return product

    def _basic_optimize(self, product: Dict[str, Any]) -> Dict[str, Any]:
        """基础优化：只修复明显的问题."""
        optimized = product.copy()

        # 清理标题中的多余空格
        if optimized.get("商品名称"):
            optimized["商品名称"] = " ".join(str(optimized["商品名称"]).split())

        return optimized

    def _advanced_optimize(self, product: Dict[str, Any]) -> Dict[str, Any]:
        """高级优化：生成描述和优化标题."""
        if not self.api_key:
            # 如果没有 API key，返回基础优化
            return self._basic_optimize(product)

        try:
            import anthropic
            client = anthropic.Anthropic(api_key=self.api_key)

            prompt = f"""作为电商运营专家，请为以下商品生成吸引人的描述。

商品信息：
- 商品名称：{product.get('商品名称', '')}
- 运营成本价：¥{product.get('运营成本价', 0)}

请生成：
1. 优化后的商品标题（更具吸引力，包含关键词，控制在30字以内）
2. 优化后的商品描述（200字以内，突出卖点和特点）

请以JSON格式返回，格式如下：
{{
  "标题": "优化后的标题",
  "描述": "优化后的商品描述"
}}

只返回JSON，不要其他内容。"""

            response = client.messages.create(
                model=self.config.ai.model,
                max_tokens=1000,
                messages=[{"role": "user", "content": prompt}]
            )

            result_text = response.content[0].text.strip()

            # 清理可能的 markdown 标记
            if result_text.startswith("```json"):
                result_text = result_text[7:]
            if result_text.endswith("```"):
                result_text = result_text[:-3]
            result_text = result_text.strip()

            # 解析 JSON
            optimization = json.loads(result_text)

            # 应用优化
            optimized = product.copy()

            if optimization.get("标题"):
                optimized["商品名称"] = optimization["标题"]

            if optimization.get("描述"):
                optimized["商品描述"] = optimization["描述"]

            optimized["_optimized"] = True

            return optimized

        except Exception as e:
            print(f"AI 优化失败: {e}")
            return self._basic_optimize(product)


def generate_description(product: Dict[str, Any]) -> str:
    """简单的描述生成器（备用方案，不使用 AI）."""
    name = product.get("商品名称", "")
    cost_price = product.get("运营成本价", 0)

    desc = f"【{name}】\n\n"
    desc += "商品特点：\n"
    desc += "- 精选优质材质\n"
    desc += "- 品质保证，值得信赖\n"
    desc += "- 价格实惠，性价比高\n\n"
    desc += f"原价：¥{float(cost_price) * 1.5:.2f}\n"
    desc += f"现价：¥{float(cost_price) * 1.3:.2f}\n\n"
    desc += "库存有限，欲购从速！"

    return desc
