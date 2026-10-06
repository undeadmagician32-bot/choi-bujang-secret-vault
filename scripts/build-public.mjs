import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { deploymentIdentity } from './deployment-identity.mjs';

// 2단계부터 자료는 Supabase에 있으므로 public/에 자료 파일을 복사하지 않습니다.
// 예전 배포에서 남은 public/data.json이 있으면 공개되지 않도록 지웁니다.
const root = resolve(import.meta.dirname, '..');
const config = JSON.parse(await readFile(resolve(root, 'aleph.config.json'), 'utf8'));
await mkdir(resolve(root, 'public'), { recursive: true });
await rm(resolve(root, 'public', 'data.json'), { force: true });
console.log('자료 파일은 복사하지 않습니다. 화면은 /api/notes로 자료를 읽습니다.');
if (!process.argv.includes('--local')) {
  const identity = deploymentIdentity(process.env, config);
  await writeFile(resolve(root, 'public', 'aleph.json'),
    `${JSON.stringify(identity, null, 2)}\n`, 'utf8');
  console.log('배포 저장소·커밋·주소를 public/aleph.json에 기록했습니다.');
}
