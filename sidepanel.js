// AI in Browser — lógica do painel de chat
import * as S from './lib/storage.js';
import { render as renderMd } from './lib/markdown.js';
import * as P from './lib/providers.js';
import { createBrowser, captureActiveTab } from './lib/browser.js';
import { AgentRunner } from './lib/agent.js';
import * as PERM from './lib/perms.js';
import * as R from './lib/roles.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const params = new URLSearchParams(location.search);
const MODE = params.get('mode') === 'tab' ? 'tab' : 'panel';
const MODEL_CACHE_TTL = 6 * 3600 * 1000;

const state = {
  settings: null,
  chats: [],
  chat: null,
  models: {},
  modelStatus: {},
  modelError: {},
  localDetected: {},
  streaming: null,
  context: null,
  pickerFilter: 'all',
  pickerSort: 'recent',
  pickerExpanded: new Set(),
  autoScroll: true,
  saveTimer: null,
  lastSettingsJson: '',
  attachments: [],
  agent: null,
  agentWaiting: false,
  openSteps: new Set(),
  rec: null
};

const els = {};

// ---------- utilidades ----------

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// base64 vai direto para um atributo src: só os caracteres do alfabeto
function b64(s) {
  return String(s ?? '').replace(/[^A-Za-z0-9+/=]/g, '');
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function conn(id) {
  return state.settings.connections.find((c) => c.id === id);
}
function currentConn() {
  return conn(state.settings.current.connectionId);
}
function isConfigured(c) {
  if (!c || c.enabled === false) return false;
  if (c.local) return !!state.localDetected[c.id];
  return !!c.apiKey || !c.builtin;
}
function visibleConnections() {
  return state.settings.connections.filter((c) => c.enabled === true);
}
function modelInfo(connId, modelId) {
  if (!modelId) return null;
  return (state.models[connId] || []).find((m) => m.id === modelId) || { id: modelId, name: P.prettyName(modelId), owner: modelId.split('/')[0] };
}
function displayName(m) {
  return (m.name || m.id).replace(/^[^:]{2,30}:\s+/, '');
}
function vendorLetter(owner, c) {
  if (c?.local) return P.connectionBadge(c).letter;
  const map = { anthropic: 'A', openai: 'AI', google: 'G', 'x-ai': 'X', deepseek: 'DS', 'meta-llama': 'M', mistralai: 'MI', qwen: 'Q', moonshotai: 'K', 'z-ai': 'Z', openrouter: 'OR', cohere: 'C', perplexity: 'P', library: 'OL' };
  if (map[owner]) return map[owner];
  return (owner || '?').replace(/[^a-z0-9]/gi, '').slice(0, 2).toUpperCase() || '?';
}
function modelBadge(c, m) {
  if (c.type === 'openrouter' && m?.owner) return { letter: vendorLetter(m.owner, c), color: P.vendorColor(m.owner) };
  return P.connectionBadge(c);
}
function relTime(ts) {
  const d = Date.now() - ts;
  if (d < 60e3) return 'agora';
  if (d < 3600e3) return Math.floor(d / 60e3) + ' min';
  if (d < 86400e3) return Math.floor(d / 3600e3) + ' h';
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}
function dayGroup(ts) {
  const now = new Date();
  const d = new Date(ts);
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (ts >= startToday) return 'Hoje';
  if (ts >= startToday - 86400e3) return 'Ontem';
  if (ts >= startToday - 7 * 86400e3) return 'Últimos 7 dias';
  if (ts >= startToday - 30 * 86400e3) return 'Últimos 30 dias';
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}
function titleFrom(text) {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > 48 ? t.slice(0, 47).trimEnd() + '…' : t;
}
function fmtDuration(ms) {
  if (!ms) return '';
  return ms < 1000 ? Math.round(ms) + 'ms' : (ms / 1000).toFixed(1).replace('.', ',') + 's';
}

let toastTimer;
function toast(msg, kind = '', ms = 2800) {
  els.toast.textContent = msg;
  els.toast.className = 'toast ' + kind;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.add('hidden'), ms);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {}
    ta.remove();
    return ok;
  }
}

function openOptions() {
  if (S.HAS_CHROME && chrome.runtime?.openOptionsPage) chrome.runtime.openOptionsPage();
  else window.open('options.html', '_blank');
}
function openInTab() {
  if (S.HAS_CHROME && chrome.tabs?.create) chrome.tabs.create({ url: chrome.runtime.getURL('sidepanel.html?mode=tab') });
  else window.open('sidepanel.html?mode=tab', '_blank');
}

// ---------- tema ----------

const mq = window.matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const s = state.settings;
  const theme = s.theme === 'system' ? (mq.matches ? 'dark' : 'light') : s.theme;
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.accent = s.accent || 'violet';
  document.documentElement.style.setProperty('--fs', (s.fontSize || 14) + 'px');
}
mq.addEventListener('change', () => state.settings && applyTheme());

// ---------- modelos ----------

async function ensureModels(connId, { force = false } = {}) {
  const c = conn(connId);
  if (!c) return [];
  if (!force && state.models[connId]?.length) return state.models[connId];
  if (!force) {
    const cache = await S.getModelCache();
    const hit = cache[connId];
    if (hit && hit.models?.length && Date.now() - hit.ts < MODEL_CACHE_TTL) {
      state.models[connId] = hit.models;
      state.modelStatus[connId] = 'ok';
      if (c.local) state.localDetected[connId] = true;
      return hit.models;
    }
  }
  if (c.local && !force && !state.localDetected[connId] && state.modelStatus[connId] === 'off') return [];
  state.modelStatus[connId] = 'loading';
  try {
    const models = await P.fetchModels(c, { timeoutMs: P.modelsTimeout(c) });
    state.models[connId] = models;
    state.modelStatus[connId] = 'ok';
    state.modelError[connId] = '';
    if (c.local) state.localDetected[connId] = models.length > 0;
    await S.setModelCache(connId, models);
    return models;
  } catch (e) {
    const localDeVerdade = c.local && P.isLoopbackUrl(c.baseUrl);
    state.modelStatus[connId] = localDeVerdade ? 'off' : 'error';
    state.modelError[connId] = P.networkErrorMessage(e, c) || 'Falha ao carregar';
    if (c.local) state.localDetected[connId] = localDeVerdade ? false : true;
    if (!c.local && P.FALLBACK_MODELS[c.type] && !state.models[connId]?.length) {
      state.models[connId] = P.FALLBACK_MODELS[c.type];
    }
    return state.models[connId] || [];
  }
}

async function detectLocal({ force = false } = {}) {
  // Sonda os locais ativos; no primeiro uso (nada ativo) ou quando forçado, sonda todos
  // e ativa os que responderem. É a "detecção automática".
  const anyEnabled = state.settings.connections.some((c) => c.enabled === true);
  const locals = state.settings.connections.filter((c) => c.local && (force || c.enabled === true || !anyEnabled));
  await Promise.all(locals.map((c) => ensureModels(c.id, { force })));
  const found = locals.filter((c) => state.localDetected[c.id]);
  let changed = false;
  for (const c of found) {
    if (c.enabled !== true) {
      c.enabled = true;
      changed = true;
    }
  }
  if (changed) await saveSettings();
  return found;
}

function defaultModelFor(connId) {
  const list = state.models[connId] || [];
  if (!list.length) return '';
  const remembered = state.settings.lastModelByConnection?.[connId];
  if (remembered && list.find((m) => m.id === remembered)) return remembered;
  const c = conn(connId);
  if (c.type === 'openrouter') {
    const feat = P.featuredFrom(list);
    return (feat[0] || list[0]).id;
  }
  if (c.type === 'anthropic') {
    const pref = list.find((m) => /sonnet/i.test(m.id)) || list[0];
    return pref.id;
  }
  if (/api\.openai\.com/.test(c.baseUrl)) {
    const pref = list.find((m) => /^gpt-5$/.test(m.id)) || list.find((m) => /^gpt-4\.1$/.test(m.id)) || list.find((m) => /^gpt-4o$/.test(m.id)) || list[0];
    return pref.id;
  }
  return list[0].id;
}

async function bootstrapModels() {
  let cur = currentConn();
  if (!isConfigured(cur)) {
    const alt = state.settings.connections.find((c) => isConfigured(c));
    if (alt) {
      state.settings.current = { connectionId: alt.id, modelId: state.settings.lastModelByConnection?.[alt.id] || '' };
      cur = alt;
    }
  }
  updateHeader();
  if (!cur || !isConfigured(cur)) return; // nada configurado: a tela inicial cuida disso
  const list = await ensureModels(cur.id);
  const mid = state.settings.current.modelId;
  if (!mid || (list.length && !list.find((m) => m.id === mid) && cur.type !== 'openrouter' && !cur.local)) {
    state.settings.current.modelId = defaultModelFor(cur.id);
  } else if (!mid && list.length) {
    state.settings.current.modelId = defaultModelFor(cur.id);
  }
  if (!state.settings.current.modelId && list.length) state.settings.current.modelId = defaultModelFor(cur.id);
  await saveSettings();
  updateHeader();
  refreshCoop();
}

async function saveSettings() {
  state.lastSettingsJson = JSON.stringify(state.settings);
  await S.saveSettings(state.settings);
}

async function selectModel(connId, modelId) {
  state.settings.current = { connectionId: connId, modelId };
  state.settings.lastModelByConnection = { ...(state.settings.lastModelByConnection || {}), [connId]: modelId };
  await saveSettings();
  if (state.chat && !state.chat.messages.length) {
    state.chat.connectionId = connId;
    state.chat.modelId = modelId;
  }
  updateHeader();
  closePicker();
  refreshCoop();
}

// ---------- header ----------

function updateHeader() {
  const c = currentConn();
  const mid = state.settings.current.modelId;
  const m = c ? modelInfo(c.id, mid) : null;
  const badge = c ? modelBadge(c, m) : { letter: '?', color: '#64748b' };
  els.modelBadge.textContent = badge.letter;
  els.modelBadge.style.background = badge.color;
  els.modelBadge.style.color = /^#(f|e)/i.test(badge.color) ? '#111' : '#fff';
  const name = m ? displayName(m) : state.modelStatus[c?.id] === 'loading' ? 'Carregando modelos…' : 'Escolher modelo';
  els.modelName.textContent = name;
  let sub = c ? c.name : 'Nenhum provedor';
  if (m?.context) sub += ` · ${P.formatContext(m.context)} contexto`;
  if (c && !isConfigured(c) && c.type !== 'openrouter') sub = `${c.name} · não configurado`;
  if (c && c.type === 'openrouter' && !c.apiKey) sub = 'OpenRouter · adicione sua chave';
  els.modelSub.textContent = sub;
  els.modelMiniName.textContent = m ? displayName(m) : 'modelo';
  els.emptySub.innerHTML = m
    ? state.settings.browseMode
      ? `<b>${esc(displayName(m))}</b> pode ver e agir nas suas abas. Diga o que fazer.`
      : `Conversando com <b>${esc(displayName(m))}</b> via ${esc(c.name)}`
    : 'Escolha um modelo para começar.';
  document.title = MODE === 'tab' ? `AI in Browser${state.chat?.title ? ' — ' + state.chat.title : ''}` : 'AI in Browser';
}

// ---------- conversas ----------

function startNewChat(focus = true) {
  if (state.streaming) stopStreaming();
  const s = state.settings;
  state.chat = S.newChat(s.current.connectionId, s.current.modelId);
  state.context = null;
  renderContextBar();
  renderMessages();
  renderChatList();
  updateHeader();
  closeChats();
  if (focus) els.input.focus();
}

function loadChat(id) {
  const c = state.chats.find((x) => x.id === id);
  if (!c) return;
  if (state.streaming) stopStreaming();
  state.chat = c;
  state.context = null;
  renderContextBar();
  renderMessages();
  renderChatList();
  updateHeader();
  closeChats();
  scrollToBottom(true);
}

function sanitizeChat(c) {
  return {
    ...c,
    messages: c.messages.map((m) =>
      m.agent ? { ...m, steps: (m.steps || []).map((st) => ({ ...st, image: null, hadImage: !!(st.image || st.hadImage) })) } : m
    )
  };
}

function persist() {
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(async () => {
    const chat = state.chat;
    if (!chat || !chat.messages.length) return;
    chat.updatedAt = Date.now();
    const i = state.chats.findIndex((c) => c.id === chat.id);
    if (i >= 0) state.chats[i] = chat;
    else state.chats.unshift(chat);
    await S.saveChats(state.chats.map(sanitizeChat));
    renderChatList();
  }, 250);
}

async function deleteChat(id) {
  state.chats = state.chats.filter((c) => c.id !== id);
  await S.saveChats(state.chats);
  if (state.chat?.id === id) startNewChat(false);
  else renderChatList();
}

function renderChatList() {
  const q = els.chatsSearch.value.trim().toLowerCase();
  const list = [...state.chats]
    .filter((c) => c.messages.length)
    .filter((c) => !q || (c.title || '').toLowerCase().includes(q) || c.messages.some((m) => (m.content || '').toLowerCase().includes(q)))
    .sort((a, b) => b.updatedAt - a.updatedAt);
  if (!list.length) {
    els.chatsList.innerHTML = `<div class="chats-empty">${q ? 'Nenhuma conversa encontrada.' : 'Suas conversas aparecerão aqui.'}</div>`;
    return;
  }
  let html = '';
  let group = '';
  for (const c of list) {
    const g = dayGroup(c.updatedAt);
    if (g !== group) {
      group = g;
      html += `<div class="chats-group">${esc(g)}</div>`;
    }
    const m = modelInfo(c.connectionId, c.modelId);
    const active = state.chat?.id === c.id ? ' active' : '';
    html += `<button class="chat-item${active}" data-id="${c.id}" title="${esc(c.title || 'Conversa')}">
      <div class="ci-body"><div class="ci-title">${esc(c.title || 'Conversa')}</div>
      <div class="ci-sub">${esc(m ? displayName(m) : '')} · ${relTime(c.updatedAt)}</div></div>
      <span class="ci-del" data-del="${c.id}" title="Excluir"><svg><use href="#i-trash"/></svg></span>
    </button>`;
  }
  els.chatsList.innerHTML = html;
}

function openChats() {
  els.chats.classList.add('open');
  els.chatsBackdrop.classList.add('open');
  renderChatList();
}
function closeChats() {
  els.chats.classList.remove('open');
  els.chatsBackdrop.classList.remove('open');
}

// ---------- mensagens ----------

function ctxChipHtml(ctx) {
  const icon = ctx.kind === 'selection' ? '#i-scissors' : '#i-page';
  const label = ctx.kind === 'selection' ? 'Seleção' : 'Página';
  return `<div class="ctx-chip" title="${esc(ctx.url || '')}"><svg><use href="${icon}"/></svg><span>${esc(label)}: ${esc(ctx.title || ctx.url || '')}</span></div>`;
}

function modelLabel(msg) {
  const c = conn(msg.connectionId);
  const m = modelInfo(msg.connectionId, msg.model);
  return [m ? displayName(m) : msg.model, c?.name].filter(Boolean).join(' · ');
}

function metaText(msg) {
  const parts = [];
  if (msg.usage?.total) parts.push(`${P.formatTokens(msg.usage.total)} tokens`);
  if (typeof msg.usage?.cost === 'number' && msg.usage.cost > 0) parts.push('$' + (msg.usage.cost < 0.01 ? msg.usage.cost.toFixed(4) : msg.usage.cost.toFixed(3)));
  if (msg.duration && !msg.pending) parts.push(fmtDuration(msg.duration));
  return parts.join(' · ');
}

function createMessageNode(msg) {
  const el = document.createElement('article');
  el.className = 'msg ' + msg.role;
  el.dataset.id = msg.id;
  if (msg.role === 'user') {
    const imgs = (msg.images || []).map((im) => `<img src="data:${esc(im.mediaType || 'image/jpeg')};base64,${b64(im.data)}" alt="${esc(im.name || 'imagem')}" data-zoom>`).join('');
    const files = (msg.files || []).map((f) => `<span title="${esc(f.name)}">📎 ${esc(f.name)}</span>`).join('');
    el.innerHTML = `<div class="bubble">${msg.context ? ctxChipHtml(msg.context) : ''}${imgs ? `<div class="msg-images">${imgs}</div>` : ''}${files ? `<div class="msg-files">${files}</div>` : ''}<div class="content"></div></div>
      <div class="msg-meta"><div class="msg-actions">
        <button data-act="copy" title="Copiar"><svg><use href="#i-copy"/></svg></button>
        <button data-act="edit" title="Editar e reenviar"><svg><use href="#i-edit"/></svg></button>
      </div></div>`;
    $('.content', el).textContent = msg.content;
    return el;
  }
  el.innerHTML = `<div class="msg-head"><span class="avatar"><svg><use href="#i-sparkle"/></svg></span><span class="msg-author"></span><span class="msg-model"></span>${msg.agent ? '<span class="mode-pill"><svg><use href="#i-cursor"/></svg>Navegar</span>' : ''}</div>
    <div class="helpers"></div>
    <div class="reasoning hidden"><details><summary>Raciocínio</summary><div class="md"></div></details></div>
    <div class="agent-run hidden"></div>
    <div class="content"><div class="md"></div></div>
    <div class="typing hidden"><span></span><span></span><span></span></div>
    <div class="msg-error hidden"></div>
    <div class="msg-stopped hidden">Geração interrompida.</div>
    <div class="msg-meta"><span class="meta-text"></span><div class="msg-actions">
      <button data-act="copy" title="Copiar"><svg><use href="#i-copy"/></svg></button>
      <button data-act="regen" title="Gerar novamente"><svg><use href="#i-refresh"/></svg></button>
      <button data-act="delete" title="Excluir"><svg><use href="#i-trash"/></svg></button>
    </div></div>`;
  $('.msg-author', el).textContent = state.settings.assistantName || 'AI';
  $('.msg-model', el).textContent = modelLabel(msg);
  updateAssistantNode(el, msg);
  return el;
}

function agentRunHtml(msg) {
  const steps = (msg.steps || [])
    .map((st) => {
      const open = state.openSteps.has(st.id) ? ' open' : '';
      const img = st.image?.data
        ? `<img class="astep-shot" src="data:${esc(st.image.mediaType || 'image/jpeg')};base64,${b64(st.image.data)}" alt="captura" data-zoom>`
        : st.hadImage
          ? '<div class="tiny">📸 captura de tela (não salva no histórico)</div>'
          : '';
      const helperTag = st.helper ? `<span class="astep-helper" title="descrito por um modelo com visão">👁️ ${esc(st.helper.name)}</span>` : '';
      const noteTag = st.note === 'sem visão' ? '<span class="astep-note" title="nenhum modelo com visão ativo">sem visão</span>' : st.note === 'falha na visão' ? '<span class="astep-note err">falha na visão</span>' : st.note === 'visão expirou' ? '<span class="astep-note err" title="o modelo de visão não respondeu a tempo">visão expirou</span>' : '';
      return `<div class="astep ${esc(st.status || 'ok')}" data-sid="${esc(st.id)}">
        <span class="astep-ico">${st.icon || '🔧'}</span>
        <div class="astep-body">
          <div class="astep-title">${esc(st.label || st.name)}${helperTag}${noteTag}</div>
          ${st.thought ? `<div class="astep-thought">${esc(st.thought.slice(0, 240))}</div>` : ''}
          ${st.result ? `<details class="astep-details"${open}><summary>Resultado</summary><pre>${esc(st.result.slice(0, 6000))}${st.result.length > 6000 ? '\n[…]' : ''}</pre></details>` : ''}
          ${img}
        </div>
        <span class="astep-time">${st.ms ? fmtDuration(st.ms) : ''}</span>
      </div>`;
    })
    .join('');
  const ask = msg.question
    ? `<div class="agent-ask${msg.questionAnswered ? ' answered' : ''}"><span class="q-ico">❓</span><div><div>${esc(msg.question)}</div>${
        msg.answer ? `<div class="agent-answer"><b>Você:</b> ${esc(msg.answer)}</div>` : ''
      }</div></div>`
    : '';
  const tag = !msg.pending && msg.steps?.length ? `<div class="agent-summary-tag"><b>${msg.steps.length} ${msg.steps.length === 1 ? 'ação' : 'ações'}</b>${msg.agentMode === 'json' ? ' · protocolo JSON' : ''}${msg.status === 'aborted' ? ' · interrompido' : msg.status === 'partial' ? ' · incompleto' : ''}${msg.workingTab?.title ? ` · aba: <span title="${esc(msg.workingTab.url || '')}">${esc(msg.workingTab.title.slice(0, 48))}</span>` : ''}</div>` : '';
  return `<div class="agent-steps">${steps}</div>${ask}${tag}`;
}

function updateAssistantNode(el, msg) {
  const md = $('.content .md', el);
  md.innerHTML = renderMd(msg.content || '');
  refreshHead(el, msg);
  const run = $('.agent-run', el);
  if (msg.agent) {
    run.classList.remove('hidden');
    run.innerHTML = agentRunHtml(msg);
  } else run.classList.add('hidden');
  const r = $('.reasoning', el);
  if (msg.reasoning && state.settings.showReasoning !== false) {
    const wasHidden = r.classList.contains('hidden');
    r.classList.remove('hidden');
    $('.md', r).innerHTML = renderMd(msg.reasoning);
    const details = $('details', r);
    const live = !!msg.pending && !msg.content;
    r.classList.toggle('live', live);
    if (wasHidden && live) details.open = true;
    if (!msg.pending && el.dataset.rClosed !== '1') {
      details.open = false;
      el.dataset.rClosed = '1';
    }
  } else {
    r.classList.add('hidden');
  }
  $('.typing', el).classList.toggle('hidden', !(msg.pending && !msg.content && !msg.reasoning && !(msg.agent && msg.steps?.length)));
  el.classList.toggle('streaming', !!msg.pending && !!msg.content);
  const err = $('.msg-error', el);
  if (msg.error) {
    err.classList.remove('hidden');
    err.innerHTML = `<span></span><button class="btn sm" data-act="regen">Tentar de novo</button>`;
    err.firstChild.textContent = msg.error;
  } else err.classList.add('hidden');
  $('.msg-stopped', el).classList.toggle('hidden', !msg.stopped);
  $('.meta-text', el).textContent = metaText(msg);
  $('[data-act="regen"]', $('.msg-actions', el)).classList.toggle('hidden', !!msg.pending);
}

function renderMessages() {
  $$('.msg', els.messages).forEach((n) => n.remove());
  const has = state.chat?.messages.length;
  els.empty.classList.toggle('hidden', !!has);
  if (!has) return;
  const frag = document.createDocumentFragment();
  for (const m of state.chat.messages) frag.appendChild(createMessageNode(m));
  els.messages.appendChild(frag);
  scrollToBottom(true);
}

function appendMessage(msg) {
  els.empty.classList.add('hidden');
  const node = createMessageNode(msg);
  els.messages.appendChild(node);
  scrollToBottom(true);
  return node;
}

function scrollToBottom(force = false, smooth = false) {
  if (!force && !state.autoScroll) return;
  els.messages.scrollTo({ top: els.messages.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
}

// ---------- contexto da página ----------

function extractPageText(maxChars) {
  const sel = (window.getSelection && String(window.getSelection())) || '';
  const root = document.querySelector('main, article, [role="main"]') || document.body;
  let text = '';
  try {
    text = root.innerText || document.body.innerText || '';
    if (text.length < 200 && root !== document.body) text = document.body.innerText || text;
  } catch (e) {}
  text = text
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
  return {
    title: document.title,
    url: location.href,
    text: text.slice(0, maxChars),
    length: text.length,
    selection: sel.trim().slice(0, maxChars)
  };
}

async function findTargetTab(preferredId) {
  if (!S.HAS_CHROME || !chrome.tabs) return null;
  const ok = (t) => t && /^https?:|^file:/i.test(t.url || '') && !t.url.startsWith(chrome.runtime.getURL(''));
  if (preferredId != null) {
    try {
      const t = await chrome.tabs.get(preferredId);
      if (ok(t)) return t;
    } catch {}
  }
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (ok(active)) return active;
  const all = await chrome.tabs.query({});
  const cands = all.filter(ok).sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
  return cands[0] || null;
}

async function grabPage({ tabId = null, silent = false } = {}) {
  if (!S.HAS_CHROME || !chrome.scripting) {
    if (!silent) toast('Leitura de página disponível apenas dentro da extensão.', 'err');
    return null;
  }
  const tab = await findTargetTab(tabId);
  if (!tab) {
    if (!silent) toast('Abra uma página web (http/https) para anexar o conteúdo.', 'err');
    return null;
  }
  try {
    const limit = state.settings.pageContextChars || 16000;
    const res = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractPageText, args: [limit] });
    const data = res?.[0]?.result;
    if (!data || !data.text) {
      if (!silent) toast('Não encontrei texto nesta página.', 'err');
      return null;
    }
    return { kind: 'page', title: data.title || tab.title || '', url: data.url || tab.url, text: data.text, truncated: data.length > data.text.length };
  } catch (e) {
    if (!silent) toast('Não foi possível ler esta página (páginas internas do navegador são bloqueadas).', 'err');
    return null;
  }
}

function defaultPlaceholder() {
  if (state.agentWaiting) return 'Responda ao agente…';
  if (state.context?.kind === 'selection') return 'Pergunte sobre o texto selecionado…';
  if (state.context?.kind === 'page') return 'Pergunte sobre esta página…';
  if (state.settings.browseMode) return 'Diga o que fazer ou pergunte sobre a página…';
  return 'Pergunte qualquer coisa…';
}

function renderContextBar() {
  const ctx = state.context;
  const att = state.attachments;
  const show = !!ctx || att.length > 0;
  els.contextBar.classList.toggle('hidden', !show);
  els.btnPage.classList.toggle('active', ctx?.kind === 'page');
  els.input.placeholder = defaultPlaceholder();
  if (!show) {
    els.contextBar.innerHTML = '';
    return;
  }
  let html = '';
  if (ctx) {
    const icon = ctx.kind === 'selection' ? '#i-scissors' : '#i-page';
    const label = ctx.kind === 'selection' ? 'Seleção' : 'Página';
    const size = ctx.text.length >= 1000 ? Math.round(ctx.text.length / 1000) + 'k' : ctx.text.length;
    html += `<span class="chip active" title="${esc(ctx.url || '')}"><svg><use href="${icon}"/></svg><span class="t">${esc(label)}: ${esc(ctx.title || ctx.url || '')}</span><span class="tiny">${size} caract.${ctx.truncated ? ' (cortado)' : ''}</span><button class="x" data-clear-ctx title="Remover"><svg><use href="#i-close"/></svg></button></span>`;
  }
  att.forEach((a, i) => {
    const vis = a.kind === 'image' ? `<img src="${a.preview}" alt="">` : `<span class="ico">📄</span>`;
    html += `<span class="attach-thumb" title="${esc(a.name)}">${vis}<span class="t">${esc(a.name)}</span><button class="x" data-remove-att="${i}" title="Remover"><svg><use href="#i-close"/></svg></button></span>`;
  });
  els.contextBar.innerHTML = html;
}

// ---------- anexos ----------

async function fileToImage(file) {
  const keepOriginal = file.size < 400 * 1024 && /^image\/(png|webp|gif|jpeg)$/.test(file.type);
  if (keepOriginal) {
    const buf = new Uint8Array(await file.arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return { data: btoa(bin), mediaType: file.type };
  }
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / bmp.width, 1600 / bmp.height);
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const c = new OffscreenCanvas(w, h);
  c.getContext('2d').drawImage(bmp, 0, 0, w, h);
  const blob = await c.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return { data: btoa(bin), mediaType: 'image/jpeg' };
}

async function addFiles(files) {
  for (const f of files) {
    if (!f) continue;
    try {
      if (f.type.startsWith('image/')) {
        if (state.attachments.filter((a) => a.kind === 'image').length >= 6) {
          toast('Máximo de 6 imagens por mensagem.', 'err');
          continue;
        }
        const img = await fileToImage(f);
        state.attachments.push({ kind: 'image', name: f.name || 'imagem', data: img.data, mediaType: img.mediaType, preview: `data:${img.mediaType};base64,${img.data}` });
      } else if (/^(audio|video)\//.test(f.type)) {
        toast(`Áudio e vídeo ainda não são suportados ("${f.name}"). Anexe imagens ou arquivos de texto.`, 'err', 5000);
      } else if (f.size > 2 * 1024 * 1024) {
        toast(`"${f.name}" é muito grande (máx. 2 MB).`, 'err');
      } else {
        const text = await f.text();
        // arquivos binários viravam texto ilegível e eram enviados assim ao modelo
        if (/\uFFFD/.test(text.slice(0, 4000)) || /[\x00-\x08\x0E-\x1F]/.test(text.slice(0, 4000))) {
          toast(`"${f.name}" não parece um arquivo de texto e não pode ser anexado.`, 'err', 5000);
          continue;
        }
        state.attachments.push({ kind: 'file', name: f.name, text: text.slice(0, 200000) });
      }
    } catch (e) {
      toast(`Não foi possível anexar "${f.name}": ${e.message}`, 'err');
    }
  }
  renderContextBar();
  els.input.focus();
}

async function attachTabCapture() {
  if (!S.HAS_CHROME) return toast('Captura disponível apenas dentro da extensão.', 'err');
  try {
    const img = await captureActiveTab();
    state.attachments.push({ kind: 'image', name: `Captura: ${img.title || 'aba'}`, data: img.data, mediaType: 'image/jpeg', preview: `data:image/jpeg;base64,${img.data}` });
    renderContextBar();
  } catch (e) {
    toast(e.message, 'err');
  }
}

function openLightbox(src) {
  const box = document.createElement('div');
  box.className = 'lightbox';
  box.innerHTML = `<img src="${src}" alt="">`;
  box.addEventListener('click', () => box.remove());
  els.app.appendChild(box);
}

async function togglePageContext() {
  if (state.context?.kind === 'page') {
    state.context = null;
    renderContextBar();
    return;
  }
  els.btnPage.disabled = true;
  const ctx = await grabPage();
  els.btnPage.disabled = false;
  if (ctx) {
    state.context = ctx;
    renderContextBar();
    els.input.focus();
  }
}

// ---------- envio ----------

function buildSystem() {
  const parts = [];
  const sp = (state.settings.systemPrompt || '').trim();
  if (sp) parts.push(sp);
  return parts.join('\n\n');
}

function contextWrap(ctx, text) {
  const head = ctx.kind === 'selection' ? `[Texto selecionado pelo usuário na página "${ctx.title}" (${ctx.url})]` : `[Conteúdo da página "${ctx.title}" (${ctx.url})${ctx.truncated ? ', truncado' : ''}]`;
  return `${head}\n"""\n${ctx.text}\n"""\n\n${text}`;
}

function userText(m) {
  let text = m.content || '';
  if (m.files?.length) text = m.files.map((f) => `[Arquivo ${f.name}]\n"""\n${f.text}\n"""`).join('\n\n') + (text ? '\n\n' + text : '');
  if (m.context) text = contextWrap(m.context, text);
  return text;
}

function userContent(m, vision = true) {
  let text = userText(m);
  if (m.images?.length && vision) return [{ type: 'text', text: text || 'Veja a imagem.' }, ...m.images.map((im) => ({ type: 'image', data: im.data, mediaType: im.mediaType }))];
  if (m.images?.length && m.imageDescriptions?.length) {
    text = `${text}\n\n[${m.images.length === 1 ? 'Imagem anexada, descrita por um modelo com visão' : 'Imagens anexadas, descritas por um modelo com visão'}]\n${m.imageDescriptions.join('\n\n')}`;
  } else if (m.images?.length) {
    text = `${text}\n\n[O usuário anexou ${m.images.length} imagem(ns), mas este modelo não enxerga imagens.]`;
  }
  return text;
}

function buildApiMessages(messages, { vision = true } = {}) {
  const out = [];
  for (const m of messages) {
    if (m.role === 'user') out.push({ role: 'user', content: userContent(m, vision) });
    else if (m.role === 'assistant' && m.content && !m.error) out.push({ role: 'assistant', content: m.content });
  }
  return out;
}

// ---------- cooperação entre modelos ----------

function mainSel() {
  return { connectionId: state.settings.current.connectionId, modelId: state.settings.current.modelId };
}

async function modelsForRoles() {
  const conns = visibleConnections();
  await Promise.all(conns.map((c) => ensureModels(c.id)));
  const out = {};
  for (const c of conns) out[c.id] = state.models[c.id] || [];
  return out;
}

// Devolve o ajudante para um papel, ou null quando o principal já cobre / nada disponível.
async function resolveHelper(roleId, main) {
  const mb = await modelsForRoles();
  const r = R.resolveRole(roleId, state.settings, mb, main || mainSel());
  if (!r || r.source === 'main') return null;
  const c = conn(r.connectionId);
  if (!c) return null;
  return { role: roleId, conn: c, connectionId: c.id, modelId: r.modelId, name: r.name || P.prettyName(r.modelId), source: r.source, cap: r.cap };
}

function helperChipsHtml(helpers) {
  return (helpers || [])
    .map((h) => {
      const role = R.ROLES.find((r) => r.id === h.role);
      const title = h.source === 'pinned' ? 'fixado em Configurações → Cooperação' : 'escolhido automaticamente';
      return `<span class="helper-chip" title="${title}">${role?.icon || '🤝'} ${esc(role?.label || h.role)}: ${esc(h.name || h.modelId)}</span>`;
    })
    .join('');
}

function refreshHead(node, msg) {
  const m = $('.msg-model', node);
  if (m) m.textContent = modelLabel(msg);
  const h = $('.helpers', node);
  if (h) h.innerHTML = helperChipsHtml(msg.helpers);
}

async function describePendingImages(mainConn, mainModelId, helpers, signal) {
  if (P.modelSupportsVision(mainConn, modelInfo(mainConn.id, mainModelId))) return;
  const pending = state.chat.messages.filter((m) => m.role === 'user' && m.images?.length && !m.imageDescriptions);
  if (!pending.length) return;
  const h = await resolveHelper('vision', { connectionId: mainConn.id, modelId: mainModelId });
  if (!h) {
    for (const m of pending) m.imageDescriptions = ['(o modelo atual não enxerga imagens e nenhum modelo com visão está ativo para descrevê-las; ative um em Configurações → Cooperação)'];
    return;
  }
  const n = pending.reduce((acc, m) => acc + m.images.length, 0);
  setAgentStatus(`Descrevendo ${n} ${n === 1 ? 'imagem' : 'imagens'} com ${h.name}…`);
  for (const m of pending) {
    try {
      m.imageDescriptions = [await R.describeImages(h.conn, h.modelId, m.images, { purpose: 'chat', question: m.content, signal })];
    } catch (e) {
      if (signal?.aborted) throw e;
      m.imageDescriptions = [`(não foi possível descrever as imagens com ${h.name}: ${P.networkErrorMessage(e, h.conn) || e?.message || e})`];
    }
  }
  helpers.push(h);
  setAgentStatus(null);
  persist();
}

// Resumo do que a cooperação faria agora, para o indicador do painel.
async function coopSummary(force = false) {
  const key = JSON.stringify([state.settings.current, state.settings.roles, visibleConnections().map((c) => c.id)]);
  if (!force && state.coopCache?.key === key) return state.coopCache.rows;
  const mb = await modelsForRoles();
  const main = mainSel();
  const rows = R.ROLES.map((role) => {
    const cfg = state.settings.roles?.[role.id] || {};
    if (cfg.mode === 'off') return { role, status: 'off' };
    const r = R.resolveRole(role.id, state.settings, mb, main);
    if (!r) return { role, status: 'none' };
    if (r.source === 'main') return { role, status: 'main', name: r.name };
    return { role, status: r.source, name: r.name, connectionName: conn(r.connectionId)?.name || '' };
  });
  state.coopCache = { key, rows };
  return rows;
}

const COOP_SRC = { auto: 'automático', pinned: 'fixo', main: 'o principal cobre', off: 'desligado', none: 'nenhum disponível' };

function renderCoopIndicator(rows) {
  const helpers = rows.filter((r) => r.status === 'auto' || r.status === 'pinned');
  const anyOn = rows.some((r) => r.status !== 'off');
  els.btnCoop.classList.toggle('on', helpers.length > 0);
  els.coopCount.textContent = String(helpers.length);
  els.coopCount.classList.toggle('hidden', helpers.length === 0);
  const modes = new Set(rows.filter((r) => r.status !== 'none').map((r) => (r.status === 'pinned' ? 'fixo' : r.status === 'off' ? 'desligado' : 'automático')));
  els.coopLabel.textContent = !anyOn ? 'Coop off' : modes.size === 1 && modes.has('fixo') ? 'Coop fixa' : 'Coop auto';
  els.btnCoop.title = helpers.length
    ? 'Cooperação: ' + helpers.map((h) => `${h.role.label} → ${h.name} (${COOP_SRC[h.status]})`).join(' · ')
    : anyOn
      ? 'Cooperação ativa: o modelo principal cobre todas as habilidades disponíveis'
      : 'Cooperação desligada';
  // linha na tela inicial
  if (helpers.length) {
    els.emptyCoop.innerHTML = '🤝 Cooperação: ' + helpers.slice(0, 3).map((h) => `${esc(h.role.label)} → <b>${esc(h.name)}</b>`).join(' · ') + (helpers.length > 3 ? ` · +${helpers.length - 3}` : '');
    els.emptyCoop.classList.remove('hidden');
  } else els.emptyCoop.classList.add('hidden');
}

function renderCoopMenu(rows) {
  const helpers = rows.filter((r) => r.status === 'auto' || r.status === 'pinned').length;
  els.coopMenu.innerHTML =
    `<div class="coop-head"><span>Cooperação entre modelos</span><b>${helpers ? `${helpers} ${helpers === 1 ? 'ajudante' : 'ajudantes'}` : 'sem ajudantes'}</b></div>` +
    rows
      .map((r) => {
        const dim = r.status === 'off' || r.status === 'none' || r.status === 'main';
        const who = r.status === 'auto' || r.status === 'pinned' ? `${esc(r.name)}${r.connectionName ? ' · ' + esc(r.connectionName) : ''}` : r.status === 'main' ? esc(r.name || 'o principal') : r.status === 'off' ? 'desligado' : 'nenhum modelo ativo tem essa habilidade';
        return `<div class="coop-row${dim ? ' dim' : ''}"><span class="ico">${r.role.icon}</span><span class="lbl">${esc(r.role.label)}</span><span class="who">${who}</span><span class="src ${r.status}">${esc(COOP_SRC[r.status])}</span></div>`;
      })
      .join('') +
    `<div class="coop-foot"><button data-coop-config>Configurar cooperação</button></div>`;
}

async function refreshCoop(force = false) {
  try {
    const rows = await coopSummary(force);
    renderCoopIndicator(rows);
    if (!els.coopMenu.classList.contains('hidden')) renderCoopMenu(rows);
  } catch (e) {
    console.warn('[coop]', e);
  }
}

function openOptionsAt(hash) {
  if (S.HAS_CHROME && chrome.tabs?.create) chrome.tabs.create({ url: chrome.runtime.getURL('options.html' + (hash || '')) });
  else window.open('options.html' + (hash || ''), '_blank');
}

async function maybeGenerateTitle() {
  const chat = state.chat;
  if (!chat || chat.titleGenerated || chat.messages.length < 2) return;
  const first = chat.messages.find((m) => m.role === 'user');
  if (!first?.content) return;
  const mb = await modelsForRoles();
  const r = R.resolveRole('fast', state.settings, mb, mainSel());
  const c = r && conn(r.connectionId);
  if (!c) return;
  chat.titleGenerated = true;
  try {
    const t = await R.generateTitle(c, r.modelId, first.content);
    if (t && state.chat?.id === chat.id) {
      chat.title = t;
      persist();
      updateHeader();
    }
  } catch {}
}

function setSendState() {
  const streaming = !!state.streaming && !state.agentWaiting;
  els.btnSend.classList.toggle('stop', streaming);
  els.btnSend.title = streaming ? 'Parar (Esc)' : 'Enviar';
  els.btnSend.disabled = !streaming && !els.input.value.trim() && !state.attachments.length;
}

function stopStreaming() {
  state.streaming?.abort.abort();
}

async function send(text, ctxOverride) {
  text = (text ?? '').trim();
  if (state.agentWaiting && state.agent) {
    if (!text) return;
    // a resposta entra no próprio bloco da pergunta, mantendo a ordem da conversa
    els.input.value = '';
    autoResize();
    state.agentWaiting = false;
    state.agent.msg.questionAnswered = true;
    state.agent.msg.answer = text;
    updateAssistantNode(state.agent.node, state.agent.msg);
    renderContextBar();
    scrollToBottom(true);
    state.agent.runner.answer(text);
    setSendState();
    return;
  }
  if ((!text && !state.attachments.length) || state.streaming) return;
  if (!text) text = state.attachments.some((a) => a.kind === 'image') ? 'Descreva a imagem.' : 'Analise o arquivo.';
  const c = currentConn();
  const modelId = state.settings.current.modelId;
  if (!c || !modelId) {
    openPicker();
    return;
  }
  if (c.builtin && !c.local && !c.apiKey) {
    toast(`Adicione sua chave de API do ${c.name} para começar.`, 'err');
    if (c.type === 'openrouter') showSetup();
    else openOptions();
    return;
  }
  let ctx = ctxOverride ?? state.context;
  if (!ctx && state.settings.pageContextDefault) ctx = await grabPage({ silent: true });
  if (!state.chat) startNewChat(false);
  const images = state.attachments.filter((a) => a.kind === 'image').map((a) => ({ name: a.name, data: a.data, mediaType: a.mediaType }));
  const files = state.attachments.filter((a) => a.kind === 'file').map((a) => ({ name: a.name, text: a.text }));
  const userMsg = { id: uid(), role: 'user', content: text, ts: Date.now(), context: ctx || null, images: images.length ? images : undefined, files: files.length ? files : undefined };
  state.chat.messages.push(userMsg);
  if (!state.chat.title) state.chat.title = titleFrom(text);
  state.chat.connectionId = c.id;
  state.chat.modelId = modelId;
  state.context = null;
  state.attachments = [];
  renderContextBar();
  els.input.value = '';
  autoResize();
  appendMessage(userMsg);
  persist();
  updateHeader();
  if (state.settings.browseMode) await runAgentTask(text, ctx, userMsg);
  else await runAssistant();
}

// ---------- agente (modo Navegar) ----------

function setAgentStatus(text) {
  if (text == null) {
    els.agentStatus.classList.add('hidden');
    return;
  }
  els.agentStatus.classList.remove('hidden');
  els.agentStatusText.textContent = text;
}

async function runAgentTask(text, ctx, userMsg) {
  const s = state.settings;
  let c = currentConn();
  let modelId = s.current.modelId;
  const helpers = [];
  const mb = await modelsForRoles();
  // papel de navegação: outro modelo pode conduzir o agente
  const ar = R.resolveRole('agent', s, mb, mainSel());
  if (ar && ar.source !== 'main' && conn(ar.connectionId)) {
    c = conn(ar.connectionId);
    modelId = ar.modelId;
    helpers.push({ role: 'agent', connectionId: c.id, modelId, name: ar.name, source: ar.source });
  }
  const mInfo = modelInfo(c.id, modelId) || { id: modelId };
  // papel de visão: descreve as capturas quando o condutor não enxerga
  let visionHelper = null;
  if (s.agent?.screenshots !== false && !P.modelSupportsVision(c, mInfo)) {
    const vr = R.resolveRole('vision', s, mb, { connectionId: c.id, modelId });
    if (vr && vr.source !== 'main' && conn(vr.connectionId)) visionHelper = { conn: conn(vr.connectionId), modelId: vr.modelId, name: vr.name };
  }
  const msg = { id: uid(), role: 'assistant', agent: true, content: '', steps: [], ts: Date.now(), model: modelId, connectionId: c.id, pending: true, status: 'running', helpers };
  // imagens anexadas pelo usuário: o agente trabalha com texto, então elas são
  // descritas antes (pelo próprio modelo, se enxergar, ou pelo ajudante de visão)
  let attachedNote = '';
  // a descrição do anexo acontece antes do agente existir: um controlador
  // próprio garante que o botão Parar interrompa também essa fase
  const node = appendMessage(msg);
  const pre = new AbortController();
  state.streaming = { abort: pre, msg, node };
  setSendState();
  if (userMsg?.images?.length) {
    const own = P.modelSupportsVision(c, mInfo);
    const describer = own ? { conn: c, modelId, name: displayName(mInfo) } : visionHelper;
    if (!userMsg.imageDescriptions && describer) {
      setAgentStatus(`Descrevendo ${userMsg.images.length === 1 ? 'a imagem anexada' : 'as imagens anexadas'} com ${describer.name}…`);
      try {
        userMsg.imageDescriptions = [await R.describeImages(describer.conn, describer.modelId, userMsg.images, { purpose: 'chat', question: text, signal: pre.signal })];
        if (!own) {
          helpers.push({ role: 'vision', connectionId: describer.conn.id, modelId: describer.modelId, name: describer.name, source: 'auto' });
        }
        persist();
      } catch (e) {
        if (pre.signal.aborted) {
          msg.pending = false;
          msg.stopped = true;
          msg.status = 'aborted';
          state.streaming = null;
          setAgentStatus(null);
          setSendState();
          updateAssistantNode(node, msg);
          persist();
          return;
        }
        userMsg.imageDescriptions = [`(não foi possível descrever: ${e?.name === 'HelperTimeout' ? e.message : P.networkErrorMessage(e, describer.conn) || e?.message || e})`];
      }
      setAgentStatus(null);
    }
    attachedNote = userMsg.imageDescriptions?.length
      ? `\n\n[O usuário anexou ${userMsg.images.length} imagem(ns) à mensagem. Descrição feita por um modelo com visão:]\n${userMsg.imageDescriptions.join('\n\n')}\n\nResponda sobre ESSA imagem anexada. Só use a ferramenta screenshot se o usuário pedir algo sobre a página aberta no navegador.`
      : `\n\n[O usuário anexou ${userMsg.images.length} imagem(ns), mas nenhum modelo com visão está ativo para descrevê-las. Diga isso a ele; não use screenshot como substituto.]`;
  }
  state.chat.messages.push(msg);
  const perms = await PERM.granted();
  const useDebugger = s.agent?.useDebugger !== false && perms.debugger !== false;
  const browser = createBrowser({ useDebugger, blockedDomains: s.agent?.blockedDomains || [], log: (m) => console.debug('[agent]', m) });
  const runner = new AgentRunner({
    conn: c,
    model: modelId,
    modelInfo: mInfo,
    browser,
    settings: s,
    perms,
    visionHelper,
    // o provedor de busca do OpenRouter usa uma conexão configurada
    searchConn: s.search?.provider === 'openrouter' ? conn(s.search.connectionId) : null,
    onEvent: (ev) => {
      if (ev.type === 'step') {
        const i = msg.steps.findIndex((x) => x.id === ev.step.id);
        const copy = { ...ev.step };
        if (i >= 0) msg.steps[i] = copy;
        else msg.steps.push(copy);
        for (const d of $$('.astep-details[open]', node)) state.openSteps.add(d.closest('.astep').dataset.sid);
        updateAssistantNode(node, msg);
        scrollToBottom();
      } else if (ev.type === 'status') {
        const tab = ev.tab;
        setAgentStatus(tab?.title ? `${ev.text} · aba: ${tab.title.slice(0, 40)}` : ev.text);
        if (tab?.note && !msg.tabNoteShown) {
          msg.tabNoteShown = true;
          msg.workingTab = { title: tab.title, url: tab.url };
          toast(`A aba ativa não é uma página web. O agente está usando a última página aberta: ${tab.title || tab.url}`, '', 6000);
        } else if (tab?.title && !msg.workingTab) msg.workingTab = { title: tab.title, url: tab.url };
      } else if (ev.type === 'helper') {
        if (!msg.helpers.some((h) => h.role === ev.role && h.modelId === ev.modelId)) {
          msg.helpers.push({ role: ev.role, connectionId: ev.connectionId, modelId: ev.modelId, name: ev.name, source: visionHelper?.source || 'auto' });
          updateAssistantNode(node, msg);
        }
      } else if (ev.type === 'ask') {
        msg.question = ev.question;
        msg.questionAnswered = false;
        state.agentWaiting = true;
        setAgentStatus('Aguardando sua resposta…');
        updateAssistantNode(node, msg);
        renderContextBar();
        setSendState();
        els.input.focus();
        scrollToBottom(true);
      }
    }
  });
  state.agent = { runner, msg, node };
  state.streaming = { abort: { abort: () => runner.stop() }, msg, node };
  state.autoScroll = true;
  setSendState();
  setAgentStatus('Iniciando…');
  const history = state.chat.messages
    .slice(0, -2)
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.content && !m.error)
    .slice(-8)
    .map((m) => ({ role: m.role, content: m.role === 'user' ? userText(m) : m.content }));
  const context = ctx || (userMsg?.files?.length ? { kind: 'page', title: userMsg.files.map((f) => f.name).join(', '), url: '', text: userMsg.files.map((f) => `[${f.name}]\n${f.text}`).join('\n\n') } : null);
  let result;
  try {
    result = await runner.run(text + attachedNote, { history, context });
  } catch (e) {
    result = { summary: '', success: false, error: e?.message || String(e), steps: msg.steps, usage: runner.usage, ms: 0 };
  }
  msg.pending = false;
  msg.content = result.error || result.aborted ? '' : result.summary || '';
  msg.error = result.error || '';
  msg.status = result.aborted ? 'aborted' : result.success ? 'ok' : 'partial';
  msg.stopped = !!result.aborted;
  msg.agentMode = result.mode;
  msg.duration = result.ms;
  if (result.usage && (result.usage.prompt || result.usage.completion)) msg.usage = { prompt: result.usage.prompt, completion: result.usage.completion, total: result.usage.prompt + result.usage.completion, cost: result.usage.cost || null };
  state.agent = null;
  state.agentWaiting = false;
  state.streaming = null;
  setAgentStatus(null);
  setSendState();
  renderContextBar();
  updateAssistantNode(node, msg);
  scrollToBottom();
  persist();
}

async function toggleBrowseMode(force) {
  state.settings.browseMode = force != null ? !!force : !state.settings.browseMode;
  await saveSettings();
  applyBrowseMode();
}

function applyBrowseMode() {
  const on = !!state.settings.browseMode;
  els.btnBrowse.classList.toggle('on', on);
  els.app.classList.toggle('browse', on);
  els.input.placeholder = defaultPlaceholder();
  updateHeader();
}

function renderEffortMenu() {
  const cur = state.settings.effort || 'auto';
  els.effortMenu.innerHTML = P.EFFORTS.map((e) => `<button data-effort="${e.id}" class="${e.id === cur ? 'active' : ''}"><span>${esc(e.label)}</span><small>${esc(e.hint)}</small></button>`).join('');
  els.effortLabel.textContent = (P.EFFORTS.find((e) => e.id === cur) || P.EFFORTS[0]).label;
}

// ---------- voz ----------

// 'granted' | 'denied' | 'prompt' | null (navegador sem a consulta)
async function micPermissionState() {
  try {
    if (!navigator.permissions?.query) return null;
    const st = await navigator.permissions.query({ name: 'microphone' });
    return st.state;
  } catch {
    return null;
  }
}

function stopMic() {
  if (state.rec) {
    try {
      state.rec.stop();
    } catch {}
  }
  state.rec = null;
  els.btnMic.classList.remove('listening');
}

function startDictation() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return toast('Reconhecimento de voz indisponível neste navegador.', 'err');
  const rec = new SR();
  rec.lang = navigator.language || 'pt-BR';
  rec.interimResults = true;
  rec.continuous = true;
  const base = els.input.value;
  let finalText = '';
  rec.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalText += r[0].transcript;
      else interim += r[0].transcript;
    }
    els.input.value = (base + (base && !/\s$/.test(base) ? ' ' : '') + finalText + interim).trimStart();
    autoResize();
    setSendState();
  };
  rec.onerror = (e) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      // o diálogo de microfone não aparece no painel lateral: leva às configurações,
      // que abrem numa aba comum, onde o Chrome mostra o pedido normalmente
      toast('O Chrome não pede o microfone dentro do painel. Abrindo as configurações: use "Testar microfone" para conceder.', 'err', 8000);
      setTimeout(() => openOptionsAt('#behavior'), 900);
    }
    else if (e.error !== 'aborted' && e.error !== 'no-speech') toast('Erro no reconhecimento de voz: ' + e.error, 'err');
    stopMic();
  };
  rec.onend = () => stopMic();
  try {
    rec.start();
    state.rec = rec;
    els.btnMic.classList.add('listening');
  } catch (e) {
    toast('Não foi possível iniciar o microfone: ' + e.message, 'err');
  }
}

async function streamInto(msg, node, c, modelId, history, abort) {
  const s = state.settings;
  let dirty = false;
  let raf = 0;
  const schedule = () => {
    dirty = true;
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (!dirty) return;
      dirty = false;
      updateAssistantNode(node, msg);
      scrollToBottom();
    });
  };
  try {
    for await (const ev of P.chatStream(c, {
      model: modelId,
      messages: history,
      system: buildSystem(),
      temperature: typeof s.temperature === 'number' ? s.temperature : 0.7,
      maxTokens: Number(s.maxTokens) || 0,
      stream: s.streaming !== false,
      effort: s.effort,
      signal: abort.signal
    })) {
      if (ev.type === 'text') {
        msg.content += ev.text;
        schedule();
      } else if (ev.type === 'reasoning') {
        msg.reasoning += ev.text;
        schedule();
      } else if (ev.type === 'usage') {
        msg.usage = ev.usage;
      } else if (ev.type === 'finish') {
        msg.finish = ev.reason;
      }
    }
  } finally {
    if (raf) cancelAnimationFrame(raf);
  }
}

async function runAssistant() {
  const s = state.settings;
  let c = currentConn();
  let modelId = s.current.modelId;
  const helpers = [];
  const abort = new AbortController();
  const msg = { id: uid(), role: 'assistant', content: '', reasoning: '', ts: Date.now(), model: modelId, connectionId: c.id, pending: true, helpers };
  state.chat.messages.push(msg);
  const node = appendMessage(msg);
  state.streaming = { abort, msg, node };
  state.autoScroll = true;
  setSendState();
  const t0 = performance.now();

  try {
    // 1) visão: outro modelo descreve as imagens anexadas se o principal não enxerga
    await describePendingImages(c, modelId, helpers, abort.signal);

    // 2) raciocínio profundo: esforço Alto num modelo sem raciocínio passa a vez
    if (s.effort === 'high' && !R.capabilities(c, modelInfo(c.id, modelId)).reasoning) {
      const h = await resolveHelper('reasoning');
      if (h) {
        c = h.conn;
        modelId = h.modelId;
        helpers.push(h);
      }
    }

    let vision = P.modelSupportsVision(c, modelInfo(c.id, modelId));
    let history = buildApiMessages(state.chat.messages.slice(0, -1), { vision });

    // 3) documentos longos: se não cabe no contexto do principal, passa a um modelo maior
    const ctx = Number(modelInfo(c.id, modelId)?.context) || 0;
    const est = R.estimateTokens(history, buildSystem());
    if (ctx && est > ctx * 0.85) {
      const h = await resolveHelper('longContext', { connectionId: c.id, modelId });
      if (h && (!h.cap?.context || h.cap.context > est)) {
        c = h.conn;
        modelId = h.modelId;
        helpers.push(h);
        vision = P.modelSupportsVision(c, modelInfo(c.id, modelId));
        history = buildApiMessages(state.chat.messages.slice(0, -1), { vision });
      }
    }

    msg.model = modelId;
    msg.connectionId = c.id;
    refreshHead(node, msg);
    await streamInto(msg, node, c, modelId, history, abort);
  } catch (e) {
    if (abort.signal.aborted) msg.stopped = true;
    else {
      // 4) reserva: falha de rede, limite ou erro do servidor tenta outro modelo uma vez
      const h = R.isRetryableError(e) ? await resolveHelper('fallback', { connectionId: c.id, modelId }).catch(() => null) : null;
      if (h && !abort.signal.aborted) {
        helpers.push(h);
        msg.content = '';
        msg.reasoning = '';
        msg.model = h.modelId;
        msg.connectionId = h.conn.id;
        refreshHead(node, msg);
        setAgentStatus(`${c.name} falhou; tentando com ${h.name}…`);
        try {
          const vision2 = P.modelSupportsVision(h.conn, modelInfo(h.conn.id, h.modelId));
          await streamInto(msg, node, h.conn, h.modelId, buildApiMessages(state.chat.messages.slice(0, -1), { vision: vision2 }), abort);
        } catch (e2) {
          if (abort.signal.aborted) msg.stopped = true;
          else msg.error = `${P.networkErrorMessage(e, c) || e?.message || e} · A reserva (${h.name}) também falhou: ${P.networkErrorMessage(e2, h.conn) || e2?.message || e2}`;
        }
      } else msg.error = P.networkErrorMessage(e, c) || e?.message || String(e);
    }
  }
  setAgentStatus(null);
  msg.pending = false;
  msg.duration = performance.now() - t0;
  if (!msg.content && !msg.error && !msg.stopped) msg.error = 'O modelo não retornou conteúdo. Tente novamente ou troque de modelo.';
  state.streaming = null;
  setSendState();
  updateAssistantNode(node, msg);
  scrollToBottom();
  persist();
  maybeGenerateTitle();
}

async function regenerate(msgId) {
  if (state.streaming) return;
  const msgs = state.chat.messages;
  const i = msgs.findIndex((m) => m.id === msgId);
  if (i < 0) return;
  msgs.splice(i);
  renderMessages();
  if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return;
  await runAssistant();
}

function editMessage(msgId) {
  if (state.streaming) return;
  const msgs = state.chat.messages;
  const i = msgs.findIndex((m) => m.id === msgId);
  if (i < 0) return;
  const m = msgs[i];
  els.input.value = m.content;
  if (m.context) {
    state.context = m.context;
    renderContextBar();
  }
  msgs.splice(i);
  renderMessages();
  persist();
  autoResize();
  els.input.focus();
  setSendState();
}

function deleteMessage(msgId) {
  if (state.streaming) return;
  const msgs = state.chat.messages;
  const i = msgs.findIndex((m) => m.id === msgId);
  if (i < 0) return;
  msgs.splice(i, 1);
  renderMessages();
  persist();
}

// ---------- exportação ----------

function chatToMarkdown(chat) {
  const lines = [`# ${chat.title || 'Conversa'}`, '', `_${new Date(chat.createdAt).toLocaleString('pt-BR')} · ${chat.modelId} via ${conn(chat.connectionId)?.name || chat.connectionId}_`, ''];
  for (const m of chat.messages) {
    if (m.role === 'user') {
      lines.push(`**${state.settings.userName || 'Você'}:**`, '');
      if (m.context) lines.push(`> ${m.context.kind === 'selection' ? 'Seleção' : 'Página'}: ${m.context.title} — ${m.context.url}`, '');
      lines.push(m.content, '');
    } else {
      lines.push(`**${state.settings.assistantName || 'AI'} (${m.model}):**`, '', m.content || (m.error ? `_Erro: ${m.error}_` : ''), '');
    }
    lines.push('---', '');
  }
  return lines.join('\n');
}

function download(name, text) {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ---------- seletor de modelos ----------

function openPicker() {
  els.picker.classList.remove('hidden');
  els.pickerSearch.value = '';
  state.pickerExpanded.clear();
  renderPickerFilters();
  renderPicker();
  loadAllModels();
  setTimeout(() => els.pickerSearch.focus(), 30);
}
function closePicker() {
  els.picker.classList.add('hidden');
}

async function loadAllModels({ force = false } = {}) {
  const conns = visibleConnections();
  await Promise.all(
    conns.map(async (c) => {
      await ensureModels(c.id, { force });
      renderPicker();
      renderPickerFilters();
    })
  );
  renderPicker();
  renderPickerFilters();
}

function renderPickerFilters() {
  const f = state.pickerFilter;
  const conns = visibleConnections();
  const hasOR = conns.some((c) => c.type === 'openrouter' && state.models[c.id]?.length);
  const chips = [{ id: 'all', label: 'Todos' }];
  if (state.settings.favorites.length) chips.push({ id: 'fav', label: '★ Favoritos' });
  if (hasOR) chips.push({ id: 'featured', label: '✦ Destaques' });
  if (hasOR) chips.push({ id: 'free', label: 'Grátis' });
  for (const c of conns) chips.push({ id: 'conn:' + c.id, label: c.name.replace(' (local)', ''), badge: P.connectionBadge(c) });
  els.pickerFilters.innerHTML = chips
    .map(
      (ch) =>
        `<button class="chip${f === ch.id ? ' active' : ''}" data-filter="${ch.id}">${ch.badge ? `<span class="badge" style="background:${ch.badge.color};color:${/^#(f|e)/i.test(ch.badge.color) ? '#111' : '#fff'}">${ch.badge.letter}</span>` : ''}${esc(ch.label)}</button>`
    )
    .join('');
}

function modelItemHtml(c, m, selected, fav) {
  const b = modelBadge(c, m);
  const meta = [];
  if (m.context) meta.push(`<span>${P.formatContext(m.context)} ctx</span>`);
  if (m.promptPrice != null) meta.push(m.free ? `<span class="free">grátis</span>` : `<span class="price">${P.formatPrice(m.promptPrice)} / ${P.formatPrice(m.completionPrice)}</span>`);
  const vision = (m.modalities || []).includes('image') ? '<span class="tag vision">visão</span>' : '';
  const novo = c.type === 'openrouter' && P.isNew(m.created) ? `<span class="tag new" title="lançado ${esc(P.formatAge(m.created))}">novo</span>` : '';
  return `<div class="model-item${selected ? ' selected' : ''}" data-conn="${esc(c.id)}" data-model="${esc(m.id)}" role="button" tabindex="0">
    <span class="badge" style="background:${b.color};color:${/^#(f|e)/i.test(b.color) ? '#111' : '#fff'}">${b.letter}</span>
    <div class="mi-body"><div class="mi-name"><span>${esc(displayName(m))}</span>${novo}${vision}</div><div class="mi-id">${esc(m.id)}${c.type === 'openrouter' && m.created ? ` · ${esc(P.formatAge(m.created))}` : ''}</div></div>
    <div class="mi-meta">${meta.join('')}</div>
    <button class="mi-star${fav ? ' on' : ''}" data-fav title="${fav ? 'Remover dos favoritos' : 'Favoritar'}"><svg><use href="#i-star"/></svg></button>
    ${selected ? '<svg class="mi-check"><use href="#i-check"/></svg>' : ''}
  </div>`;
}

function groupHtml(c, models, { title, badge = true, cap = 60, key } = {}) {
  const cur = state.settings.current;
  const favs = new Set(state.settings.favorites);
  const b = P.connectionBadge(c);
  const st = state.modelStatus[c.id];
  let status = '';
  if (st === 'loading') status = '<span class="pg-status">carregando…</span>';
  else if (st === 'off') status = '<span class="pg-status err">não detectado</span>';
  else if (st === 'error') status = `<span class="pg-status err" title="${esc(state.modelError[c.id] || '')}">erro ao carregar</span>`;
  else if (models.length) status = `<span class="pg-status">${models.length}</span>`;
  let html = `<div class="picker-group">${badge ? `<span class="badge" style="background:${b.color};color:${/^#(f|e)/i.test(b.color) ? '#111' : '#fff'}">${b.letter}</span>` : ''}${esc(title || c.name)}${status}</div>`;
  const expanded = state.pickerExpanded.has(key || c.id);
  const shown = expanded ? models : models.slice(0, cap);
  for (const m of shown) html += modelItemHtml(c, m, cur.connectionId === c.id && cur.modelId === m.id, favs.has(c.id + ':' + m.id));
  if (!expanded && models.length > cap) html += `<button class="picker-more" data-expand="${esc(key || c.id)}">Mostrar mais ${models.length - cap} modelos</button>`;
  if (!models.length && st !== 'loading' && st !== 'off' && st !== 'error') html += `<div class="picker-empty">Nenhum modelo.</div>`;
  if (!models.length && st === 'off') html += `<div class="picker-empty">Inicie o ${esc(c.name.replace(' (local)', ''))} e clique em <b>Atualizar</b>.</div>`;
  if (!models.length && st === 'error') html += `<div class="picker-empty">${esc(state.modelError[c.id] || 'Erro')}</div>`;
  return html;
}

function sortModels(list, c) {
  const s = state.pickerSort;
  const arr = [...list];
  if (s === 'name') return arr.sort((a, b) => displayName(a).localeCompare(displayName(b)));
  if (s === 'price') return arr.sort((a, b) => (a.promptPrice ?? (c.local ? 0 : 1e9)) - (b.promptPrice ?? (c.local ? 0 : 1e9)) || displayName(a).localeCompare(displayName(b)));
  if (c.type !== 'openrouter') return arr.sort((a, b) => displayName(a).localeCompare(displayName(b)));
  return arr.sort((a, b) => (b.created || 0) - (a.created || 0) || displayName(a).localeCompare(displayName(b)));
}

function renderPicker() {
  const q = els.pickerSearch.value.trim().toLowerCase();
  const f = state.pickerFilter;
  const conns = visibleConnections();
  // lotes (:batch) e apelidos (~…latest) só aparecem quando procurados
  const interactive = (m) => /batch/.test(q) || /^~|latest/.test(q) ? true : !/:batch$/i.test(m.id) && !m.id.startsWith('~');
  const match = (m) => interactive(m) && (!q || m.id.toLowerCase().includes(q) || (m.name || '').toLowerCase().includes(q));
  els.pickerSort.value = state.pickerSort;
  let html = '';
  let total = 0;

  if (f === 'fav') {
    const favs = state.settings.favorites;
    for (const c of conns) {
      const ids = favs.filter((k) => k.startsWith(c.id + ':')).map((k) => k.slice(c.id.length + 1));
      const models = ids.map((id) => modelInfo(c.id, id)).filter(match);
      if (models.length) {
        html += groupHtml(c, models, { key: 'fav:' + c.id });
        total += models.length;
      }
    }
    if (!total) html = '<div class="picker-empty">Nenhum favorito ainda.<br>Toque na ★ ao lado de um modelo para favoritar.</div>';
  } else if (f === 'featured' || f === 'free') {
    for (const c of conns.filter((x) => x.type === 'openrouter')) {
      const list = state.models[c.id] || [];
      const models = (f === 'featured' ? P.featuredFrom(list) : sortModels(list.filter((m) => m.free), c)).filter(match);
      html += groupHtml(c, models, { title: f === 'featured' ? 'Destaques' : 'Modelos gratuitos', key: f + ':' + c.id, cap: 200 });
      total += models.length;
    }
  } else if (f.startsWith('conn:')) {
    const c = conn(f.slice(5));
    if (c) {
      const models = sortModels((state.models[c.id] || []).filter(match), c);
      html += groupHtml(c, models, { key: 'conn:' + c.id, cap: q ? 200 : 80 });
      total += models.length;
    }
  } else {
    if (!q) {
      const favs = state.settings.favorites;
      if (favs.length) {
        for (const c of conns) {
          const ids = favs.filter((k) => k.startsWith(c.id + ':')).map((k) => k.slice(c.id.length + 1));
          const models = ids.map((id) => modelInfo(c.id, id));
          if (models.length) html += groupHtml(c, models, { title: `★ Favoritos · ${c.name}`, key: 'fav:' + c.id });
        }
      }
      for (const c of conns.filter((x) => x.type === 'openrouter')) {
        const feat = P.featuredFrom(state.models[c.id] || []);
        if (feat.length) html += groupHtml(c, feat, { title: '✦ Destaques', key: 'featured:' + c.id, cap: 12 });
      }
    }
    for (const c of conns) {
      const models = sortModels((state.models[c.id] || []).filter(match), c);
      total += models.length;
      if (q && !models.length) continue;
      html += groupHtml(c, models, { key: c.id, cap: q ? 200 : 40 });
    }
  }

  if (!html) html = '<div class="picker-empty">Nenhum modelo encontrado.</div>';
  els.pickerList.innerHTML = html;

  const loading = conns.some((c) => state.modelStatus[c.id] === 'loading');
  const all = conns.reduce((n, c) => n + (state.models[c.id]?.length || 0), 0);
  els.pickerStatus.textContent = loading ? 'Carregando modelos…' : q ? `${total} resultado${total === 1 ? '' : 's'}` : `${all} modelos em ${conns.length} conex${conns.length === 1 ? 'ão' : 'ões'}`;
  const sel = $('.model-item.selected', els.pickerList);
  if (sel && !q) sel.scrollIntoView({ block: 'nearest' });
}

async function toggleFavorite(connId, modelId) {
  const key = connId + ':' + modelId;
  const favs = state.settings.favorites;
  const i = favs.indexOf(key);
  if (i >= 0) favs.splice(i, 1);
  else favs.push(key);
  await saveSettings();
  renderPicker();
  renderPickerFilters();
}

// ---------- setup ----------

function showSetup() {
  els.setup.classList.remove('hidden');
  setTimeout(() => els.setupOrKey.focus(), 50);
}
function hideSetup() {
  els.setup.classList.add('hidden');
}

async function maybeShowSetup() {
  const any = state.settings.connections.some((c) => isConfigured(c));
  if (any) return;
  if (await S.getSeenSetup()) return;
  showSetup();
}

async function setupOpenRouter() {
  const key = els.setupOrKey.value.trim();
  const st = els.setupOrStatus;
  if (!key) {
    st.className = 'tiny status err';
    st.textContent = 'Cole sua chave (começa com sk-or-).';
    return;
  }
  const c = conn('openrouter');
  c.apiKey = key;
  c.enabled = true;
  await saveSettings();
  st.className = 'tiny status';
  st.textContent = 'Verificando…';
  els.setupOrSave.disabled = true;
  const r = await P.testConnection(c);
  els.setupOrSave.disabled = false;
  c.lastTest = { ok: r.ok, message: r.message, ts: Date.now() };
  if (!r.ok) {
    c.enabled = false;
    await saveSettings();
    st.className = 'tiny status err';
    st.textContent = r.message;
    return;
  }
  await saveSettings();
  state.models.openrouter = r.models;
  state.modelStatus.openrouter = 'ok';
  await S.setModelCache('openrouter', r.models);
  st.className = 'tiny status ok';
  st.textContent = 'Conectado · ' + r.message;
  state.settings.current = { connectionId: 'openrouter', modelId: defaultModelFor('openrouter') };
  await saveSettings();
  await S.setSeenSetup(true);
  updateHeader();
  setTimeout(() => {
    hideSetup();
    toast('OpenRouter conectado!', 'ok');
    els.input.focus();
  }, 600);
}

async function setupLocal() {
  const st = els.setupLocalStatus;
  st.className = 'tiny status';
  st.textContent = 'Procurando em localhost:11434 e localhost:1234…';
  els.setupLocal.disabled = true;
  const found = await detectLocal({ force: true });
  els.setupLocal.disabled = false;
  if (!found.length) {
    st.className = 'tiny status err';
    st.textContent = 'Nenhum servidor local encontrado. Inicie o Ollama (ollama serve) ou o servidor do LM Studio e tente de novo.';
    return;
  }
  const c = found[0];
  st.className = 'tiny status ok';
  st.textContent = `${c.name} detectado · ${state.models[c.id].length} modelo${state.models[c.id].length === 1 ? '' : 's'}`;
  state.settings.current = { connectionId: c.id, modelId: defaultModelFor(c.id) };
  await saveSettings();
  await S.setSeenSetup(true);
  updateHeader();
  setTimeout(() => {
    hideSetup();
    toast(`${c.name} conectado!`, 'ok');
    els.input.focus();
  }, 600);
}

// ---------- ações pendentes (menu de contexto) ----------

async function checkPending() {
  const p = await S.getSession('pending');
  if (!p || Date.now() - p.ts > 120000) return;
  await S.clearSession('pending');
  if (p.action === 'selection' && p.text) {
    state.context = { kind: 'selection', title: p.title || '', url: p.url || '', text: p.text.slice(0, state.settings.pageContextChars || 16000) };
    renderContextBar();
    els.input.focus();
    return;
  }
  if (p.action === 'summarize') {
    await summarizePage(p.tabId);
  }
}

async function summarizePage(tabId) {
  if (state.streaming) return;
  const ctx = await grabPage({ tabId });
  if (!ctx) return;
  if (state.chat?.messages.length) startNewChat(false);
  await send('Resuma esta página em tópicos claros e objetivos. Destaque os pontos principais e, se houver, conclusões ou próximos passos.', ctx);
}

// ---------- alterações externas ----------

async function handleStorageChange(changes, area) {
  if (area === 'session' && changes.pending?.newValue) {
    checkPending();
    return;
  }
  if (area !== 'local') return;
  if (changes.settings) {
    const json = JSON.stringify(changes.settings.newValue || {});
    if (json === state.lastSettingsJson) return;
    const prev = state.settings;
    state.settings = await S.loadSettings();
    state.lastSettingsJson = JSON.stringify(state.settings);
    for (const c of state.settings.connections) {
      const old = prev.connections.find((x) => x.id === c.id);
      if (!old || old.apiKey !== c.apiKey || old.baseUrl !== c.baseUrl || old.type !== c.type) {
        delete state.models[c.id];
        delete state.modelStatus[c.id];
      }
    }
    applyTheme();
    renderEffortMenu();
    applyBrowseMode();
    if (!isConfigured(currentConn()) || !state.settings.current.modelId) await bootstrapModels();
    else {
      await ensureModels(state.settings.current.connectionId);
      updateHeader();
    }
    if (!els.picker.classList.contains('hidden')) {
      renderPickerFilters();
      renderPicker();
    }
    refreshCoop(true);
    if (state.settings.connections.some((c) => isConfigured(c))) hideSetup();
  }
  if (changes.chats && !state.streaming) {
    state.chats = await S.loadChats();
    if (state.chat) {
      const fresh = state.chats.find((c) => c.id === state.chat.id);
      if (fresh && JSON.stringify(fresh.messages) !== JSON.stringify(state.chat.messages)) {
        state.chat = fresh;
        renderMessages();
      }
    }
    renderChatList();
  }
  if (changes.modelCache) {
    const cache = changes.modelCache.newValue || {};
    for (const [id, v] of Object.entries(cache)) {
      if (v?.models?.length && state.modelStatus[id] !== 'loading') {
        state.models[id] = v.models;
        state.modelStatus[id] = 'ok';
        if (conn(id)?.local) state.localDetected[id] = true;
      }
    }
    updateHeader();
  }
}

// ---------- composer ----------

// A caixa cresce sozinha até 45% do painel; se o usuário arrastar a alça, a
// altura escolhida passa a valer (e é lembrada) até ele arrastar de novo.
function autoResize() {
  const ta = els.input;
  const manual = Number(state.settings?.composerHeight) || 0;
  if (manual >= 74) {
    ta.style.height = Math.min(manual, Math.round(window.innerHeight * 0.7)) + 'px';
    state.autoHeight = ta.offsetHeight;
    return;
  }
  ta.style.height = 'auto';
  const max = Math.max(160, Math.round(window.innerHeight * 0.45));
  ta.style.height = Math.max(74, Math.min(ta.scrollHeight, max)) + 'px';
  state.autoHeight = ta.offsetHeight;
}
window.addEventListener('resize', () => autoResize());

async function rememberManualHeight() {
  const ta = els.input;
  const h = ta.offsetHeight;
  if (!h || h === state.autoHeight) return; // não foi um arraste
  // arrastar até o mínimo devolve o modo automático
  state.settings.composerHeight = h <= 78 ? 0 : h;
  state.autoHeight = h;
  await saveSettings();
}

// ---------- eventos ----------

function bindEvents() {
  els.btnChats.addEventListener('click', openChats);
  els.chatsClose.addEventListener('click', closeChats);
  els.chatsBackdrop.addEventListener('click', closeChats);
  els.chatsNew.addEventListener('click', () => startNewChat());
  els.btnNew.addEventListener('click', () => startNewChat());
  els.chatsSearch.addEventListener('input', renderChatList);
  els.chatsSettings.addEventListener('click', openOptions);
  els.chatsOpenTab.addEventListener('click', openInTab);
  els.chatsList.addEventListener('click', async (e) => {
    const del = e.target.closest('[data-del]');
    if (del) {
      e.stopPropagation();
      if (confirm('Excluir esta conversa?')) await deleteChat(del.dataset.del);
      return;
    }
    const item = e.target.closest('.chat-item');
    if (item) loadChat(item.dataset.id);
  });

  els.modelBtn.addEventListener('click', openPicker);
  els.btnModelMini.addEventListener('click', openPicker);
  $$('[data-close="picker"]').forEach((b) => b.addEventListener('click', closePicker));
  els.pickerSearch.addEventListener('input', renderPicker);
  els.pickerFilters.addEventListener('click', (e) => {
    const b = e.target.closest('[data-filter]');
    if (!b) return;
    state.pickerFilter = b.dataset.filter;
    renderPickerFilters();
    renderPicker();
  });
  els.pickerList.addEventListener('click', (e) => {
    const star = e.target.closest('[data-fav]');
    if (star) {
      e.stopPropagation();
      const item = star.closest('.model-item');
      toggleFavorite(item.dataset.conn, item.dataset.model);
      return;
    }
    const more = e.target.closest('[data-expand]');
    if (more) {
      state.pickerExpanded.add(more.dataset.expand);
      renderPicker();
      return;
    }
    const item = e.target.closest('.model-item');
    if (item) selectModel(item.dataset.conn, item.dataset.model);
  });
  els.pickerList.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.classList.contains('model-item')) selectModel(e.target.dataset.conn, e.target.dataset.model);
  });
  els.pickerRefresh.addEventListener('click', async () => {
    els.pickerRefresh.disabled = true;
    for (const c of visibleConnections()) {
      delete state.models[c.id];
      if (c.local) state.localDetected[c.id] = false;
    }
    await S.clearModelCache();
    await loadAllModels({ force: true });
    els.pickerRefresh.disabled = false;
    updateHeader();
  });
  els.pickerSettings.addEventListener('click', openOptions);
  els.pickerSort.addEventListener('change', () => {
    state.pickerSort = els.pickerSort.value;
    state.pickerExpanded.clear();
    renderPicker();
  });

  els.btnMenu.addEventListener('click', (e) => {
    e.stopPropagation();
    els.menu.classList.toggle('hidden');
  });
  document.addEventListener('click', (e) => {
    if (!els.menu.classList.contains('hidden') && !e.target.closest('#menu')) els.menu.classList.add('hidden');
  });
  els.menu.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-menu]');
    if (!b) return;
    els.menu.classList.add('hidden');
    const act = b.dataset.menu;
    if (act === 'open-tab') openInTab();
    else if (act === 'settings') openOptions();
    else if (act === 'theme') {
      const cur = document.documentElement.dataset.theme;
      state.settings.theme = cur === 'dark' ? 'light' : 'dark';
      await saveSettings();
      applyTheme();
    } else if (act === 'copy-all') {
      if (!state.chat?.messages.length) return toast('Conversa vazia.');
      (await copyText(chatToMarkdown(state.chat))) ? toast('Conversa copiada.', 'ok') : toast('Não foi possível copiar.', 'err');
    } else if (act === 'export') {
      if (!state.chat?.messages.length) return toast('Conversa vazia.');
      download(`ai-in-browser-${(state.chat.title || 'conversa').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'conversa'}.md`, chatToMarkdown(state.chat));
    } else if (act === 'clear') {
      if (!state.chat?.messages.length) return startNewChat();
      if (confirm('Excluir esta conversa?')) await deleteChat(state.chat.id);
    }
  });

  els.messages.addEventListener('scroll', () => {
    const el = els.messages;
    const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
    state.autoScroll = gap < 80;
    els.scrollBottom.classList.toggle('hidden', gap < 140);
  });
  els.scrollBottom.addEventListener('click', () => {
    state.autoScroll = true;
    scrollToBottom(true, true);
  });

  els.messages.addEventListener('click', async (e) => {
    const zoom = e.target.closest('[data-zoom]');
    if (zoom) {
      openLightbox(zoom.src);
      return;
    }
    const copyCode = e.target.closest('.copy-code');
    if (copyCode) {
      const pre = copyCode.closest('.codeblock')?.querySelector('pre');
      if (pre && (await copyText(pre.textContent))) {
        copyCode.textContent = 'Copiado ✓';
        copyCode.classList.add('done');
        setTimeout(() => {
          copyCode.textContent = 'Copiar';
          copyCode.classList.remove('done');
        }, 1600);
      }
      return;
    }
    const sug = e.target.closest('.suggestion');
    if (sug) {
      if (sug.dataset.action === 'summarize') summarizePage();
      else {
        els.input.value = sug.dataset.prompt || '';
        autoResize();
        els.input.focus();
        els.input.setSelectionRange(els.input.value.length, els.input.value.length);
        setSendState();
      }
      return;
    }
    const act = e.target.closest('[data-act]');
    if (!act) return;
    const node = act.closest('.msg');
    const id = node?.dataset.id;
    const msg = state.chat?.messages.find((m) => m.id === id);
    if (!msg) return;
    const a = act.dataset.act;
    if (a === 'copy') {
      if (await copyText(msg.content || '')) {
        act.classList.add('done');
        setTimeout(() => act.classList.remove('done'), 1400);
      }
    } else if (a === 'regen') regenerate(id);
    else if (a === 'edit') editMessage(id);
    else if (a === 'delete') deleteMessage(id);
  });

  els.input.addEventListener('input', () => {
    autoResize();
    setSendState();
  });
  // alça no topo da caixa: arrastar ajusta a altura; clique duplo volta ao automático
  const grip = els.boxGrip;
  let dragY = 0;
  let dragH = 0;
  let dragging = false;
  grip.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    grip.setPointerCapture(e.pointerId);
    dragging = true;
    dragY = e.clientY;
    dragH = els.input.offsetHeight;
  });
  grip.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const max = Math.round(window.innerHeight * 0.7);
    els.input.style.height = Math.max(74, Math.min(max, dragH + (dragY - e.clientY))) + 'px';
  });
  const endDrag = async (e) => {
    if (!dragging) return;
    dragging = false;
    try {
      grip.releasePointerCapture(e.pointerId);
    } catch {}
    await rememberManualHeight();
  };
  grip.addEventListener('pointerup', endDrag);
  grip.addEventListener('pointercancel', endDrag);
  grip.addEventListener('dblclick', async () => {
    state.settings.composerHeight = 0;
    await saveSettings();
    autoResize();
  });
  els.input.addEventListener('keydown', (e) => {
    if (e.isComposing) return;
    const onEnter = state.settings.sendOnEnter !== false;
    if (e.key === 'Enter') {
      if (onEnter && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        send(els.input.value);
      } else if (!onEnter && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        send(els.input.value);
      }
    }
  });
  els.btnSend.addEventListener('click', () => {
    if (state.agentWaiting) send(els.input.value);
    else if (state.streaming) stopStreaming();
    else send(els.input.value);
  });
  els.btnPage.addEventListener('click', togglePageContext);
  els.contextBar.addEventListener('click', (e) => {
    if (e.target.closest('[data-clear-ctx]')) {
      state.context = null;
      renderContextBar();
      return;
    }
    const rm = e.target.closest('[data-remove-att]');
    if (rm) {
      state.attachments.splice(Number(rm.dataset.removeAtt), 1);
      renderContextBar();
      setSendState();
    }
  });

  // anexos
  els.btnAttach.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!S.HAS_CHROME) return els.fileInput.click();
    const m = document.createElement('div');
    m.className = 'menu attach-menu';
    m.style.cssText = 'top:auto;bottom:100%;margin-bottom:6px;left:12px;right:auto;';
    m.innerHTML = `<button data-a="file"><svg><use href="#i-paperclip"/></svg> Anexar imagem ou arquivo</button><button data-a="shot"><svg><use href="#i-image"/></svg> Capturar a aba atual</button>`;
    m.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-a]');
      m.remove();
      if (!b) return;
      if (b.dataset.a === 'file') els.fileInput.click();
      else attachTabCapture();
    });
    document.querySelectorAll('.attach-menu').forEach((x) => x.remove());
    document.querySelector('.composer-wrap').appendChild(m);
    const close = (ev) => {
      if (!ev.target.closest('.attach-menu')) {
        m.remove();
        document.removeEventListener('click', close);
      }
    };
    setTimeout(() => document.addEventListener('click', close), 0);
  });
  els.fileInput.addEventListener('change', async () => {
    await addFiles([...els.fileInput.files]);
    els.fileInput.value = '';
    setSendState();
  });
  els.input.addEventListener('paste', (e) => {
    const items = [...(e.clipboardData?.items || [])].filter((i) => i.kind === 'file');
    if (!items.length) return;
    e.preventDefault();
    addFiles(items.map((i) => i.getAsFile())).then(setSendState);
  });
  const composer = $('#composer');
  composer.addEventListener('dragover', (e) => {
    e.preventDefault();
    composer.classList.add('drag');
  });
  composer.addEventListener('dragleave', () => composer.classList.remove('drag'));
  composer.addEventListener('drop', (e) => {
    e.preventDefault();
    composer.classList.remove('drag');
    if (e.dataTransfer?.files?.length) addFiles([...e.dataTransfer.files]).then(setSendState);
  });

  // modo navegar, esforço, voz, parar
  els.btnBrowse.addEventListener('click', () => toggleBrowseMode());
  els.btnEffort.addEventListener('click', (e) => {
    e.stopPropagation();
    renderEffortMenu();
    els.effortMenu.classList.toggle('hidden');
  });
  els.effortMenu.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-effort]');
    if (!b) return;
    state.settings.effort = b.dataset.effort;
    await saveSettings();
    renderEffortMenu();
    els.effortMenu.classList.add('hidden');
  });
  document.addEventListener('click', (e) => {
    if (!els.effortMenu.classList.contains('hidden') && !e.target.closest('#effort-menu') && !e.target.closest('#btn-effort')) els.effortMenu.classList.add('hidden');
  });
  els.btnMic.addEventListener('click', async () => {
    if (state.rec) return stopMic();
    // O Chrome não exibe o pedido de microfone dentro do painel lateral. Em vez
    // de tentar e falhar, consulta o estado: se ainda não foi concedido, leva
    // direto às configurações, que abrem numa aba comum, onde o diálogo aparece.
    const estado = await micPermissionState();
    if (estado === 'granted' || estado === null) return startDictation();
    toast('O Chrome só pede o microfone fora do painel. Abrindo as configurações: clique em "Testar microfone" para liberar.', '', 7000);
    openOptionsAt('#behavior');
  });
  els.btnCoop.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!els.coopMenu.classList.contains('hidden')) return els.coopMenu.classList.add('hidden');
    els.effortMenu.classList.add('hidden');
    els.coopMenu.innerHTML = '<div class="coop-head"><span>Cooperação entre modelos</span><b>calculando…</b></div>';
    els.coopMenu.classList.remove('hidden');
    const rows = await coopSummary(true);
    renderCoopIndicator(rows);
    renderCoopMenu(rows);
  });
  els.coopMenu.addEventListener('click', (e) => {
    if (e.target.closest('[data-coop-config]')) {
      els.coopMenu.classList.add('hidden');
      openOptionsAt('#cooperation');
    }
  });
  document.addEventListener('click', (e) => {
    if (!els.coopMenu.classList.contains('hidden') && !e.target.closest('#coop-menu') && !e.target.closest('#btn-coop')) els.coopMenu.classList.add('hidden');
  });
  els.agentStop.addEventListener('click', () => stopStreaming());
  window.addEventListener('pagehide', () => {
    state.agent?.runner.stop();
    state.agent?.runner.browser?.detachNow?.(); // não deixa a barra de depuração presa
  });

  els.setupOrSave.addEventListener('click', setupOpenRouter);
  els.setupOrKey.addEventListener('keydown', (e) => e.key === 'Enter' && setupOpenRouter());
  els.setupLocal.addEventListener('click', setupLocal);
  els.setupSettings.addEventListener('click', async (e) => {
    e.preventDefault();
    await S.setSeenSetup(true);
    hideSetup();
    openOptions();
  });
  els.setupSkip.addEventListener('click', async (e) => {
    e.preventDefault();
    await S.setSeenSetup(true);
    hideSetup();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!els.coopMenu.classList.contains('hidden')) return els.coopMenu.classList.add('hidden');
      if (!els.picker.classList.contains('hidden')) return closePicker();
      if (!els.menu.classList.contains('hidden')) return els.menu.classList.add('hidden');
      if (els.chats.classList.contains('open')) return closeChats();
      if (state.streaming && !state.agentWaiting) return stopStreaming();
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      els.picker.classList.contains('hidden') ? openPicker() : closePicker();
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'o') {
      e.preventDefault();
      startNewChat();
    }
  });

  window.addEventListener('focus', () => checkPending());
}

// ---------- init ----------

async function init() {
  Object.assign(els, {
    app: $('#app'),
    chats: $('#chats'),
    chatsBackdrop: $('#chats-backdrop'),
    chatsClose: $('#chats-close'),
    chatsNew: $('#chats-new'),
    chatsSearch: $('#chats-search'),
    chatsList: $('#chats-list'),
    chatsSettings: $('#chats-settings'),
    chatsOpenTab: $('#chats-open-tab'),
    btnChats: $('#btn-chats'),
    modelBtn: $('#model-btn'),
    modelBadge: $('#model-badge'),
    modelName: $('#model-name'),
    modelSub: $('#model-sub'),
    btnNew: $('#btn-new'),
    btnMenu: $('#btn-menu'),
    menu: $('#menu'),
    messages: $('#messages'),
    empty: $('#empty'),
    emptySub: $('#empty-sub'),
    scrollBottom: $('#scroll-bottom'),
    contextBar: $('#context-bar'),
    input: $('#input'),
    btnPage: $('#btn-page'),
    btnModelMini: $('#btn-model-mini'),
    modelMiniName: $('#model-mini-name'),
    btnSend: $('#btn-send'),
    boxGrip: $('#box-grip'),
    btnAttach: $('#btn-attach'),
    fileInput: $('#file-input'),
    btnBrowse: $('#btn-browse'),
    btnEffort: $('#btn-effort'),
    effortLabel: $('#effort-label'),
    effortMenu: $('#effort-menu'),
    btnMic: $('#btn-mic'),
    btnCoop: $('#btn-coop'),
    coopLabel: $('#coop-label'),
    coopCount: $('#coop-count'),
    coopMenu: $('#coop-menu'),
    emptyCoop: $('#empty-coop'),
    agentStatus: $('#agent-status'),
    agentStatusText: $('#agent-status-text'),
    agentStop: $('#agent-stop'),
    picker: $('#picker'),
    pickerSearch: $('#picker-search'),
    pickerFilters: $('#picker-filters'),
    pickerList: $('#picker-list'),
    pickerStatus: $('#picker-status'),
    pickerRefresh: $('#picker-refresh'),
    pickerSettings: $('#picker-settings'),
    pickerSort: $('#picker-sort'),
    setup: $('#setup'),
    setupOrKey: $('#setup-or-key'),
    setupOrSave: $('#setup-or-save'),
    setupOrStatus: $('#setup-or-status'),
    setupLocal: $('#setup-local'),
    setupLocalStatus: $('#setup-local-status'),
    setupSettings: $('#setup-settings'),
    setupSkip: $('#setup-skip'),
    toast: $('#toast')
  });
  if (MODE === 'tab') els.app.classList.add('mode-tab');

  state.settings = await S.loadSettings();
  state.lastSettingsJson = JSON.stringify(state.settings);
  applyTheme();
  state.chats = await S.loadChats();
  bindEvents();
  els.input.title = state.settings.sendOnEnter === false ? 'Ctrl/⌘ + Enter envia' : 'Enter envia · Shift+Enter nova linha';
  renderEffortMenu();
  applyBrowseMode();

  const last = [...state.chats].sort((a, b) => b.updatedAt - a.updatedAt)[0];
  if (last && last.messages.length && Date.now() - last.updatedAt < 6 * 3600e3) loadChat(last.id);
  else startNewChat(false);
  setSendState();
  updateHeader();
  autoResize(); // aplica a altura lembrada da caixa de texto

  await detectLocal();
  await bootstrapModels();
  await maybeShowSetup();
  await checkPending();
  S.onStorageChanged(handleStorageChange);
  els.input.focus();
}

init().catch((e) => {
  console.error(e);
  toast('Erro ao iniciar: ' + (e?.message || e), 'err', 6000);
});
