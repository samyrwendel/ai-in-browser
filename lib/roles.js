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

export const DEFAULT_ROLES = Object.fromEntries(ROLES.map((r) => [r.id, { mode: 'auto', connectionId: '', modelId: '' }]));

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
export function candidates(roleId, settings, modelsByConn, main) {
  const role = ROLES.find((r) => r.id === roleId);
  if (!role) return [];
  const favorites = new Set(settings.favorites || []);
  const out = [];
  for (const conn of (settings.connections || []).filter((c) => c.enabled === true)) {
    for (const m of modelsByConn[conn.id] || []) {
      const cap = capabilities(conn, m);
      if (!cap[role.needs]) continue;
      if (roleId === 'fast' && !cap.free) continue;
      const isMain = sameModel({ connectionId: conn.id, modelId: m.id }, main);
      if (roleId === 'fallback' && isMain) continue;
      let score = 0;
      const why = [];
      if (isMain) {
        score += 60;
        why.push('é o modelo principal');
      } else if (main && conn.id === main.connectionId) {
        score += 10;
        why.push('mesmo provedor');
      }
      if (cap.local) {
        score += 30;
        why.push('local');
      } else if (cap.free) {
        score += 20;
        why.push('gratuito');
      }
      if (favorites.has(conn.id + ':' + m.id)) {
        score += 25;
        why.push('favorito');
      }
      if (P.FEATURED_OPENROUTER.includes(m.id)) {
        score += 15;
        why.push('destaque');
      }
      if (roleId === 'agent' && cap.vision) {
        score += 8;
        why.push('também tem visão');
      }
      if (roleId === 'longContext') score += Math.min(20, Math.round(cap.context / 100000));
      if (roleId === 'vision' && cap.reasoning) score -= 5; // raciocínio é lento demais só para descrever
      if (cap.price != null && !cap.free) score -= Math.min(15, cap.price);
      out.push({ connectionId: conn.id, connectionName: conn.name, modelId: m.id, name: (m.name || m.id).replace(/^[^:]{2,30}:\s+/, ''), score, why, cap });
    }
  }
  return out.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
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
  const list = candidates(roleId, settings, modelsByConn, main);
  if (!list.length) return null;
  const top = list[0];
  return { ...top, source: roleId !== 'fallback' && sameModel(top, main) ? 'main' : 'auto' };
}

// Explicação curta do que o automático faria (para a tela de configurações).
export function explainAuto(roleId, settings, modelsByConn, main) {
  const r = resolveRole(roleId, { ...settings, roles: { ...(settings.roles || {}), [roleId]: { mode: 'auto' } } }, modelsByConn, main);
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
