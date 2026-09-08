// AI in Browser — busca na web e leitura de páginas sem abrir aba
//
// O modo Navegar consegue pesquisar abrindo o Google numa aba e lendo o DOM,
// mas isso custa dezenas de milhares de tokens e mexe nas abas do usuário.
// Aqui a consulta sai por HTTP e volta como uma lista curta de título, endereço
// e trecho. Quatro provedores, todos com formato verificado na documentação:
//
//   searxng     instância própria do usuário, sem chave e sem terceiros
//   openrouter  plugin "web" da conexão que o usuário já tem (Exa por baixo)
//   exa         api.exa.ai, plano gratuito generoso
//   tavily      api.tavily.com
//
// Instâncias públicas do SearXNG não servem: respondem 429 ou ficam atrás de
// muro anti-bot. Só a própria instância funciona.

export const SEARCH_PROVIDERS = [
  {
    id: 'none',
    label: 'Desligada',
    hint: 'O agente pesquisa abrindo uma aba, como antes.',
    needs: []
  },
  {
    id: 'searxng',
    label: 'SearXNG (sua instância)',
    hint: 'Sem chave e sem terceiros. Na sua instância, ligue o formato JSON em settings.yml (search.formats: html, json) e desligue o limiter (server.limiter: false). Instâncias públicas não funcionam: respondem 429 ou caem em muro anti-bot.',
    needs: ['baseUrl'],
    placeholder: 'http://localhost:8080'
  },
  {
    id: 'openrouter',
    label: 'OpenRouter (plugin web)',
    hint: 'Usa a conexão do OpenRouter que você já tem. Cobrado por busca, além dos tokens do modelo.',
    needs: ['connection']
  },
  {
    id: 'exa',
    label: 'Exa',
    hint: 'Plano gratuito generoso. Chave em exa.ai.',
    needs: ['apiKey']
  },
  {
    id: 'tavily',
    label: 'Tavily',
    hint: 'Plano gratuito menor. Chave em tavily.com.',
    needs: ['apiKey']
  }
];

export const DEFAULT_SEARCH = {
  provider: 'none',
  baseUrl: '',
  apiKey: '',
  connectionId: '',
  maxResults: 5,
  fetchUrl: true
};

export function providerInfo(id) {
  return SEARCH_PROVIDERS.find((p) => p.id === id) || SEARCH_PROVIDERS[0];
}

// O que ainda falta configurar para o provedor escolhido funcionar.
export function missingFields(cfg) {
  const c = { ...DEFAULT_SEARCH, ...(cfg || {}) };
  const info = providerInfo(c.provider);
  const falta = [];
  for (const need of info.needs) {
    if (need === 'baseUrl' && !String(c.baseUrl || '').trim()) falta.push('baseUrl');
    if (need === 'apiKey' && !String(c.apiKey || '').trim()) falta.push('apiKey');
    if (need === 'connection' && !String(c.connectionId || '').trim()) falta.push('connection');
  }
  return falta;
}

export function isConfigured(cfg) {
  const c = { ...DEFAULT_SEARCH, ...(cfg || {}) };
  return c.provider !== 'none' && missingFields(c).length === 0;
}

// ---------- normalização ----------

function limpaTexto(s, max = 400) {
  const t = String(s || '')
    .replace(/\s+/g, ' ')
    .trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t;
}

function urlValida(u) {
  try {
    const x = new URL(String(u));
    return /^https?:$/.test(x.protocol) ? x.href : null;
  } catch {
    return null;
  }
}

export function normalizeResults(list, max) {
  const out = [];
  const vistos = new Set();
  for (const r of Array.isArray(list) ? list : []) {
    const url = urlValida(r?.url);
    if (!url || vistos.has(url)) continue;
    vistos.add(url);
    out.push({
      title: limpaTexto(r.title || url, 160) || url,
      url,
      snippet: limpaTexto(r.snippet || '', 400),
      published: r.published ? String(r.published).slice(0, 10) : ''
    });
    if (max && out.length >= max) break;
  }
  return out;
}

// Texto entregue ao modelo. Compacto de propósito: a vantagem sobre abrir o
// Google numa aba é justamente não gastar milhares de tokens.
export function formatResults(query, results, providerLabel) {
  if (!results.length) return `Nenhum resultado para "${query}".`;
  const linhas = results.map((r, i) => {
    const data = r.published ? ` (${r.published})` : '';
    const trecho = r.snippet ? `\n   ${r.snippet}` : '';
    return `${i + 1}. ${r.title}${data}\n   ${r.url}${trecho}`;
  });
  return `Resultados para "${query}" (via ${providerLabel}):\n\n${linhas.join('\n\n')}\n\nEsses trechos são resumos. Para ler uma página inteira use fetch_url com o endereço.`;
}

// ---------- adaptadores ----------

async function comoJson(res, provedor) {
  if (!res.ok) {
    let detalhe = '';
    try {
      detalhe = (await res.text()).slice(0, 200);
    } catch {}
    throw new Error(`${provedor}: HTTP ${res.status}${detalhe ? ' — ' + detalhe.replace(/\s+/g, ' ').trim() : ''}`);
  }
  const tipo = res.headers.get('content-type') || '';
  const corpo = await res.text();
  if (!/json/i.test(tipo)) {
    const dica = /making sure you|challenge|captcha/i.test(corpo)
      ? ' A instância respondeu com um desafio anti-bot; instâncias públicas do SearXNG não servem como API.'
      : ' O servidor respondeu HTML em vez de JSON; confira se o formato json está ligado.';
    throw new Error(`${provedor}: resposta não é JSON.${dica}`);
  }
  try {
    return JSON.parse(corpo);
  } catch {
    throw new Error(`${provedor}: JSON inválido na resposta.`);
  }
}

async function buscaSearxng(cfg, query, { maxResults, signal }) {
  const base = String(cfg.baseUrl || '').replace(/\/+$/, '');
  const u = new URL(base + '/search');
  u.searchParams.set('q', query);
  u.searchParams.set('format', 'json');
  const res = await fetch(u.href, { method: 'GET', signal });
  const j = await comoJson(res, 'SearXNG');
  return normalizeResults(
    (j.results || []).map((r) => ({ title: r.title, url: r.url, snippet: r.content, published: r.publishedDate })),
    maxResults
  );
}

async function buscaExa(cfg, query, { maxResults, signal }) {
  const res = await fetch('https://api.exa.ai/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': cfg.apiKey },
    body: JSON.stringify({
      query,
      numResults: maxResults,
      type: 'auto',
      contents: { text: { maxCharacters: 500 } }
    }),
    signal
  });
  const j = await comoJson(res, 'Exa');
  return normalizeResults(
    (j.results || []).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: (Array.isArray(r.highlights) && r.highlights.join(' ')) || r.text,
      published: r.publishedDate
    })),
    maxResults
  );
}

async function buscaTavily(cfg, query, { maxResults, signal }) {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.apiKey },
    body: JSON.stringify({ query, max_results: maxResults, search_depth: 'basic' }),
    signal
  });
  const j = await comoJson(res, 'Tavily');
  return normalizeResults(
    (j.results || []).map((r) => ({ title: r.title, url: r.url, snippet: r.content })),
    maxResults
  );
}

// O OpenRouter não expõe busca sozinha: o plugin "web" anexa resultados a uma
// conversa e devolve as fontes em message.annotations. Pedimos ao modelo mais
// barato possível e lemos só as anotações; o texto gerado é descartado.
async function buscaOpenRouter(cfg, query, { maxResults, signal, conn }) {
  if (!conn) throw new Error('OpenRouter: conexão não encontrada. Escolha-a em Configurações → Busca.');
  const base = String(conn.baseUrl || 'https://openrouter.ai/api/v1').replace(/\/+$/, '');
  const headers = { 'Content-Type': 'application/json', 'HTTP-Referer': 'https://github.com/ai-in-browser/extension', 'X-Title': 'AI in Browser' };
  if (conn.apiKey) headers.Authorization = 'Bearer ' + conn.apiKey;
  const res = await fetch(base + '/chat/completions', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: cfg.model || 'openai/gpt-oss-120b',
      messages: [{ role: 'user', content: query }],
      max_tokens: 32,
      plugins: [{ id: 'web', engine: 'exa', max_results: maxResults }]
    }),
    signal
  });
  const j = await comoJson(res, 'OpenRouter');
  const anota = j.choices?.[0]?.message?.annotations || [];
  const brutos = anota
    .filter((a) => a?.type === 'url_citation' && a.url_citation)
    .map((a) => ({ title: a.url_citation.title, url: a.url_citation.url, snippet: a.url_citation.content }));
  return normalizeResults(brutos, maxResults);
}

const ADAPTADORES = { searxng: buscaSearxng, openrouter: buscaOpenRouter, exa: buscaExa, tavily: buscaTavily };

export async function search(cfg, query, opts = {}) {
  const c = { ...DEFAULT_SEARCH, ...(cfg || {}) };
  const q = String(query || '').trim();
  if (!q) throw new Error('Busca sem termo.');
  if (c.provider === 'none') throw new Error('Nenhum provedor de busca configurado (Configurações → Busca).');
  const falta = missingFields(c);
  if (falta.length) throw new Error(`Provedor de busca incompleto: falta ${falta.join(', ')} (Configurações → Busca).`);
  const fn = ADAPTADORES[c.provider];
  if (!fn) throw new Error(`Provedor de busca desconhecido: ${c.provider}`);
  const max = Math.min(Math.max(Number(opts.maxResults || c.maxResults) || 5, 1), 15);
  const results = await fn(c, q, { maxResults: max, signal: opts.signal, conn: opts.conn });
  return { query: q, results, provider: c.provider, label: providerInfo(c.provider).label };
}

// ---------- leitura de uma URL sem abrir aba ----------

const ENTIDADES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0',
  aelig: 'æ', AElig: 'Æ', oslash: 'ø', Oslash: 'Ø', szlig: 'ß',
  eth: 'ð', ETH: 'Ð', thorn: 'þ', THORN: 'Þ', ccedil: 'ç', Ccedil: 'Ç',
  ndash: '–', mdash: '—', hellip: '…', laquo: '«', raquo: '»',
  ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', middot: '·',
  deg: '°', euro: '€', pound: '£', copy: '©', reg: '®', trade: '™'
};

// Em vez de uma tabela gigante, as entidades acentuadas do Latin-1 seguem um
// padrão: letra + sufixo do acento. Montamos a letra com o diacrítico
// combinante e normalizamos, o que cobre todo o conjunto com sete regras.
const DIACRITICOS = {
  acute: '\u0301', grave: '\u0300', circ: '\u0302',
  tilde: '\u0303', uml: '\u0308', cedil: '\u0327', ring: '\u030a'
};

export function decodeEntities(s) {
  return String(s || '').replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => {
    if (ENTIDADES[e] !== undefined) return ENTIDADES[e];
    const baixo = e.toLowerCase();
    if (ENTIDADES[baixo] !== undefined && baixo !== e.toLowerCase()) return ENTIDADES[baixo];
    if (baixo[0] === '#') {
      const n = baixo[1] === 'x' ? parseInt(baixo.slice(2), 16) : parseInt(baixo.slice(1), 10);
      if (Number.isFinite(n) && n > 0 && n < 0x110000) {
        try {
          return String.fromCodePoint(n);
        } catch {
          return m;
        }
      }
      return m;
    }
    const casa = /^([a-zA-Z])(acute|grave|circ|tilde|uml|cedil|ring)$/.exec(e);
    if (casa) return (casa[1] + DIACRITICOS[casa[2]]).normalize('NFC');
    if (ENTIDADES[baixo] !== undefined) return ENTIDADES[baixo];
    return m;
  });
}

// Extrator sem dependência de DOM: roda igual no painel, no service worker e
// nos testes em Node.
export function htmlToText(html) {
  let s = String(html || '');
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/<(script|style|noscript|template|svg|iframe|canvas)\b[\s\S]*?<\/\1\s*>/gi, ' ');
  s = s.replace(/<\/(p|div|section|article|li|tr|h[1-6]|blockquote|pre)\s*>/gi, '\n');
  s = s.replace(/<(br|hr)\s*\/?>/gi, '\n');
  s = s.replace(/<li\b[^>]*>/gi, '\n- ');
  s = s.replace(/<[^>]+>/g, ' ');
  s = decodeEntities(s);
  s = s.replace(/[ \t ]+/g, ' ');
  s = s.replace(/ *\n */g, '\n');
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

export function htmlTitle(html) {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(String(html || ''));
  return m ? decodeEntities(m[1]).replace(/\s+/g, ' ').trim() : '';
}

// credentials: 'omit' de propósito. Página que exige sessão é trabalho do modo
// Navegar, que roda na aba real do usuário; aqui não puxamos conteúdo logado
// sem que ele veja.
export async function fetchUrl(url, opts = {}) {
  const alvo = urlValida(url);
  if (!alvo) throw new Error('Endereço inválido: use http:// ou https://');
  const max = Math.min(Math.max(Number(opts.maxChars) || 8000, 500), 40000);
  const res = await fetch(alvo, { method: 'GET', credentials: 'omit', redirect: 'follow', signal: opts.signal });
  if (!res.ok) throw new Error(`HTTP ${res.status} ao ler ${alvo}`);
  const tipo = (res.headers.get('content-type') || '').toLowerCase();
  if (/^image\/|^audio\/|^video\/|application\/pdf|application\/octet-stream|application\/zip/.test(tipo)) {
    throw new Error(`Conteúdo não textual (${tipo.split(';')[0]}). Abra numa aba se precisar dele.`);
  }
  const corpo = await res.text();
  const ehHtml = /html|xml/.test(tipo) || /^\s*<(!doctype|html)/i.test(corpo);
  const texto = ehHtml ? htmlToText(corpo) : corpo.trim();
  const titulo = ehHtml ? htmlTitle(corpo) : '';
  const cortado = texto.length > max;
  return {
    url: res.url || alvo,
    title: titulo,
    text: cortado ? texto.slice(0, max) : texto,
    truncated: cortado,
    total: texto.length
  };
}

export function formatFetch(r) {
  const cab = [r.title ? `Título: ${r.title}` : '', `Endereço: ${r.url}`].filter(Boolean).join('\n');
  const aviso = r.truncated ? `\n\n[Cortado em ${r.text.length} de ${r.total} caracteres. Use max_chars ou offset para o resto.]` : '';
  return `${cab}\n\n${r.text}${aviso}`;
}
