// AI in Browser — página de configurações
import * as S from './lib/storage.js';
import * as P from './lib/providers.js';
import * as PERM from './lib/perms.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

let settings = null;
let saveTimer = null;
let lastSavedJson = '';

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

let toastTimer;
function toast(msg, kind = '', ms = 2800) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast ' + kind;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), ms);
}

const mq = window.matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const theme = settings.theme === 'system' ? (mq.matches ? 'dark' : 'light') : settings.theme;
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.accent = settings.accent || 'violet';
}
mq.addEventListener('change', () => settings && applyTheme());

function markSaved() {
  const el = $('#save-state');
  el.textContent = 'Salvo ✓';
  el.classList.add('saved');
  setTimeout(() => {
    el.textContent = 'Alterações salvas automaticamente';
    el.classList.remove('saved');
  }, 1600);
}

function save({ immediate = false } = {}) {
  clearTimeout(saveTimer);
  const doSave = async () => {
    lastSavedJson = JSON.stringify(settings);
    await S.saveSettings(settings);
    markSaved();
  };
  if (immediate) return doSave();
  saveTimer = setTimeout(doSave, 350);
}

// ---------- conexões ----------

function statusPill(c) {
  if (c.enabled === false) return '<span class="pill">desativada</span>';
  if (c.local) return '<span class="pill">local · sem chave</span>';
  if (c.apiKey) return '<span class="pill ok"><svg width="11" height="11"><use href="#i-check"/></svg> chave salva</span>';
  if (!c.builtin) return '<span class="pill warn">sem chave</span>';
  return '<span class="pill warn">sem chave</span>';
}

function keyLink(c) {
  const links = {
    openrouter: 'https://openrouter.ai/keys',
    openai: 'https://platform.openai.com/api-keys',
    anthropic: 'https://console.anthropic.com/settings/keys'
  };
  const url = links[c.id];
  if (!url) return '';
  return `<span class="link-row"><a href="${url}" target="_blank" rel="noopener">Obter chave ↗</a></span>`;
}

function renderConnections() {
  const list = $('#conn-list');
  list.innerHTML = settings.connections
    .map((c) => {
      const b = P.connectionBadge(c);
      const typeLabel = c.type === 'openrouter' ? 'OpenRouter' : c.type === 'anthropic' ? 'API Anthropic' : 'API compatível com OpenAI';
      return `<div class="conn${c.apiKey || c.local ? ' ok' : ''}" data-id="${esc(c.id)}">
        <div class="conn-head">
          <span class="badge" style="background:${b.color};color:${/^#(f|e)/i.test(b.color) ? '#111' : '#fff'}">${b.letter}</span>
          <div class="conn-title"><b>${esc(c.name)}</b><span class="tiny">${esc(typeLabel)} · ${esc(c.hint || c.baseUrl)}</span></div>
          ${statusPill(c)}
          <label class="switch" title="Ativar/desativar"><input type="checkbox" data-field="enabled" ${c.enabled !== false ? 'checked' : ''}><span class="track"></span></label>
        </div>
        <div class="conn-body">
          <label class="field">
            <span>Chave de API ${c.local ? '<em class="tiny">(opcional)</em>' : ''}</span>
            <div class="key-wrap">
              <input class="input" type="password" data-field="apiKey" value="${esc(c.apiKey || '')}" placeholder="${c.local ? 'não necessária' : c.type === 'anthropic' ? 'sk-ant-…' : c.type === 'openrouter' ? 'sk-or-v1-…' : 'sk-…'}" autocomplete="off" spellcheck="false">
              <button class="eye" data-eye title="Mostrar/ocultar"><svg><use href="#i-eye"/></svg></button>
            </div>
            ${keyLink(c)}
          </label>
          <label class="field">
            <span>URL base</span>
            <input class="input" data-field="baseUrl" value="${esc(c.baseUrl || '')}" spellcheck="false">
          </label>
        </div>
        <div class="conn-foot">
          <button class="btn sm" data-test>Testar conexão</button>
          ${c.builtin ? '' : '<button class="btn sm danger" data-remove><svg><use href="#i-trash"/></svg> Remover</button>'}
          <span class="status"></span>
        </div>
      </div>`;
    })
    .join('');
}

function bindConnections() {
  const list = $('#conn-list');
  list.addEventListener('input', (e) => {
    const field = e.target.dataset.field;
    if (!field) return;
    const card = e.target.closest('.conn');
    const c = settings.connections.find((x) => x.id === card.dataset.id);
    if (!c) return;
    if (field === 'enabled') c.enabled = e.target.checked;
    else c[field] = e.target.value.trim();
    card.classList.toggle('ok', !!(c.apiKey || c.local));
    const pill = card.querySelector('.pill');
    if (pill) pill.outerHTML = statusPill(c);
    save();
  });
  list.addEventListener('click', async (e) => {
    const eye = e.target.closest('[data-eye]');
    if (eye) {
      const inp = eye.parentElement.querySelector('input');
      const show = inp.type === 'password';
      inp.type = show ? 'text' : 'password';
      eye.innerHTML = `<svg><use href="#${show ? 'i-eye-off' : 'i-eye'}"/></svg>`;
      return;
    }
    const test = e.target.closest('[data-test]');
    if (test) {
      const card = test.closest('.conn');
      const c = settings.connections.find((x) => x.id === card.dataset.id);
      const st = card.querySelector('.status');
      st.className = 'status';
      st.textContent = 'Testando…';
      test.disabled = true;
      await save({ immediate: true });
      if (S.HAS_CHROME && chrome.runtime?.sendMessage) {
        try {
          await chrome.runtime.sendMessage({ type: 'sync-rules' });
        } catch {}
      }
      const r = await P.testConnection(c);
      test.disabled = false;
      st.className = 'status ' + (r.ok ? 'ok' : 'err');
      st.textContent = r.ok ? '✓ ' + r.message : '✗ ' + r.message;
      if (r.ok && r.models) await S.setModelCache(c.id, r.models);
      return;
    }
    const rm = e.target.closest('[data-remove]');
    if (rm) {
      const card = rm.closest('.conn');
      const c = settings.connections.find((x) => x.id === card.dataset.id);
      if (!confirm(`Remover a conexão "${c.name}"?`)) return;
      settings.connections = settings.connections.filter((x) => x.id !== c.id);
      if (settings.current.connectionId === c.id) settings.current = { connectionId: 'openrouter', modelId: '' };
      await S.clearModelCache(c.id);
      await save({ immediate: true });
      renderConnections();
    }
  });

  // formulário de adicionar
  const form = $('#add-form');
  const preset = $('#add-preset');
  const type = $('#add-type');
  preset.innerHTML = '<option value="">Personalizado…</option>' + P.CUSTOM_PRESETS.map((p, i) => `<option value="${i}">${esc(p.name)}</option>`).join('');
  type.innerHTML = P.PROVIDER_TYPES.filter((t) => t.id !== 'openrouter').map((t) => `<option value="${t.id}">${esc(t.label)}</option>`).join('');
  $('#add-conn').addEventListener('click', () => {
    form.classList.toggle('hidden');
    if (!form.classList.contains('hidden')) $('#add-name').focus();
  });
  $('#add-cancel').addEventListener('click', () => form.classList.add('hidden'));
  preset.addEventListener('change', () => {
    const p = P.CUSTOM_PRESETS[Number(preset.value)];
    if (!p) return;
    $('#add-name').value = p.name;
    $('#add-url').value = p.baseUrl;
    type.value = p.type;
  });
  $('#add-save').addEventListener('click', async () => {
    const name = $('#add-name').value.trim();
    const baseUrl = $('#add-url').value.trim().replace(/\/+$/, '');
    if (!name || !baseUrl) return toast('Informe nome e URL base.', 'err');
    if (!/^https?:\/\//i.test(baseUrl)) return toast('A URL base deve começar com http:// ou https://', 'err');
    const id = 'c_' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36).slice(-4);
    settings.connections.push({
      id,
      name,
      type: type.value,
      baseUrl,
      apiKey: $('#add-key').value.trim(),
      builtin: false,
      enabled: true,
      local: /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(baseUrl)
    });
    await save({ immediate: true });
    renderConnections();
    form.classList.add('hidden');
    $('#add-name').value = $('#add-url').value = $('#add-key').value = '';
    preset.value = '';
    toast(`Conexão "${name}" adicionada. Clique em "Testar conexão" para validar.`, 'ok', 4000);
  });
}

// ---------- demais campos ----------

function bindGeneral() {
  const sp = $('#system-prompt');
  sp.value = settings.systemPrompt || '';
  sp.addEventListener('input', () => {
    settings.systemPrompt = sp.value;
    save();
  });

  const temp = $('#temperature');
  temp.value = settings.temperature ?? 0.7;
  $('#temp-val').textContent = Number(temp.value).toFixed(2).replace(/0$/, '');
  temp.addEventListener('input', () => {
    settings.temperature = Number(temp.value);
    $('#temp-val').textContent = Number(temp.value).toFixed(2).replace(/0$/, '');
    save();
  });

  const mt = $('#max-tokens');
  mt.value = settings.maxTokens || '';
  mt.addEventListener('input', () => {
    settings.maxTokens = Math.max(0, parseInt(mt.value, 10) || 0);
    save();
  });

  const bindToggle = (id, key, def) => {
    const el = $(id);
    el.checked = settings[key] ?? def;
    el.addEventListener('change', () => {
      settings[key] = el.checked;
      save();
    });
  };
  // agente
  settings.agent = settings.agent || {};
  const ag = settings.agent;
  const agDbg = $('#agent-debugger');
  agDbg.checked = ag.useDebugger !== false;
  agDbg.addEventListener('change', () => {
    if (agDbg.checked) {
      // gesto do usuário: pede a permissão opcional "debugger"
      PERM.request(['debugger']).then(async (ok) => {
        ag.useDebugger = ok;
        ag.debuggerDeclined = !ok;
        agDbg.checked = ok;
        await save({ immediate: true });
        if (!ok) toast('Permissão negada. O agente continua funcionando sem o DevTools Protocol.', 'err', 5000);
      });
      return;
    }
    ag.useDebugger = false;
    PERM.remove(['debugger']);
    save();
  });
  const agJs = $('#agent-js');
  agJs.checked = ag.allowJs !== false;
  agJs.addEventListener('change', () => {
    ag.allowJs = agJs.checked;
    save();
  });

  const agHist = $('#agent-extra');
  if (agHist) {
    PERM.granted().then((g) => {
      agHist.checked = !!(g.history && g.downloads);
    });
    agHist.addEventListener('change', () => {
      if (agHist.checked) {
        PERM.request(['history', 'downloads']).then((ok) => {
          agHist.checked = ok;
          if (!ok) toast('Permissão negada.', 'err');
        });
      } else {
        PERM.remove(['history', 'downloads']);
      }
    });
  }

  const agShots = $('#agent-screenshots');
  agShots.checked = ag.screenshots !== false;
  agShots.addEventListener('change', () => {
    ag.screenshots = agShots.checked;
    save();
  });
  const agSteps = $('#agent-steps');
  agSteps.value = ag.maxSteps || 25;
  $('#steps-val').textContent = agSteps.value;
  agSteps.addEventListener('input', () => {
    ag.maxSteps = Number(agSteps.value);
    $('#steps-val').textContent = agSteps.value;
    save();
  });
  const agBlocked = $('#agent-blocked');
  agBlocked.value = (ag.blockedDomains || []).join('\n');
  agBlocked.addEventListener('input', () => {
    ag.blockedDomains = agBlocked.value.split(/[\n,;\s]+/).map((d) => d.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')).filter(Boolean);
    save();
  });
  const agPrompt = $('#agent-prompt');
  agPrompt.value = ag.systemPrompt || '';
  agPrompt.addEventListener('input', () => {
    ag.systemPrompt = agPrompt.value;
    save();
  });

  bindToggle('#streaming', 'streaming', true);
  bindToggle('#show-reasoning', 'showReasoning', true);
  bindToggle('#send-on-enter', 'sendOnEnter', true);
  bindToggle('#page-default', 'pageContextDefault', false);

  const pc = $('#page-chars');
  pc.value = settings.pageContextChars || 16000;
  pc.addEventListener('input', () => {
    settings.pageContextChars = Math.min(200000, Math.max(2000, parseInt(pc.value, 10) || 16000));
    save();
  });

  const un = $('#user-name');
  un.value = settings.userName || '';
  un.addEventListener('input', () => {
    settings.userName = un.value.trim() || 'Você';
    save();
  });
  const an = $('#assistant-name');
  an.value = settings.assistantName || '';
  an.addEventListener('input', () => {
    settings.assistantName = an.value.trim() || 'AI';
    save();
  });

  // tema
  const seg = $('#theme-seg');
  const syncSeg = () => $$('button', seg).forEach((b) => b.classList.toggle('active', b.dataset.theme === settings.theme));
  syncSeg();
  seg.addEventListener('click', (e) => {
    const b = e.target.closest('[data-theme]');
    if (!b) return;
    settings.theme = b.dataset.theme;
    syncSeg();
    applyTheme();
    save();
  });

  const sw = $('#accent-swatches');
  const syncSw = () => $$('button', sw).forEach((b) => b.classList.toggle('active', b.dataset.accent === (settings.accent || 'violet')));
  syncSw();
  sw.addEventListener('click', (e) => {
    const b = e.target.closest('[data-accent]');
    if (!b) return;
    settings.accent = b.dataset.accent;
    syncSw();
    applyTheme();
    save();
  });

  const fs = $('#font-size');
  fs.value = settings.fontSize || 14;
  $('#fs-val').textContent = fs.value + 'px';
  fs.addEventListener('input', () => {
    settings.fontSize = Number(fs.value);
    $('#fs-val').textContent = fs.value + 'px';
    save();
  });
}

// ---------- dados ----------

async function refreshChatCount() {
  const chats = await S.loadChats();
  const msgs = chats.reduce((n, c) => n + (c.messages?.length || 0), 0);
  $('#chat-count').textContent = `${chats.length} conversa${chats.length === 1 ? '' : 's'} · ${msgs} mensagens`;
}

function bindData() {
  $('#export-all').addEventListener('click', async () => {
    const data = await S.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-in-browser-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  });
  $('#import-all').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!data.settings && !data.chats) throw new Error('Arquivo inválido');
      if (!confirm('Importar irá substituir as configurações e conversas atuais. Continuar?')) return;
      await S.importAll(data);
      settings = await S.loadSettings();
      applyTheme();
      renderConnections();
      bindGeneralValues();
      await refreshChatCount();
      toast('Backup importado.', 'ok');
    } catch (err) {
      toast('Não foi possível importar: ' + err.message, 'err');
    }
    e.target.value = '';
  });
  $('#clear-cache').addEventListener('click', async () => {
    await S.clearModelCache();
    toast('Cache de modelos limpo.', 'ok');
  });
  $('#clear-chats').addEventListener('click', async () => {
    if (!confirm('Apagar TODAS as conversas? Isso não pode ser desfeito.')) return;
    await S.clearAllChats();
    await refreshChatCount();
    toast('Conversas apagadas.', 'ok');
  });
}

function bindGeneralValues() {
  $('#system-prompt').value = settings.systemPrompt || '';
  $('#temperature').value = settings.temperature ?? 0.7;
  $('#temp-val').textContent = Number(settings.temperature ?? 0.7).toFixed(2).replace(/0$/, '');
  $('#max-tokens').value = settings.maxTokens || '';
  $('#streaming').checked = settings.streaming !== false;
  $('#show-reasoning').checked = settings.showReasoning !== false;
  $('#send-on-enter').checked = settings.sendOnEnter !== false;
  $('#page-default').checked = !!settings.pageContextDefault;
  $('#page-chars').value = settings.pageContextChars || 16000;
  $('#user-name').value = settings.userName || '';
  $('#assistant-name').value = settings.assistantName || '';
  $('#font-size').value = settings.fontSize || 14;
  $('#fs-val').textContent = (settings.fontSize || 14) + 'px';
  const ag = settings.agent || {};
  $('#agent-debugger').checked = ag.useDebugger !== false;
  $('#agent-screenshots').checked = ag.screenshots !== false;
  $('#agent-steps').value = ag.maxSteps || 25;
  $('#steps-val').textContent = ag.maxSteps || 25;
  $('#agent-js').checked = ag.allowJs !== false;
  $('#agent-blocked').value = (ag.blockedDomains || []).join('\n');
  $('#agent-prompt').value = ag.systemPrompt || '';
  $$('#theme-seg button').forEach((b) => b.classList.toggle('active', b.dataset.theme === settings.theme));
  $$('#accent-swatches button').forEach((b) => b.classList.toggle('active', b.dataset.accent === (settings.accent || 'violet')));
}

// ---------- navegação ----------

function bindNav() {
  const links = $$('.nav-link');
  const sections = links.map((l) => $(l.getAttribute('href')));
  const onScroll = () => {
    const y = window.scrollY + 120;
    let active = 0;
    sections.forEach((s, i) => {
      if (s && s.offsetTop <= y) active = i;
    });
    links.forEach((l, i) => l.classList.toggle('active', i === active));
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  links.forEach((l) =>
    l.addEventListener('click', (e) => {
      e.preventDefault();
      $(l.getAttribute('href'))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.replaceState(null, '', l.getAttribute('href'));
    })
  );
  if (location.hash) $(location.hash)?.scrollIntoView();

  $('#open-chat').addEventListener('click', () => {
    if (S.HAS_CHROME && chrome.tabs?.create) chrome.tabs.create({ url: chrome.runtime.getURL('sidepanel.html?mode=tab') });
    else window.open('sidepanel.html?mode=tab', '_blank');
  });
  $('#shortcuts-link').addEventListener('click', (e) => {
    e.preventDefault();
    if (S.HAS_CHROME && chrome.tabs?.create) chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
    else toast('Abra chrome://extensions/shortcuts no navegador.');
  });
}

// ---------- init ----------

async function init() {
  settings = await S.loadSettings();
  lastSavedJson = JSON.stringify(settings);
  applyTheme();
  try {
    if (S.HAS_CHROME && chrome.runtime?.getManifest) $('#version').textContent = 'v' + chrome.runtime.getManifest().version;
  } catch {}
  renderConnections();
  bindConnections();
  bindGeneral();
  bindData();
  bindNav();
  await refreshChatCount();

  S.onStorageChanged(async (changes, area) => {
    if (area !== 'local' || !changes.settings) return;
    const json = JSON.stringify(changes.settings.newValue || {});
    if (json === lastSavedJson) return;
    // alteração vinda do chat (modelo atual, favoritos…): mescla sem sobrescrever o que está sendo editado
    const fresh = await S.loadSettings();
    settings.current = fresh.current;
    settings.favorites = fresh.favorites;
    settings.lastModelByConnection = fresh.lastModelByConnection;
    if (fresh.theme !== settings.theme) {
      settings.theme = fresh.theme;
      applyTheme();
      bindGeneralValues();
    }
    lastSavedJson = JSON.stringify(settings);
  });
}

init().catch((e) => {
  console.error(e);
  toast('Erro ao carregar: ' + (e?.message || e), 'err', 6000);
});
