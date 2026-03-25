---
name: pdd-ecommerce
description: 拼多多电商全自动上架技能，支持 AI 生成描述、图片处理、智能定价、类目匹配、SKU识别
metadata:
  nanobot:
    emoji: 🛒
    requires:
      bins: ["python3"]
---

# 拼多多电商全自动上架

使用 AI 智能优化并批量上架商品到拼多多平台。这是一个完全独立的技能插件，不修改任何 nanobot 核心代码。

## ⚡ 快速开始

### 1. 初始化技能

```bash
run_shell("cd ~/.nanobot/skills/pdd-ecommerce && python3 bin/pdd_init")
```

### 2. 配置 API 凭证

编辑 `~/.nanobot/skills/pdd-ecommerce/config.yaml`：

```yaml
pdd:
  client_id: "your_client_id"
  client_secret: "your_client_secret"
  access_token: "your_access_token"

security:
  allowed_users: ["your_user_id"]
```

### 3. 准备最少数据

只需提供最少信息：
- **商品名称**（必需）
- **运营成本价**（必需，用于智能定价）
- **商品图片链接**（必需，会自动处理为白底图）

### 4. 全自动上架（推荐）

```bash
# 一键全自动上架
run_shell("~/.nanobot/skills/pdd-ecommerce/bin/pdd_auto ~/products.xlsx")

# 预览模式（不上架）
run_shell("~/.nanobot/skills/pdd-ecommerce/bin/pdd_auto ~/products.xlsx --dry-run")

# 跳过确认直接上架
run_shell("~/.nanobot/skills/pdd-ecommerce/bin/pdd_auto ~/products.xlsx --skip-confirmation")
```

## 🚀 全自动流程

`pdd_auto` 脚本会自动完成以下步骤：

1. **解析商品文件** - 支持 Excel (.xlsx, .xls) 和 CSV (.csv)
2. **AI 生成描述** - 根据商品名称生成吸引人的描述
3. **处理图片** - 验证并优化图片
4. **识别 SKU** - AI 判断是否需要规格，自动推断颜色、尺码等
5. **匹配类目** - AI 自动识别并匹配最合适的拼多多类目
6. **智能定价** - 根据成本价和利润率自动计算售价
7. **预览确认** - 展示处理结果，确认无误后上架
8. **批量上架** - 上架到拼多多并保存结果

## 🎯 功能特点

### 完全自动化
- 📝 **AI 生成描述**：根据商品名称自动生成吸引人的描述
- 🖼️ **图片处理**：自动验证和优化图片
- 💰 **智能定价**：根据成本价和目标利润率自动计算售价
- 🏷️ **类目匹配**：AI 自动识别并匹配最合适的商品类目
- 📦 **SKU 识别**：智能判断商品规格，自动创建 SKU 组合

### 高度可靠
- ✅ 完全独立，不修改 nanobot 核心代码
- ✅ 白名单权限控制
- ✅ 详细的错误日志
- ✅ 上架结果可追溯

## 📝 最少数据示例

你只需要提供一个简单的 Excel 文件：

| 商品名称 | 运营成本价 | 主图链接 |
|---------|----------|---------|
| 优质纯棉T恤 夏季新款 | 50.00 | https://example.com/image1.jpg |
| 时尚休闲运动裤 | 80.00 | https://example.com/image2.jpg |

系统会自动：
- ✅ 生成商品描述
- ✅ 处理图片
- ✅ 计算售价（50 × 1.3 = 65）
- ✅ 识别是否有规格
- ✅ 匹配类目

## 🛠️ 可用脚本

| 脚本 | 功能 | 使用场景 |
|------|------|---------|
| `pdd_init` | 初始化环境 | 首次使用 |
| `pdd_auto` | 全自动上架 | ⭐ **推荐**日常使用 |
| `pdd_upload` | 分步上传 | 需要手动控制 |
| `pdd_preview` | 预览商品 | 上架前查看 |
| `pdd_confirm` | 确认上架 | 分步上架 |
| `pdd_status` | 查询状态 | 查看进度 |

## 💡 使用示例

### 快速上架（推荐）

```bash
# 用户：帮我上架这批商品 ~/products.xlsx
run_shell("~/.nanobot/skills/pdd-ecommerce/bin/pdd_auto ~/products.xlsx --skip-confirmation")
# 几分钟后：✅ 上架完成！
```

### 预览模式

```bash
run_shell("~/.nanobot/skills/pdd-ecommerce/bin/pdd_auto ~/products.xlsx --dry-run")
# 👀 预览结果，不上架
```

## ⚙️ 配置选项

### AI 功能开关

```yaml
ai:
  features:
    auto_description: true       # AI 生成商品描述
    auto_image_process: true     # 自动处理图片
    auto_pricing: true           # 智能定价
    auto_category: true          # 自动匹配类目
    auto_sku: true              # 自动识别 SKU
```

### 定价策略

```yaml
pricing:
  strategy: "profit_margin"      # 按利润率定价
  profit_margin: 0.3            # 30% 利润率
```

## 🔐 权限要求

- 需要在 `config.yaml` 的 `allowed_users` 白名单中
- 需要配置拼多多 API 凭证（可选，不配置时为模拟模式）
