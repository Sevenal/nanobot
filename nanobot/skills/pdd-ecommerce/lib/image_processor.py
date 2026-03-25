"""图片处理模块 - 简化版，支持基本图片处理。"""

import os
import hashlib
from pathlib import Path
from typing import Dict
from PIL import Image


class ImageProcessor:
    """图片处理器，支持简单的图片验证和处理。"""

    def __init__(self, config):
        self.config = config
        self.processed_dir = Path(config.storage.data_dir) / "images" / "processed"
        self.original_dir = Path(config.storage.data_dir) / "images" / "original"

    def process_product_images(self, product: dict) -> dict:
        """处理商品的所有图片."""
        processed = product.copy()

        # 处理主图
        if product.get("主图链接"):
            processed["主图链接"] = self._validate_image_url(product["主图链接"])

        # 处理营销图
        if product.get("营销图"):
            marketing_images = str(product["营销图"]).split(",") if product.get("营销图") else []
            processed["营销图"] = ",".join([self._validate_image_url(img.strip()) for img in marketing_images if img.strip()])

        return processed

    def _validate_image_url(self, url: str) -> str:
        """验证图片 URL."""
        # 简化版：只检查 URL 格式
        url = url.strip()

        if not url:
            return ""

        # 如果是本地路径，转换为绝对路径
        if url.startswith("/") or url.startswith("./"):
            return str(Path(url).resolve())

        # 如果是 HTTP URL，直接返回
        if url.startswith("http://") or url.startswith("https://"):
            return url

        # 其他情况，假设是相对路径
        return str(Path(url).resolve())

    def make_white_background(self, image_path: str) -> str:
        """将图片转换为白底（需要 PIL 支持）。"""
        try:
            # 如果是 URL，跳过处理
            if image_path.startswith("http"):
                return image_path

            img_path = Path(image_path)
            if not img_path.exists():
                return image_path

            # 打开图片
            img = Image.open(img_path)

            # 如果是 RGBA，转换为白底
            if img.mode == "RGBA":
                background = Image.new("RGB", img.size, (255, 255, 255))
                background.paste(img, mask=img.split()[3])
                img = background
            elif img.mode != "RGB":
                img = img.convert("RGB")

            # 调整尺寸
            target_size = self.config.image.target_size
            img.thumbnail((target_size, target_size), Image.Resampling.LANCZOS)

            # 创建正方形画布
            square = Image.new("RGB", (target_size, target_size), (255, 255, 255))
            offset = ((target_size - img.width) // 2, (target_size - img.height) // 2)
            square.paste(img, offset)

            # 保存
            self.processed_dir.mkdir(parents=True, exist_ok=True)
            filename = hashlib.md5(image_path.encode()).hexdigest()[:12] + ".jpg"
            output_path = self.processed_dir / filename
            square.save(output_path, "JPEG", quality=self.config.image.quality)

            return str(output_path)

        except Exception as e:
            print(f"图片处理失败: {e}")
            return image_path
