import * as R from '../lib/roles.js';
const or = [
  { id: 'openai/gpt-5', name: 'OpenAI: GPT-5', owner: 'openai', context: 400000, promptPrice: 1.25, completionPrice: 10, modalities: ['text','image'], params: ['tools','reasoning'] },
  { id: 'meta-llama/llama-4-maverick', name: 'Meta: Llama 4 Maverick', owner: 'meta-llama', context: 1048576, promptPrice: 0.2, completionPrice: 0.7, modalities: ['text','image'], params: ['tools'] }
];
const base = { connections: [{ id: 'openrouter', type: 'openrouter', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', apiKey: 'k', enabled: true }], favorites: [] };
const main = { connectionId: 'x', modelId: 'y' };
const eq = R.explainAuto('vision', { ...base, roles: { vision: { mode: 'pinned', prefer: 'balanced' } } }, { openrouter: or }, main).text;
const pr = R.explainAuto('vision', { ...base, roles: { vision: { mode: 'pinned', prefer: 'price' } } }, { openrouter: or }, main).text;
console.log((/GPT-5/.test(eq) ? 'ok    ' : 'FALHA ') + 'equilíbrio explica GPT-5  →  ' + eq);
console.log((/Maverick/.test(pr) ? 'ok    ' : 'FALHA ') + 'preço explica Maverick  →  ' + pr);
