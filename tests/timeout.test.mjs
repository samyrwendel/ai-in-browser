import * as R from '../lib/roles.js';

// servidor que nunca responde, para provar que o tempo limite corta
import http from 'node:http';
const travado = http.createServer(() => {}).listen(8802);
const conn = { id: 'x', type: 'openai', name: 'Travado', baseUrl: 'http://127.0.0.1:8802/v1', apiKey: '', local: true };
const img = [{ data: 'AAAA', mediaType: 'image/jpeg' }];
const ok = (n, c) => console.log((c ? 'ok    ' : 'FALHA ') + n);

// 1) expira sozinho
let t0 = Date.now();
try {
  await R.describeImages(conn, 'm', img, { timeoutMs: 800 });
  ok('expira quando o modelo não responde', false);
} catch (e) {
  const dt = Date.now() - t0;
  ok(`expira em ~0,8s (levou ${dt}ms) com erro claro: "${e.message}"`, e.name === 'HelperTimeout' && dt < 3000);
}

// 2) o Parar interrompe antes do tempo limite
const ctrl = new AbortController();
t0 = Date.now();
setTimeout(() => ctrl.abort(new Error('parado pelo usuário')), 300);
try {
  await R.describeImages(conn, 'm', img, { timeoutMs: 60000, signal: ctrl.signal });
  ok('cancelamento pelo usuário interrompe', false);
} catch (e) {
  const dt = Date.now() - t0;
  ok(`cancelamento interrompe em ~0,3s (levou ${dt}ms) e não vira tempo limite`, dt < 2000 && e.name !== 'HelperTimeout');
}

// 3) título também tem prazo
t0 = Date.now();
try {
  await R.generateTitle(conn, 'm', 'texto', { timeoutMs: 600 });
  ok('geração de título expira', false);
} catch (e) {
  ok(`geração de título expira (levou ${Date.now() - t0}ms)`, Date.now() - t0 < 3000);
}
travado.close();
