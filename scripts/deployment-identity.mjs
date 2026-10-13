const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/u;
const REPO = /^[A-Za-z0-9._-]{1,100}$/u;
const SHA = /^[a-f0-9]{40}$/iu;
const HOST = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.vercel\.app$/iu;

// 5단계부터 aleph.json에 쿼리 없는 원본 자료 HTTPS 경로를 싣습니다(비밀값 아님).
function originalApiUrl(config) {
  let url;
  try { url = new URL(config.originalApiUrl); } catch { return null; }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash
      || config.originalApiUrl !== url.href) return null;
  return url.href;
}

// 3단계부터 aleph.json에 허용 경로("METHOD /경로")를 싣습니다. 쿼리와 비밀값은 허용하지 않습니다.
const ROUTE = /^(GET|POST|PUT|PATCH|DELETE) \/[A-Za-z0-9._~:/-]{0,200}$/u;
function allowedRoutes(config) {
  const routes = config.allowedRoutes;
  if (!Array.isArray(routes) || routes.length < 1 || routes.length > 50
      || routes.some((route) => typeof route !== 'string' || !ROUTE.test(route))
      || new Set(routes).size !== routes.length) return null;
  return [...routes];
}

export function deploymentIdentity(env, config) {
  const owner = env.VERCEL_GIT_REPO_OWNER;
  const repo = env.VERCEL_GIT_REPO_SLUG;
  const commit = env.VERCEL_GIT_COMMIT_SHA;
  const host = env.VERCEL_URL;
  if (env.VERCEL_GIT_PROVIDER !== 'github' || !OWNER.test(owner || '')
      || !REPO.test(repo || '') || repo === '.' || repo === '..'
      || repo.toLowerCase().endsWith('.git') || !SHA.test(commit || '')
      || !HOST.test(host || '') || !Number.isInteger(config?.step)
      || config.step < 1 || config.step > 12
      || typeof config.judgeIssuer !== 'string'
      || !/^https:\/\/[a-z0-9-]+\.up\.railway\.app\/defense\/judge$/iu.test(config.judgeIssuer)
      || typeof config.sampleMarker !== 'string'
      || !/^[A-Z0-9_]{1,80}$/u.test(config.sampleMarker)) {
    throw new Error('배포 식별 정보를 확인할 수 없습니다. Vercel 시스템 환경변수와 aleph.config.json의 단계(1~12)를 확인하세요.');
  }
  const identity = {
    schema: 'aleph.defense.deployment.v1',
    step: config.step,
    repoUrl: `https://github.com/${owner.toLowerCase()}/${repo.toLowerCase()}`,
    commit: commit.toLowerCase(),
    publicAppUrl: `https://${host.toLowerCase()}`,
    judgeIssuer: config.judgeIssuer,
    sampleMarker: config.sampleMarker,
  };
  if (config.step >= 3) {
    const routes = allowedRoutes(config);
    if (!routes) {
      throw new Error('3단계부터 aleph.config.json의 allowedRoutes에 "METHOD /경로" 꼴의 허용 경로가 하나 이상 필요합니다.');
    }
    identity.allowedRoutes = routes;
  }
  if (config.step >= 5) {
    const original = originalApiUrl(config);
    if (!original) {
      throw new Error('5단계부터 aleph.config.json의 originalApiUrl에 쿼리 없는 HTTPS 원본 자료 주소가 필요합니다.');
    }
    identity.originalApiUrl = original;
  }
  return identity;
}
