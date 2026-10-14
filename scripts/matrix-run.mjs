import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { renderMarkdown, runMatrix, ENV_NAMES } from '../src/matrix.mjs';

// npm run matrix:run [-- --include-writes]
// 배포 주소에 실제 요청을 보내고 결과를 artifacts/matrix.json, artifacts/matrix.md에 씁니다(artifacts/는 커밋하지 않음).
// 로그인한 점검에 필요한 값은 환경변수로만 받습니다(이름: VAULT_TOKEN_A, VAULT_TOKEN_B, VAULT_DEVICE_COOKIE_A,
// VAULT_DEVICE_COOKIE_B, VAULT_A_MEMO_ID, VAULT_B_RESTORE_ID). 값은 출력하지도 저장하지도 않고, 없으면 그 항목은 미실행입니다.
const root = resolve(import.meta.dirname, '..');
try {
  const config = JSON.parse(readFileSync(join(root, 'aleph.config.json'), 'utf8'));
  const includeWrites = process.argv.includes('--include-writes');
  const result = await runMatrix({ config, includeWrites });
  mkdirSync(join(root, 'artifacts'), { recursive: true });
  writeFileSync(join(root, 'artifacts', 'matrix.json'), `${JSON.stringify(result, null, 2)}\n`);
  writeFileSync(join(root, 'artifacts', 'matrix.md'), renderMarkdown(result));
  const s = result.summary;
  process.stdout.write(`확인표: ${s.total}건 중 통과 ${s.passed} · 실패 ${s.failed} · 오류 ${s.errored} · 미실행 ${s.notRun}\n`);
  process.stdout.write(`총공세 41종: 실행 ${s.attacks41.executed}, 미실행 ${s.attacks41.notRun} (통과로 세지 않음)\n`);
  for (const row of result.rows.filter((r) => r.status === '실패' || r.status === '오류')) {
    process.stdout.write(`${row.status} · ${row.step}단계 ${row.kind} · ${row.what} → ${row.actual}\n`);
  }
  const missing = [...new Set(result.rows.filter((r) => r.status === '미실행').map((r) => r.reason))];
  if (missing.length) process.stdout.write(`미실행 사유: ${missing.join(' / ')}\n(환경변수 이름 목록: ${ENV_NAMES.join(', ')})\n`);
  process.stdout.write('결과 파일: artifacts/matrix.md, artifacts/matrix.json (커밋하지 않음)\n');
  if (s.failed || s.errored) process.exitCode = 1;
} catch (error) {
  process.stderr.write(`확인표 첫 오류: ${error.message}\n`);
  process.exitCode = 1;
}
