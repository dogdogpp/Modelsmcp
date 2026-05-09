#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "========================================"
echo "  Modelsmcp 环境初始化脚本"
echo "========================================"
echo ""

# 0. 配置本地 bare repo 为远程源（避免网络问题）
echo "[0/3] 配置本地 bare repo 远程源..."
if ! git remote | grep -q "^local$"; then
    git remote add local /home/qihui/multica_workspaces/.repos/9fe17ac9-54fa-4e0f-9078-e02138fa4d92/Modelsmcp.git
    echo "已添加 local 远程源（指向本地 bare repo）"
else
    echo "local 远程源已存在"
fi
echo ""

# 1. 安装 Node.js 依赖
echo "[1/3] 安装 Node.js 依赖..."
if [ -f "package.json" ]; then
    if command -v pnpm &> /dev/null; then
        pnpm install
    else
        npm install
    fi
    echo "Node.js 依赖安装完成"
else
    echo "未找到 package.json，跳过 Node.js 依赖安装"
fi
echo ""

# 2. 安装 Python 依赖
echo "[2/3] 安装 Python 依赖..."
if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt
    echo "Python 依赖安装完成"
else
    echo "未找到 requirements.txt，跳过 Python 依赖安装"
fi
echo ""

# 3. 检查模型权重目录
echo "[3/3] 检查模型权重目录..."
if [ -d "models_storage" ]; then
    echo "models_storage/ 目录已存在"
    ls -la models_storage/ 2>/dev/null || true
else
    echo "models_storage/ 目录不存在，如需模型权重请手动下载或从其他 worktree 复制"
fi
echo ""

echo "========================================"
echo "  初始化完成"
echo "  项目路径: $(pwd)"
echo "========================================"
echo ""
echo "常用命令:"
echo "  ./update.sh          拉取最新代码"
echo "  npm run dev          启动前端开发服务器"
echo "  python3 server/main.py  启动后端服务（根据实际入口调整）"
