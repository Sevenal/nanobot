"""Excel/CSV 解析模块."""

import pandas as pd
from pathlib import Path
from typing import Dict, List, Any
import hashlib


class ExcelParser:
    """Excel/CSV 商品信息解析器."""

    REQUIRED_FIELDS = [
        "商品名称", "运营成本价", "主图链接"
    ]

    OPTIONAL_FIELDS = [
        "价格", "库存", "商品描述", "分类ID",
        "SKU规格", "营销图", "视频链接",
        "活动标签", "物流模板ID"
    ]

    def parse(self, file_path: str) -> List[Dict[str, Any]]:
        """解析 Excel/CSV 文件."""
        path = Path(file_path).expanduser()

        if not path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")

        # 根据文件类型解析
        if path.suffix in ['.xlsx', '.xls']:
            df = pd.read_excel(path)
        elif path.suffix == '.csv':
            # 尝试不同编码
            try:
                df = pd.read_csv(path, encoding='utf-8')
            except UnicodeDecodeError:
                df = pd.read_csv(path, encoding='gbk')
        else:
            raise ValueError(f"不支持的文件格式: {path.suffix}")

        # 验证必需字段
        missing = [f for f in self.REQUIRED_FIELDS if f not in df.columns]
        if missing:
            # 尝试匹配常见列名变体
            column_mapping = self._map_columns(df.columns.tolist())
            if column_mapping:
                df = df.rename(columns=column_mapping)
                missing = [f for f in self.REQUIRED_FIELDS if f not in df.columns]

        if missing:
            raise ValueError(f"缺少必需字段: {', '.join(missing)}\n可用的列: {', '.join(df.columns.tolist())}")

        # 转换为字典列表并添加 ID
        products = []
        for idx, row in df.iterrows():
            product = self._clean_product(row.to_dict())
            product['id'] = self._generate_id(product, idx)

            # 如果没有价格但有成本价，设置默认价格
            if not product.get("价格") and product.get("运营成本价"):
                product['价格'] = float(product['运营成本价']) * 1.3  # 默认30%利润

            # 设置默认库存
            if not product.get("库存"):
                product['库存'] = 100

            products.append(product)

        return products

    def _clean_product(self, product: Dict[str, Any]) -> Dict[str, Any]:
        """清洗单个商品数据."""
        cleaned = {}
        for key, value in product.items():
            # 移除 NaN 值
            if pd.notna(value):
                cleaned[key] = value
        return cleaned

    def _generate_id(self, product: Dict[str, Any], idx: int) -> str:
        """生成唯一 ID."""
        content = f"{product.get('商品名称')}{product.get('运营成本价')}{idx}"
        return hashlib.md5(content.encode()).hexdigest()[:12]

    def _map_columns(self, columns: List[str]) -> Dict[str, str]:
        """映射常见的列名变体."""
        mapping = {}
        column_lower_map = {c.lower(): c for c in columns}

        # 商品名称
        for name in ["商品名称", "产品名称", "名称", "title", "product_name"]:
            if name.lower() in column_lower_map or name in columns:
                mapping[column_lower_map.get(name.lower(), name)] = "商品名称"
                break

        # 成本价
        for name in ["运营成本价", "成本价", "进价", "cost_price", "cost"]:
            if name.lower() in column_lower_map or name in columns:
                mapping[column_lower_map.get(name.lower(), name)] = "运营成本价"
                break

        # 主图
        for name in ["主图链接", "商品图片", "图片", "image", "主图", "图片链接"]:
            if name.lower() in column_lower_map or name in columns:
                mapping[column_lower_map.get(name.lower(), name)] = "主图链接"
                break

        return mapping
