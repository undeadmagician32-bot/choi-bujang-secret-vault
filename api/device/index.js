import { authorize, methodNotAllowed } from '../../src/memo-api.mjs';
import { deviceStatus, requestDevice, supabaseDeviceStore } from '../../src/device-gate.mjs';

// GET /api/device  : 이 기기(쿠키)의 서버 쪽 승인 상태 { state, id? }. 로그인 필요.
// POST /api/device : 승인 요청. pending 행만 만들며 승인하지 않습니다. 본문: 선택 항목 { label }.
// 승인(approved)은 이 경로로 할 수 없고, 서버 표를 운영자가 바꿔야 합니다(docs/DEVICES.sql).
export default async function handler(request, response) {
  if (request.method !== 'GET' && request.method !== 'POST') {
    methodNotAllowed(response, 'GET, POST');
    return;
  }
  const session = await authorize(request, response, { skipDevice: true });
  if (!session) return;
  const store = supabaseDeviceStore(session.supabase);
  try {
    if (request.method === 'GET') {
      response.status(200).json(await deviceStatus({
        store, userId: session.userId, cookieHeader: request.headers.cookie,
      }));
      return;
    }
    let input = request.body;
    if (typeof input === 'string') { try { input = JSON.parse(input); } catch { input = null; } }
    if (input !== undefined && input !== null && (typeof input !== 'object' || Array.isArray(input))) {
      response.status(400).json({ error: 'INVALID_BODY' });
      return;
    }
    const result = await requestDevice({
      store, userId: session.userId, cookieHeader: request.headers.cookie, input: input ?? {},
    });
    if (result.setCookie) response.setHeader('Set-Cookie', result.setCookie);
    response.status(result.status).json(result.body);
  } catch {
    console.error('DEVICE_REQUEST_FAILED');
    response.status(502).json({ error: 'DEVICE_UNAVAILABLE' });
  }
}
