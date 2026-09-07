// AI in Browser — adaptadores de provedores
// Tipos suportados:
//   openrouter → API OpenRouter (compatível com OpenAI + metadados de preço/contexto)
//   openai     → qualquer endpoint compatível com OpenAI (OpenAI, Ollama, LM Studio, Groq, DeepSeek, Mistral, xAI…)
//   anthropic  → API Messages da Anthropic

export const PROVIDER_TYPES = [
  { id: 'openai', label: 'Compatível com OpenAI (Ollama, LM Studio, Groq, DeepSeek, xAI…)' },
  { id: 'anthropic', label: 'Compatível com Anthropic (Messages API)' },
  { id: 'openrouter', label: 'OpenRouter' }
];

export const CUSTOM_PRESETS = [
  { name: 'Groq', type: 'openai', baseUrl: 'https://api.groq.com/openai/v1' },
  { name: 'DeepSeek', type: 'openai', baseUrl: 'https://api.deepseek.com/v1' },
  { name: 'xAI (Grok)', type: 'openai', baseUrl: 'https://api.x.ai/v1' },
  { name: 'Mistral', type: 'openai', baseUrl: 'https://api.mistral.ai/v1' },
  { name: 'Together', type: 'openai', baseUrl: 'https://api.together.xyz/v1' },
  { name: 'Google Gemini', type: 'openai', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai' },
  { name: 'Perplexity', type: 'openai', baseUrl: 'https://api.perplexity.ai' },
  { name: 'Jan (local)', type: 'openai', baseUrl: 'http://localhost:1337/v1' },
  { name: 'llama.cpp (local)', type: 'openai', baseUrl: 'http://localhost:8080/v1' },
  { name: 'vLLM (local)', type: 'openai', baseUrl: 'http://localhost:8000/v1' }
];

// Modelos em destaque no OpenRouter. Só aparecem se existirem na lista ao vivo.
export const FEATURED_OPENROUTER = [
  'anthropic/claude-sonnet-5',
  'anthropic/claude-opus-5',
  'anthropic/claude-fable-5.1',
  'anthropic/claude-sonnet-4.6',
  'anthropic/claude-sonnet-4.5',
  'anthropic/claude-opus-4.1',
  'anthropic/claude-sonnet-4',
  'anthropic/claude-haiku-4.5',
  'openai/gpt-5',
  'openai/gpt-5-mini',
  'openai/gpt-4.1',
  'openai/gpt-4o',
  'openai/o3',
  'openai/o4-mini',
  'google/gemini-3-pro-preview',
  'google/gemini-2.5-pro',
  'google/gemini-2.5-flash',
  'x-ai/grok-4',
  'x-ai/grok-4-fast',
  'x-ai/grok-code-fast-1',
  'deepseek/deepseek-v3.2-exp',
  'deepseek/deepseek-chat-v3.1',
  'deepseek/deepseek-r1-0528',
  'deepseek/deepseek-chat',
  'moonshotai/kimi-k2-0905',
  'moonshotai/kimi-k2',
  'z-ai/glm-4.6',
  'z-ai/glm-4.5',
  'qwen/qwen3-max',
  'qwen/qwen3-coder',
  'qwen/qwen3-235b-a22b-2507',
  'meta-llama/llama-4-maverick',
  'meta-llama/llama-3.3-70b-instruct',
  'mistralai/mistral-medium-3.1',
  'openrouter/auto'
];

const FEATURED_VENDORS = ['anthropic', 'openai', 'google', 'x-ai', 'deepseek', 'moonshotai', 'z-ai', 'qwen', 'meta-llama', 'mistralai'];

export const FALLBACK_MODELS = {
  openrouter: FEATURED_OPENROUTER.map((id) => ({ id, name: prettyName(id), owner: id.split('/')[0] })),
  openai: ['gpt-5', 'gpt-5-mini', 'gpt-4.1', 'gpt-4o', 'o3', 'o4-mini'].map((id) => ({ id, name: id, owner: 'openai' })),
  anthropic: [
    { id: 'claude-sonnet-5', name: 'Claude Sonnet 5', owner: 'anthropic' },
    { id: 'claude-opus-5', name: 'Claude Opus 5', owner: 'anthropic' },
    { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', owner: 'anthropic' },
    { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', owner: 'anthropic' },
    { id: 'claude-opus-4-1', name: 'Claude Opus 4.1', owner: 'anthropic' }
  ]
};

export function prettyName(id) {
  const base = id.includes('/') ? id.split('/').slice(1).join('/') : id;
  return base
    .replace(/[-_]/g, ' ')
    .replace(/\b(gpt|glm|llm)\b/gi, (m) => m.toUpperCase())
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function connectionBadge(conn) {
  const map = {
    openrouter: { letter: 'OR', color: '#8b5cf6' },
    openai: { letter: 'AI', color: '#10a37f' },
    anthropic: { letter: 'A', color: '#d97757' },
    ollama: { letter: 'OL', color: '#f4f4f5' },
    lmstudio: { letter: 'LM', color: '#3b82f6' }
  };
  if (map[conn.id]) return map[conn.id];
  if (conn.type === 'anthropic') return { letter: 'A', color: '#d97757' };
  const letter = (conn.name || '?').replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || '?';
  return { letter, color: '#64748b' };
}

export function vendorColor(owner) {
  const m = {
    anthropic: '#d97757',
    openai: '#10a37f',
    google: '#4285f4',
    'x-ai': '#e2e8f0',
    deepseek: '#4d6bfe',
    'meta-llama': '#0866ff',
    mistralai: '#ff7000',
    qwen: '#6f42c1',
    moonshotai: '#1e293b',
    'z-ai': '#22d3ee',
    cohere: '#39594d',
    perplexity: '#20808d',
    openrouter: '#8b5cf6',
    library: '#f4f4f5'
  };
  return m[owner] || '#64748b';
}

// ---------- utilidades HTTP ----------

function joinUrl(base, path) {
  return String(base || '').replace(/\/+$/, '') + path;
}

function isOfficialOpenAI(conn) {
  return /api\.openai\.com/i.test(conn.baseUrl || '');
}

function headersFor(conn) {
  const h = { 'Content-Type': 'application/json' };
  if (conn.type === 'anthropic') {
    if (conn.apiKey) h['x-api-key'] = conn.apiKey;
    h['anthropic-version'] = '2023-06-01';
    h['anthropic-dangerous-direct-browser-access'] = 'true';
  } else {
    if (conn.apiKey) h['Authorization'] = 'Bearer ' + conn.apiKey;
    if (conn.type === 'openrouter') {
      h['HTTP-Referer'] = 'https://github.com/ai-in-browser/extension';
      h['X-Title'] = 'AI in Browser';
    }
  }
  return h;
}

function withTimeout(ms, signal) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(new Error('timeout')), ms);
  if (signal) signal.addEventListener('abort', () => ctrl.abort(signal.reason), { once: true });
  return { signal: ctrl.signal, clear: () => clearTimeout(t) };
}

async function httpError(res, conn) {
  let msg = `HTTP ${res.status}`;
  try {
    const t = await res.text();
    try {
      const j = JSON.parse(t);
      const m = j.error?.message || j.error?.msg || j.message || j.error || j.detail;
      msg = typeof m === 'string' ? m : m ? JSON.stringify(m) : t;
    } catch {
      if (t) msg = t.slice(0, 400);
    }
  } catch {}
  const e = new Error(friendlyError(res.status, msg, conn));
  e.status = res.status;
  e.raw = msg;
  return e;
}

function friendlyError(status, msg, conn) {
  const name = conn?.name || 'o provedor';
  if (status === 403 && !conn?.apiKey) {
    return `${name} recusou a origem da extensão (HTTP 403). Recarregue a extensão em chrome://extensions e tente de novo; se persistir, defina OLLAMA_ORIGINS="chrome-extension://*" na máquina do Ollama e reinicie o serviço.`;
  }
  if (status === 401 || status === 403) return `Chave de API inválida ou sem permissão em ${name}. (${msg})`;
  if (status === 402) return `Créditos insuficientes em ${name}. Adicione saldo na sua conta. (${msg})`;
  if (status === 404) return `Modelo ou endpoint não encontrado em ${name}. (${msg})`;
  if (status === 429) return `Limite de requisições atingido em ${name}. Tente novamente em instantes. (${msg})`;
  if (status >= 500) return `${name} respondeu com erro ${status}. (${msg})`;
  return msg;
}

export function networkErrorMessage(err, conn) {
  if (err?.name === 'AbortError' || /aborted|timeout/i.test(String(err?.message))) return null;
  if (err instanceof TypeError || /Failed to fetch|NetworkError|Load failed/i.test(String(err?.message))) {
    let host = conn?.baseUrl || '';
    try {
      host = new URL(conn.baseUrl).host;
    } catch {}
    if (conn?.local) return `Não foi possível conectar em ${host}. Verifique se o ${conn.name.replace(' (local)', '')} está rodando.`;
    return `Não foi possível conectar em ${host}. Verifique sua conexão ou a URL base.`;
  }
  return err?.message || String(err);
}

// ---------- listagem de modelos ----------

function normalizeOpenRouter(m) {
  const promptPrice = parseFloat(m.pricing?.prompt ?? 'NaN') * 1e6;
  const completionPrice = parseFloat(m.pricing?.completion ?? 'NaN') * 1e6;
  const free = m.id.endsWith(':free') || (promptPrice === 0 && completionPrice === 0);
  return {
    id: m.id,
    name: m.name || prettyName(m.id),
    owner: m.id.split('/')[0],
    context: m.context_length || m.top_provider?.context_length || 0,
    promptPrice: Number.isFinite(promptPrice) ? promptPrice : null,
    completionPrice: Number.isFinite(completionPrice) ? completionPrice : null,
    free,
    modalities: m.architecture?.input_modalities || [],
    params: Array.isArray(m.supported_parameters) ? m.supported_parameters : [],
    created: m.created || 0,
    description: m.description || ''
  };
}

const OPENAI_CHAT_EXCLUDE = /(realtime|audio|transcribe|tts|whisper|embedding|moderation|image|dall-e|davinci|babbage|instruct|search|computer-use|codex-mini|sora)/i;

function normalizeOpenAI(m, conn) {
  return {
    id: m.id,
    name: prettyName(m.id),
    owner: m.owned_by || (conn.local ? 'library' : conn.id),
    context: m.context_length || m.max_context_length || 0,
    created: m.created || 0
  };
}

export async function fetchModels(conn, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? (conn.local ? 3000 : 20000);
  const { signal, clear } = withTimeout(timeoutMs, opts.signal);
  try {
    if (conn.type === 'anthropic') {
      const res = await fetch(joinUrl(conn.baseUrl, '/models?limit=1000'), { headers: headersFor(conn), signal });
      if (!res.ok) throw await httpError(res, conn);
      const j = await res.json();
      return (j.data || []).map((m) => ({
        id: m.id,
        name: m.display_name || prettyName(m.id),
        owner: 'anthropic',
        created: m.created_at ? Date.parse(m.created_at) / 1000 : 0
      }));
    }
    const res = await fetch(joinUrl(conn.baseUrl, '/models'), { headers: headersFor(conn), signal });
    if (!res.ok) throw await httpError(res, conn);
    const j = await res.json();
    const arr = Array.isArray(j.data) ? j.data : Array.isArray(j.models) ? j.models : Array.isArray(j) ? j : [];
    if (conn.type === 'openrouter') {
      return arr
        .map(normalizeOpenRouter)
        .filter((m) => !/(embedding|tts|whisper)/i.test(m.id))
        .sort((a, b) => (b.created || 0) - (a.created || 0) || a.name.localeCompare(b.name));
    }
    let list = arr.map((m) => normalizeOpenAI(typeof m === 'string' ? { id: m } : m, conn));
    if (isOfficialOpenAI(conn)) {
      list = list.filter((m) => /^(gpt-|o\d|chatgpt-)/i.test(m.id) && !OPENAI_CHAT_EXCLUDE.test(m.id));
    }
    return list.sort((a, b) => a.id.localeCompare(b.id));
  } finally {
    clear();
  }
}

export function featuredFrom(list) {
  const byId = new Map(list.map((m) => [m.id, m]));
  const out = [];
  const seen = new Set();
  const staticMatches = FEATURED_OPENROUTER.filter((id) => byId.has(id));
  const vendors = [...new Set([...staticMatches.map((id) => id.split('/')[0]), ...FEATURED_VENDORS])];
  const skip = /preview|beta|exp|mini|nano|lite|batch|-0\d|search|online|extended|thinking|latest|distill|guard|embed/i;
  for (const vendor of vendors) {
    const picks = staticMatches
      .filter((id) => id.split('/')[0] === vendor)
      .slice(0, 4)
      .map((id) => byId.get(id));
    if (picks.length < 2) {
      const newest = list
        .filter((m) => m.owner === vendor && !seen.has(m.id) && !picks.includes(m) && !m.free && !skip.test(m.id) && !m.id.startsWith('~'))
        .sort((a, b) => (b.created || 0) - (a.created || 0))
        .slice(0, 2 - picks.length);
      picks.push(...newest);
    }
    for (const m of picks) {
      if (m && !seen.has(m.id)) {
        out.push(m);
        seen.add(m.id);
      }
    }
  }
  return out;
}

// O Chrome não envia o cabeçalho Origin em GET de extensão, mas envia em POST.
// Servidores que filtram origem (Ollama) aprovam a listagem de modelos e recusam
// o chat, então a sonda repete a forma da requisição real antes de dar tudo certo.
async function originProbe(conn) {
  const { signal, clear } = withTimeout(8000);
  try {
    const res = await fetch(joinUrl(conn.baseUrl, '/chat/completions'), {
      method: 'POST',
      headers: headersFor(conn),
      body: JSON.stringify({ model: '__probe__', messages: [{ role: 'user', content: 'x' }], max_tokens: 1, stream: false }),
      signal
    });
    return res.status;
  } catch {
    return 0;
  } finally {
    clear();
  }
}

export async function testConnection(conn) {
  const result = { ok: false, count: 0, message: '' };
  try {
    if (conn.type === 'openrouter' && conn.apiKey) {
      const { signal, clear } = withTimeout(15000);
      try {
        const res = await fetch(joinUrl(conn.baseUrl, '/auth/key'), { headers: headersFor(conn), signal });
        if (!res.ok) throw await httpError(res, conn);
        const j = await res.json();
        result.key = j.data || {};
        try {
          const cres = await fetch(joinUrl(conn.baseUrl, '/credits'), { headers: headersFor(conn), signal });
          if (cres.ok) {
            const cj = await cres.json();
            if (cj.data) result.credits = { total: cj.data.total_credits, used: cj.data.total_usage };
          }
        } catch {}
      } finally {
        clear();
      }
    }
    const models = await fetchModels(conn);
    result.ok = true;
    result.count = models.length;
    result.models = models;
    result.message = `${models.length} modelo${models.length === 1 ? '' : 's'} disponíve${models.length === 1 ? 'l' : 'is'}`;
    if (conn.type !== 'anthropic' && !conn.apiKey) {
      const status = await originProbe(conn);
      if (status === 403) {
        result.ok = false;
        result.blockedOrigin = true;
        result.message = `A listagem funciona, mas o envio de mensagens é recusado (HTTP 403): o servidor não aceita a origem da extensão. Recarregue a extensão em chrome://extensions; se persistir, defina OLLAMA_ORIGINS="chrome-extension://*" na máquina do Ollama e reinicie o serviço.`;
        return result;
      }
    }
    if (result.credits && Number.isFinite(result.credits.total)) {
      const left = result.credits.total - (result.credits.used || 0);
      result.message += ` · saldo ≈ $${left.toFixed(2)}`;
    }
  } catch (e) {
    result.message = networkErrorMessage(e, conn) || 'Cancelado';
  }
  return result;
}

// ---------- SSE ----------

async function* sseEvents(body, signal) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let event = { event: '', data: [] };
  const flush = () => {
    const out = event.data.length ? { event: event.event, data: event.data.join('\n') } : null;
    event = { event: '', data: [] };
    return out;
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf('\n')) >= 0) {
        let line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (line === '') {
          const ev = flush();
          if (ev) yield ev;
          continue;
        }
        if (line.startsWith(':')) continue;
        const colon = line.indexOf(':');
        const field = colon >= 0 ? line.slice(0, colon) : line;
        let val = colon >= 0 ? line.slice(colon + 1) : '';
        if (val.startsWith(' ')) val = val.slice(1);
        if (field === 'event') event.event = val;
        else if (field === 'data') event.data.push(val);
      }
    }
    if (buffer.trim()) {
      const line = buffer.trim();
      if (line.startsWith('data:')) event.data.push(line.slice(5).trim());
    }
    const ev = flush();
    if (ev) yield ev;
  } finally {
    try {
      reader.releaseLock();
    } catch {}
  }
}

function normalizeUsage(u) {
  if (!u) return null;
  const prompt = u.prompt_tokens ?? u.input_tokens ?? 0;
  const completion = u.completion_tokens ?? u.output_tokens ?? 0;
  return {
    prompt,
    completion,
    total: u.total_tokens ?? prompt + completion,
    cost: typeof u.cost === 'number' ? u.cost : null
  };
}

// ---------- chat ----------

function coalesceForAnthropic(messages) {
  const out = [];
  const asBlocks = (c) => (typeof c === 'string' ? [{ type: 'text', text: c }] : contentToAnthropic(c, true));
  for (const m of messages) {
    if (m.role !== 'user' && m.role !== 'assistant') continue;
    const blocks = Array.isArray(asBlocks(m.content)) ? asBlocks(m.content) : [{ type: 'text', text: String(asBlocks(m.content)) }];
    if (!blocks.length) continue;
    if (m.role === 'assistant' && blocks.every((b) => b.type === 'text' && !b.text.trim())) continue;
    const last = out[out.length - 1];
    if (last && last.role === m.role) last.content.push(...blocks);
    else out.push({ role: m.role, content: blocks });
  }
  if (out.length && out[0].role !== 'user') out.unshift({ role: 'user', content: [{ type: 'text', text: '(início da conversa)' }] });
  if (out.length && out[out.length - 1].role === 'assistant') out.push({ role: 'user', content: [{ type: 'text', text: 'Continue.' }] });
  return out;
}

export async function* chatStream(conn, opts) {
  if (conn.type === 'anthropic') {
    yield* anthropicStream(conn, opts);
  } else {
    yield* openaiStream(conn, opts);
  }
}

async function* openaiStream(conn, { model, messages, system, temperature, maxTokens, signal, stream = true, effort }) {
  const body = {
    model,
    messages: [...(system ? [{ role: 'system', content: system }] : []), ...messages.map((m) => ({ role: m.role, content: contentToOpenAI(m.content, true) }))],
    stream
  };
  const official = isOfficialOpenAI(conn);
  const reasoningModel = official && /^(o\d|gpt-5)/i.test(model);
  if (temperature != null && !reasoningModel) body.temperature = temperature;
  if (maxTokens > 0) {
    if (official) body.max_completion_tokens = maxTokens;
    else body.max_tokens = maxTokens;
  }
  if (conn.type === 'openrouter') body.usage = { include: true };
  if (official && stream) body.stream_options = { include_usage: true };
  applyEffort(body, conn, model, effort);

  const res = await fetch(joinUrl(conn.baseUrl, '/chat/completions'), {
    method: 'POST',
    headers: headersFor(conn),
    body: JSON.stringify(body),
    signal
  });
  if (!res.ok) throw await httpError(res, conn);

  const ct = res.headers.get('content-type') || '';
  if (!stream || !ct.includes('text/event-stream')) {
    const j = await res.json();
    if (j.error) throw new Error(j.error.message || JSON.stringify(j.error));
    const msg = j.choices?.[0]?.message || {};
    if (msg.reasoning || msg.reasoning_content) yield { type: 'reasoning', text: msg.reasoning || msg.reasoning_content };
    if (msg.content) yield { type: 'text', text: typeof msg.content === 'string' ? msg.content : msg.content.map((p) => p.text || '').join('') };
    if (j.usage) yield { type: 'usage', usage: normalizeUsage(j.usage) };
    yield { type: 'finish', reason: j.choices?.[0]?.finish_reason || 'stop' };
    return;
  }

  for await (const ev of sseEvents(res.body, signal)) {
    if (ev.data === '[DONE]') break;
    let j;
    try {
      j = JSON.parse(ev.data);
    } catch {
      continue;
    }
    if (j.error) throw new Error(friendlyError(j.error.code, j.error.message || JSON.stringify(j.error), conn));
    const choice = j.choices?.[0];
    const delta = choice?.delta || {};
    const reasoning = delta.reasoning ?? delta.reasoning_content;
    if (reasoning) yield { type: 'reasoning', text: reasoning };
    if (delta.content) yield { type: 'text', text: delta.content };
    if (j.usage && (j.usage.total_tokens || j.usage.completion_tokens)) yield { type: 'usage', usage: normalizeUsage(j.usage) };
    if (choice?.finish_reason) yield { type: 'finish', reason: choice.finish_reason };
  }
}

async function* anthropicStream(conn, { model, messages, system, temperature, maxTokens, signal, stream = true, effort }) {
  const body = {
    model,
    max_tokens: maxTokens > 0 ? maxTokens : 8192,
    messages: coalesceForAnthropic(messages),
    stream
  };
  if (system) body.system = system;
  if (temperature != null) body.temperature = Math.min(1, Math.max(0, temperature));
  applyAnthropicEffort(body, model, effort);

  const res = await fetch(joinUrl(conn.baseUrl, '/messages'), {
    method: 'POST',
    headers: headersFor(conn),
    body: JSON.stringify(body),
    signal
  });
  if (!res.ok) throw await httpError(res, conn);

  const ct = res.headers.get('content-type') || '';
  if (!stream || !ct.includes('text/event-stream')) {
    const j = await res.json();
    for (const block of j.content || []) {
      if (block.type === 'thinking' && block.thinking) yield { type: 'reasoning', text: block.thinking };
      if (block.type === 'text' && block.text) yield { type: 'text', text: block.text };
    }
    if (j.usage) yield { type: 'usage', usage: normalizeUsage(j.usage) };
    yield { type: 'finish', reason: j.stop_reason || 'end_turn' };
    return;
  }

  let inputTokens = 0;
  for await (const ev of sseEvents(res.body, signal)) {
    let j;
    try {
      j = JSON.parse(ev.data);
    } catch {
      continue;
    }
    switch (j.type) {
      case 'error':
        throw new Error(j.error?.message || 'Erro da API Anthropic');
      case 'message_start':
        inputTokens = j.message?.usage?.input_tokens || 0;
        break;
      case 'content_block_delta':
        if (j.delta?.type === 'text_delta' && j.delta.text) yield { type: 'text', text: j.delta.text };
        else if (j.delta?.type === 'thinking_delta' && j.delta.thinking) yield { type: 'reasoning', text: j.delta.thinking };
        break;
      case 'message_delta':
        if (j.usage) {
          yield {
            type: 'usage',
            usage: normalizeUsage({ input_tokens: j.usage.input_tokens ?? inputTokens, output_tokens: j.usage.output_tokens || 0 })
          };
        }
        if (j.delta?.stop_reason) yield { type: 'finish', reason: j.delta.stop_reason };
        break;
      default:
        break;
    }
  }
}

// ---------- formatação ----------

export function formatContext(n) {
  if (!n) return '';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0) + 'M';
  if (n >= 1000) return Math.round(n / 1000) + 'k';
  return String(n);
}

export function formatPrice(perMillion) {
  if (perMillion == null) return '';
  if (perMillion === 0) return 'grátis';
  if (perMillion < 0.01) return '<$0.01';
  if (perMillion < 1) return '$' + perMillion.toFixed(2);
  return '$' + perMillion.toFixed(perMillion >= 10 ? 0 : 1);
}

export function formatTokens(n) {
  if (n == null) return '';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

// ---------- esforço de raciocínio ----------

export const EFFORTS = [
  { id: 'auto', label: 'Auto', hint: 'Padrão do modelo' },
  { id: 'low', label: 'Baixo', hint: 'Mais rápido e barato' },
  { id: 'medium', label: 'Médio', hint: 'Equilibrado' },
  { id: 'high', label: 'Alto', hint: 'Raciocínio mais profundo' }
];

function applyEffort(body, conn, model, effort) {
  if (!effort || effort === 'auto' || effort === 'none') return;
  if (conn.type === 'openrouter') body.reasoning = { effort };
  else if (isOfficialOpenAI(conn) && /^(o\d|gpt-5)/i.test(model)) body.reasoning_effort = effort;
}

function applyAnthropicEffort(body, model, effort) {
  if (!effort || effort === 'auto' || effort === 'none') return;
  if (!/claude-(3-7|sonnet-4|opus-4|haiku-4|sonnet-5|opus-5|fable)/i.test(model)) return;
  const budget = { low: 2048, medium: 8192, high: 16384 }[effort] || 8192;
  body.thinking = { type: 'enabled', budget_tokens: budget };
  delete body.temperature;
  body.max_tokens = Math.max(body.max_tokens || 0, budget + 4096);
}

// ---------- capacidades ----------

export function modelSupportsVision(conn, m) {
  const id = (m?.id || '').toLowerCase();
  if (conn.type === 'openrouter') return (m?.modalities || []).includes('image');
  if (conn.type === 'anthropic') return true;
  if (isOfficialOpenAI(conn)) return /gpt-4o|gpt-4\.1|gpt-5|^o[134]|chatgpt/.test(id);
  return /llava|vision|-vl\b|vl-|[-.]\dv\b|v-turbo|gemma3|gemma-3|minicpm-v|moondream|pixtral|bakllava|qwen2?\.?5?-?vl|qwen3-?vl|llama-?3\.2-.*vision|mistral-small-?3|granite3?\.?2?-vision|internvl|smolvlm|gpt-4|claude|gemini/.test(id);
}

export function modelLikelySupportsTools(conn, m) {
  const id = (m?.id || '').toLowerCase();
  if (conn.type === 'openrouter' || conn.type === 'anthropic' || isOfficialOpenAI(conn)) return true;
  return /llama3\.[1-3]|llama-3\.[1-3]|llama4|qwen2\.5|qwen3|qwq|mistral|mixtral|command-r|hermes|firefunction|granite|gemma3|gemma-3|phi-4|deepseek|gpt-oss|glm|devstral|magistral|nemotron|smollm2|functionary|watt|xlam/.test(id);
}

// ---------- chat com ferramentas (não-stream) ----------

function rid() {
  return 'call_' + Math.random().toString(36).slice(2, 10);
}

function parseArgs(a) {
  if (!a) return {};
  if (typeof a === 'object') return a;
  try {
    return JSON.parse(a);
  } catch {
    try {
      return JSON.parse(a.replace(/,\s*}$/, '}'));
    } catch {
      return { _raw: a };
    }
  }
}

function contentToOpenAI(content, vision) {
  if (typeof content === 'string') return content;
  const parts = [];
  for (const p of content || []) {
    if (p.type === 'text') parts.push({ type: 'text', text: p.text });
    else if (p.type === 'image' && vision) parts.push({ type: 'image_url', image_url: { url: `data:${p.mediaType || 'image/jpeg'};base64,${p.data}` } });
  }
  return parts.length === 1 && parts[0].type === 'text' ? parts[0].text : parts;
}

function contentToAnthropic(content, vision) {
  if (typeof content === 'string') return content;
  const parts = [];
  for (const p of content || []) {
    if (p.type === 'text') parts.push({ type: 'text', text: p.text });
    else if (p.type === 'image' && vision) parts.push({ type: 'image', source: { type: 'base64', media_type: p.mediaType || 'image/jpeg', data: p.data } });
  }
  return parts.length ? parts : '(vazio)';
}

function toOpenAIMessages(messages, vision) {
  const out = [];
  let i = 0;
  while (i < messages.length) {
    const m = messages[i];
    if (m.role === 'tool') {
      const imgs = [];
      while (i < messages.length && messages[i].role === 'tool') {
        const t = messages[i];
        out.push({ role: 'tool', tool_call_id: t.toolCallId, content: t.content || '' });
        for (const img of t.images || []) imgs.push({ name: t.name, img });
        i++;
      }
      if (vision && imgs.length) {
        out.push({
          role: 'user',
          content: imgs.flatMap(({ name, img }) => [
            { type: 'text', text: `[Imagem retornada pela ferramenta ${name}]` },
            { type: 'image_url', image_url: { url: `data:${img.mediaType || 'image/jpeg'};base64,${img.data}` } }
          ])
        });
      }
      continue;
    }
    if (m.role === 'assistant') {
      const msg = { role: 'assistant', content: m.content || null };
      if (m.toolCalls?.length) msg.tool_calls = m.toolCalls.map((tc) => ({ id: tc.id, type: 'function', function: { name: tc.name, arguments: JSON.stringify(tc.args || {}) } }));
      if (m.reasoningDetails) msg.reasoning_details = m.reasoningDetails;
      out.push(msg);
    } else {
      out.push({ role: m.role === 'system' ? 'system' : 'user', content: contentToOpenAI(m.content, vision) });
    }
    i++;
  }
  return out;
}

function toAnthropicMessages(messages, vision) {
  const out = [];
  for (const m of messages) {
    if (m.role === 'tool') {
      const block = {
        type: 'tool_result',
        tool_use_id: m.toolCallId,
        content: [{ type: 'text', text: m.content || '(vazio)' }, ...(vision ? (m.images || []).map((img) => ({ type: 'image', source: { type: 'base64', media_type: img.mediaType || 'image/jpeg', data: img.data } })) : [])]
      };
      const last = out[out.length - 1];
      if (last && last.role === 'user' && Array.isArray(last.content) && last.content[0]?.type === 'tool_result') last.content.push(block);
      else out.push({ role: 'user', content: [block] });
    } else if (m.role === 'assistant') {
      if (Array.isArray(m.raw) && m.raw.length) {
        out.push({ role: 'assistant', content: m.raw });
        continue;
      }
      const blocks = [];
      if (m.content && m.content.trim()) blocks.push({ type: 'text', text: m.content });
      for (const tc of m.toolCalls || []) blocks.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.args || {} });
      if (!blocks.length) blocks.push({ type: 'text', text: '(continuando)' });
      out.push({ role: 'assistant', content: blocks });
    } else {
      out.push({ role: 'user', content: contentToAnthropic(m.content, vision) });
    }
  }
  if (out.length && out[0].role !== 'user') out.unshift({ role: 'user', content: '(início)' });
  return out;
}

function classifyToolError(e) {
  const msg = String(e?.raw || e?.message || '').toLowerCase();
  if ((e?.status === 400 || e?.status === 404 || e?.status === 422) && /tool|function/.test(msg) && !/image|vision/.test(msg)) e.code = 'TOOLS_UNSUPPORTED';
  else if ((e?.status === 400 || e?.status === 422) && /image|vision|multimodal|image_url/.test(msg)) e.code = 'VISION_UNSUPPORTED';
  return e;
}

export async function chatWithTools(conn, { model, messages, system, tools, temperature, maxTokens, signal, effort, vision = true }) {
  const { toOpenAITools, toAnthropicTools } = await import('./tools.js');
  if (conn.type === 'anthropic') {
    const body = { model, max_tokens: maxTokens > 0 ? maxTokens : 8192, messages: toAnthropicMessages(messages, vision), stream: false };
    if (system) body.system = system;
    if (temperature != null) body.temperature = Math.min(1, Math.max(0, temperature));
    if (tools?.length) body.tools = toAnthropicTools(tools);
    applyAnthropicEffort(body, model, effort);
    const res = await fetch(joinUrl(conn.baseUrl, '/messages'), { method: 'POST', headers: headersFor(conn), body: JSON.stringify(body), signal });
    if (!res.ok) throw classifyToolError(await httpError(res, conn));
    const j = await res.json();
    const text = (j.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    const toolCalls = (j.content || []).filter((b) => b.type === 'tool_use').map((b) => ({ id: b.id, name: b.name, args: b.input || {} }));
    const reasoning = (j.content || []).filter((b) => b.type === 'thinking').map((b) => b.thinking).join('\n');
    return { text, toolCalls, reasoning, usage: normalizeUsage(j.usage), finish: j.stop_reason, raw: j.content };
  }

  const official = isOfficialOpenAI(conn);
  const body = { model, messages: [...(system ? [{ role: 'system', content: system }] : []), ...toOpenAIMessages(messages, vision)], stream: false };
  const reasoningModel = official && /^(o\d|gpt-5)/i.test(model);
  if (temperature != null && !reasoningModel) body.temperature = temperature;
  if (maxTokens > 0) {
    if (official) body.max_completion_tokens = maxTokens;
    else body.max_tokens = maxTokens;
  }
  if (tools?.length) {
    body.tools = toOpenAITools(tools);
    body.tool_choice = 'auto';
  }
  if (conn.type === 'openrouter') body.usage = { include: true };
  applyEffort(body, conn, model, effort);
  const res = await fetch(joinUrl(conn.baseUrl, '/chat/completions'), { method: 'POST', headers: headersFor(conn), body: JSON.stringify(body), signal });
  if (!res.ok) throw classifyToolError(await httpError(res, conn));
  const j = await res.json();
  if (j.error) throw classifyToolError(Object.assign(new Error(friendlyError(j.error.code, j.error.message || JSON.stringify(j.error), conn)), { status: j.error.code, raw: j.error.message }));
  const msg = j.choices?.[0]?.message || {};
  const text = typeof msg.content === 'string' ? msg.content : Array.isArray(msg.content) ? msg.content.map((p) => p.text || '').join('') : '';
  const toolCalls = (msg.tool_calls || []).filter((tc) => tc.function?.name).map((tc) => ({ id: tc.id || rid(), name: tc.function.name, args: parseArgs(tc.function.arguments) }));
  return { text, toolCalls, reasoning: msg.reasoning || msg.reasoning_content || '', reasoningDetails: msg.reasoning_details, usage: normalizeUsage(j.usage), finish: j.choices?.[0]?.finish_reason };
}

// ---------- datas de lançamento ----------

const DAY = 86400;

export function ageDays(created) {
  if (!created) return null;
  return Math.max(0, Math.floor((Date.now() / 1000 - created) / DAY));
}

export function isNew(created, days = 30) {
  const a = ageDays(created);
  return a != null && a <= days;
}

export function formatAge(created) {
  const a = ageDays(created);
  if (a == null) return '';
  if (a === 0) return 'hoje';
  if (a === 1) return 'ontem';
  if (a < 30) return `há ${a} dias`;
  if (a < 365) {
    const m = Math.round(a / 30);
    return `há ${m} ${m === 1 ? 'mês' : 'meses'}`;
  }
  const y = Math.floor(a / 365);
  return `há ${y} ${y === 1 ? 'ano' : 'anos'}`;
}
