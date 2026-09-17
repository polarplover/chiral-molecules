# 开发与贡献

## 运行和测试

需要Node.js 22或更高版本，无需安装第三方依赖：

```sh
git clone https://github.com/polarplover/chiral-molecules.git
cd chiral-molecules
node tools/serve.mjs
```

开发服务器地址为 `http://127.0.0.1:4173/socrates-question/`。该兼容子路径用于检验相对资源URL，不代表公开部署地址。也可使用 `npm start`。不要直接双击HTML；ES模块和Service Worker需要HTTP或HTTPS。

```sh
node --test community/*.test.mjs tests/*.test.mjs
```

等同于 `npm test`。自动检查涵盖成绩协议、答题状态、存档边界、社区数据、资源路径与离线缓存。涉及页面布局或交互的改动还应在桌面、窄屏和键盘操作下实际验收。

## 文件结构

| 位置 | 用途 |
| --- | --- |
| `index.html` | 上游编译React发布包及新章首页入口 |
| `chirality.html`、`chapters/chirality/` | 新章结构、数据、状态、渲染、样式及原创SVG |
| `site-config.js` | 前端与同步程序共用的目标仓库配置 |
| `community/`、`community.json` | Issue协议、同步、校验与公开快照 |
| `.github/workflows/` | 自动检查及社区同步 |
| `chirality-sw.js` | 本章离线缓存 |
| `pics/` | 编号叙事插画及来源说明 |
| `comic-art/`、`comic-audio/` | 上游章节的图像与音频 |
| `tests/`、`tools/` | 测试和维护工具 |

`index.html`包含上游编译代码，不是完整React源工程。尽量局部修改，不重新生成原章节。`tools/integrate-chirality.mjs`记录首次接入的限定替换；历史基线见[架构审计](architecture-audit.md)。

## 资源校验

上游资源包含81张WebP和396个MP3。安装Python后可进行完整性检查：

```sh
python tools/restore-upstream-assets.py --verify-only
```

脚本使用固定清单 `docs/upstream-tree.json` 校验长度和Git blob SHA；省略 `--verify-only` 时可恢复缺失资源，需要网络和curl。不要以新图覆盖带有独立许可的上游资源。

## 贡献约定

使用功能分支和Pull Request，说明问题、用户可见变化及验证结果。科学文案应引用可靠来源，区分历史观察、教学示意和现代解释。关键结果仅在相应预测通过后呈现；新增题目须有对应错误解释，不以速度评分。

测试夹具只用于测试，不写入公开榜单。`tests/community-preview.html`是明确标记的社区UI夹具。真实玩家的反思、存档、私人信息或开发凭据不得提交到仓库。

修改运行资源时同步检查Service Worker缓存清单与版本。公开发布和Fork配置见[部署指南](deployment.md)；Issues协议及同步权限见[社区说明](../community/README.md)。