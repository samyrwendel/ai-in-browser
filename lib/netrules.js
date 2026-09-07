// AI in Browser — regras de rede para servidores locais/personalizados
//
// O Chrome envia o cabeçalho Origin (chrome-extension://…) em requisições POST
// feitas pela extensão. Servidores que filtram origem, como o Ollama, recusam
// com 403 a menos que o usuário configure OLLAMA_ORIGINS. Em vez de exigir isso,
// removemos o Origin apenas nas requisições da própria extensão para as URLs
// base configuradas, usando declarativeNetRequest. Nada muda para os sites.

export const RULE_BASE = 7000;
const RULE_SPAN = 1000;
const OFFICIAL = /(^|\.)(openrouter\.ai|api\.openai\.com|api\.anthropic\.com)$/i;

export function originFor(baseUrl) {
  try {
    const u = new URL(String(baseUrl || '').trim());
    if (!/^https?:$/.test(u.protocol)) return null;
    return u.origin;
  } catch {
    return null;
  }
}

export function buildOriginRules(connections, extensionId) {
  const rules = [];
  const seen = new Set();
  for (const c of connections || []) {
    if (!c || c.enabled === false || c.type !== 'openai') continue;
    const origin = originFor(c.baseUrl);
    if (!origin || seen.has(origin)) continue;
    let host = '';
    try {
      host = new URL(origin).hostname;
    } catch {}
    if (OFFICIAL.test(host)) continue;
    seen.add(origin);
    const rule = {
      id: RULE_BASE + rules.length,
      priority: 1,
      action: { type: 'modifyHeaders', requestHeaders: [{ header: 'Origin', operation: 'remove' }] },
      condition: { urlFilter: '|' + origin + '/', resourceTypes: ['xmlhttprequest'] }
    };
    if (extensionId) rule.condition.initiatorDomains = [extensionId];
    rules.push(rule);
    if (rules.length >= RULE_SPAN) break;
  }
  return rules;
}

export async function syncOriginRules(connections) {
  const api = typeof chrome !== 'undefined' ? chrome.declarativeNetRequest : null;
  if (!api?.updateDynamicRules) return { ok: false, reason: 'api indisponível' };
  const existing = await api.getDynamicRules();
  const removeRuleIds = existing.filter((r) => r.id >= RULE_BASE && r.id < RULE_BASE + RULE_SPAN).map((r) => r.id);
  const extId = chrome.runtime?.id || null;
  let addRules = buildOriginRules(connections, extId);
  try {
    await api.updateDynamicRules({ removeRuleIds, addRules });
    return { ok: true, count: addRules.length, scoped: !!extId };
  } catch (e) {
    // Se o Chrome recusar o filtro de iniciador, aplica só pela URL.
    console.warn('[netrules] regra com initiatorDomains recusada, aplicando por URL:', e?.message || e);
    addRules = buildOriginRules(connections, null);
    await api.updateDynamicRules({ removeRuleIds, addRules });
    return { ok: true, count: addRules.length, scoped: false };
  }
}
