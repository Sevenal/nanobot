"""数据验证模块。"""

from pathlib import Path
from typing import Dict, Any, Tuple, List


def setup_environment():
    """设置环境，创建必要的目录和文件."""
    skill_dir = Path(__file__).parent.parent
    data_dir = skill_dir / "data"
    uploads_dir = data_dir / "uploads"
    categories_dir = data_dir / "categories"
    images_dir = data_dir / "images"
    logs_dir = skill_dir / "logs"

    # 创建目录
    for dir_path in [data_dir, uploads_dir, categories_dir, images_dir, logs_dir]:
        dir_path.mkdir(parents=True, exist_ok=True)

    # 创建类目文件
    category_file = categories_dir / "category_tree.json"
    if not category_file.exists():
        import json
        default_categories = {
            "服装": 10001,
            "男装": 10002,
            "女装": 10003,
            "童装": 10004,
            "鞋": 10005,
            "食品": 20001,
            "零食": 20002,
            "饮料": 20003,
            "数码": 30001,
            "手机": 30002,
            "电脑": 30003,
            "家居": 40001,
            "美妆": 50001,
            "护肤": 50002,
            "其他": 99999
        }
        with open(category_file, "w", encoding="utf-8") as f:
            json.dump(default_categories, f, ensure_ascii=False, indent=2)

    # 创建配置文件模板
    config_file = skill_dir / "config.yaml"
    if not config_file.exists():
        config_template = """# 拼多多电商技能配置
skill:
  name: pdd-ecommerce
  version: "1.0.0"

# 拼多多开放平台配置
pdd:
  client_id: ""  # 从 https://open.pinduoduo.com 获取
  client_secret: ""
  access_token: ""
  api_base_url: "https://open-api.pinduoduo.com"

# 权限控制
security:
  allowed_users: []  # 添加允许的用户ID
  require_verification: true

# 文件配置
storage:
  data_dir: "~/.nanobot/skills/pdd-ecommerce/data"
  upload_batch_size: 10
  max_file_size_mb: 50

# AI 配置
ai:
  enabled: true
  optimization_level: "advanced"
  model: "claude-opus-4-5"
  provider: "anthropic"
  features:
    auto_description: true       # AI 生成描述
    auto_image_process: true     # 自动处理图片
    auto_pricing: true           # 智能定价
    auto_category: true          # 自动匹配类目
    auto_sku: true              # 自动识别 SKU

# 定价策略
pricing:
  strategy: "profit_margin"      # profit_margin, competitor
  profit_margin: 0.3            # 利润率 30%

# 图片处理
image:
  enable_white_bg: true         # 生成白底图
  target_size: 800              # 目标尺寸 800x800
  quality: 95                   # JPEG 质量

# API 限流
rate_limit:
  requests_per_minute: 100
  burst_size: 10

# 日志配置
logging:
  level: "INFO"
  file: "~/.nanobot/skills/pdd-ecommerce/logs/pdd.log"
"""
        config_file.write_text(config_template, encoding="utf-8")


def validate_product(product: Dict[str, Any]) -> Tuple[bool, List[str]]:
    """验证商品数据."""
    errors = []

    required_fields = ["商品名称", "运营成本价", "主图链接"]

    for field in required_fields:
        if not product.get(field):
            errors.append(f"缺少必需字段: {field}")

    # 验证成本价
    try:
        cost_price = float(product.get("运营成本价", 0))
        if cost_price <= 0:
            errors.append("成本价必须大于0")
    except (ValueError, TypeError):
        errors.append("成本价格式不正确")

    return len(errors) == 0, errors
