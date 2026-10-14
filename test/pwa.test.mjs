import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const read = path => readFile(new URL(`../public/${path}`, import.meta.url));

test('manifest has the install fields and icons that exist', async () => {
  const manifest = JSON.parse(await read('manifest.webmanifest'));
  assert.ok(manifest.name && manifest.short_name);
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.icons.some(icon => icon.sizes === '192x192'));
  assert.ok(manifest.icons.some(icon => icon.sizes === '512x512'));
  for (const icon of manifest.icons) {
    const file = await read(icon.src.slice(1));
    assert.deepEqual([...file.subarray(0, 4)], [137, 80, 78, 71], icon.src);
  }
});

test('service worker only answers failed page navigations and never touches /api or storage of data', async () => {
  const sw = (await read('sw.js')).toString('utf8');
  assert.match(sw, /request\.mode !== 'navigate'/u);
  assert.doesNotMatch(sw, /localStorage|indexedDB|Authorization|\.put\(|addAll/u);
  assert.doesNotMatch(sw, /['"`]\/api/u);
});

test('home page links the manifest, shows the approval caveat, and adds no browser storage', async () => {
  const html = (await read('index.html')).toString('utf8');
  assert.match(html, /rel="manifest" href="\/manifest\.webmanifest"/u);
  assert.match(html, /id="offline-banner"/u);
  assert.match(html, /기기 승인[\s\S]*확인되지 않음/u);
  assert.match(html, /설치했다는 표시는 기기를 믿을 근거가 아닙니다/u);
  // 11단계: 로그인 토큰을 브라우저 저장소에 쓰지 않습니다. 예전 vault-session 값을 지우는 removeItem만 남습니다.
  assert.doesNotMatch(html, /localStorage.(setItem|getItem)|sessionStorage|indexedDB|document.cookie/u);
  assert.equal((html.match(/localStorage.removeItem/gu) ?? []).length, 1);
  // 11단계: 기기 승인 코드는 쿠키·저장소를 직접 만지지 않고, 승인 요청은 /api/device로만 보냅니다.
  assert.doesNotMatch(html, /document\.cookie/u);
  assert.match(html, /deviceCall\('POST'/u);
  assert.doesNotMatch(html, /deviceState\s*=\s*['"]approved['"]/u);
});
