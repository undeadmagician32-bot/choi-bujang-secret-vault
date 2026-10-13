import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  POLICY_FILES, PolicyDiffAbort, SNAPSHOT_SCHEMA, loadSnapshot, parseOptions, sha256, snapshotVersion,
} from './policy-diff.mjs';

// 현재 정책 파일 여섯 개를 「검증한 안전 정책 사본」으로 저장합니다. 침해 전, 정책이 맞다고 확인한 때만 실행하세요.
// - --confirm <버전>(또는 --confirm=<버전>) 없이는 미리보기만 하고 아무것도 쓰지 않습니다.
// - 사본이 이미 있으면 덮어쓰지 않고 중단합니다(옛 사본을 직접 옮기거나 --snapshot으로 다른 경로를 쓰세요).
// - 정책 파일은 읽기만 합니다. 쓰는 것은 사본 파일 하나뿐입니다.
const abort = (message) => { throw new PolicyDiffAbort(message); };

export function run(argv) {
  const opts = parseOptions(argv, ['--snapshot', '--root', '--confirm']);
  const root = resolve(opts.root ?? fileURLToPath(new URL('..', import.meta.url)));
  const output = resolve(opts.snapshot ?? join(root, 'backup', 'policy-snapshot.json'));
  if (existsSync(output)) abort('안전 정책 사본이 이미 있습니다. 덮어쓰지 않습니다.');

  const files = {};
  for (const path of POLICY_FILES) {
    const abs = join(root, path);
    if (!existsSync(abs)) abort(`정책 파일이 없어 사본을 만들 수 없습니다: ${path}`);
    const content = readFileSync(abs, 'utf8');
    files[path] = { sha256: sha256(content), content };
  }
  const version = snapshotVersion(files);
  const shown = [
    '정책 사본 만들기 미리보기 (확인 전에는 아무것도 쓰지 않습니다)',
    `만들 사본 버전: ${version}`,
    `사본 파일: ${output}`,
    ...POLICY_FILES.map((path) => `  ${path}  sha256 ${files[path].sha256.slice(0, 12)}…`),
    '이 사본은 위 파일을 「검증한 안전 정책」으로 정합니다. 침해 전 상태가 맞을 때만 확인하세요.',
  ].join('\n');

  if (opts.confirm === undefined) {
    return `${shown}\n\n아직 아무것도 쓰지 않았습니다. 위 버전이 맞으면 다음 명령을 실행하세요.\nnpm run policy:snapshot -- --confirm ${version}`;
  }
  if (opts.confirm !== version) abort(`확인한 버전 ${opts.confirm}이 만들 사본 버전 ${version}과 다릅니다. 아무것도 쓰지 않았습니다.`);

  mkdirSync(dirname(output), { recursive: true });
  const snap = { schema: SNAPSHOT_SCHEMA, version, createdAt: new Date().toISOString(), files };
  try {
    writeFileSync(output, `${JSON.stringify(snap, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  } catch {
    abort('안전 정책 사본을 쓰지 못했습니다. 이미 있거나 쓸 수 없는 경로입니다.');
  }
  loadSnapshot(output, version); // 쓴 사본을 다시 읽어 검증합니다. 실패하면 중단합니다.
  return `${shown}\n\n사본을 만들었습니다: 버전 ${version}. 이 버전을 적어 두고 사본 파일을 커밋하세요.\n나중에 npm run policy:diff -- --expect-version ${version} 로 같은 버전인지 확인할 수 있습니다.`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(run(process.argv.slice(2)));
  } catch (error) {
    console.log(`중단: ${error instanceof PolicyDiffAbort ? error.message : '예상하지 못한 오류가 났습니다.'}`);
    process.exitCode = 2;
  }
}
