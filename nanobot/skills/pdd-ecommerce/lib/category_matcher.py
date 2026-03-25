"""类目匹配模块 - 简化版，使用关键词匹配。"""

import json
from pathlib import Path
from typing import Dict, List


class CategoryMatcher:
    """类目匹配器，使用关键词匹配类目。"""

    def __init__(self, config):
        self.config = config
        self.category_map = self._load_category_map()

    def _load_category_map(self) -> Dict[str, int]:
        """加载类目映射."""
        category_file = Path(__file__).parent.parent / "data" / "categories" / "category_tree.json"

        # 默认类目映射
        default_map = {
            # 服装类
            "服装": 10001,
            "男装": 10002,
            "女装": 10003,
            "童装": 10004,
            "鞋": 10005,
            "内衣": 10006,
            # 食品类
            "食品": 20001,
            "零食": 20002,
            "饮料": 20003,
            "生鲜": 20004,
            # 数码类
            "手机": 30001,
            "电脑": 30002,
            "数码": 30003,
            "电器": 30004,
            # 家居类
            "家居": 40001,
            "床品": 40002,
            "厨具": 40003,
            # 美妆类
            "护肤": 50001,
            "彩妆": 50002,
            "美妆": 50003,
        }

        if category_file.exists():
            try:
                with open(category_file, encoding="utf-8") as f:
                    return json.load(f)
            except:
                pass

        return default_map

    def match_category(self, product: dict) -> tuple:
        """匹配商品类目，返回 (类目名称, 类目ID)."""
        name = product.get("商品名称", "")
        description = product.get("商品描述", "")

        # 合并文本
        text = f"{name} {description}".lower()

        # 关键词匹配
        best_match = None
        best_score = 0

        for keyword, cat_id in self.category_map.items():
            if keyword.lower() in text:
                # 计算匹配分数
                score = text.count(keyword.lower())
                if score > best_score:
                    best_score = score
                    best_match = (keyword, cat_id)

        if best_match:
            return best_match

        # 默认类目
        return ("其他", 0)
