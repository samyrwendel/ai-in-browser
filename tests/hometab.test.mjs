// verifica a âncora da aba de origem no prompt do agente
import { buildSystemPrompt } from '../lib/agent.js';

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'ok    ' : 'FALHA ') + msg); if (!cond) fails++; };

const home = { id: 7, title: 'httpbin', url: 'https://httpbin.org/forms/post' };
const other = { id: 9, title: 'g1', url: 'https://g1.globo.com/' };
const P = (tabInfo, homeTab) => buildSystemPrompt({ maxSteps: 25, jsonMode: false, tools: [], userSystem: '', tabInfo, homeTab, vision: true });

const away = P(other, home);
ok(away.includes('switch_tab with tab_id 7'), 'fora da origem: manda voltar por switch_tab com o id certo');
ok(away.includes('You are NOT on it right now'), 'fora da origem: avisa que não está na aba de origem');
ok(/Never return by navigating to its URL/.test(away), 'fora da origem: proíbe voltar navegando pela URL');
ok(away.includes('Current working tab: [9]'), 'fora da origem: mostra o id da aba atual');

const at = P(home, home);
ok(at.includes('The task started on this tab [7]'), 'na origem: reconhece que já está na aba de origem');
ok(!at.includes('You are NOT on it'), 'na origem: não emite o aviso de estar fora');

const none = P(other, null);
ok(!none.includes('The task started on'), 'sem aba de origem: nenhuma âncora é escrita');

ok(P(null, home).includes('switch_tab with tab_id 7'), 'sem aba atual: a âncora ainda aparece');

ok(/navigate and navigate_history replace the page/.test(away), 'guarda do formulário continua no prompt');
ok(/NEVER answer from memory anything that changes over time/.test(away), 'regra anti-invenção continua no prompt');

// a orientação de busca só aparece quando a ferramenta existe
const { toolsFor } = await import('../lib/tools.js');
const comBusca = buildSystemPrompt({ maxSteps: 25, jsonMode: false, tools: toolsFor({ webSearch: true }), userSystem: '', tabInfo: other, homeTab: home, vision: true });
const semBusca = buildSystemPrompt({ maxSteps: 25, jsonMode: false, tools: toolsFor({ webSearch: false }), userSystem: '', tabInfo: other, homeTab: home, vision: true });
const semNada = buildSystemPrompt({ maxSteps: 25, jsonMode: false, tools: toolsFor({ webSearch: false, fetchUrl: false }), userSystem: '', tabInfo: other, homeTab: home, vision: true });
ok(/call web_search FIRST/.test(comBusca), 'com busca: manda usar web_search antes de abrir aba');
ok(/call fetch_url instead of opening it/.test(comBusca), 'com busca: manda ler por fetch_url em vez de abrir aba');
ok(!/no web search tool/.test(comBusca), 'com busca: não diz que falta busca');
ok(!/call web_search FIRST/.test(semBusca), 'sem busca: não cita uma ferramenta inexistente');
ok(/read any page whose address you already know with fetch_url/.test(semBusca), 'só com leitura: lembra que fetch_url resolve endereço conhecido');
ok(/only to DISCOVER an address you do not know/.test(semBusca), 'só com leitura: abrir buscador vira exceção, não regra');
ok(/Busca na web/.test(semBusca), 'só com leitura: manda avisar o usuário que dá para configurar busca');
ok(/You have no search or fetch tool/.test(semNada), 'sem nada: aí sim diz que precisa abrir aba');
ok(!/fetch_url/.test(semNada), 'sem nada: não cita fetch_url');
ok(toolsFor({ webSearch: true }).some((t) => t.name === 'web_search'), 'web_search entra na lista quando configurada');
ok(!toolsFor({ webSearch: false }).some((t) => t.name === 'web_search'), 'web_search fica fora quando não configurada');
ok(toolsFor({}).some((t) => t.name === 'fetch_url'), 'fetch_url vem ligada por padrão');
ok(!toolsFor({ fetchUrl: false }).some((t) => t.name === 'fetch_url'), 'fetch_url some quando desligada');

console.log(fails ? `\n${fails} falha(s)` : '\ntudo certo');
process.exit(fails ? 1 : 0);
