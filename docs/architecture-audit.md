> **历史归档：初次开发前的架构审计。** 以下按当时状态保留；本地环境、未配置或未部署等描述不代表当前版本。当前使用说明见[项目README](../README.md)，维护配置见[部署指南](deployment.md)。

# 原项目架构审计（修改前）

来源：yaoyuzhang1/socrates-question，main 快照 `5ac771e3e1a4f69794dddd07c9893033247cdd39`。当前工作区原为空，并非已有 clone。通过公开下载取得发布包；index.html 的 Git blob SHA 为 `7c18ee7f4e35644f8187fe29fe7069d4a6fb358f`，已核验。不设置老师仓库为 push 目标。

## 文件与运行边界

已检查 README、CREDITS、THIRD_PARTY_NOTICES、全部 community 模块/类型/测试/同步脚本、community.json、Issue 模板、workflow、.gitattributes、.nojekyll。index.html 约 17.35 MB；用代码去除 base64 后定位运行代码和数据，没有重生成整个文件。它是 React 19 的编译发布包，包含第三方库、内嵌研究图像、10 章数据、阅读器和样式，没有 package.json 或原始 React 源工程。

comic-art 是按章/六页组/内容哈希命名的 WebP；阅读器按当前页裁格，失败退回内嵌科学资料图。comic-audio 按章/页面/选项命名，按需播放解析；音频失败不阻止作答。路径均为 `./comic-art/...`、`./comic-audio/...`，无需域名根目录。原图署名链接指向老师项目，是来源链接而非投稿目标，应保留。

## 数据、流程、保存

| 功能 | 原实现 |
| --- | --- |
| 注册 | `le` 为10个 chapter ID；`fe` 为难度/领域/时间/路线；`xe` 汇总故事。恐龙/mRNA 已有 panels，其他8章 scenes 的每组3页转换为 panels。 |
| 页面 | `id, sceneId, chapter, title, caption, visualAlt, illustrationBrief, beat`；可带 evidence、quiz、reveal。story 保留 sources、terms、scenes。 |
| 题目 | quiz 的 prompt、options（id/label/explanation）、answerId、reason、可选 keyQuestion/seal。当前页选项解释与整题原因分开。 |
| 作答 | `Te` reducer 保存 choose/reveal 事件；`we` 判断是否已答对。错误选项显示对应 explanation，可重答；advance 在通过前拒绝。提示事件不直接通过题目。 |
| 计分 | `vc` 读取逐题 events：独立首次100、先错后对60、曾提示30；平均后四舍五入。速度不计分。`yc` 生成 f/r/h marks。缺记录旧档不伪造首答成绩，参考成绩明确标注。 |
| 线索 | `ke` 只列已通过题；线索本显示关键追问与理由，`Ae` 导出 Markdown。 |
| 倾向与回望 | `bu/Tu/Eu` 管理独立 discovery 记录，按 storyId/runId 保存，含 opened、forecasts、response。非计分题，可跳过，回看不能补改历史倾向，不进入成绩包。 |
| 存档 | `Me=de(4)` 得到 `socrates-comic-{chapter}-v4`；内容 version 3，含 cursor/furthest/answers/scoreRecord/resetToken/resetRevision。迁移 v1—v3 键，不混其他章。 |
| 重置/多标签 | `Fe` 读写本章键，restart 产生新 runId/resetRevision；合并同轮事件并检测跨轮冲突，不调用 localStorage.clear。 |
| 结算 | fu 展示百分制、三种题数、题量、回看题；从书架可再次打开成绩与投稿。 |
| 可访问性 | 跳正文链接、标题焦点、进度条、可键盘操作选项/按钮、反馈焦点、媒体替代文本、窄屏 CSS、可静音。新章需延续并特别保障非拖拽分类。 |

## 社区链路

community.mjs 是可读共享逻辑，但 index 中还存在它的编译副本，必须同时适配。成绩包 version 1 严格白名单：chapter/runId/completedAt/marks，可选 reference。Issue 使用唯一 `socrates-question` fenced JSON；昵称24字、评论500字、星级1—5，自愿预览后由玩家在 GitHub 确认提交。

sync.mjs 读取开放 Issues，排除 PR/bot/关闭/隐藏记录，按 GitHub 用户ID每章保留最高分、最近评论；重算分数，校验快照，SHA 冲突重试，无变化不提交。workflow 使用可信 main 和固定 SHA actions，仅 contents:write、issues:read，不执行 Issue 内容。客户端定时/窗口恢复/恢复联网读取 raw community.json，失败提示，不伪装空榜。评论作为文本渲染。

硬编码位置：community.mjs、community.d.mts、community/README、community.json、workflow 的 job if，以及 index 中 Q、快照校验的仓库和 Issue URL、ru、iu。旧 community.json 是老师真实投稿，学生版本应空榜，不能当作自己的试玩。

## 实际运行与教学观察

在原公开网页实际打开 argon 和 mrna；桌面检查逐页推进、倾向、错误选项反馈、纠错解锁与线索数变化；390×844 窄屏检查原阅读器，DOM 实测 scrollWidth 375 <= innerWidth 390。

argon 起始先确立称量目的，再让两条制法的重复差异打断收尾；第一次推理要求保留差异并核对条件。选“取平均”时解释平均会掩盖系统差异，纠错后解锁并提出“跟着仪器还是制法”的关键追问。

mrna 先确立治疗愿望、暂时指令，再问什么证据支持执行；区分到达、表达、疗效。后续数据按修饰、杂质、纯化、递送、人体证据分阶段推进，避免一种成功解释全部机制。两章都先给可用事实再提问，关键记录另外揭示。

原 community 自动测试：30/30 通过。实际开发审计不代表学生本人通关记录。

## 许可与最小改动决定

CREDITS 分别规定 CC BY、CC BY-SA、CC BY-NC、CC BY-NC-ND、公共领域等研究图像条件；ND 图不改原图，保留署名。GPT 插画不能套用旁边论文图的许可。THIRD_PARTY_NOTICES 保留 MIT/ISC/Apache 等组件全文。上游没有整体 LICENSE，不能自行宣布整个派生项目为 MIT。

新增独立 chirality.html 与可读 JS/CSS，首页仅加入口和社区配置接缝，保留原10章数据与引擎。新章用原创科学 SVG；可选 AI 配图只输出有编号的 prompt。统一 site-config.js，未配置时阻止公开投稿，明确拒绝老师仓库。新章沿用原 f/r/h 社区包及100/60/30计分，独立存档键，预测结果只在通过门槛后创建 DOM。
