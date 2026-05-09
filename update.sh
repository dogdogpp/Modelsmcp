#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

BRANCH="develop"

echo "========================================"
echo "  Modelsmcp 代码同步脚本"
echo "========================================"
echo ""

echo "当前分支: $(git branch --show-current)"
echo "项目路径: $(pwd)"
echo ""

# 检查是否有本地未提交的修改（只检查已跟踪文件的改动，忽略未跟踪文件）
if [ -n "$(git diff --name-only)" ] || [ -n "$(git diff --cached --name-only)" ]; then
    echo "警告：检测到本地有未提交的修改"
    git status -s
    echo ""
    read -p "是否先 stash 本地修改再拉取？(y/n) " answer
    if [ "$answer" = "y" ] || [ "$answer" = "Y" ]; then
        git stash push -m "auto-stash-$(date +%Y%m%d-%H%M%S)"
        echo "本地修改已 stash"
    else
        echo "已取消拉取，请先手动处理本地修改"
        exit 0
    fi
    echo ""
fi

# 优先从本地 bare repo 拉取，避免网络问题
REMOTE="local"
if ! git remote | grep -q "^local$"; then
    echo "正在配置本地 bare repo 为远程源..."
    git remote add local /home/qihui/multica_workspaces/.repos/9fe17ac9-54fa-4e0f-9078-e02138fa4d92/Modelsmcp.git
fi

echo "正在从本地 bare repo 拉取最新代码..."
git fetch "$REMOTE"

# 显示即将更新的内容
echo ""
echo "即将更新的提交:"
git log --oneline HEAD..$REMOTE/$BRANCH 2>/dev/null || echo "  (无新提交或已在最新版本)"
echo ""

# 记录拉取前的版本
PREV_HEAD=$(git rev-parse HEAD)

git pull "$REMOTE" "$BRANCH"

# 检查依赖文件是否有变化（只在真正有更新时检测）
DEPS_CHANGED=false
POST_HEAD=$(git rev-parse HEAD)
if [ "$PREV_HEAD" != "$POST_HEAD" ]; then
    if git diff --name-only "$PREV_HEAD" "$POST_HEAD" | grep -qE "^(package\.json|requirements\.txt|pnpm-lock\.yaml|package-lock\.json)$"; then
        DEPS_CHANGED=true
    fi
fi

echo ""
echo "========================================"
echo "  同步完成"
echo "  当前版本: $(git rev-parse --short HEAD)"
echo "  时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================"

if [ "$DEPS_CHANGED" = true ]; then
    echo ""
    echo "注意：检测到依赖配置文件有更新（package.json 或 requirements.txt）"
    echo "建议运行环境初始化脚本更新依赖:"
    echo "  ./setup.sh"
fi
