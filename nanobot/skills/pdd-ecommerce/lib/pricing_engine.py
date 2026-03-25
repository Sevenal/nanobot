"""定价引擎模块。"""

from typing import Dict


class PricingEngine:
    """定价引擎，支持多种定价策略。"""

    def __init__(self, config):
        self.config = config

    def calculate_price(self, product: dict) -> dict:
        """计算商品售价."""
        cost_price = product.get("运营成本价", 0)

        if not cost_price or float(cost_price) <= 0:
            # 没有成本价，使用原价或默认
            return product

        cost_price = float(cost_price)

        # 获取定价策略
        strategy = self.config.pricing.strategy

        if strategy == "profit_margin":
            selling_price = self._calculate_by_profit_margin(cost_price)
        elif strategy == "competitor":
            selling_price = self._calculate_by_competitor(product, cost_price)
        else:
            selling_price = cost_price * 1.3  # 默认30%利润

        result = product.copy()
        result["价格"] = round(selling_price, 2)
        result["定价依据"] = f"成本价 ¥{cost_price} × {self.config.pricing.profit_margin + 1:.2f}"

        return result

    def _calculate_by_profit_margin(self, cost_price: float) -> float:
        """根据利润率计算价格."""
        profit_margin = self.config.pricing.profit_margin
        return cost_price * (1 + profit_margin)

    def _calculate_by_competitor(self, product: dict, cost_price: float) -> float:
        """根据竞品价格计算（简化版）。"""
        competitor_price = float(product.get("市场参考价", cost_price * 1.5))
        # 比竞品低5%
        return competitor_price * 0.95
