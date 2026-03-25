"""配置加载模块."""

import os
import yaml
from pathlib import Path
from dataclasses import dataclass
from typing import List, Dict, Any


@dataclass
class PddConfig:
    """拼多多配置."""

    client_id: str
    client_secret: str
    access_token: str
    api_base_url: str = "https://open-api.pinduoduo.com"


@dataclass
class SecurityConfig:
    """安全配置."""

    allowed_users: List[str]
    require_verification: bool = True


@dataclass
class StorageConfig:
    """存储配置."""

    data_dir: str
    upload_batch_size: int = 10
    max_file_size_mb: int = 50


@dataclass
class AIConfig:
    """AI 配置."""

    enabled: bool = True
    optimization_level: str = "advanced"
    model: str = "claude-opus-4-5"
    provider: str = "anthropic"

    @dataclass
    class Features:
        """AI 功能开关."""

        auto_description: bool = True
        auto_image_process: bool = True
        auto_pricing: bool = True
        auto_category: bool = True
        auto_sku: bool = True

    features: Features = None

    def __post_init__(self):
        if self.features is None:
            self.features = self.Features()


@dataclass
class PricingConfig:
    """定价配置."""

    strategy: str = "profit_margin"
    profit_margin: float = 0.3


@dataclass
class ImageConfig:
    """图片配置."""

    enable_white_bg: bool = True
    target_size: int = 800
    quality: int = 95


@dataclass
class Config:
    """总配置."""

    pdd: PddConfig
    security: SecurityConfig
    storage: StorageConfig
    ai: AIConfig
    pricing: PricingConfig
    image: ImageConfig

    @classmethod
    def load(cls) -> "Config":
        """加载配置文件."""
        config_file = Path(__file__).parent.parent / "config.yaml"

        # 如果配置文件不存在，使用默认值
        if not config_file.exists():
            return cls._default()

        with open(config_file, encoding="utf-8") as f:
            data = yaml.safe_load(f)

        # 环境变量覆盖
        pdd_data = data.get("pdd", {})
        pdd_data["client_id"] = os.getenv("PDD_CLIENT_ID", pdd_data.get("client_id", ""))
        pdd_data["client_secret"] = os.getenv("PDD_CLIENT_SECRET", pdd_data.get("client_secret", ""))
        pdd_data["access_token"] = os.getenv("PDD_ACCESS_TOKEN", pdd_data.get("access_token", ""))

        # 处理 AI features
        ai_data = data.get("ai", {})
        features_data = ai_data.get("features", {})
        ai_data["features"] = AIConfig.Features(**features_data)

        return cls(
            pdd=PddConfig(**pdd_data),
            security=SecurityConfig(**data.get("security", {"allowed_users": []})),
            storage=StorageConfig(**data.get("storage", {"data_dir": "~/.nanobot/skills/pdd-ecommerce/data"})),
            ai=AIConfig(**ai_data),
            pricing=PricingConfig(**data.get("pricing", {})),
            image=ImageConfig(**data.get("image", {}))
        )

    @classmethod
    def _default(cls) -> "Config":
        """默认配置."""
        return cls(
            pdd=PddConfig(
                client_id="",
                client_secret="",
                access_token=""
            ),
            security=SecurityConfig(
                allowed_users=[]
            ),
            storage=StorageConfig(
                data_dir="~/.nanobot/skills/pdd-ecommerce/data"
            ),
            ai=AIConfig(),
            pricing=PricingConfig(),
            image=ImageConfig()
        )


def load_config() -> Config:
    """加载配置的便捷函数."""
    return Config.load()
