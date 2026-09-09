// verifica a heurística de tool calling: gateway remoto personalizado é
// otimista (o usuário escolheu, e há queda para JSON); só servidor local
// é julgado pelo nome do modelo
import { modelLikelySupportsTools } from '../lib/providers.js';

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'ok    ' : 'FALHA ') + msg); if (!cond) fails++; };

const drael = { type: 'openai', baseUrl: 'https://drael.sh/v1' };
const oficialOpenAI = { type: 'openai', baseUrl: 'https://api.openai.com/v1' };
const openrouter = { type: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1' };
const anthropic = { type: 'anthropic', baseUrl: 'https://api.anthropic.com/v1' };
const groq = { type: 'openai', baseUrl: 'https://api.groq.com/openai/v1' };
const ollama = { type: 'openai', baseUrl: 'http://localhost:11434/v1', local: true };

// o caso do relatório: nome desconhecido num gateway de nuvem
ok(modelLikelySupportsTools(drael, { id: 'drael-v1' }) === true, 'drael-v1 remoto: assumido com ferramentas (era o bug)');
ok(modelLikelySupportsTools(groq, { id: 'algum-modelo-novo-2027' }) === true, 'gateway remoto com nome desconhecido: otimista');
ok(modelLikelySupportsTools(openrouter, { id: 'x/y' }) === true, 'openrouter sempre true');
ok(modelLikelySupportsTools(anthropic, { id: 'claude' }) === true, 'anthropic sempre true');
ok(modelLikelySupportsTools(oficialOpenAI, { id: 'gpt-5' }) === true, 'openai oficial sempre true');

// local continua pelo nome
ok(modelLikelySupportsTools(ollama, { id: 'qwen3-coder:30b' }) === true, 'local conhecido (qwen3): true pelo nome');
ok(modelLikelySupportsTools(ollama, { id: 'glm-4.7-flash:latest' }) === true, 'local conhecido (glm): true pelo nome');
ok(modelLikelySupportsTools(ollama, { id: 'modelo-exotico-sem-tools:latest' }) === false, 'local desconhecido: false pelo nome');
ok(modelLikelySupportsTools(ollama, { id: 'llama2:7b' }) === false, 'local antigo sem tools: false');

console.log(fails ? `\n${fails} falha(s)` : '\ntudo certo');
process.exit(fails ? 1 : 0);
