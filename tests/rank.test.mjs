import * as R from '../lib/roles.js';
const now = 1;
const or = [
  { id: 'openrouter/auto', name: 'Auto Router', owner: 'openrouter', context: 2000000, promptPrice: 0.01, completionPrice: 0.01, modalities: ['text','image'], params: ['tools'] },
  { id: 'anthropic/claude-sonnet-5', name: 'Anthropic: Claude Sonnet 5', owner: 'anthropic', context: 1000000, promptPrice: 3, completionPrice: 15, modalities: ['text','image'], params: ['tools','reasoning'] },
  { id: 'google/gemini-2.5-flash', name: 'Google: Gemini 2.5 Flash', owner: 'google', context: 1048576, promptPrice: 0.3, completionPrice: 2.5, modalities: ['text','image'], params: ['tools','reasoning'] },
  { id: 'x-ai/grok-4.6', name: 'xAI: Grok 4.6', owner: 'x-ai', context: 500000, promptPrice: 3, completionPrice: 15, modalities: ['text','image'], params: ['tools'] },
  { id: 'meta-llama/llama-4-maverick', name: 'Meta: Llama 4 Maverick', owner: 'meta-llama', context: 1048576, promptPrice: 0.2, completionPrice: 0.7, modalities: ['text','image'], params: ['tools'] },
  { id: 'deepseek/deepseek-r1-0528:free', name: 'DeepSeek: R1 (free)', owner: 'deepseek', context: 163840, promptPrice: 0, completionPrice: 0, free: true, modalities: ['text'], params: ['reasoning'] }
];
const settings = { connections: [{ id: 'openrouter', type: 'openrouter', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', apiKey: 'k', enabled: true }, { id: 'ollama', type: 'openai', name: 'Ollama (local)', baseUrl: 'http://x:11434/v1', enabled: true, local: true }], favorites: [], roles: {} };
const models = { openrouter: or, ollama: [{ id: 'glm-4.7-flash:latest', name: 'GLM 4.7 Flash', owner: 'library' }] };
const main = { connectionId: 'ollama', modelId: 'glm-4.7-flash:latest' };
const ok = (n, c) => console.log((c ? 'ok    ' : 'FALHA ') + n);
const names = (l) => l.map((c) => c.name).join(' > ');
let v = R.candidates('vision', settings, models, main, 'balanced');
ok('Auto Router excluído das sugestões de visão', !v.some((c) => /Auto Router/.test(c.name)));
ok('equilíbrio: um bom e barato (Flash/Maverick) antes de Sonnet 5, que é referência mas caro  →  ' + names(v).slice(0, 80), /Flash|Maverick/.test(v[0].name) && v[0].name !== 'Claude Sonnet 5');
v = R.candidates('vision', settings, models, main, 'quality');
ok('qualidade: Claude Sonnet 5 primeiro  →  ' + names(v).slice(0, 60), v[0].name === 'Claude Sonnet 5' && v[0].labels.includes('melhor qualidade'));
v = R.candidates('vision', settings, models, main, 'price');
ok('preço: Llama 4 Maverick (mais barato com qualidade ≥ boa) primeiro  →  ' + names(v).slice(0, 60), v[0].name === 'Llama 4 Maverick');
ok('rótulo melhor preço em algum candidato', v.some((c) => c.labels.includes('melhor preço')));
ok('preço formatado', R.formatCandidatePrice(v[0]) === '$0.20 / $0.70 por 1M');
let r = R.candidates('reasoning', settings, models, main, 'balanced');
ok('raciocínio: R1 gratuito no topo em equilíbrio  →  ' + names(r).slice(0, 60), /R1/.test(r[0].name) && r[0].labels.includes('grátis'));
let a = R.candidates('agent', settings, models, main, 'quality');
ok('agente/qualidade: Sonnet 5 primeiro; GLM Flash local é nível bom (2), não referência  →  ' + names(a).slice(0, 70), a[0].name === 'Claude Sonnet 5' && a.find((c) => /GLM/.test(c.name))?.tier === 2);
let ab = R.candidates('agent', settings, models, main, 'balanced');
ok('agente/equilíbrio: GLM local (sem custo) primeiro  →  ' + names(ab).slice(0, 60), /GLM/.test(ab[0].name));

// automático só preenche lacunas
let res = R.resolveRole('agent', settings, models, main);
ok('agente/auto: GLM principal tem ferramentas → o principal cobre, sem trocar por Qwen/Sonnet  →  ' + res.source, res.source === 'main');
res = R.resolveRole('vision', settings, models, main);
ok('visão/auto: GLM não enxerga → delega  →  ' + res.name + ' (' + res.source + ')', res.source === 'auto');
res = R.resolveRole('vision', settings, models, { connectionId: 'openrouter', modelId: 'google/gemini-2.5-flash' });
ok('visão/auto com principal Gemini Flash (enxerga) → o principal cobre, mesmo havendo Sonnet 5 melhor', res.source === 'main');
res = R.resolveRole('agent', { ...settings, roles: { agent: { mode: 'pinned', connectionId: 'openrouter', modelId: 'anthropic/claude-sonnet-5' } } }, models, main);
ok('agente/fixo: Sonnet 5 assume mesmo com o principal capaz  →  ' + res.source, res.source === 'pinned');
res = R.resolveRole('fallback', settings, models, main);
ok('reserva: nunca é o principal  →  ' + res.name, res.source === 'auto' && res.modelId !== main.modelId);

// catálogo 2026: GLM 5.x, lotes, apelidos, variantes pequenas
const or2 = [
  { id: 'z-ai/glm-5.2', name: 'Z.AI: GLM 5.2', owner: 'z-ai', context: 1048576, promptPrice: 0.97, completionPrice: 3.04, modalities: ['text'], params: ['tools','reasoning'] },
  { id: 'z-ai/glm-5.3-flash', name: 'Z.AI: GLM 5.3 Flash', owner: 'z-ai', context: 1310720, promptPrice: 0.07, completionPrice: 0.25, modalities: ['text'], params: ['tools','reasoning'] },
  { id: 'z-ai/glm-5.3-flash:batch', name: 'Z.AI: GLM 5.3 Flash (batch)', owner: 'z-ai', context: 1048575, promptPrice: 0.15, completionPrice: 0.5, modalities: ['text'], params: ['tools'] },
  { id: '~z-ai/glm-latest', name: 'Z.AI: GLM (latest)', owner: 'z-ai', context: 1310720, promptPrice: 1.12, completionPrice: 3.52, modalities: ['text'], params: ['tools'] },
  { id: 'openai/gpt-5.4-nano', name: 'OpenAI: GPT-5.4 Nano', owner: 'openai', context: 400000, promptPrice: 0.1, completionPrice: 0.63, modalities: ['text','image'], params: ['tools','reasoning'] },
  { id: 'openai/gpt-5.6', name: 'OpenAI: GPT-5.6', owner: 'openai', context: 1100000, promptPrice: 1.25, completionPrice: 10, modalities: ['text','image'], params: ['tools','reasoning'] }
];
const fb = R.candidates('fallback', settings, { openrouter: or2 }, main, 'quality');
const ids = fb.map((c) => c.modelId);
ok('GLM 5.2 é referência em raciocínio/ferramentas (tier 3)  →  tier ' + fb.find(c=>c.modelId==='z-ai/glm-5.2')?.tier, fb.find(c=>c.modelId==='z-ai/glm-5.2')?.tier === 3);
ok('GLM 5.3 Flash é nível bom (2), não referência', fb.find(c=>c.modelId==='z-ai/glm-5.3-flash')?.tier === 2);
ok(':batch fica fora da lista', !ids.includes('z-ai/glm-5.3-flash:batch'));
ok('apelido ~latest fica fora da lista', !ids.includes('~z-ai/glm-latest'));
ok('GPT-5.4 Nano rebaixado para 2', fb.find(c=>c.modelId==='openai/gpt-5.4-nano')?.tier === 2);
ok('GPT-5.6 continua referência', fb.find(c=>c.modelId==='openai/gpt-5.6')?.tier === 3);

// recentes
const nowS = Math.floor(Date.now() / 1000);
const or3 = [
  { id: 'acme/velho-ref', name: 'Acme: Velho Ref', owner: 'a', context: 200000, promptPrice: 1, completionPrice: 3, modalities: ['text','image'], params: ['tools'], created: nowS - 400 * 86400 },
  { id: 'acme/novo-bom', name: 'Acme: Novo Bom', owner: 'a', context: 200000, promptPrice: 1, completionPrice: 3, modalities: ['text','image'], params: ['tools'], created: nowS - 5 * 86400 },
];
const rc = R.candidates('vision', settings, { openrouter: or3 }, main, 'recent');
ok('recentes: o de 5 dias vem antes do de 400 dias  →  ' + rc.map(c=>c.name).join(' > '), rc[0].name === 'Novo Bom');
ok('etiqueta de lançamento no porquê', rc[0].why.some((w) => /lançado há 5 dias/.test(w)));
const bal = R.candidates('vision', settings, { openrouter: or3 }, main, 'balanced');
ok('equilíbrio com empate de qualidade/preço: data desempata a favor do novo', bal[0].name === 'Novo Bom');
ok('PREFERENCES tem 4 opções', R.PREFERENCES.length === 4 && R.PREFERENCES[3].id === 'recent');
