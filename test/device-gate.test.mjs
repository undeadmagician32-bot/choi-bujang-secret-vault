import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deviceStatus, gateDevice, MAX_PENDING_PER_OWNER, parseDeviceCookie, requestDevice, setCookieHeader }
  from '../src/device-gate.mjs';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

// 가상 값만 쓰는 메모리 저장소. 운영자의 승인은 store 쪽 행을 직접 바꾸는 것으로 흉내 냅니다.
const memoryStore = () => {
  const rows = new Map();
  return {
    rows,
    async findById(id) { return rows.get(id) ?? null; },
    async countPending(owner) { return [...rows.values()].filter(r => r.owner_id === owner && r.status === 'pending').length; },
    async insert(row) { rows.set(row.id, { ...row }); },
  };
};
const cookieOf = result => result.setCookie.split(';')[0];

test('request creates only a pending row, sets an HttpOnly cookie, and never approves', async () => {
  const store = memoryStore();
  const result = await requestDevice({ store, userId: A, cookieHeader: undefined, input: { label: '내 노트북' } });
  assert.equal(result.status, 201);
  assert.equal(result.body.state, 'pending');
  assert.match(result.setCookie, /HttpOnly/u);
  assert.match(result.setCookie, /Secure/u);
  assert.match(result.setCookie, /SameSite=Strict/u);
  const row = store.rows.get(result.body.id);
  assert.equal(row.status, 'pending');
  assert.match(row.secret_hash, /^[0-9a-f]{64}$/u);
  assert.equal(JSON.stringify(row).includes(cookieOf(result).split('.')[1]), false); // 비밀값 원문은 표에 없음
  assert.equal((await deviceStatus({ store, userId: A, cookieHeader: cookieOf(result) })).state, 'pending');
});

test('pressing request again, or sending body fields, never approves or duplicates', async () => {
  const store = memoryStore();
  const first = await requestDevice({ store, userId: A, cookieHeader: undefined, input: {} });
  const again = await requestDevice({ store, userId: A, cookieHeader: cookieOf(first), input: { status: 'approved', state: 'approved' } });
  assert.equal(again.status, 200);
  assert.equal(again.body.state, 'pending');
  assert.equal(store.rows.size, 1);
  assert.equal([...store.rows.values()][0].status, 'pending');
});

test('only a server-side status change opens the device, and only for the same owner and secret', async () => {
  const store = memoryStore();
  const first = await requestDevice({ store, userId: A, cookieHeader: undefined, input: {} });
  const cookie = cookieOf(first);
  store.rows.get(first.body.id).status = 'approved'; // 운영자가 서버에서 바꾼 값
  assert.equal((await deviceStatus({ store, userId: A, cookieHeader: cookie })).state, 'approved');
  // 다른 사용자, 쿠키 없음, 비밀값이 틀린 쿠키, 형식이 틀린 쿠키는 모두 none
  assert.equal((await deviceStatus({ store, userId: B, cookieHeader: cookie })).state, 'none');
  assert.equal((await deviceStatus({ store, userId: A, cookieHeader: undefined })).state, 'none');
  const wrongSecret = `vault_device=${first.body.id}.${'x'.repeat(43)}`;
  assert.equal((await deviceStatus({ store, userId: A, cookieHeader: wrongSecret })).state, 'none');
  assert.equal(parseDeviceCookie('vault_device=garbage'), null);
  assert.equal((await deviceStatus({ store, userId: A, cookieHeader: `x=1; ${cookie}` })).state, 'approved');
  // 회수하면 다시 열리지 않고, 같은 쿠키로 스스로 되살릴 수 없습니다.
  store.rows.get(first.body.id).status = 'revoked';
  assert.equal((await deviceStatus({ store, userId: A, cookieHeader: cookie })).state, 'revoked');
  const retry = await requestDevice({ store, userId: A, cookieHeader: cookie, input: {} });
  assert.equal(retry.body.state, 'revoked');
  assert.equal(store.rows.size, 1);
});

test('pending requests per owner are limited and labels are validated', async () => {
  const store = memoryStore();
  for (let i = 0; i < MAX_PENDING_PER_OWNER; i += 1) {
    assert.equal((await requestDevice({ store, userId: A, cookieHeader: undefined, input: {} })).status, 201);
  }
  assert.equal((await requestDevice({ store, userId: A, cookieHeader: undefined, input: {} })).status, 429);
  assert.equal((await requestDevice({ store, userId: B, cookieHeader: undefined, input: { label: '<script>' } })).status, 400);
  assert.equal((await requestDevice({ store, userId: B, cookieHeader: undefined, input: { label: 5 } })).status, 400);
});

test('gateDevice denies unapproved students with 403, fails closed on errors, and lets judge tokens through', async () => {
  const store = memoryStore();
  const make = (cookie) => {
    const out = { code: null, body: null };
    const response = { status(code) { out.code = code; return this; }, json(body) { out.body = body; return this; } };
    return { out, response, request: { headers: { cookie } } };
  };
  // gateDevice는 Supabase 클라이언트를 받으므로 같은 모양의 가짜를 씁니다.
  const supabaseFor = rows => ({
    from: () => {
      const query = {
        select: () => query, eq: () => query,
        maybeSingle: async () => ({ data: rows, error: null }),
      };
      return query;
    },
  });
  const first = await requestDevice({ store, userId: A, cookieHeader: undefined, input: {} });
  const row = store.rows.get(first.body.id);

  let call = make(cookieOf(first));
  assert.equal(await gateDevice({ ...call, verified: { kind: 'student', userId: A }, supabase: supabaseFor(row) }), false);
  assert.equal(call.out.code, 403);
  assert.equal(call.out.body.error, 'DEVICE_NOT_APPROVED');

  call = make(undefined);
  assert.equal(await gateDevice({ ...call, verified: { kind: 'student', userId: A }, supabase: supabaseFor(null) }), false);
  assert.equal(call.out.code, 403);

  row.status = 'approved';
  call = make(cookieOf(first));
  assert.equal(await gateDevice({ ...call, verified: { kind: 'student', userId: A }, supabase: supabaseFor(row) }), true);
  assert.equal(call.out.code, null);

  call = make(cookieOf(first));
  const broken = { from: () => { throw new Error('db down'); } };
  assert.equal(await gateDevice({ ...call, verified: { kind: 'student', userId: A }, supabase: broken }), false);
  assert.equal(call.out.code, 503);

  call = make(undefined);
  assert.equal(await gateDevice({ ...call, verified: { kind: 'judge', userId: B }, supabase: broken }), true);
});

test('cookie header cannot be read by page scripts and is scoped to /api', () => {
  const header = setCookieHeader('v');
  assert.match(header, /Path=\/api;/u);
  assert.match(header, /HttpOnly/u);
});
