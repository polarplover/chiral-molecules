import json
import unittest
from issue_intake import community_only, BOILERPLATE


class CommunityRouting(unittest.TestCase):
    def issue(self, kind='score', comment='好玩！', extra=''):
        record = {'app': 'socrates-question', 'version': 1, 'kind': kind,
                  'chapter': 'chirality', 'nickname': 'Player', 'comment': comment, 'rating': 5}
        if kind == 'score':
            record['packet'] = {'version': 1, 'chapter': 'chirality', 'marks': 'ffffff'}
        intro = '我完成了《零度读数的秘密》，本次自报成绩为 **100 / 100**。' if kind == 'score' else '我想对《零度读数的秘密》提交评论。'
        return {'title': ('成绩' if kind == 'score' else '评论') + ' · 零度读数的秘密',
                'body': '\n\n'.join((intro, *BOILERPLATE, '```socrates-question\n' + json.dumps(record, ensure_ascii=False) + '\n```', extra))}

    def test_generated_score_and_experience_skip_without_labels(self):
        for kind in ('score', 'comment'):
            self.assertTrue(community_only(self.issue(kind)))

    def test_mixed_feedback_remains_eligible_inside_or_outside_record(self):
        for text in ('下一页按钮没反应', '建议增加字幕', '页面白屏', 'Score resets after refresh; please fix', '有个bug'):
            self.assertFalse(community_only(self.issue(comment=text)))
            self.assertFalse(community_only(self.issue(extra=text)))

    def test_titles_never_hide_bugs(self):
        issue = self.issue()
        issue['title'] = '成绩 · 计算错误'
        self.assertFalse(community_only(issue))

    def test_plain_social_posts_and_ambiguous_prose(self):
        for body in ('好玩！谢谢！', '我通关了，100/100！', '很有趣，喜欢！'):
            self.assertTrue(community_only({'title': '游戏体验', 'body': body}))
        for body in ('第三页右下角的文字遮住按钮', '下一页没反应', '建议改善对比度', 'unknown report'):
            self.assertFalse(community_only({'title': '游戏体验', 'body': body}))

    def test_malformed_records_and_extra_text_are_not_silently_dropped(self):
        for body in ('```socrates-question\nno-json\n```', '```socrates-question\n[]\n```', self.issue()['body'] * 2):
            self.assertFalse(community_only({'title': '成绩 · test', 'body': body}))
        self.assertFalse(community_only(self.issue(extra='第三页右下角的文字遮住按钮')))
        self.assertFalse(community_only({'title':'成绩', 'body':'x'*20001}))

    def test_editing_a_social_post_into_report_reenters_intake(self):
        issue = self.issue()
        self.assertTrue(community_only(issue))
        issue['body'] += '\n建议为图表增加文字说明'
        self.assertFalse(community_only(issue))


if __name__ == '__main__':
    unittest.main()
