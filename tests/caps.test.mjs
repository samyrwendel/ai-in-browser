// capacidades reais (m.caps, vindas do /api/tags do Ollama) têm prioridade
// sobre as heurísticas por nome
import * as P from '../lib/providers.js';
import * as R from '../lib/roles.js';

let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok    ' : 'FALHA ') + m); if (!c) fails++; };

const ollama = { type: 'openai', baseUrl: 'http://100.97.5.57:11434/v1', local: true };

// um modelo cujo NOME não sugere visão, mas o servidor diz que enxerga
const qwenVL = { id: 'qwen3.6:latest', caps: { vision: true, tools: true, reasoning: true } };
ok(P.modelSupportsVision(ollama, qwenVL) === true, 'visão vem do caps real, não do nome');
ok(P.modelLikelySupportsTools(ollama, qwenVL) === true, 'ferramentas vêm do caps real');
ok(R.capabilities(ollama, qwenVL).reasoning === true, 'raciocínio vem do caps real');

// caps real dizendo que NÃO tem, mesmo que o nome sugira
const semTools = { id: 'qwen3-coder:30b', caps: { vision: false, tools: false, reasoning: false } };
ok(P.modelSupportsVision(ollama, semTools) === false, 'sem visão respeita o caps real');
ok(P.modelLikelySupportsTools(ollama, semTools) === false, 'sem ferramentas respeita o caps real (nome tinha "qwen3")');
ok(R.capabilities(ollama, semTools).reasoning === false, 'sem raciocínio respeita o caps real');

// sem caps, cai na heurística por nome (comportamento antigo preservado)
const semCaps = { id: 'qwen3-coder:30b' };
ok(P.modelLikelySupportsTools(ollama, semCaps) === true, 'sem caps, heurística por nome ainda vale');

console.log(fails ? `\n${fails} falha(s)` : '\ntudo certo');
process.exit(fails ? 1 : 0);
