"""SKU 检测模块 - 简化版，基于关键词判断。"""

from typing import Dict, List


class SKUDetector:
    """SKU 检测器，基于商品特征判断规格。"""

    def __init__(self, config):
        self.config = config

    def detect_and_create_skus(self, product: dict) -> dict:
        """检测并创建 SKU."""
        # 检查是否已有规格信息
        if product.get("SKU规格") or product.get("颜色") or product.get("尺码"):
            return self._parse_existing_skus(product)

        # 判断是否应该有规格
        should_have_sku = self._should_have_sku(product)

        if not should_have_sku:
            # 单规格商品
            return self._create_single_sku(product)
        else:
            # 尝试推断规格
            return self._infer_skus(product)

    def _has_sku_info(self, product: dict) -> bool:
        """检查是否已有规格信息."""
        return bool(product.get("SKU规格") or product.get("颜色") or product.get("尺码"))

    def _should_have_sku(self, product: dict) -> bool:
        """判断是否应该有规格."""
        name = product.get("商品名称", "").lower()

        # 服装类商品通常有规格
        clothing_keywords = ["衣服", "裤", "裙", "鞋", "衫", "外套", "内衣", "t恤", " shirt", "pants"]
        for keyword in clothing_keywords:
            if keyword in name:
                return True

        return False

    def _infer_skus(self, product: dict) -> dict:
        """推断可能的规格."""
        name = product.get("商品名称", "").lower()

        # 简化版：根据商品类型推断默认规格
        if any(k in name for k in ["衣服", "衫", "裙", "t恤"]):
            # 服装类：颜色 + 尺码
            colors = ["黑色", "白色", "灰色", "蓝色"]
            sizes = ["S", "M", "L", "XL"]

            sku_list = []
            for color in colors:
                for size in sizes:
                    sku_list.append({
                        "spec": f"颜色:{color};尺码:{size}",
                        "price": product.get("价格", product.get("运营成本价", 0) * 1.3),
                        "quantity": product.get("库存", 100) // len(colors) // len(sizes)
                    })

            result = product.copy()
            result["SKU列表"] = sku_list
            return result

        elif "鞋" in name:
            # 鞋类：尺码
            sizes = ["36", "37", "38", "39", "40", "41", "42", "43"]

            sku_list = []
            for size in sizes:
                sku_list.append({
                    "spec": f"尺码:{size}",
                    "price": product.get("价格", product.get("运营成本价", 0) * 1.3),
                    "quantity": product.get("库存", 100) // len(sizes)
                })

            result = product.copy()
            result["SKU列表"] = sku_list
            return result

        # 默认单规格
        return self._create_single_sku(product)

    def _create_single_sku(self, product: dict) -> dict:
        """创建单规格商品."""
        result = product.copy()
        result["SKU列表"] = [{
            "spec": "默认",
            "price": float(product.get("价格", product.get("运营成本价", 0) * 1.3)),
            "quantity": int(product.get("库存", 100))
        }]
        return result

    def _parse_existing_skus(self, product: dict) -> dict:
        """解析已有的规格信息."""
        sku_spec = product.get("SKU规格", "")

        if not sku_spec:
            return self._create_single_sku(product)

        sku_list = []
        specs = str(sku_spec).split(";")

        for spec in specs:
            parts = str(spec).split(":")
            if len(parts) == 2:
                sku_list.append({
                    "spec": spec.strip(),
                    "price": float(product.get("价格", product.get("运营成本价", 0) * 1.3)),
                    "quantity": int(product.get("库存", 100))
                })

        result = product.copy()
        result["SKU列表"] = sku_list if sku_list else [{
            "spec": "默认",
            "price": float(product.get("价格", product.get("运营成本价", 0) * 1.3)),
            "quantity": int(product.get("库存", 100))
        }]
        return result
