import { BrowserController } from '../lib/browser.js';

// simula o mínimo de chrome.* para exercitar o guarda de bloqueio
const tab = { id: 1, url: 'https://banco.exemplo.com/conta', title: 'Banco', windowId: 1 };
globalThis.chrome = {
  tabs: { get: async () => tab, query: async () => [tab], update: async () => tab },
  scripting: { executeScript: async () => [{ result: { ok: true, url: tab.url, title: '', viewport: { w: 1, h: 1 }, scroll: { y: 0, max: 0 }, items: [], total: 0, textExcerpt: 'segredo bancário', textLength: 16 } }] },
  debugger: undefined,
  runtime: { id: 'x' }
};
const b = new BrowserController({ blockedDomains: ['banco.exemplo.com'], useDebugger: false });
b.tabId = 1; b.windowId = 1;

const casos = [
  ['getState (ler a página)', () => b.getState()],
  ['getText (ler o texto)', () => b.getText({})],
  ['getHtml (ler o HTML)', () => b.getHtml({})],
  ['click (agir)', () => b.click({ index: 0 })],
  ['typeText (digitar)', () => b.typeText({ index: 0, text: 'x' })],
  ['evaluate (rodar JS)', () => b.evaluate({ code: '1' })],
  ['navigate (ir ao site)', () => b.navigate({ url: 'https://banco.exemplo.com' })]
];
let falhas = 0;
for (const [nome, fn] of casos) {
  let bloqueou = false, vazou = '';
  try { const r = await fn(); vazou = String(r).slice(0, 40); } catch (e) { bloqueou = /Ação bloqueada/.test(e.message); if (!bloqueou) vazou = e.message.slice(0, 40); }
  if (!bloqueou) falhas++;
  console.log((bloqueou ? 'ok    ' : 'FALHA ') + nome + (bloqueou ? '' : ' → vazou: ' + vazou));
}
// site permitido continua funcionando
tab.url = 'https://exemplo.com/';
try { const r = await b.getState(); console.log((/exemplo.com/.test(r) ? 'ok    ' : 'FALHA ') + 'site permitido continua lendo normalmente'); } catch (e) { falhas++; console.log('FALHA site permitido: ' + e.message); }
console.log(falhas ? `${falhas} falha(s)` : 'lista de bloqueio cobre leitura e ação');
