// verifica o módulo de busca: configuração, normalização, formatação,
// extração de texto de HTML e os adaptadores contra um servidor de mentira
import * as S from '../lib/search.js';
import http from 'node:http';

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'ok    ' : 'FALHA ') + msg); if (!cond) fails++; };
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg}${JSON.stringify(a) === JSON.stringify(b) ? '' : `  (${JSON.stringify(a)} != ${JSON.stringify(b)})`}`);

// ---------- configuração ----------
ok(!S.isConfigured({ provider: 'none' }), 'provedor "none" não conta como configurado');
ok(!S.isConfigured({ provider: 'searxng', baseUrl: '' }), 'searxng sem endereço não está configurado');
ok(S.isConfigured({ provider: 'searxng', baseUrl: 'http://localhost:8080' }), 'searxng com endereço está configurado');
ok(!S.isConfigured({ provider: 'exa', apiKey: '' }), 'exa sem chave não está configurado');
ok(S.isConfigured({ provider: 'exa', apiKey: 'k' }), 'exa com chave está configurado');
eq(S.missingFields({ provider: 'openrouter' }), ['connection'], 'openrouter sem conexão aponta o que falta');
ok(S.providerInfo('inexistente').id === 'none', 'provedor desconhecido cai em "none"');

// ---------- normalização ----------
const bruto = [
  { title: 'A', url: 'https://a.com/x', snippet: '  muito   espaço  ' },
  { title: 'dup', url: 'https://a.com/x', snippet: 'repetida' },
  { title: 'sem url', url: 'javascript:alert(1)', snippet: 'perigosa' },
  { title: 'ftp', url: 'ftp://a.com/y', snippet: '' },
  { title: 'B', url: 'https://b.com', snippet: 'ok' }
];
const norm = S.normalizeResults(bruto);
eq(norm.length, 2, 'normalização remove duplicata, javascript: e ftp:');
eq(norm[0].snippet, 'muito espaço', 'espaços em excesso são colapsados');
eq(S.normalizeResults(bruto, 1).length, 1, 'o limite de resultados é respeitado');
ok(S.normalizeResults([{ url: 'https://c.com' }])[0].title === 'https://c.com/', 'sem título, usa o endereço');

// ---------- formatação ----------
const txt = S.formatResults('gatos', norm, 'SearXNG');
ok(txt.includes('1. A') && txt.includes('2. B'), 'resultados saem numerados');
ok(txt.includes('https://a.com/x'), 'o endereço aparece no texto');
ok(S.formatResults('nada', [], 'X').includes('Nenhum resultado'), 'lista vazia tem mensagem própria');

// ---------- HTML para texto ----------
const html = `<!doctype html><html><head><title>  Um  título </title>
<style>body{color:red}</style><script>var x = "<p>não sou texto</p>";</script></head>
<body><h1>Cabe&ccedil;alho</h1><p>Primeiro&nbsp;par&aacute;grafo.</p>
<ul><li>um</li><li>dois</li></ul><noscript>oculto</noscript>
<p>Fim &amp; ponto &#65;.</p></body></html>`;
const t = S.htmlToText(html);
eq(S.htmlTitle(html), 'Um título', 'título é extraído e normalizado');
ok(!/color:red/.test(t), 'o conteúdo de <style> é descartado');
ok(!/não sou texto/.test(t), 'o conteúdo de <script> é descartado');
ok(!/oculto/.test(t), 'o conteúdo de <noscript> é descartado');
ok(/Cabeçalho/.test(t), 'entidade nomeada é decodificada');
ok(S.decodeEntities('&Aacute;&eacute;&ntilde;&uuml;&ccedil;&atilde;') === 'Áéñüçã', 'acentos do Latin-1 saem por regra, sem tabela gigante');
ok(/Primeiro parágrafo\./.test(t), '&nbsp; vira espaço comum');
ok(/Fim & ponto A\./.test(t), 'entidades &amp; e numérica são decodificadas');
ok(/- um/.test(t) && /- dois/.test(t), 'itens de lista viram marcadores');
ok(!/\n{3,}/.test(t), 'não sobram linhas em branco em sequência');
eq(S.decodeEntities('&naoexiste; &amp;'), '&naoexiste; &', 'entidade desconhecida é preservada');

// ---------- adaptadores contra um servidor de mentira ----------
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const corpo = [];
  req.on('data', (c) => corpo.push(c));
  req.on('end', () => {
    const body = corpo.length ? JSON.parse(Buffer.concat(corpo).toString()) : null;
    const json = (o) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (u.pathname === '/search' && u.searchParams.get('format') === 'json') {
      return json({ results: [{ title: 'sx', url: 'https://sx.test/1', content: 'trecho', publishedDate: '2026-01-02T00:00:00Z' }] });
    }
    if (u.pathname === '/anubis/search') {
      res.writeHead(200, { 'content-type': 'text/html' });
      return res.end('<html><head><title>Making sure you\'re not a bot!</title></head><body></body></html>');
    }
    if (u.pathname === '/exa') return json({ results: [{ title: 'ex', url: 'https://ex.test/1', highlights: ['h1', 'h2'], publishedDate: '2026-02-03' }] });
    if (u.pathname === '/tavily') return json({ results: [{ title: 'tv', url: 'https://tv.test/1', content: 'c' }] });
    if (u.pathname === '/or') {
      return json({ choices: [{ message: { content: 'ignorado', annotations: [
        { type: 'url_citation', url_citation: { url: 'https://or.test/1', title: 'or', content: 'trecho or' } },
        { type: 'outra', foo: 1 }
      ] } }] });
    }
    if (u.pathname === '/pagina') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end('<html><head><title>Página</title></head><body><p>Um texto qualquer aqui.</p></body></html>');
    }
    if (u.pathname === '/imagem') { res.writeHead(200, { 'content-type': 'image/png' }); return res.end('x'); }
    if (u.pathname === '/erro') { res.writeHead(500); return res.end('falhou'); }
    res.writeHead(404); res.end('nao');
  });
});

await new Promise((r) => server.listen(0, '127.0.0.1', r));
const porta = server.address().port;
const url = (p) => `http://127.0.0.1:${porta}${p}`;

const sx = await S.search({ provider: 'searxng', baseUrl: url('') }, 'gatos', { maxResults: 5 });
eq(sx.results[0].url, 'https://sx.test/1', 'searxng: resultado normalizado');
eq(sx.results[0].published, '2026-01-02', 'searxng: data cortada em AAAA-MM-DD');

let erro = '';
try { await S.search({ provider: 'searxng', baseUrl: url('/anubis') }, 'x', {}); } catch (e) { erro = String(e.message); }
ok(/não é JSON/.test(erro), 'resposta HTML vira erro claro em vez de quebrar');

try { erro = ''; await S.search({ provider: 'exa', apiKey: '' }, 'x', {}); } catch (e) { erro = String(e.message); }
ok(/falta apiKey/.test(erro), 'chave ausente é dita antes de qualquer requisição');

try { erro = ''; await S.search({ provider: 'none' }, 'x', {}); } catch (e) { erro = String(e.message); }
ok(/Nenhum provedor/.test(erro), 'provedor desligado explica o que fazer');

try { erro = ''; await S.search({ provider: 'openrouter', connectionId: 'c' }, 'x', {}); } catch (e) { erro = String(e.message); }
ok(/conexão não encontrada/.test(erro), 'openrouter sem a conexão resolvida avisa');

// ---------- fetchUrl ----------
const pag = await S.fetchUrl(url('/pagina'));
eq(pag.title, 'Página', 'fetch_url extrai o título');
ok(/Um texto qualquer aqui\./.test(pag.text), 'fetch_url extrai o texto');
ok(!pag.truncated, 'texto curto não é marcado como cortado');
const curto = await S.fetchUrl(url('/pagina'), { maxChars: 500 });
ok(curto.text.length <= 500, 'o limite mínimo de caracteres é aplicado');

try { erro = ''; await S.fetchUrl(url('/imagem')); } catch (e) { erro = String(e.message); }
ok(/não textual/.test(erro), 'conteúdo binário é recusado com explicação');
try { erro = ''; await S.fetchUrl(url('/erro')); } catch (e) { erro = String(e.message); }
ok(/HTTP 500/.test(erro), 'erro do servidor é reportado');
try { erro = ''; await S.fetchUrl('javascript:alert(1)'); } catch (e) { erro = String(e.message); }
ok(/inválido/.test(erro), 'esquema perigoso é recusado');
try { erro = ''; await S.fetchUrl('ftp://x.com'); } catch (e) { erro = String(e.message); }
ok(/inválido/.test(erro), 'ftp é recusado');

server.close();
console.log(fails ? `\n${fails} falha(s)` : '\ntudo certo');
process.exit(fails ? 1 : 0);
