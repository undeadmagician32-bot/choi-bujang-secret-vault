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
  });
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
      return new Response(target.pathname === '/data.json' ? 'not found' : '{"error":"LOGIN_REQUIRED"}',
        { status: target.pathname === '/data.json' ? 404 : 401 });
    };
    const results = await runAttackChecks(config);
    assert.equal(results.length, 11);
    assert.equal(new Set(results.map((item) => item.attackId)).size, results.length);
    for (const result of results) {
      assert.deepEqual(Object.keys(result).sort(), ['attackId', 'expected', 'observed']);
      assert.doesNotMatch(result.observed, /eyJ|Bearer|notes|title/u);
    }
    assert.match(results[0].observed, /확인 표시가 보이지 않음 \(HTTP 404\)/u);
    assert.ok(results.slice(1).every((item) => /HTTP 401, 자료 없이 거부됨/u.test(item.observed)));
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
    assert.equal(seen.filter((req) => !req.headers.Authorization).length, 9);
    // 원본 자료 API는 쿼리 없는 주소 그대로, 공개 키만 들고 직접 요청합니다.
    const direct = seen.find((req) => req.url === config.originalApiUrl);
    assert.ok(direct && direct.method === 'GET' && direct.headers.apikey && !direct.headers.Authorization);
    assert.match(results.at(-1).observed, /HTTP 401, 자료 없이 거부됨/u);

    // 보호가 뚫리면 그대로 기록해야 합니다.
    globalThis.fetch = async () => new Response('[]', { status: 200 });
    const open = await runAttackChecks(config);
    assert.ok(open.slice(1).every((item) => /거부되지 않음/u.test(item.observed)));
    await assert.rejects(() => runAttackChecks({ ...config, step: 1 }));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
