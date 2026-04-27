# 多 Agent Git 协作流程（正式版）

> 适用仓库：`dogdogpp/Modelsmcp`  
> 生效日期：2026-04-27  
> 关联 Skill：`git-workflow`（PM）、`git-workflow-dev`（CTO）、`git-workflow-test`（Test）

---

## 一、分支架构

```
origin/main          ← 生产分支，仅接受 hotfix 和正式发布
origin/develop       ← 唯一集成分支，所有 feature 合并到此
  │
  ├─ feature/cto/SEL-99/yolo-upgrade   ← CTO 开发分支
  ├─ feature/pm/SEL-100/docs-update    ← PM 文档分支
  └─ feature/test/SEL-101/e2e-suite    ← 测试补充分支（经 PM 确认）
```

**命名规范**：`feature/<agent-role>/<issue-id>/<short-desc>`

---

## 二、Issue 全生命周期与 Git 映射

| Issue 状态 | 负责 Agent | Git 操作 |
|-----------|-----------|---------|
| `todo` | PM | 基于 `develop` 创建 feature 分支，指派给开发 Agent |
| `in_progress` | CTO/Dev | 在 feature 分支开发、提交、rebase |
| `in_review` | CTO/Dev | rebase 到 latest develop → `git merge --no-ff` → develop → push |
| `in_review` | 测试 | checkout develop，执行回归测试 |
| `done` | PM | 合并确认后 24h 内删除 feature 分支（本地 + remote） |
| `blocked` | PM | 保留分支，标记 WIP，协调 CTO 重新评审技术契约 |

---

## 三、各 Agent 具体操作手册

### PM（项目管理）

```bash
# 1. 接到新 Issue，创建 feature 分支
git checkout develop
git pull origin develop
git checkout -b feature/cto/SEL-99/yolo-upgrade
git push origin feature/cto/SEL-99/yolo-upgrade

# 2. 指派给 CTO，Issue 状态改为 in_progress

# 3. 测试通过后，清理分支（24h 内）
git push origin --delete feature/cto/SEL-99/yolo-upgrade
git branch -D feature/cto/SEL-99/yolo-upgrade
```

### CTO / Dev（开发）

```bash
# 1. checkout 到 feature 分支（PM 已创建）
git checkout feature/cto/SEL-99/yolo-upgrade

# 2. 开发过程中正常 commit
git add .
git commit -m "feat(SEL-99): add YOLOv8 support"

# 3. 开发完成后，rebase 到 latest develop
git fetch origin
git rebase origin/develop
# （如有冲突，本地解决，确保 npm run build 通过）

# 4. 合并到 develop（使用 --no-ff 保留 feature 历史）
git checkout develop
git merge --no-ff feature/cto/SEL-99/yolo-upgrade

# 5. push 到 origin
git push origin develop

# 6. Issue 状态改为 in_review，@深度测试工程师 触发测试
```

### 深度测试工程师（测试）

```bash
# 1. 始终以 develop 为测试基线
git checkout develop
git pull origin develop

# 2. 执行全量回归测试
npm run build
pytest test_regression.py

# 3. 发布结构化测试报告（不新建 feature 分支做测试代码）
# Status: PASS / FAIL / BLOCK
# Contract Match: xx%
# Discrepancies: ...
# Remediation: ...

# 4. PASS → @PM 推进验收；FAIL → @CTO 修复
```

---

## 四、关键协作原则

1. **单源 truth**：每个 Issue 只对应一个 feature 分支，禁止同一 Issue 在多个分支并行开发
2. **rebase 优先**：合并到 develop 前必须先 rebase 到 develop 最新 HEAD，保持线性历史
3. **集成顺序**：安全修复 > 基础设施 > 业务功能，先合入的基线不得被后合入破坏
4. **--no-ff 合并**：保留 feature 分支历史，便于追溯
5. **24h 清理**：合并完成后 24 小时内删除 feature 分支
6. **死锁熔断**：开发 Agent 连续 3 次未通过测试，PM 介入申请 CTO 重新评审技术契约

---

## 五、Hotfix 紧急流程

```bash
# 1. 从 main 切出 hotfix
git checkout main
git checkout -b hotfix/SEL-102/fix-auth-bypass

# 2. 修复后直接同时合回 main + develop
git checkout main
git merge --no-ff hotfix/SEL-102/fix-auth-bypass
git push origin main

git checkout develop
git merge --no-ff hotfix/SEL-102/fix-auth-bypass
git push origin develop
```

---

## 六、完整协作示例（以 SEL-99 为例）

```
Day 0  PM:  创建 feature/cto/SEL-99/yolo-upgrade，指派 CTO，状态 todo → in_progress
Day 1  CTO: 在 feature 分支开发，commit & push
Day 2  CTO: rebase → merge --no-ff → develop → push，状态 in_progress → in_review，@测试
Day 2  测试: checkout develop，回归测试 PASS，发布报告，@PM
Day 3  PM:  确认验收，状态 in_review → done，删除 feature 分支
```

---

## 七、相关链接

- 仓库地址：https://github.com/dogdogpp/Modelsmcp
- develop 分支：https://github.com/dogdogpp/Modelsmcp/tree/develop
- 基线 tag：[v0.2.0-rc1](https://github.com/dogdogpp/Modelsmcp/releases/tag/v0.2.0-rc1)
