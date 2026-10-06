import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deploymentIdentity } from '../scripts/deployment-identity.mjs';
import { runAttackChecks } from '../src/attack-check.mjs';

const config = {
  step: 5,
  originalApiUrl: 'https://project-ref.supabase.co/rest/v1/memos',
  judgeIssuer: 'https://aleph-judge-production.up.railway.app/defense/judge',
  sampleMarker: 'SAMPLE_NOTE_1',
  publicAppUrl: 'https://student-defense.vercel.app',
  allowedRoutes: ['GET /api/memos', 'POST /api/memos', 'GET /api/memos/:id', 'PUT /api/memos/:id', 'DELETE /api/memos/:id'],
  identityProvider: {
    issuer: 'https://project-ref.supabase.co/auth/v1',
    audience: 'authenticated',
    jwksUrl: 'https://project-ref.supabase.co/auth/v1/.well-known/jwks.json',
  },
};
const env = {
  VERCEL_GIT_PROVIDER: 'github',
  VERCEL_GIT_REPO_OWNER: 'Student-A',
  VERCEL_GIT_REPO_SLUG: 'aleph-defense',
  VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40),
  VERCEL_URL: 'student-defense-123.vercel.app',
};

test('build identity uses Vercel Git and deployment metadata', () => {
  assert.deepEqual(deploymentIdentity(env, config), {
    schema: 'aleph.defense.deployment.v1',
    step: 5,
    repoUrl: 'https://github.com/student-a/aleph-defense',
    commit: 'a'.repeat(40),
    publicAppUrl: 'https://student-defense-123.vercel.app',
    judgeIssuer: config.judgeIssuer,
    sampleMarker: config.sampleMarker,
    allowedRoutes: config.allowedRoutes,
    originalApiUrl: 'https://project-ref.supabase.co/rest/v1/memos',
  });
  // 3단계부터 허용 경로가 하나 이상, "METHOD /경로" 꼴이어야 하고 쿼리·중복·잘못된 메서드는 빌드 실패입니다.
  for (const bad of [undefined, null, [], 'GET /api/memos', ['/api/memos'], ['TRACE /api/memos'],
    ['GET /api/memos?x=1'], ['GET /api/memos', 'GET /api/memos'], [42]]) {
    assert.throws(() => deploymentIdentity(env, { ...config, allowedRoutes: bad }), /allowedRoutes/u, JSON.stringify(bad));
  }
  assert.equal('allowedRoutes' in deploymentIdentity(env, { ...config, step: 2 }), false);
  // 5단계부터 원본 자료 주소가 없거나, http이거나, 쿼리·비밀이 붙어 있으면 빌드가 실패해야 합니다.
  for (const bad of [undefined, null, '', 'http://project-ref.supabase.co/rest/v1/memos',
    'https://project-ref.supabase.co/rest/v1/memos?select=*', 'https://user:pw@project-ref.supabase.co/rest/v1/memos',
    'https://project-ref.supabase.co/rest/v1/memos#x', 'not a url']) {
    assert.throws(() => deploymentIdentity(env, { ...config, originalApiUrl: bad }), /originalApiUrl/u, String(bad));
  }
  // 4단계 이하에서는 originalApiUrl을 싣지 않습니다.
  assert.equal('originalApiUrl' in deploymentIdentity(env, { ...config, step: 4 }), false);
  assert.throws(() => deploymentIdentity({ ...env, VERCEL_GIT_PROVIDER: undefined }, config));
  assert.throws(() => deploymentIdentity({ ...env, VERCEL_GIT_COMMIT_SHA: 'short' }, config));
  assert.throws(() => deploymentIdentity(env, { ...config, step: 0 }));
  assert.throws(() => deploymentIdentity(env, { ...config, step: 13 }));
  assert.throws(() => deploymentIdentity(env, { ...config, step: '3' }));
});

test('step 5 attack checks send unauthenticated and forged requests and record only statuses', async () => {
  const originalFetch = globalThis.fetch;
  const seen = [];
  try {
    globalThis.fetch = async (url, init = {}) => {
      const target = new URL(String(url));
      seen.push({ url: String(url), path: target.pathname, method: init.method ?? 'GET', headers: init.headers ?? {},
        body: init.body, redirect: init.redirect });
      if (target.pathname === '/') {
        return new Response('<html>화면</html>', { status: 200, headers: { 'x-content-type-options': 'nosniff' } });
      }
      return new Response(target.pathname === '/data.json' ? 'not found' : '{"error":"LOGIN_REQUIRED"}',
        { status: target.pathname === '/data.json' ? 404 : 401 });
    };
    const results = await runAttackChecks(config);
    assert.equal(results.length, 13);
    const byId = Object.fromEntries(results.map((item) => [item.attackId, item.observed]));
    assert.match(byId.home_security_header, /보안 머리글이 있음/u);
    assert.match(byId.home_code_has_no_key, /보이지 않음/u);
    assert.equal(new Set(results.map((item) => item.attackId)).size, results.length);
    for (const result of results) {
      assert.deepEqual(Object.keys(result).sort(), ['attackId', 'expected', 'observed']);
      assert.doesNotMatch(result.observed, /eyJ|Bearer|notes|title/u);
    }
    assert.match(results[0].observed, /확인 표시가 보이지 않음 \(HTTP 404\)/u);
    const homeIds = ['home_security_header', 'home_code_has_no_key'];
    const guarded = results.slice(1).filter((item) => !homeIds.includes(item.attackId));
    assert.equal(guarded.length, 10);
    assert.ok(guarded.every((item) => /HTTP 401, 자료 없이 거부됨/u.test(item.observed)));
    assert.ok(seen.every((req) => req.redirect === 'error'));
    const post = seen.find((req) => req.method === 'POST');
    assert.equal(post.body, '{}');
    assert.deepEqual(seen.filter((req) => req.method !== 'GET').map((req) => req.method).sort(), ['DELETE', 'POST', 'PUT', 'PUT']);
    assert.ok(seen.some((req) => req.path === '/api/memos/b0b0b0b0-0000-4000-8000-000000000001' && req.method === 'GET'));
    const ownerChange = seen.find((req) => req.method === 'PUT' && String(req.body).includes('owner_id'));
    assert.ok(ownerChange && !ownerChange.headers.Authorization);
    const bearer = seen.filter((req) => req.headers.Authorization);
    assert.equal(bearer.length, 2);
    for (const req of bearer) assert.match(req.headers.Authorization, /^Bearer [\w-]+\.[\w-]+\.[\w-]+$/u);
    assert.equal(seen.filter((req) => !req.headers.Authorization).length, 10);
    // 원본 자료 API는 쿼리 없는 주소 그대로, 공개 키만 들고 직접 요청합니다.
    const direct = seen.find((req) => req.url === config.originalApiUrl);
    assert.ok(direct && direct.method === 'GET' && direct.headers.apikey && !direct.headers.Authorization);
    assert.match(results.at(-1).observed, /HTTP 401, 자료 없이 거부됨/u);

    // 보호가 뚫리면 그대로 기록해야 합니다.
    globalThis.fetch = async () => new Response('[]', { status: 200 });
    const open = await runAttackChecks(config);
    assert.ok(open.slice(1).filter((item) => !homeIds.includes(item.attackId))
      .every((item) => /거부되지 않음/u.test(item.observed)));
    // 보안 머리글이 없고 화면에 키가 있으면 그대로 기록해야 합니다.
    globalThis.fetch = async (url) => new URL(String(url)).pathname === '/'
      ? new Response('<script>const k="sb_publishable_ABCDEFGHIJKLMNOP"</script>', { status: 200 })
      : new Response('x', { status: 401 });
    const weak = Object.fromEntries((await runAttackChecks(config)).map((item) => [item.attackId, item.observed]));
    assert.match(weak.home_security_header, /보안 머리글이 없음/u);
    assert.match(weak.home_code_has_no_key, /키로 보이는 문자열이 있음/u);
    await assert.rejects(() => runAttackChecks({ ...config, step: 1 }));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
