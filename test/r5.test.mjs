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

test('bundle attack checks send no request and record every check as not_run', async () => {
  const originalFetch = globalThis.fetch;
  let sent = 0;
  try {
    globalThis.fetch = async () => { sent += 1; return new Response('x', { status: 200 }); };
    for (const step of [5, 6, 7, 8, 9, 10, 11, 12]) {
      const results = await runAttackChecks({ ...config, step });
      assert.equal(results.length, 16);
      assert.equal(new Set(results.map((item) => item.attackId)).size, results.length);
      for (const result of results) {
        assert.deepEqual(Object.keys(result).sort(), ['attackId', 'expected', 'observed']);
        assert.equal(result.observed, 'not_run'); // 보내지 않은 점검에 통과·거부·허용을 지어내 적지 않음
        assert.ok(result.expected.trim() && result.expected.length <= 300);
        assert.match(result.attackId, /^[a-z0-9][a-z0-9_.-]{0,79}$/iu);
      }
    }
    assert.equal(sent, 0); // 번들은 네트워크를 쓰지 않음
    await assert.rejects(() => runAttackChecks({ ...config, step: 1 }));
    await assert.rejects(() => runAttackChecks({ ...config, step: 13 }));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
