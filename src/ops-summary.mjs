import { randomBytes } from 'node:crypto';
import { RULE_IDS } from './decider.mjs';

// 12단계 탈환 작전실 요약. 화면이 보여 줄 값은 모두 이 함수가 서버에서 만든 한 객체에서 나오고,
// 가린 서버 기록(opsLogRecord)도 같은 객체에서 만들어서 화면 수치와 기록이 어긋나지 않습니다.
// 상태 값: 'verified'(이번 요청에서 서버가 직접 읽어 확인) | 'not_run'(이 서버에서 실행·연결하지 않음) | 'failed'(읽다가 실패).
// 메모 제목·본문, 사용자 ID, 메모 ID, 기기 ID는 읽지도 싣지도 않습니다. 사용자는 서버가 토큰으로 확인한 본인 한 명뿐입니다.
const OUTCOME = /^[a-z_]{1,40}$/u;
const DEVICE_STATES = ['pending', 'approved', 'revoked'];
const HASH = /^[0-9a-f]{64}$/u;
const VERSION_LIMIT = 5;

const attempt = async (read) => {
  try { return { value: await read() }; } catch { return { failed: true }; }
};
const countBy = (rows, key, allowed) => {
  const counts = Object.fromEntries(allowed.map((name) => [name, 0]));
  let other = 0;
  for (const row of rows) {
    const name = row?.[key];
    if (allowed.includes(name)) counts[name] += 1; else other += 1;
  }
  return { counts, other };
};

export async function buildOpsSummary({ userId, store, now = () => new Date(), recordId = () => randomBytes(4).toString('hex') }) {
  const devices = await attempt(() => store.deviceRows(userId));
  const backups = await attempt(() => store.backups(userId));
  const audit = await attempt(() => store.auditRows(userId));

  const summary = {
    recordId: recordId(),
    generatedAt: now().toISOString(),
    rules: {
      status: 'verified',
      source: 'server_code',
      count: RULE_IDS.length,
      ruleIds: [...RULE_IDS],
      // 자료실 서버 함수는 판정기를 부르지 않습니다. 실제 요청이 판정된 건수는 이 서버에 없습니다.
      liveDecisions: { status: 'not_run', count: null },
    },
    detection: {
      // 운영 반 엔진이 검증한 사건을 detect()에 전달하는 경로가 이 저장소에 없습니다.
      status: 'not_run', reason: 'engine_not_connected', events: null, proposals: null,
    },
    revocation: devices.failed
      ? { status: 'failed', devices: null, enforcement: { status: 'not_run' } }
      : (() => {
        const { counts, other } = countBy(devices.value, 'status', DEVICE_STATES);
        return {
          status: 'verified',
          devices: { ...counts, other, total: devices.value.length },
          // 회수 제안을 집행하는 경로가 연결돼 있지 않습니다. revoked는 운영자가 DB에서 바꾼 값입니다.
          enforcement: { status: 'not_run' },
        };
      })(),
    restore: {
      status: backups.failed || audit.failed ? 'failed' : 'verified',
      versions: backups.failed ? null : {
        count: backups.value.count,
        latest: backups.value.rows.slice(0, VERSION_LIMIT).map((row) => ({
          backedUpAt: typeof row.backed_up_at === 'string' ? row.backed_up_at : null,
          hash8: HASH.test(row.content_hash) ? row.content_hash.slice(0, 8) : null,
        })),
      },
      audit: audit.failed ? null : (() => {
        const names = [...new Set(audit.value.rows.map((row) => row?.outcome).filter((name) => OUTCOME.test(name)))].sort();
        const { counts, other } = countBy(audit.value.rows, 'outcome', names);
        return { total: audit.value.count, byOutcome: counts, other, truncated: audit.value.rows.length < audit.value.count };
      })(),
      // 정책 사본(restore/policy-snapshot.json) 비교는 로컬 명령(restore:plan)이 하며 배포 서버에서는 읽지 않습니다.
      policySnapshot: { status: 'not_run' },
    },
  };
  // 가린 서버 기록을 응답에도 같이 싣습니다. 서버 로그(OPS_SUMMARY)에 남는 값과 같은 객체입니다.
  summary.serverRecord = opsLogRecord(summary);
  return summary;
}

// 가린 서버 기록: 수치와 상태만 담습니다. 사용자·메모·기기 식별자와 본문은 없습니다. recordId로 화면과 맞춰 봅니다.
export function opsLogRecord(summary) {
  return {
    id: summary.recordId,
    rules: summary.rules.count,
    detection: summary.detection.status,
    revocation: summary.revocation.status,
    devices: summary.revocation.devices
      ? [summary.revocation.devices.pending, summary.revocation.devices.approved, summary.revocation.devices.revoked]
      : null,
    restore: summary.restore.status,
    versions: summary.restore.versions?.count ?? null,
    audit: summary.restore.audit?.total ?? null,
    restored: summary.restore.audit?.byOutcome?.restored ?? null,
  };
}

export function supabaseOpsStore(supabase) {
  const must = ({ data, error, count }) => { if (error) throw error; return { rows: data ?? [], count: count ?? (data?.length ?? 0) }; };
  return {
    deviceRows: async (userId) => must(await supabase.from('device_registrations')
      .select('status').eq('owner_id', userId).limit(100)).rows,
    backups: async (userId) => must(await supabase.from('memo_backups')
      .select('backed_up_at, content_hash', { count: 'exact' }).eq('owner_id', userId)
      .order('backed_up_at', { ascending: false }).limit(VERSION_LIMIT)),
    auditRows: async (userId) => must(await supabase.from('memo_restore_audit')
      .select('outcome', { count: 'exact' }).eq('owner_id', userId).limit(1000)),
  };
}
