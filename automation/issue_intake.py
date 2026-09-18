"""Conservative, model-free recognition of community-only issues.

This is routing, not a security decision. Unknown or mixed feedback stays eligible.
No repository code is executed to parse a submission.
"""
import json
import re

ACTIONABLE = re.compile(
    r'bug|error|crash|fail|broken|not work|fix|improv|suggest|feature|request|should|could|please|'
    r'问题|错误|报错|故障|异常|无法|不能|不[能会对行]|没[有法反]|不显示|不正确|不一致|失效|丢失|'
    r'卡[住死顿]|白屏|闪退|乱码|点不了|打不开|加载|建议|改进|改善|优化|希望|应[该当]|增加|新增|修复|漏洞|反馈',
    re.IGNORECASE,
)
SOCIAL_TITLE = re.compile(r'^(?:成绩|通关成绩|成绩分享|评论|游戏体验|游玩体验|体验分享|心得|感想)(?:\s|[·:：!！]|$)')
FENCE = re.compile(r'^```socrates-question[^\S\r\n]*\r?\n(.*?)\r?\n```[^\S\r\n]*$', re.M | re.S)
BOILERPLATE = (
    '本帖公开发布后，GitHub账号、显示名、成绩及填写的评论会进入游戏社区。关闭本帖可从下次更新的榜单中撤回。成绩用于交流，不作为正式考核凭证。',
    '下面是游戏生成的提交记录；请保留记录格式。显示名、评论与星级也包含在记录中。',
)


def community_only(issue):
    """True means silently skip before source download, model calls or replies."""
    title, body = issue.get('title') or '', issue.get('body') or ''
    if not isinstance(title, str) or not isinstance(body, str) or len(body) > 20000:
        return False
    # A score/comment title must never hide a report or improvement suggestion.
    if ACTIONABLE.search(title + '\n' + body):
        return False
    blocks = list(FENCE.finditer(body))
    if blocks:
        if len(blocks) != 1:
            return False
        try:
            record = json.loads(blocks[0][1])
        except (ValueError, RecursionError):
            return False
        if not isinstance(record, dict):
            return False
        fields = {'app', 'version', 'kind', 'chapter', 'nickname', 'comment', 'rating', 'packet'}
        if (record.get('app') != 'socrates-question' or record.get('version') != 1
                or record.get('kind') not in ('score', 'comment')
                or not isinstance(record.get('comment'), str) or not set(record) <= fields):
            return False
        outside = body[:blocks[0].start()] + body[blocks[0].end():]
        for line in BOILERPLATE:
            outside = outside.replace(line, '')
        outside = re.sub(r'我完成了《[^\r\n]+?》，(?:本次自报成绩|旧存档参考成绩)为\s*\*\*\d+\s*/\s*100\*\*。(?:此成绩依据旧版保存的作答结果还原，榜单会标记为参考成绩。)?', '', outside)
        outside = re.sub(r'我想对《[^\r\n]+?》提交评论。', '', outside)
        # Extra prose may contain a report we do not know how to recognize.
        return not outside.strip()
    if '```' in body or 'socrates-question' in body:
        return False
    # Free-text sharing is skipped only for short, clearly social statements.
    if not SOCIAL_TITLE.search(title):
        return False
    social = re.compile(r'(?:我|今天|这次|终于|本次|已经|已|刚刚|玩了|完成了|通关了|通关|得了|拿到|考了|成绩|得分|分数|满分|分|好玩|很好玩|很有趣|有趣|很棒|不错|喜欢|学到了|谢谢|感谢|分享|体验|开心|太棒了|推荐|赞|[\d\s/，。！!、：:;；~～⭐★👍😊🎉])+')
    return bool(body.strip() and len(body) <= 300 and social.fullmatch(body.strip()))
