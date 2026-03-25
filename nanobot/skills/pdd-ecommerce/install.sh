#!/bin/bash
# 拼多多电商技能安装脚本

echo "🛒 拼多多电商自动上架技能 - 安装程序"
echo "========================================"
echo ""

# 检查 Python 版本
echo "📋 检查 Python 版本..."
python3 --version || { echo "❌ 需要 Python 3.7+"; exit 1; }

# 检查是否在正确的目录
if [ ! -f "SKILL.md" ]; then
    echo "❌ 请在技能目录中运行此脚本"
    exit 1
fi

# 安装依赖
echo ""
echo "📦 安装 Python 依赖..."
pip install -r requirements.txt || { echo "❌ 依赖安装失败"; exit 1; }

# 初始化环境
echo ""
echo "🔧 初始化环境..."
python3 bin/pdd_init

# 创建示例数据文件
echo ""
echo "📝 创建示例数据文件..."
cat > data/products_example.csv << 'EOF'
商品名称,运营成本价,主图链接,价格,库存
优质纯棉T恤 夏季新款,50.00,https://example.com/image1.jpg,,
时尚休闲运动裤,80.00,https://example.com/image2.jpg,,
舒适棉质床品四件套,150.00,https://example.com/image3.jpg,,
EOF

echo ""
echo "✅ 安装完成！"
echo ""
echo "下一步："
echo "1. 编辑 config.yaml 配置 API 凭证"
echo "2. 添加用户 ID 到 allowed_users 白名单"
echo "3. 测试运行: python3 bin/pdd_auto data/products_example.csv --dry-run"
echo ""
