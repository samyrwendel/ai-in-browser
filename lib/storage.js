// AI in Browser — camada de armazenamento
// Usa chrome.storage.local dentro da extensão e localStorage como fallback
// (permite abrir as páginas em um servidor comum para desenvolvimento).

export const HAS_CHROME = typeof chrome !== 'undefined' && !!chrome?.storage?.local;

const KEY_SETTINGS = 'settings';
const KEY_CHATS = 'chats';
const KEY_MODEL_CACHE = 'modelCache';
const KEY_SEEN_SETUP = 'seenSetup';

export const BUILTIN_CONNECTIONS = [
  {
    id: 'openrouter',
    type: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKey: '',
    builtin: true,
    enabled: false,
    hint: 'Uma chave, centenas de modelos (Claude, GPT, Gemini, DeepSeek, Llama…)'
  },
  {
    id: 'openai',
    type: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    builtin: true,
    enabled: false,
    hint: 'Chave da plataforma OpenAI (GPT-5, GPT-4.1, o-series)'
  },
  {
    id: 'anthropic',
    type: 'anthropic',
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    apiKey: '',
    builtin: true,
    enabled: false,
    hint: 'Chave do console Anthropic (Claude Sonnet, Opus, Haiku)'
  },
  {
    id: 'ollama',
    type: 'openai',
    name: 'Ollama (local)',
    baseUrl: 'http://localhost:11434/v1',
    apiKey: '',
    builtin: true,
    enabled: false,
    local: true,
    hint: 'Detectado automaticamente quando o Ollama está rodando'
  },
  {
    id: 'lmstudio',
    type: 'openai',
    name: 'LM Studio (local)',
    baseUrl: 'http://localhost:1234/v1',
    apiKey: '',
    builtin: true,
    enabled: false,
    local: true,
    hint: 'Ative o servidor local no LM Studio (porta 1234)'
  }
];

export const DEFAULT_SETTINGS = {
  version: 2,
  connections: BUILTIN_CONNECTIONS.map((c) => ({ ...c })),
  current: { connectionId: 'openrouter', modelId: '' },
  lastModelByConnection: {},
  favorites: [],
  systemPrompt:
    'Você é um assistente útil, direto e preciso. Responda no idioma do usuário. Use Markdown quando ajudar na leitura (listas, código, tabelas).',
  temperature: 0.7,
  maxTokens: 0,
  streaming: true,
  theme: 'system',
  accent: 'violet',
  fontSize: 14,
  sendOnEnter: true,
  pageContextDefault: false,
  pageContextChars: 16000,
  showReasoning: true,
  userName: 'Você',
  assistantName: 'AI',
  effort: 'auto',
  browseMode: true,
  agent: {
    maxSteps: 25,
    useDebugger: true,
    screenshots: true,
    confirmSensitive: true,
    allowJs: true,
    blockedDomains: [],
    systemPrompt: ''
  }
};

// ---------- primitivas ----------

async function getRaw(key) {
  if (HAS_CHROME) {
    const r = await chrome.storage.local.get(key);
    return r[key];
  }
  try {
    const v = localStorage.getItem('prism:' + key);
    return v ? JSON.parse(v) : undefined;
  } catch {
    return undefined;
  }
}

async function setRaw(key, value) {
  if (HAS_CHROME) {
    await chrome.storage.local.set({ [key]: value });
    return;
  }
  localStorage.setItem('prism:' + key, JSON.stringify(value));
}

async function removeRaw(key) {
  if (HAS_CHROME) {
    await chrome.storage.local.remove(key);
    return;
  }
  localStorage.removeItem('prism:' + key);
}

// ---------- settings ----------

function mergeConnections(saved) {
  const byId = new Map((saved || []).map((c) => [c.id, c]));
  const merged = BUILTIN_CONNECTIONS.map((b) => ({ ...b, ...(byId.get(b.id) || {}), builtin: true }));
  for (const c of saved || []) {
    if (!merged.find((m) => m.id === c.id)) merged.push({ ...c, builtin: false });
  }
  return merged;
}

export async function loadSettings() {
  const saved = (await getRaw(KEY_SETTINGS)) || {};
  const s = { ...DEFAULT_SETTINGS, ...saved };
  s.connections = mergeConnections(saved.connections);
  s.current = { ...DEFAULT_SETTINGS.current, ...(saved.current || {}) };
  s.favorites = Array.isArray(saved.favorites) ? saved.favorites : [];
  s.lastModelByConnection = saved.lastModelByConnection || {};
  s.agent = { ...DEFAULT_SETTINGS.agent, ...(saved.agent || {}) };
  if (s.assistantName === 'Prism' || s.assistantName === 'LLM') s.assistantName = 'AI';
  if (!Array.isArray(s.agent.blockedDomains)) s.agent.blockedDomains = [];
  // v2: provedores começam desativados; só ficam ativos quando configurados ou detectados
  if ((saved.version || 1) < 2) {
    for (const c of s.connections) {
      if (!c.builtin || c.apiKey || c.id === s.current?.connectionId) continue;
      c.enabled = false;
    }
    s.version = 2;
    await setRaw(KEY_SETTINGS, s);
  }
  return s;
}

export async function saveSettings(settings) {
  await setRaw(KEY_SETTINGS, settings);
}

export async function updateSettings(patch) {
  const s = await loadSettings();
  const next = { ...s, ...patch };
  await saveSettings(next);
  return next;
}

// ---------- chats ----------

export async function loadChats() {
  const chats = (await getRaw(KEY_CHATS)) || [];
  return Array.isArray(chats) ? chats : [];
}

export async function saveChats(chats) {
  // mantém as 200 conversas mais recentes
  const trimmed = [...chats].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 200);
  await setRaw(KEY_CHATS, trimmed);
  return trimmed;
}

export function newChat(connectionId, modelId) {
  const now = Date.now();
  return {
    id: 'c_' + now.toString(36) + Math.random().toString(36).slice(2, 7),
    title: '',
    createdAt: now,
    updatedAt: now,
    connectionId,
    modelId,
    messages: []
  };
}

// ---------- cache de modelos ----------

export async function getModelCache() {
  return (await getRaw(KEY_MODEL_CACHE)) || {};
}

export async function setModelCache(connectionId, models) {
  const cache = await getModelCache();
  cache[connectionId] = { ts: Date.now(), models };
  await setRaw(KEY_MODEL_CACHE, cache);
}

export async function clearModelCache(connectionId) {
  const cache = await getModelCache();
  if (connectionId) delete cache[connectionId];
  await setRaw(KEY_MODEL_CACHE, connectionId ? cache : {});
}

// ---------- diversos ----------

export async function getSeenSetup() {
  return !!(await getRaw(KEY_SEEN_SETUP));
}

export async function setSeenSetup(v) {
  await setRaw(KEY_SEEN_SETUP, !!v);
}

export async function getSession(key) {
  if (HAS_CHROME && chrome.storage.session) {
    const r = await chrome.storage.session.get(key);
    return r[key];
  }
  try {
    const v = sessionStorage.getItem('prism:' + key);
    return v ? JSON.parse(v) : undefined;
  } catch {
    return undefined;
  }
}

export async function clearSession(key) {
  if (HAS_CHROME && chrome.storage.session) {
    await chrome.storage.session.remove(key);
    return;
  }
  sessionStorage.removeItem('prism:' + key);
}

export function onStorageChanged(cb) {
  if (HAS_CHROME) {
    chrome.storage.onChanged.addListener((changes, area) => cb(changes, area));
  } else {
    window.addEventListener('storage', () => cb({}, 'local'));
  }
}

export async function exportAll() {
  return {
    exportedAt: new Date().toISOString(),
    settings: await loadSettings(),
    chats: await loadChats()
  };
}

export async function importAll(data) {
  if (data?.settings) await saveSettings(data.settings);
  if (Array.isArray(data?.chats)) await saveChats(data.chats);
}

export async function clearAllChats() {
  await removeRaw(KEY_CHATS);
}
