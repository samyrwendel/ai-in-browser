// AI in Browser — cooperação entre modelos
//
// O modelo principal (o escolhido no chat) nem sempre tem todas as habilidades:
// um modelo local pode não ter visão, um modelo barato pode não ter tool calling,
// um modelo pequeno pode não caber a página inteira. Cada "papel" abaixo é uma
// habilidade que outro modelo pode cobrir. O usuário pode fixar um modelo por
// papel, deixar automático ou desligar. No automático a extensão ranqueia os
// candidatos entre as conexões ativas e explica a escolha.

import * as P from './providers.js';

export const ROLES = [
  {
    id: 'vision',
    label: 'Visão',
    icon: '👁️',
    needs: 'vision',
    description: 'Descreve imagens anexadas e capturas de tela do agente quando o modelo principal não enxerga.'
  },
  {
    id: 'agent',
    label: 'Navegação (agente)',
    icon: '🧭',
    needs: 'tools',
    description: 'Executa o modo Navegar. Modelos com tool calling nativo erram menos ao clicar e preencher.'
  },
  {
    id: 'reasoning',
    label: 'Raciocínio profundo',
    icon: '🧠',
    needs: 'reasoning',
    description: 'Assume a conversa quando o esforço está em Alto e o principal não é um modelo de raciocínio.'
  },
  {
    id: 'longContext',
    label: 'Documentos longos',
    icon: '📚',
    needs: 'longContext',
    description: 'Assume quando a mensagem, com página e arquivos anexados, não cabe no contexto do principal.'
  },
  {
    id: 'fast',
    label: 'Tarefas auxiliares',
    icon: '⚡',
    needs: 'cheap',
    description: 'Gera títulos de conversa e resume resultados longos. No automático usa só modelos locais ou gratuitos.'
  },
  {
    id: 'fallback',
    label: 'Reserva',
    icon: '♻️',
    needs: 'chat',
    description: 'Responde quando o principal falha por limite de uso, erro do servidor ou tempo esgotado.'
  }
];

export const DEFAULT_ROLES = Object.fromEntries(ROLES.map((r) => [r.id, { mode: 'auto', connectionId: '', modelId: '', prefer: 'balanced' }]));

export const PREFERENCES = [
  { id: 'quality', label: 'Qualidade', hint: 'o melhor modelo conhecido para a habilidade' },
  { id: 'balanced', label: 'Equilíbrio', hint: 'qualidade boa com custo baixo; locais e gratuitos na frente' },
  { id: 'price', label: 'Preço', hint: 'o mais barato que dá conta' },
  { id: 'recent', label: 'Recentes', hint: 'lançamentos mais novos primeiro, com qualidade como desempate' }
];

// Qualidade conhecida por habilidade (3 = referência, 2 = bom, 1 = funciona).
// Lista curada; modelos fora dela recebem 1 quando têm a habilidade.
const TIERS = {
  vision: [
    [/claude-(opus|sonnet)-(4|5)|claude-fable|(^|\/)gpt-5(\.\d+)?(-[a-z]+)?$|gemini-(2\.5|3)-pro|(^|\/)o3(?!-mini)|glm-(4\.[5-9]|5(\.\d+)?)v|glm-5v/i, 3],
    [/claude-haiku-4|gpt-5(\.\d+)?-(mini|nano)|gpt-4\.1(?!-nano)|gpt-4o(?!-mini)|gemini-2\.5-flash|gemini-3-flash|llama-4-maverick|qwen3-vl|qwen2\.5-vl|pixtral-large|grok-4(?!-fast)|mistral-medium-3|llava|gemma3|minicpm-v/i, 2]
  ],
  tools: [
    [/claude-(opus|sonnet)-(4|5)|claude-fable|(^|\/)gpt-5(\.\d+)?(-[a-z]+)?$|gpt-4\.1(?!-nano)|gemini-(2\.5|3)-pro|kimi-k2|qwen3-(235b|coder|max)|glm-(4\.[5-9]|5(\.\d+)?)(-turbo)?$|grok-4(?!-fast)|deepseek-(chat-)?v3/i, 3],
    [/gpt-4o|gemini-2\.5-flash|claude-haiku|llama-4|qwen3|mistral-medium|grok-4-fast|devstral|gpt-oss|llama3\.[1-3]|llama-3\.[1-3].*70b|hermes|command-r|glm-(4\.[5-9]|5(\.\d+)?)-(flash|air)/i, 2]
  ],
  reasoning: [
    [/(^|\/)o3(?!-mini)|(^|\/)gpt-5(\.\d+)?(-[a-z]+)?$|claude-opus-(4|5)|claude-sonnet-(4\.5|4\.6|5)|claude-fable|gemini-(2\.5|3)-pro|deepseek-r1(?!-distill)|grok-4(?!-fast)|qwen3-max|kimi-k2-thinking|glm-5(\.\d+)?(-turbo)?$/i, 3],
    [/o4-mini|o3-mini|gpt-5(\.\d+)?-(mini|nano)|deepseek-r1-distill|qwq|qwen3-(235b|32b)|magistral|glm-4\.[5-9]|glm-5(\.\d+)?-(flash|air)|gemini-2\.5-flash|phi-4-reasoning|gpt-oss|deepseek-r1:/i, 2]
  ]
};

export function qualityTier(roleId, cap, m) {
  const id = String(m?.id || '').toLowerCase();
  if (roleId === 'longContext') return cap.context >= 1000000 ? 3 : cap.context >= 200000 ? 2 : 1;
  if (roleId === 'fast') return cap.local ? 3 : cap.free ? 2 : cap.price != null && cap.price <= 0.2 ? 2 : 1;
  const key = roleId === 'fallback' ? null : roleId === 'agent' ? 'tools' : roleId;
  if (!key) {
    // reserva: o melhor que o modelo faz em qualquer frente
    return Math.max(qualityTier('vision', cap, m) * (cap.vision ? 1 : 0), qualityTier('agent', cap, m) * (cap.tools ? 1 : 0), qualityTier('reasoning', cap, m) * (cap.reasoning ? 1 : 0), 1);
  }
  for (const [re, tier] of TIERS[key] || []) {
    if (!re.test(id)) continue;
    // variantes pequenas (nano, mini, lite, air, flash) nunca são referência
    if (tier === 3 && /(-|:|\/)(nano|mini|lite|air|small|flash)(\b|-|:)/i.test(id)) return 2;
    return tier;
  }
  return 1;
}

// Variantes que não servem para delegar em tempo real: lotes assíncronos
// (":batch") e apelidos dinâmicos ("~provedor/modelo-latest"), que apontam
// para outro modelo do catálogo.
function isNonInteractive(m) {
  const id = String(m?.id || '');
  return /:batch$/i.test(id) || id.startsWith('~');
}

function isRouter(m) {
  return /^openrouter\//i.test(String(m?.id || ''));
}

const REASONING_RE = /(^|[/-])(r1|qwq|o[134])(\b|-)|thinking|reason|gpt-5|magistral|phi-4-reasoning|deepseek-r|glm-4\.[5-9]|kimi-k2/i;

// Habilidades de um modelo numa conexão. Usa metadados do OpenRouter quando
// existem e heurísticas por nome nos demais casos.
export function capabilities(conn, m) {
  const id = String(m?.id || '').toLowerCase();
  const params = Array.isArray(m?.params) ? m.params : [];
  const isOR = conn?.type === 'openrouter';
  const vision = P.modelSupportsVision(conn, m);
  const tools = isOR && params.length ? params.includes('tools') : P.modelLikelySupportsTools(conn, m);
  const reasoning = isOR && params.length ? params.includes('reasoning') || params.includes('include_reasoning') : REASONING_RE.test(id);
  const context = Number(m?.context) || 0;
  const local = !!conn?.local;
  const free = !!m?.free || local;
  const price = m?.promptPrice != null ? Number(m.promptPrice) : local ? 0 : null;
  return {
    vision,
    tools,
    reasoning,
    longContext: context >= 100000,
    cheap: free || (price != null && price <= 0.5),
    chat: true,
    context,
    local,
    free,
    price
  };
}

export function capabilityBadges(cap) {
  const out = [];
  if (cap.vision) out.push('visão');
  if (cap.tools) out.push('ferramentas');
  if (cap.reasoning) out.push('raciocínio');
  if (cap.context) out.push(P.formatContext(cap.context) + ' ctx');
  if (cap.local) out.push('local');
  else if (cap.free) out.push('grátis');
  return out;
}

function sameModel(a, b) {
  return !!a && !!b && a.connectionId === b.connectionId && a.modelId === b.modelId;
}

// Candidatos ranqueados para um papel. `main` é o modelo principal do chat.
// A ordem depende da preferência do papel: qualidade, equilíbrio ou preço.
export function candidates(roleId, settings, modelsByConn, main, prefer) {
  const role = ROLES.find((r) => r.id === roleId);
  if (!role) return [];
  const pref = prefer || (settings.roles || {})[roleId]?.prefer || 'balanced';
  const favorites = new Set(settings.favorites || []);
  const out = [];
  for (const conn of (settings.connections || []).filter((c) => c.enabled === true)) {
    for (const m of modelsByConn[conn.id] || []) {
      if (isRouter(m) || isNonInteractive(m)) continue; // roteadores, lotes e apelidos não servem para delegar
      const cap = capabilities(conn, m);
      if (!cap[role.needs]) continue;
      if (roleId === 'fast' && !cap.free) continue;
      const isMain = sameModel({ connectionId: conn.id, modelId: m.id }, main);
      if (roleId === 'fallback' && isMain) continue;
      const tier = qualityTier(roleId, cap, m);
      const price = cap.price;
      const outPrice = m?.completionPrice != null ? Number(m.completionPrice) : cap.local ? 0 : null;
      const costIdx = cap.free ? 0 : price == null ? 3 : Math.min(15, price + (outPrice || 0) / 4);
      let score = 0;
      const why = [];
      const created = conn.type === 'openrouter' ? Number(m?.created) || 0 : 0;
      if (pref === 'recent') {
        // dias desde o lançamento contam contra; qualidade e custo desempatam
        const age = created ? Math.max(0, (Date.now() / 1000 - created) / 86400) : 3650;
        score += 1000 - Math.min(1000, age);
        score += tier * 5;
        if (cap.local) score += 3;
        score -= Math.min(4, costIdx / 4);
      } else if (pref === 'quality') {
        score += tier * 40;
        if (cap.local) score += 8;
        if (favorites.has(conn.id + ':' + m.id)) score += 10;
        score -= costIdx;
      } else if (pref === 'price') {
        score += cap.local ? 60 : cap.free ? 50 : 0;
        score += tier * 10;
        score -= costIdx * 3;
      } else {
        // equilíbrio: qualidade pesa, mas um modelo bom e barato vence um excelente e caro
        score += tier * 15;
        if (cap.local) score += 30;
        else if (cap.free) score += 20;
        if (favorites.has(conn.id + ':' + m.id)) score += 15;
        score -= costIdx * 2.5;
      }
      if (isMain) {
        score += 5;
        why.push('é o modelo principal');
      } else if (main && conn.id === main.connectionId) {
        score += 3;
        why.push('mesmo provedor');
      }
      if (created && P.isNew(created)) why.push('lançado ' + P.formatAge(created));
      if (tier === 3) why.push('referência na habilidade');
      else if (tier === 2) why.push('boa qualidade');
      if (cap.local) why.push('local, sem custo');
      else if (cap.free) why.push('gratuito');
      if (favorites.has(conn.id + ':' + m.id)) why.push('favorito');
      if (roleId === 'agent' && cap.vision) why.push('também enxerga');
      out.push({
        connectionId: conn.id,
        connectionName: conn.name,
        modelId: m.id,
        name: (m.name || m.id).replace(/^[^:]{2,30}:\s+/, ''),
        score,
        tier,
        why,
        cap,
        price,
        outPrice,
        isMain,
        created
      });
    }
  }
  out.sort((a, b) => b.score - a.score || b.tier - a.tier || b.created - a.created || (a.price ?? 99) - (b.price ?? 99) || a.name.localeCompare(b.name));
  // rótulos de comparação
  const notMain = out.filter((c) => !c.isMain);
  const bestQ = [...notMain].sort((a, b) => b.tier - a.tier || (a.price ?? 99) - (b.price ?? 99))[0];
  const bestP = [...notMain].filter((c) => c.tier >= 2).sort((a, b) => (a.price ?? 99) - (b.price ?? 99))[0] || [...notMain].sort((a, b) => (a.price ?? 99) - (b.price ?? 99))[0];
  for (const c of out) {
    c.labels = [];
    if (c === bestQ) c.labels.push('melhor qualidade');
    if (c === bestP && c !== bestQ) c.labels.push('melhor preço');
    if (c.cap.local) c.labels.push('local');
    else if (c.cap.free) c.labels.push('grátis');
  }
  return out;
}

export function formatCandidatePrice(c) {
  if (c.cap?.local) return 'grátis · local';
  if (c.cap?.free) return 'grátis';
  if (c.price == null) return '—';
  return `${P.formatPrice(c.price)} / ${c.outPrice != null ? P.formatPrice(c.outPrice) : '?'} por 1M`;
}

// Resolve quem cobre um papel: { connectionId, modelId, source: 'pinned' | 'auto' | 'main' } ou null.
// source 'main' significa que o próprio modelo principal cobre a habilidade.
export function resolveRole(roleId, settings, modelsByConn, main) {
  const cfg = { ...DEFAULT_ROLES[roleId], ...((settings.roles || {})[roleId] || {}) };
  if (cfg.mode === 'off') return null;
  if (cfg.mode === 'pinned' && cfg.connectionId && cfg.modelId) {
    const conn = (settings.connections || []).find((c) => c.id === cfg.connectionId);
    if (conn && conn.enabled === true) {
      const m = (modelsByConn[conn.id] || []).find((x) => x.id === cfg.modelId) || { id: cfg.modelId };
      return { connectionId: cfg.connectionId, modelId: cfg.modelId, name: (m.name || m.id).replace(/^[^:]{2,30}:\s+/, ''), source: sameModel(cfg, main) ? 'main' : 'pinned', cap: capabilities(conn, m) };
    }
  }
  // Automático preenche lacunas, não troca um principal que dá conta:
  // se o modelo principal tem a habilidade, ele mesmo cobre. Quem quiser um
  // ajudante "melhor" que o principal usa o modo Fixo.
  if (roleId !== 'fallback' && main) {
    const conn = (settings.connections || []).find((c) => c.id === main.connectionId);
    const m = (modelsByConn[main.connectionId] || []).find((x) => x.id === main.modelId);
    if (conn && m && !isRouter(m)) {
      const cap = capabilities(conn, m);
      const need = ROLES.find((r) => r.id === roleId)?.needs;
      if (need && cap[need]) return { connectionId: main.connectionId, modelId: main.modelId, name: (m.name || m.id).replace(/^[^:]{2,30}:\s+/, ''), source: 'main', cap };
    }
  }
  const list = candidates(roleId, settings, modelsByConn, main);
  if (!list.length) return null;
  const top = list[0];
  return { ...top, source: roleId !== 'fallback' && sameModel(top, main) ? 'main' : 'auto' };
}

// Explicação curta do que o automático faria (para a tela de configurações).
export function explainAuto(roleId, settings, modelsByConn, main) {
  const r = resolveRole(roleId, { ...settings, roles: { ...(settings.roles || {}), [roleId]: { ...((settings.roles || {})[roleId] || {}), mode: 'auto' } } }, modelsByConn, main);
  if (!r) return { text: 'nenhum modelo ativo tem essa habilidade', ok: false };
  if (r.source === 'main') return { text: 'o modelo principal já cobre', ok: true };
  return { text: `${r.name} · ${r.connectionName || r.connectionId}${r.why?.length ? ' (' + r.why.join(', ') + ')' : ''}`, ok: true };
}

// ---------- ajudantes em tempo de execução ----------

const VISION_PROMPTS = {
  chat: (q) =>
    `Você está descrevendo imagens para um assistente de texto que não consegue vê-las. Descreva cada imagem com precisão e sem inventar: o que aparece, textos visíveis (transcreva na íntegra), números, tabelas, gráficos com seus valores, layout e cores relevantes. Não responda à pergunta do usuário; apenas descreva o que ele precisaria saber para respondê-la.${q ? `\n\nPergunta do usuário: ${q}` : ''}`,
  agent: (q) =>
    `Você está descrevendo uma captura de tela de uma página web para um agente de navegação que não consegue vê-la. Os elementos interativos estão marcados com etiquetas numéricas coloridas; esses números são os índices que o agente usa para clicar e digitar. Descreva de forma estruturada: 1) que página é e seu estado (carregada, modal aberto, erro, login); 2) regiões do layout; 3) cada elemento interativo visível com seu número, tipo, texto e estado (marcado, desabilitado, focado); 4) campos de formulário e o que já está preenchido; 5) o que parece ser o próximo passo lógico. Transcreva textos importantes. Não invente elementos que não estejam na imagem.${q ? `\n\nContexto da tarefa: ${q}` : ''}`
};

export async function describeImages(conn, modelId, images, { purpose = 'chat', question = '', signal, maxTokens = 1500 } = {}) {
  const content = [{ type: 'text', text: VISION_PROMPTS[purpose](question) }];
  for (const img of images) content.push({ type: 'image', data: img.data, mediaType: img.mediaType || 'image/jpeg' });
  const r = await P.chatWithTools(conn, {
    model: modelId,
    messages: [{ role: 'user', content }],
    tools: null,
    temperature: 0.2,
    maxTokens,
    vision: true,
    signal
  });
  return (r.text || '').trim();
}

export async function generateTitle(conn, modelId, text, { signal } = {}) {
  const r = await P.chatWithTools(conn, {
    model: modelId,
    messages: [{ role: 'user', content: `Crie um título curto (no máximo 6 palavras, sem aspas, sem ponto final, no idioma do texto) para uma conversa que começa assim:\n\n${text.slice(0, 1500)}` }],
    tools: null,
    temperature: 0.3,
    maxTokens: 24,
    vision: false,
    signal
  });
  return (r.text || '').replace(/^["'“”]+|["'“”.]+$/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
}

export function estimateTokens(messages, system = '') {
  let chars = String(system || '').length;
  for (const m of messages || []) {
    const c = m.content;
    if (typeof c === 'string') chars += c.length;
    else if (Array.isArray(c)) for (const p of c) chars += p.type === 'text' ? String(p.text || '').length : 800;
  }
  return Math.ceil(chars / 3.6);
}

export function isRetryableError(e) {
  const status = Number(e?.status) || 0;
  if (status === 429 || status === 408 || status >= 500) return true;
  if (!status && e && (e.name === 'TypeError' || /Failed to fetch|NetworkError|Load failed|timeout|Não foi possível conectar/i.test(String(e.message)))) return true;
  return false;
}
