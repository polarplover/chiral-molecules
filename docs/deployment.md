# GitHub Pages与社区同步部署

本指南面向维护者及Fork使用者。当前仓库为 `polarplover/chiral-molecules`；运行时配置位于根目录 `site-config.js`。

本仓库的Pages地址为 **https://polarplover.github.io/chiral-molecules/**，分支为 `main`、目录为 `/(root)`。部署状态和版本以GitHub **Deployments → github-pages** 的记录为准。

## 发布与维护

1. 合并前运行[开发指南](development.md)中的测试。
2. 在仓库 **Settings → Pages → Build and deployment** 使用 **Deploy from a branch**，分支 **main**，目录 **/(root)**，保留 `.nojekyll`。
3. 确保仓库启用Issues和Actions。社区工作流需要 `contents: write` 与 `issues: read`；组织策略或分支保护可能需要管理员配置。
4. 在 **Actions → Update game leaderboard → Run workflow** 执行同步，检查 `community.json` 的 `repository` 与 `site-config.js` 一致。
5. 等待Pages部署成功，再验收实际地址。本章入口为项目路径下的 `chirality.html`。

网站应包含整个仓库的运行资源，不能只发布HTML。资源使用相对路径，支持GitHub Pages项目子目录。工作流生成的快照由客户端从配置仓库的raw地址读取，避免依赖每次榜单更新都重新构建Pages。

## Fork到其他仓库

1. Fork本仓库并保留来源、署名与素材许可声明。
2. 将 `site-config.js` 中的 `repository` 改为实际 `owner/repository`，分支保持 `main`；不要放入URL或令牌。
3. 确认Git远端指向有权限维护的目标：`git remote -v`。使用功能分支和Pull Request提交改动。
4. 启用Issues与Actions，并运行社区同步以生成目标仓库的快照。不要把其他仓库的玩家记录冒充为本站投稿。
5. 按前述步骤启用Pages，并完成在线验收。

配置层禁止向上游 `yaoyuzhang1/socrates-question` 投稿。同步发布还会检查 `GITHUB_REPOSITORY` 与配置一致；个人访问令牌不得写入网页或提交到仓库。

## 在线验收

- 用未登录窗口和手机打开实际HTTPS地址，检查首页、章节、图像和结算页。
- 完成一次真实游玩后，自愿通过结算页提交Issue，核对目标仓库，再确认工作流和排行榜更新。
- 关闭该Issue后确认下次同步撤回记录；不要用测试夹具代替真实玩家投稿。
- 检查首次加载完成后的离线刷新，以及刷新、重开时的存档行为。

## 常见问题

- **投稿配置错误**：检查 `site-config.js` 的仓库名称、当前发布版本和Issues是否启用。
- **快照不匹配**：确认配置、Actions运行仓库与 `community.json` 的 `repository` 相同，再运行同步。
- **同步403**：检查工作流权限、组织策略及分支保护，不要将个人令牌放入网页。
- **资源404**：确认发布目录包含 `chapters/`、`community/`、`pics/`、`comic-art/`和 `comic-audio/`。
- **更新未生效**：在线打开站点并关闭旧标签页后重试。清理网站数据前先导出调查笔记，清理可能删除本机存档。
- **榜单更新延迟**：等待Actions队列和CDN缓存刷新；加载失败不等于没有投稿。

参考[GitHub Pages官方部署文档](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)及[社区维护说明](../community/README.md)。