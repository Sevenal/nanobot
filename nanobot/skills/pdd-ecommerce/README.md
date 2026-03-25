# 拼多多电商自动上架技能

一个完全独立的 nanobot 技能插件，实现拼多多商品的 AI 自动化上架。

## 特点

- ✅ **完全独立**：不修改 nanobot 任何核心代码
- ✅ **高度自动化**：只需提供商品名称、成本价、图片链接
- ✅ **AI 驱动**：自动生成描述、识别规格、匹配类目、智能定价
- ✅ **批量处理**：支持 Excel/CSV 批量导入

## 安装

1. 将整个 `pdd-ecommerce-skill` 目录复制到 `~/.nanobot/skills/`：

```bash
cp -r pdd-ecommerce-skill ~/.nanobot/skills/pdd-ecommerce
```

2. 安装依赖：

```bash
pip install -r ~/.nanobot/skills/pdd-ecommerce/requirements.txt
```

3. 初始化技能：

```bash
cd ~/.nanobot/skills/pdd-ecommerce
python3 bin/pdd_init
```

## 配置

编辑 `~/.nanobot/skills/pdd-ecommerce/config.yaml`：

```yaml
pdd:
  client_id: "your_client_id"
  client_secret: "your_client_secret"
  access_token: "your_access_token"

security:
  allowed_users: ["your_user_id"]  # 添加你的用户ID

ai:
  features:
    auto_description: true
    auto_pricing: true
    auto_category: true
    auto_sku: true
```

## 使用

### 全自动上架（推荐）

```bash
python3 bin/pdd_auto ~/products.xlsx
```

### 预览模式

```bash
python3 bin/pdd_auto ~/products.xlsx --dry-run
```

### 分步操作

```bash
# 1. 上传文件
python3 bin/pdd_upload ~/products.xlsx --optimize

# 2. 预览
python3 bin/pdd_preview

# 3. 确认上架
python3 bin/pdd_confirm

# 4. 查询状态
python3 bin/pdd_status
```

## 在 nanobot 中使用

在 nanobot 的聊天界面中：

```
帮我上架这批商品 ~/products.xlsx
```

nanobot 会调用 `pdd_auto` 脚本，全自动完成上架。

## 数据格式

### 最少数据（只需3列）

| 商品名称 | 运营成本价 | 主图链接 |
|---------|----------|---------|
| 优质纯棉T恤 | 50.00 | https://... |
| 休闲运动裤 | 80.00 | https://... |

### 完整数据

| 商品名称 | 运营成本价 | 主图链接 | 价格 | 库存 | SKU规格 |
|---------|----------|---------|-----|------|---------|
| 优质纯棉T恤 | 50.00 | https://... | 65.00 | 100 | 颜色:黑色;尺码:L |
