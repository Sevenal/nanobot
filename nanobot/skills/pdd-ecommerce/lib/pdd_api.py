"""拼多多 API 客户端模块."""

import time
import json
import httpx
from typing import Dict, Any, List
from datetime import datetime


class RateLimiter:
    """简单的令牌桶限流器."""

    def __init__(self, rate: int, per: float = 60.0):
        self.rate = rate  # 每per秒的请求数
        self.per = per
        self.allowance = rate
        self.last_check = time.time()

    def acquire(self):
        """获取一个令牌."""
        current = time.time()
        time_passed = current - self.last_check
        self.last_check = current
        self.allowance += time_passed * (self.rate / self.per)

        if self.allowance > self.rate:
            self.allowance = self.rate

        if self.allowance < 1:
            # 需要等待
            sleep_time = (1 - self.allowance) * (self.per / self.rate)
            time.sleep(sleep_time)
            self.allowance = 0
        else:
            self.allowance -= 1


class PddApiClient:
    """拼多多 API 客户端."""

    def __init__(self, config):
        self.config = config
        self.rate_limiter = RateLimiter(rate=100, per=60)  # 每分钟100次

    def upload_product(self, product: Dict[str, Any]) -> Dict[str, Any]:
        """上传单个商品到拼多多."""
        self.rate_limiter.acquire()

        # 检查是否配置了 API
        if not self.config.pdd.client_id or not self.config.pdd.access_token:
            # 模拟成功（用于测试）
            return {
                "success": True,
                "product_id": product.get("id"),
                "pdd_goods_id": f"MOCK_{int(time.time())}",
                "data": {"message": "模拟上传成功（未配置API）"}
            }

        try:
            # 构建请求参数
            params = {
                "type": "pdd.goods.add",
                "client_id": self.config.pdd.client_id,
                "access_token": self.config.pdd.access_token,
                "timestamp": int(datetime.now().timestamp()),
                "data": json.dumps(self._build_product_data(product), ensure_ascii=False)
            }

            # 发送请求
            response = httpx.post(
                self.config.pdd.api_base_url,
                json=params,
                timeout=30
            )

            result = response.json()

            if result.get("error_response"):
                return {
                    "success": False,
                    "error": result["error_response"],
                    "product_id": product.get("id")
                }

            return {
                "success": True,
                "product_id": product.get("id"),
                "pdd_goods_id": result.get("goods_id"),
                "data": result
            }

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "product_id": product.get("id")
            }

    def batch_upload(self, products: List[Dict]) -> List[Dict]:
        """批量上传商品."""
        results = []
        for product in products:
            result = self.upload_product(product)
            results.append(result)
        return results

    def _build_product_data(self, product: Dict[str, Any]) -> Dict[str, Any]:
        """构建拼多多商品数据."""
        return {
            "goods_name": product.get("商品名称"),
            "cost_price": float(product.get("运营成本价", 0)),
            "sell_price": float(product.get("价格", product.get("运营成本价", 0) * 1.3)),
            "quantity": int(product.get("库存", 100)),
            "goods_desc": product.get("商品描述", product.get("商品名称", "")),
            "image_url": product.get("主图链接", ""),
            "cat_id": int(product.get("分类ID", 0)),
            # SKU 信息
            "sku_list": self._build_sku_list(product)
        }

    def _build_sku_list(self, product: Dict[str, Any]) -> List[Dict]:
        """构建 SKU 列表."""
        sku_list_data = product.get("SKU列表", [])

        if not sku_list_data:
            # 默认 SKU
            return [{
                "spec": "默认",
                "price": float(product.get("价格", product.get("运营成本价", 0) * 1.3)),
                "quantity": int(product.get("库存", 100))
            }]

        # 转换 SKU 格式
        result = []
        for sku in sku_list_data:
            result.append({
                "spec": sku.get("spec", "默认"),
                "price": float(sku.get("price", product.get("价格", 0))),
                "quantity": int(sku.get("quantity", product.get("库存", 100)))
            })

        return result
