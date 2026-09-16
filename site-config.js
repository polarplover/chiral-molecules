/* Public deployment settings. Set repository to YOUR-ACCOUNT/YOUR-REPOSITORY.
 * No tokens or secrets belong in this file. main is the supported publishing branch.
 */
(function () {
  'use strict';
  const settings = { repository: '', branch: 'main' };
  function createConfig(repository, branch = 'main') {
    const valid = typeof repository === 'string' && /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?\/[a-z\d._-]+$/i.test(repository) && !repository.endsWith('/.') && !repository.endsWith('/..');
    if (repository !== '' && (!valid || repository.toLowerCase() === 'yaoyuzhang1/socrates-question')) throw new Error('请填写你自己的有效 GitHub 仓库，不能使用老师的原仓库。');
    if (branch !== 'main') throw new Error('本项目使用 main 分支发布。');
    return Object.freeze({
      repository, branch,
      repositoryUrl: repository ? `https://github.com/${repository}` : '',
      snapshotUrl: repository ? `https://raw.githubusercontent.com/${repository}/${branch}/community.json` : './community.json',
      assertConfigured() {
        if (!repository) throw new Error('尚未配置你的 GitHub 仓库。请先在 site-config.js 设置 repository；本地游玩与存档不受影响。');
        return repository;
      },
      // Pure factory used by isolated tests; it never changes production settings.
      forRepository: createConfig,
    });
  }
  globalThis.SOCRATES_CONFIG = createConfig(settings.repository, settings.branch);
})();
