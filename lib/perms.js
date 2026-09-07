// AI in Browser — permissões opcionais
// history e downloads não são pedidas na instalação: a extensão só solicita
// quando o recurso é realmente usado. (O Chrome não permite declarar
// "debugger" como opcional; ela é obrigatória no manifest.)

const API = typeof chrome !== 'undefined' && chrome?.permissions ? chrome.permissions : null;

export const OPTIONAL = ['history', 'downloads'];

export const LABELS = {
  history: 'Histórico de navegação',
  downloads: 'Downloads'
};

export async function has(perm) {
  if (!API) return false;
  try {
    return await API.contains({ permissions: [perm] });
  } catch {
    return false;
  }
}

export async function granted() {
  if (!API) return { debugger: true, history: true, downloads: true, unavailable: true };
  const out = { debugger: typeof chrome !== 'undefined' && !!chrome.debugger };
  await Promise.all(OPTIONAL.map(async (p) => (out[p] = await has(p))));
  return out;
}

// Precisa ser chamado a partir de um gesto do usuário (clique).
export async function request(perms) {
  if (!API) return false;
  try {
    return await API.request({ permissions: Array.isArray(perms) ? perms : [perms] });
  } catch (e) {
    console.warn('[perms] request falhou', e);
    return false;
  }
}

export async function remove(perms) {
  if (!API) return false;
  try {
    return await API.remove({ permissions: Array.isArray(perms) ? perms : [perms] });
  } catch {
    return false;
  }
}
