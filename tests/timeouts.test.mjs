// verifica o prazo de listagem por tipo de host: o prazo curto das conexões
// locais só vale para loopback de verdade, não para uma máquina remota
import { isLoopbackUrl, modelsTimeout } from '../lib/providers.js';

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'ok    ' : 'FALHA ') + msg); if (!cond) fails++; };

for (const u of ['http://localhost:11434/v1', 'http://127.0.0.1:1234/v1', 'http://127.5.5.5:80', 'http://[::1]:11434/v1', 'http://app.localhost:3000']) {
  ok(isLoopbackUrl(u) === true, `loopback reconhecido: ${u}`);
}
for (const u of ['http://100.97.5.57:11434/v1', 'https://api.openai.com/v1', 'http://192.168.0.10:11434', 'http://meu-servidor:11434', '', 'não é url']) {
  ok(isLoopbackUrl(u) === false, `não é loopback: ${u || '(vazio)'}`);
}

const ollamaLocal = { local: true, baseUrl: 'http://localhost:11434/v1' };
const ollamaRemoto = { local: true, baseUrl: 'http://100.97.5.57:11434/v1' };
const nuvem = { local: false, baseUrl: 'https://openrouter.ai/api/v1' };

ok(modelsTimeout(ollamaLocal) === 3000, 'loopback local mantém o prazo curto de 3 s para a detecção automática');
ok(modelsTimeout(ollamaRemoto) === 15000, 'conexão local apontada para outra máquina ganha 15 s');
ok(modelsTimeout(nuvem) === 20000, 'provedor de nuvem mantém 20 s');
ok(modelsTimeout(undefined) === 20000, 'sem conexão, o prazo é o longo');
ok(modelsTimeout({ local: true, baseUrl: 'lixo' }) === 15000, 'URL inválida numa conexão local não recebe o prazo curto');

console.log(fails ? `\n${fails} falha(s)` : '\ntudo certo');
process.exit(fails ? 1 : 0);
