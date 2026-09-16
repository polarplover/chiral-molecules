# 发布到自己的GitHub Pages

当前只完成本地开发，没有已部署的HTTPS地址。以下步骤由仓库拥有者操作；不要向老师的原仓库推送。

## 1. 建立自己的仓库并配置

在你的GitHub账号下创建一个空的公开仓库，例如 `chirality-investigation`，启用Issues。当前下载目录不是git clone，没有远端。

编辑根目录 `site-config.js`：

```js
const settings = { repository: '你的账号/chirality-investigation', branch: 'main' };
```

填写真实账号和仓库名；不要填写URL、令牌或老师仓库。前端、成绩链接和同步程序都读取这一项。初始 `community.json` 可以保留空榜，首次Actions会建立属于你的快照。

## 2. 本地检查与推送

先执行：

```powershell
node --test community/*.test.mjs tests/*.test.mjs
node tools/serve.mjs
```

确认网页可玩后，在项目目录执行（替换远端占位内容）：

```powershell
git init
git branch -M main
git add .
git commit -m "Add chirality investigation chapter"
git remote add origin https://github.com/你的账号/chirality-investigation.git
git remote -v
git push -u origin main
```

**执行push前检查输出必须是你自己的仓库。** 如果你后来已经配置了origin，不要重复add；先检查 `git remote -v`，必要时使用 `git remote set-url origin https://github.com/你的账号/chirality-investigation.git` 改为自己的地址。不要保留指向老师仓库的push目标。无需把登录令牌写入任何项目文件；按GitHub客户端的正常登录方式操作。

## 3. 启用Pages与社区同步

1. 仓库 Settings → Pages → Build and deployment，选择 **Deploy from a branch**，分支 **main**，目录 **/(root)**，保存。保留 `.nojekyll`。
2. 仓库 Actions 中允许本仓库工作流运行。`Check interactive chapters` 执行测试；`Update game leaderboard` 有 `contents: write` 与 `issues: read` 的最小权限。若组织策略禁止写入，需仓库管理员允许该工作流写入本仓库。
3. 在 `Update game leaderboard` 点 **Run workflow**，建立自己的空快照。确认任务成功且根目录 `community.json` 的repository变成你的仓库。
4. 等待Pages部署成功，以设置页显示的实际地址为准。通常是 `https://你的账号.github.io/chirality-investigation/`，直接新章为其下的 `chirality.html`。此处只是格式示例，不是已验证地址。
5. 用未登录窗口及手机打开，确认首页、新章、图像与结算。页面采用相对资源路径，支持上述项目子目录。

GitHub文档：[建立Pages站点](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)。使用GITHUB_TOKEN写入的社区快照提交不会触发分支式Pages重新构建；因此客户端直接读取配置仓库的raw快照，无需每次留言重新发布静态站点。

## 4. 验证一次真实投稿，再邀请同学

由真实玩家完成章节，在结算页自愿填写昵称、星级、评论，核对草稿和目标仓库后由本人发布Issue。不要手写或伪造通关数据。

等待社区Actions完成，打开排行榜刷新，确认该记录出现。关闭Issue后，下次同步应撤回对应记录。社区是玩家自报记录，不是监考系统；本机反思不会上传。首次启用后raw文件可能短暂缓存，稍后再刷新。

再把**已经实际验证能访问**的HTTPS链接发给至少三位同学。请他们本人真实通关、自愿发布成绩和意见；在 `homework-notes.md` 记录实际用时与反馈，不能用测试夹具代替。

## 常见问题

- **未配置提示**：检查site-config中的账号/仓库名，并重新push；本地游玩不受影响。
- **榜单格式或仓库不匹配**：确认Actions已经完成首次同步，配置、当前仓库和快照repository一致。
- **同步403**：检查工作流写权限及组织/分支保护策略，不要把个人令牌放进网页。
- **静态资源404**：发布目录必须包含chapters、community、comic-art、comic-audio；不要只上传两个HTML。
- **代码更新未生效**：在线刷新以更新本章缓存；仍有问题可在浏览器站点设置清理缓存，但先导出本机调查笔记，因为清理网站数据可能删除存档。
