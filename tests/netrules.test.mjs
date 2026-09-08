import { buildOriginRules, originFor } from '../lib/netrules.js';

const conns = [
  { id: 'openrouter', type: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1', enabled: true },
  { id: 'openai', type: 'openai', baseUrl: 'https://api.openai.com/v1', apiKey: 'x', enabled: true },
  { id: 'anthropic', type: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', enabled: true },
  { id: 'ollama', type: 'openai', baseUrl: 'http://100.97.5.57:11434/v1', enabled: true, local: true },
  { id: 'lmstudio', type: 'openai', baseUrl: 'http://localhost:1234/v1', enabled: false, local: true },
  { id: 'groq', type: 'openai', baseUrl: 'https://api.groq.com/openai/v1', enabled: true },
  { id: 'dup', type: 'openai', baseUrl: 'http://100.97.5.57:11434/', enabled: true },
  { id: 'ruim', type: 'openai', baseUrl: 'não é url', enabled: true },
  { id: 'ftp', type: 'openai', baseUrl: 'ftp://x/v1', enabled: true }
];
const rules = buildOriginRules(conns, 'fbkjajcphbgpcaghmnihplolhjnifikn');
const check = (nome, ok) => console.log((ok ? 'ok    ' : 'FALHA ') + nome);
check('gera 3 regras (ollama, lmstudio desativada, groq); ignora oficiais, duplicada, inválidas', rules.length === 3);
check('conexão desativada também ganha regra, senão testá-la antes de ativar dá 403 para sempre', rules.some((r) => r.condition.urlFilter === '|http://localhost:1234/'));
check('ollama remoto com urlFilter ancorado', rules[0].condition.urlFilter === '|http://100.97.5.57:11434/');
check('groq incluído (compatível OpenAI, não oficial)', rules.some((r) => r.condition.urlFilter === '|https://api.groq.com/'));
check('remove o cabeçalho Origin', rules[0].action.requestHeaders[0].header === 'Origin' && rules[0].action.requestHeaders[0].operation === 'remove');
check('restrito às requisições da própria extensão', rules[0].condition.initiatorDomains?.[0] === 'fbkjajcphbgpcaghmnihplolhjnifikn');
check('só xmlhttprequest', rules[0].condition.resourceTypes.join() === 'xmlhttprequest');
check('ids estáveis e sequenciais a partir de 7000', rules.map((r) => r.id).join() === '7000,7001,7002');
check('sem initiator quando não há id', buildOriginRules(conns, null)[0].condition.initiatorDomains === undefined);
check('originFor descarta esquema não http', originFor('ftp://x') === null && originFor('http://a:1/v1') === 'http://a:1');
