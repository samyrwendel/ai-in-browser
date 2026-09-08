// verifica que a mensagem de erro nomeia o servidor de verdade quando a URL
// base aponta para outro provedor (MiniMax pelo endpoint da Anthropic, etc.)
import * as P from '../lib/providers.js';

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'ok    ' : 'FALHA ') + msg); if (!cond) fails++; };

const oficial = { id: 'anthropic', name: 'Anthropic', type: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', apiKey: 'k' };
const minimax = { id: 'anthropic', name: 'Anthropic', type: 'anthropic', baseUrl: 'https://api.minimax.io/anthropic/v1', apiKey: 'k' };
const orOficial = { id: 'or', name: 'OpenRouter', type: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1', apiKey: 'k' };
const local = { id: 'ollama', name: 'Ollama (local)', type: 'openai', baseUrl: 'http://localhost:11434/v1', apiKey: '' };

const msg = (status, conn) => P.errorMessageFor(status, 'insufficient balance (1008)', conn);

ok(/Créditos insuficientes em Anthropic\. /.test(msg(402, oficial)), 'host oficial: só o nome da conexão');
ok(/Créditos insuficientes em Anthropic \(api\.minimax\.io\)/.test(msg(402, minimax)), 'host de terceiro: o host aparece junto do nome');
ok(!/api\.minimax\.io/.test(msg(402, oficial)), 'host oficial não ganha sufixo à toa');
ok(/plano certo/.test(msg(402, minimax)), '402 sugere conferir se a chave é a do plano certo');
ok(/Chave de API inválida ou sem permissão em Anthropic \(api\.minimax\.io\)/.test(msg(401, minimax)), '401 também nomeia o host real');
ok(/Limite de requisições atingido em Anthropic \(api\.minimax\.io\)/.test(msg(429, minimax)), '429 também nomeia o host real');
ok(!/\(/.test(msg(402, orOficial).split('.')[0]), 'openrouter oficial não ganha sufixo');
ok(/api\.anthropic\.com/.test(msg(402, { ...minimax, baseUrl: 'https://api.anthropic.com/v1' })) === false, 'subdomínio oficial continua sem sufixo');
ok(/Ollama \(local\) \(localhost:11434\)/.test(msg(500, local)), 'conexão openai genérica sempre mostra o host');
ok(/^Modelo ou endpoint não encontrado/.test(msg(404, minimax)), '404 mantém o texto próprio');

console.log(fails ? `\n${fails} falha(s)` : '\ntudo certo');
process.exit(fails ? 1 : 0);
