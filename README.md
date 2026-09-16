# 镜子里的两种分子：零度读数的秘密

参考老师的[《迷雾中的探险》](https://github.com/yaoyuzhang1/socrates-question)互动科学推理形式制作的本地作业项目。保留原10章，新增独立短篇 `chirality`；上游原说明保存在 [upstream-readme.md](docs/upstream-readme.md)。

**本作品入口：[全部故事](index.html) / [新章节](chirality.html)**。这些是仓库内相对入口，不代表已经部署；目前没有公开游戏地址。

## 新章节

14个短页面、6道等权计分题、2次不计分反思，预计7—9分钟，难度4/5。以Pasteur相关发现为背景，追查“零读数是没有效应，还是相反作用抵消”。晶体分类使用点击或键盘，不要求拖拽。科学示意为原创SVG，历史观察、教学安排和现代解释分别标注。

六题依次练习：区分竞争模型、事先预测、限定证据结论、干预预测、因果重建、生物选择性与外推边界。结果页在完成预测后才创建；没有提前插入的后续结果DOM。

每题首次独立答对100、纠错后答对60、使用提示后掌握30，最终平均并四舍五入。速度不计分。进度使用独立localStorage键，重开只影响本章；反思只留本机，可导出，不进入成绩包。

## 本地运行与测试

需要Node.js 22或更高版本，无需安装第三方依赖。不要直接双击HTML：新增章节使用ES模块和Service Worker，需要HTTP或HTTPS。

```powershell
node tools/serve.mjs
```

打开 http://127.0.0.1:4173/socrates-question/ 。也可在包含npm的常规Node环境使用 `npm start`。

```powershell
node --test community/*.test.mjs tests/*.test.mjs
```

等同于 `npm test`。初次联网加载新章后可离线刷新继续；社区在线功能和外部科学资料仍需要网络。浏览器清理网站数据会删除本机记录。

原作81张WebP和396个MP3保留完整。可选的离线完整性检查：

```powershell
python tools/restore-upstream-assets.py --verify-only
```

脚本默认读取固定上游清单 `docs/upstream-tree.json`；不加验证参数时可恢复缺失资源，需网络及curl。

## 排行榜、评论和发布

目前 `site-config.js` 的 `repository` 留空。设置为**你自己的** `账号/仓库名`，再按 [部署步骤](docs/deployment.md) 推送和启用GitHub Pages。代码拒绝把老师仓库作为投稿目标。

不登录也能游玩。玩家通关后自愿填写昵称、星级和意见，预览草稿，前往GitHub由本人确认发Issue。GitHub Actions从开放Issues生成 `community.json`，客户端读取快照；同账号每关保留最高分，同分并列。评论按文本显示，不执行HTML。详情见 [社区协议](community/README.md)。

生产快照目前是真实空榜；测试夹具只在测试中使用，不充当同学记录。`tests/community-preview.html` 是明确标注的界面测试页面，不是公开成绩来源。

## 审计、资料与作业记录

- [原项目架构审计](docs/architecture-audit.md)：编译React发布包、计分、存档、社区与最小接入范围。
- [科学资料与文案边界](docs/science-sources.md)：Institut Pasteur、RSC、Science History Institute、Flack和Gál的历史研究。
- [本地验收记录](docs/acceptance.md)：自动测试、实际浏览器、手机、离线、存档隔离与尚需外部验证的事项。
- [可选配图提示词](docs/image-prompts.md)：CHI-IMG-01至05，指定文件名；保留给gpt-image-2.5的prompt；用户后来提供的5张图片已整合，见[pics素材说明](pics/README.md)。
- [本人作业与同学反馈模板](homework-notes.md)：本人真实玩原作两关，再邀请至少三位同学真实通关和留言。模板不含虚构成绩。

## 来源、署名与许可

上游来自 `yaoyuzhang1/socrates-question` 的固定快照，保留原章节、署名及第三方声明。新增章节使用原创代码与SVG，没有复制原作GPT插画作为新章配图。参见 [CREDITS](CREDITS.md) 和 [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.txt)。

上游各素材适用不同许可，含署名、非商业或禁止改编要求；上游没有整体LICENSE，不能据此将整个派生项目声明为MIT。发布时保留说明，遵循各素材自身条件。本项目目前未向任何GitHub仓库推送。
