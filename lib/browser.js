// AI in Browser — controlador do navegador (o "Playwright dentro do Chrome")
// Observa e age em abas reais usando chrome.tabs, chrome.scripting e, quando
// disponível, o Chrome DevTools Protocol via chrome.debugger (eventos confiáveis,
// capturas, código-fonte, console, rede e execução de JS sem restrição de CSP).

export const HAS_CHROME = typeof chrome !== 'undefined' && !!chrome?.tabs && !!chrome?.scripting;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ============================================================
// Scripts injetados na página (precisam ser auto-contidos)
// ============================================================

function pageStateScript(opts) {
  const maxElements = (opts && opts.maxElements) || 220;
  const maxText = (opts && opts.maxText) || 3000;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const SEL =
    'a[href], button, input, select, textarea, summary, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="checkbox"], [role="radio"], [role="combobox"], [role="option"], [role="switch"], [role="textbox"], [role="searchbox"], [role="slider"], [contenteditable=""], [contenteditable="true"], [onclick], [tabindex]:not([tabindex="-1"]), label[for], video, audio';

  function isVisible(el) {
    const st = getComputedStyle(el);
    if (st.visibility === 'hidden' || st.display === 'none' || st.pointerEvents === 'none' && el.tagName !== 'LABEL') return false;
    if (parseFloat(st.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    if (r.bottom < -vh * 1.5 || r.top > vh * 2.5) return false;
    return true;
  }
  function collect(root, out) {
    let nodes;
    try {
      nodes = root.querySelectorAll(SEL);
    } catch (e) {
      return;
    }
    for (const el of nodes) {
      if (out.length >= maxElements * 3) return;
      if (el.closest('#__prism_overlay')) continue;
      if (isVisible(el)) out.push(el);
    }
    // shadow roots abertos
    let all;
    try {
      all = root.querySelectorAll('*');
    } catch (e) {
      return;
    }
    for (const el of all) {
      if (el.shadowRoot) collect(el.shadowRoot, out);
      if (out.length >= maxElements * 3) return;
    }
  }
  const raw = [];
  collect(document, raw);
  // remove aninhados redundantes (ex.: <a><button>) mantendo o mais interno com texto
  const set = new Set(raw);
  const els = raw.filter((el) => {
    let p = el.parentElement;
    let depth = 0;
    while (p && depth < 2) {
      if (set.has(p)) {
        const r1 = el.getBoundingClientRect();
        const r2 = p.getBoundingClientRect();
        if (Math.abs(r1.width - r2.width) < 6 && Math.abs(r1.height - r2.height) < 6) return false;
      }
      p = p.parentElement;
      depth++;
    }
    return true;
  });
  window.__prismEls = els;

  function clean(s) {
    return (s || '').replace(/\s+/g, ' ').trim();
  }
  function label(el) {
    const tag = el.tagName;
    let t = '';
    if (tag === 'INPUT') {
      const type = (el.type || '').toLowerCase();
      if (type === 'submit' || type === 'button' || type === 'reset') t = el.value;
    }
    if (!t && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') t = clean(el.innerText || el.textContent);
    if (!t) t = clean(el.getAttribute('aria-label'));
    if (!t) {
      const lab = el.labels && el.labels[0];
      if (lab) t = clean(lab.innerText);
    }
    if (!t) {
      const img = el.tagName === 'IMG' ? el : el.querySelector('img[alt]');
      if (img) t = clean(img.getAttribute('alt'));
    }
    if (!t) t = clean(el.getAttribute('title'));
    if (!t && el.getAttribute('aria-labelledby')) {
      const ref = document.getElementById(el.getAttribute('aria-labelledby'));
      if (ref) t = clean(ref.innerText);
    }
    return t.slice(0, 90);
  }
  const items = els.slice(0, maxElements).map((el, i) => {
    const r = el.getBoundingClientRect();
    const tag = el.tagName.toLowerCase();
    const it = { i, tag, text: label(el) };
    const type = el.getAttribute('type');
    if (type && tag === 'input') it.type = type.toLowerCase();
    const role = el.getAttribute('role');
    if (role) it.role = role;
    const name = el.getAttribute('name');
    if (name) it.name = name.slice(0, 40);
    if (el.id) it.id = el.id.slice(0, 40);
    const ph = el.getAttribute('placeholder');
    if (ph) it.placeholder = clean(ph).slice(0, 60);
    if ((tag === 'input' && !/^(submit|button|reset|checkbox|radio|password|hidden|file)$/.test(it.type || 'text')) || tag === 'textarea') {
      if (el.value) it.value = String(el.value).slice(0, 60);
    }
    if (tag === 'select') {
      const opt = el.options && el.options[el.selectedIndex];
      if (opt) it.value = clean(opt.textContent).slice(0, 40);
      it.options = el.options ? el.options.length : 0;
    }
    if (tag === 'a' && el.href) {
      try {
        const u = new URL(el.href);
        it.href = (u.origin === location.origin ? u.pathname + u.search : el.href).slice(0, 80);
      } catch (e) {}
    }
    if (tag === 'input' && (it.type === 'checkbox' || it.type === 'radio')) it.checked = !!el.checked;
    if (role === 'checkbox' || role === 'switch' || role === 'tab') {
      const a = el.getAttribute('aria-checked') || el.getAttribute('aria-selected');
      if (a != null) it.checked = a === 'true';
    }
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') it.disabled = true;
    if (el.isContentEditable) it.editable = true;
    it.inViewport = r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw;
    return it;
  });

  let text = '';
  try {
    text = (document.body.innerText || '').replace(/\u00a0/g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  } catch (e) {}
  const doc = document.documentElement;
  return {
    url: location.href,
    title: document.title,
    viewport: { w: vw, h: vh },
    scroll: { y: Math.round(window.scrollY), max: Math.max(0, Math.round(doc.scrollHeight - vh)) },
    items,
    total: els.length,
    textExcerpt: text.slice(0, maxText),
    textLength: text.length
  };
}

function pageActionScript(action, p) {
  p = p || {};
  function target() {
    if (p.selector) {
      const el = document.querySelector(p.selector);
      if (!el) throw new Error('Nenhum elemento corresponde ao seletor ' + p.selector);
      return el;
    }
    if (p.index == null) throw new Error('Informe index ou selector');
    const els = window.__prismEls || [];
    const el = els[p.index];
    if (!el) throw new Error('Elemento [' + p.index + '] não existe. Chame get_page_state para obter índices atualizados.');
    if (!el.isConnected) throw new Error('Elemento [' + p.index + '] não está mais na página. Chame get_page_state.');
    return el;
  }
  function describe(el) {
    return '<' + el.tagName.toLowerCase() + '> ' + ((el.innerText || el.value || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 60));
  }
  function center(el) {
    el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  function setValue(el, value) {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    const d = Object.getOwnPropertyDescriptor(proto, 'value');
    if (d && d.set) d.set.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  try {
    switch (action) {
      case 'locate': {
        const el = target();
        const c = center(el);
        return { ok: true, x: c.x, y: c.y, desc: describe(el), tag: el.tagName.toLowerCase(), editable: el.isContentEditable };
      }
      case 'click': {
        const el = target();
        center(el);
        if (el.focus) el.focus({ preventScroll: true });
        if (p.double) el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
        else el.click();
        return { ok: true, desc: describe(el) };
      }
      case 'focus': {
        const el = target();
        center(el);
        if (el.focus) el.focus({ preventScroll: true });
        if (p.clear) {
          if (el.isContentEditable) {
            const sel = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(el);
            sel.removeAllRanges();
            sel.addRange(range);
          } else if ('value' in el) setValue(el, '');
        }
        return { ok: true, desc: describe(el), editable: el.isContentEditable };
      }
      case 'type': {
        const el = target();
        center(el);
        if (el.focus) el.focus({ preventScroll: true });
        if (el.isContentEditable) {
          if (p.clear) el.textContent = '';
          const done = document.execCommand && document.execCommand('insertText', false, p.text);
          if (!done) el.textContent += p.text;
          el.dispatchEvent(new Event('input', { bubbles: true }));
        } else if ('value' in el) {
          setValue(el, p.clear ? p.text : (el.value || '') + p.text);
        } else throw new Error('Elemento não é editável: ' + describe(el));
        if (p.pressEnter) {
          const ev = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
          const cancelled = !el.dispatchEvent(new KeyboardEvent('keydown', ev));
          el.dispatchEvent(new KeyboardEvent('keypress', ev));
          el.dispatchEvent(new KeyboardEvent('keyup', ev));
          if (!cancelled && el.form) {
            if (el.form.requestSubmit) el.form.requestSubmit();
            else el.form.submit();
          }
        }
        return { ok: true, desc: describe(el), value: ('value' in el ? el.value : el.textContent || '').slice(0, 80) };
      }
      case 'key': {
        const el = document.activeElement || document.body;
        const key = p.key;
        const ev = { key, code: p.code || key, keyCode: p.vk || 0, which: p.vk || 0, bubbles: true, cancelable: true, ctrlKey: !!p.ctrl, metaKey: !!p.meta, shiftKey: !!p.shift, altKey: !!p.alt };
        const cancelled = !el.dispatchEvent(new KeyboardEvent('keydown', ev));
        el.dispatchEvent(new KeyboardEvent('keyup', ev));
        if (key === 'Enter' && !cancelled && el.form && el.tagName !== 'TEXTAREA') {
          if (el.form.requestSubmit) el.form.requestSubmit();
          else el.form.submit();
        }
        if (key === 'Tab' && !cancelled) {
          const f = Array.from(document.querySelectorAll('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])')).filter((x) => !x.disabled && x.getBoundingClientRect().width > 0);
          const i = f.indexOf(el);
          const next = f[(i + (p.shift ? -1 : 1) + f.length) % f.length];
          if (next) next.focus();
        }
        return { ok: true, focused: describe(document.activeElement || document.body) };
      }
      case 'select': {
        const el = target();
        if (el.tagName !== 'SELECT') throw new Error('Elemento não é um <select>: ' + describe(el));
        const opts = Array.from(el.options);
        let opt = null;
        if (p.value != null) opt = opts.find((o) => o.value === String(p.value));
        if (!opt && p.label != null) {
          const l = String(p.label).trim().toLowerCase();
          opt = opts.find((o) => o.textContent.trim().toLowerCase() === l) || opts.find((o) => o.textContent.trim().toLowerCase().includes(l));
        }
        if (!opt) throw new Error('Opção não encontrada. Opções: ' + opts.map((o) => o.textContent.trim()).slice(0, 30).join(' | '));
        setValue(el, opt.value);
        return { ok: true, selected: opt.textContent.trim() };
      }
      case 'scroll': {
        if (p.index != null || p.selector) {
          const el = target();
          el.scrollIntoView({ block: 'center', behavior: 'instant' });
        } else {
          const amt = p.amount || Math.round(window.innerHeight * 0.85);
          if (p.direction === 'top') window.scrollTo({ top: 0, behavior: 'instant' });
          else if (p.direction === 'bottom') window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
          else window.scrollBy({ top: p.direction === 'up' ? -amt : amt, behavior: 'instant' });
        }
        const doc = document.documentElement;
        return { ok: true, y: Math.round(window.scrollY), max: Math.max(0, Math.round(doc.scrollHeight - window.innerHeight)) };
      }
      case 'hover': {
        const el = target();
        const c = center(el);
        for (const t of ['pointerover', 'pointerenter', 'mouseover', 'mouseenter', 'mousemove']) el.dispatchEvent(new MouseEvent(t, { bubbles: t !== 'mouseenter' && t !== 'pointerenter', clientX: c.x, clientY: c.y }));
        return { ok: true, desc: describe(el), x: c.x, y: c.y };
      }
      case 'text': {
        const t = (document.body.innerText || '').replace(/\u00a0/g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
        return { ok: true, text: t.slice(p.offset || 0, (p.offset || 0) + (p.max || 8000)), total: t.length };
      }
      case 'html': {
        let node = p.selector ? document.querySelector(p.selector) : document.documentElement;
        if (!node) throw new Error('Nenhum elemento corresponde ao seletor ' + p.selector);
        let html = node.outerHTML;
        if (p.strip) html = html.replace(/<script\b[\s\S]*?<\/script>/gi, '<script></script>').replace(/<style\b[\s\S]*?<\/style>/gi, '<style></style>').replace(/<svg\b[\s\S]*?<\/svg>/gi, '<svg/>').replace(/\s(?:data-[\w-]+|style)="[^"]*"/g, '');
        return { ok: true, html: html.slice(p.offset || 0, (p.offset || 0) + (p.max || 15000)), total: html.length };
      }
      case 'check': {
        if (p.selector && document.querySelector(p.selector)) return { ok: true, found: true };
        if (p.text && (document.body.innerText || '').toLowerCase().includes(String(p.text).toLowerCase())) return { ok: true, found: true };
        return { ok: true, found: false };
      }
      case 'info': {
        return { ok: true, url: location.href, title: document.title, ready: document.readyState };
      }
      default:
        throw new Error('Ação desconhecida: ' + action);
    }
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e) };
  }
}

function overlayScript(on) {
  const ID = '__prism_overlay';
  const old = document.getElementById(ID);
  if (old) old.remove();
  if (!on) return 0;
  const els = window.__prismEls || [];
  const box = document.createElement('div');
  box.id = ID;
  box.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647;';
  const colors = ['#f43f5e', '#8b5cf6', '#0ea5e9', '#f59e0b', '#10b981', '#3b82f6', '#ec4899'];
  let n = 0;
  els.forEach((el, i) => {
    if (!el.isConnected) return;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return;
    const c = colors[i % colors.length];
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;left:' + r.left + 'px;top:' + r.top + 'px;width:' + r.width + 'px;height:' + r.height + 'px;border:2px solid ' + c + ';box-sizing:border-box;border-radius:3px;';
    const l = document.createElement('span');
    l.textContent = String(i);
    l.style.cssText = 'position:absolute;left:-2px;top:-15px;background:' + c + ';color:#fff;font:700 10px/13px system-ui,sans-serif;padding:0 3px;border-radius:3px;white-space:nowrap;';
    if (r.top < 16) l.style.top = '0';
    d.appendChild(l);
    box.appendChild(d);
    n++;
  });
  document.documentElement.appendChild(box);
  return n;
}

function mainWorldEval(code) {
  try {
    const v = new Function('return (' + code + ')')();
    const out = v && typeof v.then === 'function' ? '[Promise]' : v;
    return { ok: true, value: JSON.parse(JSON.stringify(out === undefined ? null : out)) };
  } catch (e) {
    try {
      const v = new Function(code)();
      return { ok: true, value: JSON.parse(JSON.stringify(v === undefined ? null : v)) };
    } catch (e2) {
      return { ok: false, error: String((e2 && e2.message) || e2) };
    }
  }
}

// ============================================================
// Buffers do DevTools Protocol (console / rede)
// ============================================================

const cdpBuffers = new Map(); // tabId -> { console: [], net: Map }
const cdpAttached = new Set();

let cdpListenersReady = false;

function ensureCdpListeners() {
  // registrado sob demanda: evita registrar listeners em páginas que nunca
  // usam o depurador e tolera chrome.debugger ausente (fora da extensão).
  if (cdpListenersReady || !HAS_CHROME || !chrome.debugger) return;
  cdpListenersReady = true;
  chrome.debugger.onEvent.addListener((source, method, params) => {
    const b = cdpBuffers.get(source.tabId);
    if (!b) return;
    const push = (e) => {
      b.console.push({ ts: Date.now(), ...e });
      if (b.console.length > 300) b.console.splice(0, b.console.length - 300);
    };
    if (method === 'Runtime.consoleAPICalled') {
      push({ type: params.type, text: (params.args || []).map((a) => (a.value !== undefined ? (typeof a.value === 'string' ? a.value : JSON.stringify(a.value)) : a.description || a.type)).join(' ') });
    } else if (method === 'Runtime.exceptionThrown') {
      const d = params.exceptionDetails || {};
      push({ type: 'error', text: (d.exception && d.exception.description) || d.text || 'Exceção' });
    } else if (method === 'Log.entryAdded') {
      const e = params.entry || {};
      push({ type: e.level, text: e.text + (e.url ? ' (' + e.url + ')' : ''), source: e.source });
    } else if (method === 'Network.requestWillBeSent') {
      b.net.set(params.requestId, { ts: Date.now(), method: params.request.method, url: params.request.url, type: params.type });
      if (b.net.size > 400) b.net.delete(b.net.keys().next().value);
    } else if (method === 'Network.responseReceived') {
      const r = b.net.get(params.requestId);
      if (r) {
        r.status = params.response.status;
        r.mime = params.response.mimeType;
        r.ms = Date.now() - r.ts;
      }
    } else if (method === 'Network.loadingFailed') {
      const r = b.net.get(params.requestId);
      if (r) r.error = params.errorText;
    }
  });
  chrome.debugger.onDetach.addListener((source) => {
    cdpAttached.delete(source.tabId);
  });
}

// ============================================================
// Utilidades
// ============================================================

export async function downscale(dataUrl, maxW, maxH, quality = 0.72) {
  const blob = await (await fetch(dataUrl)).blob();
  const bmp = await createImageBitmap(blob);
  const scale = Math.min(1, maxW / bmp.width, maxH / bmp.height);
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = new OffscreenCanvas(w, h);
  canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
  const out = await canvas.convertToBlob({ type: 'image/jpeg', quality });
  const buf = await out.arrayBuffer();
  let bin = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return { data: btoa(bin), width: w, height: h };
}

const KEYS = {
  enter: { key: 'Enter', code: 'Enter', vk: 13, text: '\r' },
  return: { key: 'Enter', code: 'Enter', vk: 13, text: '\r' },
  tab: { key: 'Tab', code: 'Tab', vk: 9 },
  escape: { key: 'Escape', code: 'Escape', vk: 27 },
  esc: { key: 'Escape', code: 'Escape', vk: 27 },
  backspace: { key: 'Backspace', code: 'Backspace', vk: 8 },
  delete: { key: 'Delete', code: 'Delete', vk: 46 },
  arrowup: { key: 'ArrowUp', code: 'ArrowUp', vk: 38 },
  arrowdown: { key: 'ArrowDown', code: 'ArrowDown', vk: 40 },
  arrowleft: { key: 'ArrowLeft', code: 'ArrowLeft', vk: 37 },
  arrowright: { key: 'ArrowRight', code: 'ArrowRight', vk: 39 },
  up: { key: 'ArrowUp', code: 'ArrowUp', vk: 38 },
  down: { key: 'ArrowDown', code: 'ArrowDown', vk: 40 },
  left: { key: 'ArrowLeft', code: 'ArrowLeft', vk: 37 },
  right: { key: 'ArrowRight', code: 'ArrowRight', vk: 39 },
  home: { key: 'Home', code: 'Home', vk: 36 },
  end: { key: 'End', code: 'End', vk: 35 },
  pageup: { key: 'PageUp', code: 'PageUp', vk: 33 },
  pagedown: { key: 'PageDown', code: 'PageDown', vk: 34 },
  space: { key: ' ', code: 'Space', vk: 32, text: ' ' },
  f5: { key: 'F5', code: 'F5', vk: 116 }
};

export function parseKeySpec(spec) {
  const parts = String(spec || '')
    .split('+')
    .map((s) => s.trim())
    .filter(Boolean);
  const mods = { ctrl: false, meta: false, shift: false, alt: false };
  let main = parts.pop() || '';
  for (const p of parts) {
    const l = p.toLowerCase();
    if (l === 'ctrl' || l === 'control') mods.ctrl = true;
    else if (l === 'meta' || l === 'cmd' || l === 'command') mods.meta = true;
    else if (l === 'shift') mods.shift = true;
    else if (l === 'alt' || l === 'option') mods.alt = true;
  }
  const isMac = /Mac/i.test(navigator.platform || navigator.userAgent);
  if (isMac && mods.ctrl && main.length === 1) {
    mods.ctrl = false;
    mods.meta = true;
  }
  let k = KEYS[main.toLowerCase()];
  if (!k) {
    if (main.length === 1) {
      const up = main.toUpperCase();
      k = { key: mods.shift ? up : main, code: /[A-Z]/.test(up) ? 'Key' + up : /[0-9]/.test(up) ? 'Digit' + up : '', vk: up.charCodeAt(0), text: mods.ctrl || mods.meta || mods.alt ? undefined : mods.shift ? up : main };
    } else {
      k = { key: main, code: main, vk: 0 };
    }
  }
  return { ...k, ...mods };
}

function normalizeUrl(url) {
  let u = String(url || '').trim();
  if (!u) throw new Error('URL vazia');
  if (/^(javascript|data|chrome|chrome-extension|about|file):/i.test(u)) throw new Error('Navegação para ' + u.split(':')[0] + ': não é permitida.');
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  new URL(u);
  return u;
}

// Escolhe a aba de trabalho e explica quando não é a aba ativa do usuário.
// Retorna { tab, note }; note é null quando a aba ativa serve.
export function chooseTab({ preferred, active, all }) {
  const isWeb = (t) => !!t && /^(https?|file):/i.test(t.url || '');
  const describe = (t) => {
    const u = String(t?.url || '');
    if (/^chrome-extension:/i.test(u)) return u.includes('options.html') ? 'as configurações desta extensão' : 'uma página desta extensão';
    if (/^chrome:\/\/newtab|^about:blank/i.test(u)) return 'uma aba em branco';
    if (/^chrome:/i.test(u)) return 'uma página interna do navegador';
    return u ? `uma página que a extensão não pode acessar (${u.split('/')[0]}…)` : 'uma aba sem página';
  };
  if (isWeb(preferred)) return { tab: preferred, note: null };
  if (isWeb(active)) return { tab: active, note: null };
  const cands = (all || []).filter(isWeb).sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
  if (!cands.length) return { tab: null, note: null };
  const t = cands[0];
  const where = active ? describe(active) : 'nenhuma aba';
  return {
    tab: t,
    note: `A aba ativa do usuário é ${where}, que não é uma página web. A aba de trabalho passou a ser a última página web usada: "${t.title || ''}" (${t.url}). Ao responder, diga ao usuário que está olhando essa aba, e não a tela atual dele.`
  };
}

// ============================================================
// Controlador real
// ============================================================

export class BrowserController {
  constructor(opts = {}) {
    this.useDebugger = opts.useDebugger !== false;
    this.blocked = (opts.blockedDomains || []).map((d) => String(d).trim().toLowerCase()).filter(Boolean);
    this.tabId = null;
    this.windowId = null;
    this.log = opts.log || (() => {});
    this.debuggerError = '';
  }

  // ---------- abas ----------

  async pickTab(preferredId) {
    let preferred = null;
    if (preferredId != null) {
      try {
        preferred = await chrome.tabs.get(preferredId);
      } catch {}
    }
    const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
    const all = await chrome.tabs.query({});
    const { tab, note } = chooseTab({ preferred, active, all });
    this.tabNote = note;
    return tab;
  }

  async init(preferredId) {
    let t = await this.pickTab(preferredId);
    if (!t) {
      t = await chrome.tabs.create({ url: 'about:blank', active: true });
      this.tabNote = 'Nenhuma página web estava aberta; uma aba em branco foi criada. Use navigate para abrir um site.';
    }
    this.tabId = t.id;
    this.windowId = t.windowId;
    return t;
  }

  async ensureTab() {
    if (this.tabId != null) {
      try {
        const t = await chrome.tabs.get(this.tabId);
        this.windowId = t.windowId;
        return this.tabId;
      } catch {}
    }
    const t = await this.init();
    return t.id;
  }

  async tab() {
    return chrome.tabs.get(await this.ensureTab());
  }

  async activate() {
    const t = await this.tab();
    if (!t.active) await chrome.tabs.update(t.id, { active: true });
    return t;
  }

  async waitForLoad(timeout = 15000) {
    const tabId = await this.ensureTab();
    const t0 = Date.now();
    await sleep(250);
    while (Date.now() - t0 < timeout) {
      let t;
      try {
        t = await chrome.tabs.get(tabId);
      } catch {
        return false;
      }
      if (t.status === 'complete') {
        await sleep(350);
        return true;
      }
      await sleep(200);
    }
    return false;
  }

  async detectTabSwitch(beforeActiveId) {
    // se a ação abriu uma nova aba ativa, passa a trabalhar nela
    try {
      const [active] = await chrome.tabs.query({ active: true, windowId: this.windowId });
      if (active && active.id !== beforeActiveId && active.id !== this.tabId && /^https?:/i.test(active.url || '')) {
        this.tabId = active.id;
        return active;
      }
    } catch {}
    return null;
  }

  assertAllowed(url) {
    if (!this.blocked.length || !url) return;
    let host = '';
    try {
      host = new URL(url).hostname.toLowerCase();
    } catch {
      return;
    }
    for (const d of this.blocked) {
      if (host === d || host.endsWith('.' + d)) throw new Error(`Ação bloqueada: "${host}" está na lista de sites bloqueados (Configurações → Agente).`);
    }
  }

  // ---------- injeção ----------

  async exec(func, args = [], world = 'ISOLATED') {
    const tabId = await this.ensureTab();
    try {
      const r = await chrome.scripting.executeScript({ target: { tabId }, func, args, world });
      return r && r[0] ? r[0].result : undefined;
    } catch (e) {
      const t = await chrome.tabs.get(tabId).catch(() => null);
      throw new Error(`Não foi possível acessar a página${t?.url ? ' ' + t.url : ''} (${e.message}). Páginas internas do Chrome, a Chrome Web Store e abas em branco não são acessíveis; use navigate para abrir um site.`);
    }
  }

  async act(action, params) {
    const r = await this.exec(pageActionScript, [action, params || {}]);
    if (!r) throw new Error('Sem resposta da página.');
    if (!r.ok) throw new Error(r.error || 'Falha na ação');
    return r;
  }

  // ---------- DevTools Protocol ----------

  async cdp() {
    if (!this.useDebugger || !HAS_CHROME || !chrome.debugger) return false;
    ensureCdpListeners();
    const tabId = await this.ensureTab();
    if (cdpAttached.has(tabId)) return true;
    try {
      await chrome.debugger.attach({ tabId }, '1.3');
      cdpAttached.add(tabId);
      cdpBuffers.set(tabId, { console: [], net: new Map() });
      await this.send('Runtime.enable').catch(() => {});
      await this.send('Log.enable').catch(() => {});
      await this.send('Network.enable', { maxPostDataSize: 0 }).catch(() => {});
      await this.send('Page.enable').catch(() => {});
      return true;
    } catch (e) {
      this.debuggerError = e?.message || String(e);
      this.log('debugger indisponível: ' + this.debuggerError);
      return false;
    }
  }

  async send(method, params = {}) {
    const tabId = await this.ensureTab();
    return chrome.debugger.sendCommand({ tabId }, method, params);
  }

  async detachAll() {
    for (const tabId of [...cdpAttached]) {
      try {
        await chrome.debugger.detach({ tabId });
      } catch {}
      cdpAttached.delete(tabId);
    }
  }

  async cdpMouse(x, y, { double = false, button = 'left' } = {}) {
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    const n = double ? 2 : 1;
    for (let c = 1; c <= n; c++) {
      await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button, clickCount: c });
      await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button, clickCount: c });
    }
  }

  async cdpKey(spec) {
    const k = parseKeySpec(spec);
    const modifiers = (k.alt ? 1 : 0) | (k.ctrl ? 2 : 0) | (k.meta ? 4 : 0) | (k.shift ? 8 : 0);
    const base = { key: k.key, code: k.code, windowsVirtualKeyCode: k.vk, nativeVirtualKeyCode: k.vk, modifiers };
    if (k.meta || k.ctrl) base.commands = [];
    await this.send('Input.dispatchKeyEvent', { type: k.text ? 'keyDown' : 'rawKeyDown', ...base, text: k.text, unmodifiedText: k.text });
    await this.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
    return k;
  }

  // ---------- ferramentas ----------

  async getState({ includeText = true } = {}) {
    const s = await this.exec(pageStateScript, [{ maxText: includeText ? 3000 : 0 }]);
    if (!s) throw new Error('Sem resposta da página.');
    const note = this.tabNote ? `AVISO: ${this.tabNote}\n\n` : '';
    this.tabNote = ''; // o aviso vale para a primeira observação; depois o modelo já sabe
    return note + formatState(s, includeText);
  }

  async findElements(query) {
    const s = await this.exec(pageStateScript, [{ maxText: 0, maxElements: 600 }]);
    const q = String(query || '').toLowerCase();
    const hits = (s.items || []).filter((it) => [it.text, it.placeholder, it.name, it.id, it.href, it.value, it.role].some((v) => v && String(v).toLowerCase().includes(q)));
    if (!hits.length) return `Nenhum elemento contém "${query}". Tente get_page_state, scroll ou outro termo.`;
    return `${hits.length} elemento(s) para "${query}":\n` + hits.slice(0, 40).map(formatItem).join('\n');
  }

  async getText({ offset = 0, max_chars = 8000 } = {}) {
    const r = await this.act('text', { offset: Math.max(0, offset | 0), max: Math.min(30000, Math.max(200, max_chars | 0 || 8000)) });
    return `Texto (${offset}–${Math.min(r.total, offset + r.text.length)} de ${r.total} caracteres):\n${r.text}${offset + r.text.length < r.total ? `\n\n[… continua; use offset=${offset + r.text.length}]` : ''}`;
  }

  async getHtml({ selector, offset = 0, max_chars = 15000, strip_scripts = true } = {}) {
    const r = await this.act('html', { selector, strip: strip_scripts !== false, offset: Math.max(0, offset | 0), max: Math.min(40000, Math.max(500, max_chars | 0 || 15000)) });
    return `HTML${selector ? ' de ' + selector : ''} (${offset}–${Math.min(r.total, offset + r.html.length)} de ${r.total} caracteres):\n${r.html}${offset + r.html.length < r.total ? `\n\n[… continua; use offset=${offset + r.html.length}]` : ''}`;
  }

  async viewSource({ offset = 0, max_chars = 15000 } = {}) {
    const t = await this.tab();
    let src = '';
    if (await this.cdp()) {
      try {
        const tree = await this.send('Page.getResourceTree');
        const frame = tree.frameTree.frame;
        const res = await this.send('Page.getResourceContent', { frameId: frame.id, url: frame.url });
        src = res.base64Encoded ? atob(res.content) : res.content;
      } catch (e) {
        this.log('getResourceContent falhou: ' + e.message);
      }
    }
    if (!src) {
      const r = await fetch(t.url, { credentials: 'include' });
      src = await r.text();
    }
    const max = Math.min(40000, Math.max(500, max_chars | 0 || 15000));
    const slice = src.slice(offset, offset + max);
    return `Código-fonte de ${t.url} (${offset}–${offset + slice.length} de ${src.length} caracteres):\n${slice}${offset + slice.length < src.length ? `\n\n[… continua; use offset=${offset + slice.length}]` : ''}`;
  }

  async click({ index, selector, double = false } = {}) {
    const t = await this.tab();
    this.assertAllowed(t.url);
    const before = t.id;
    let desc;
    if (await this.cdp()) {
      const loc = await this.act('locate', { index, selector });
      await sleep(60);
      await this.cdpMouse(loc.x, loc.y, { double });
      desc = loc.desc;
    } else {
      const r = await this.act('click', { index, selector, double });
      desc = r.desc;
    }
    await this.waitForLoad(8000);
    const sw = await this.detectTabSwitch(before);
    const now = await this.tab();
    return `Clique em ${desc}.${sw ? ` Uma nova aba foi aberta e agora é a aba de trabalho: "${sw.title}" (${sw.url}).` : now.url !== t.url ? ` A página mudou para ${now.url}.` : ''} Chame get_page_state para ver o resultado.`;
  }

  async typeText({ index, selector, text, clear = true, press_enter = false } = {}) {
    const t = await this.tab();
    this.assertAllowed(t.url);
    if (text == null) throw new Error('Informe text');
    let r;
    if (await this.cdp()) {
      const f = await this.act('focus', { index, selector, clear });
      await sleep(40);
      await this.send('Input.insertText', { text: String(text) });
      if (press_enter) {
        await sleep(60);
        await this.cdpKey('Enter');
      }
      r = { desc: f.desc };
    } else {
      r = await this.act('type', { index, selector, text: String(text), clear, pressEnter: press_enter });
    }
    if (press_enter) await this.waitForLoad(8000);
    const now = await this.tab();
    return `Texto digitado em ${r.desc}${press_enter ? ' e Enter pressionado' : ''}.${now.url !== t.url ? ` A página mudou para ${now.url}.` : ''}`;
  }

  async pressKey({ key } = {}) {
    const t = await this.tab();
    this.assertAllowed(t.url);
    if (!key) throw new Error('Informe key');
    if (await this.cdp()) {
      await this.cdpKey(key);
    } else {
      const k = parseKeySpec(key);
      await this.act('key', { key: k.key, code: k.code, vk: k.vk, ctrl: k.ctrl, meta: k.meta, shift: k.shift, alt: k.alt });
    }
    await this.waitForLoad(5000);
    const now = await this.tab();
    return `Tecla ${key} pressionada.${now.url !== t.url ? ` A página mudou para ${now.url}.` : ''}`;
  }

  async selectOption({ index, selector, label, value } = {}) {
    const t = await this.tab();
    this.assertAllowed(t.url);
    const r = await this.act('select', { index, selector, label, value });
    return `Opção "${r.selected}" selecionada.`;
  }

  async scroll({ direction = 'down', amount, index, selector } = {}) {
    const r = await this.act('scroll', { direction, amount, index, selector });
    await sleep(250);
    return `Rolagem feita. Posição: ${r.y}/${r.max}px${r.y >= r.max - 2 ? ' (fim da página)' : ''}${r.y === 0 ? ' (topo)' : ''}. Chame get_page_state para ver os elementos visíveis.`;
  }

  async hover({ index, selector } = {}) {
    if (await this.cdp()) {
      const loc = await this.act('locate', { index, selector });
      await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: loc.x, y: loc.y });
      await sleep(300);
      return `Mouse sobre ${loc.desc}.`;
    }
    const r = await this.act('hover', { index, selector });
    await sleep(300);
    return `Mouse sobre ${r.desc}.`;
  }

  async navigate({ url } = {}) {
    const u = normalizeUrl(url);
    this.assertAllowed(u);
    const tabId = await this.ensureTab();
    await chrome.tabs.update(tabId, { url: u, active: true });
    const ok = await this.waitForLoad(20000);
    const t = await this.tab();
    return `${ok ? 'Página carregada' : 'Tempo esgotado aguardando carregar'}: "${t.title}" (${t.url}). Chame get_page_state.`;
  }

  async navigateHistory({ action } = {}) {
    const tabId = await this.ensureTab();
    if (action === 'back') await chrome.tabs.goBack(tabId).catch(() => {});
    else if (action === 'forward') await chrome.tabs.goForward(tabId).catch(() => {});
    else await chrome.tabs.reload(tabId);
    await this.waitForLoad(15000);
    const t = await this.tab();
    return `${{ back: 'Voltou', forward: 'Avançou', reload: 'Recarregou' }[action] || 'Navegou'}: "${t.title}" (${t.url}).`;
  }

  async wait({ ms, selector, text, timeout_ms = 10000 } = {}) {
    if (!selector && !text) {
      await sleep(Math.min(30000, Math.max(0, ms | 0 || 1000)));
      return `Aguardou ${ms || 1000} ms.`;
    }
    const t0 = Date.now();
    while (Date.now() - t0 < Math.min(60000, timeout_ms | 0 || 10000)) {
      const r = await this.act('check', { selector, text }).catch(() => ({ found: false }));
      if (r.found) return `Encontrado${selector ? ' ' + selector : ''}${text ? ' texto "' + text + '"' : ''} após ${Date.now() - t0} ms.`;
      await sleep(400);
    }
    return `Tempo esgotado (${timeout_ms || 10000} ms) sem encontrar${selector ? ' ' + selector : ''}${text ? ' texto "' + text + '"' : ''}.`;
  }

  async listTabs() {
    const tabs = await chrome.tabs.query({});
    const cur = this.tabId;
    return (
      `Abas abertas (${tabs.length}); aba de trabalho: ${cur}\n` +
      tabs
        .filter((t) => !/^chrome(-extension)?:/i.test(t.url || ''))
        .map((t) => `- id=${t.id}${t.id === cur ? ' [trabalho]' : ''}${t.active ? ' [ativa]' : ''} "${(t.title || '').slice(0, 70)}" ${t.url}`)
        .join('\n')
    );
  }

  async openTab({ url } = {}) {
    const u = url ? normalizeUrl(url) : 'about:blank';
    if (url) this.assertAllowed(u);
    const t = await chrome.tabs.create({ url: u, active: true });
    this.tabId = t.id;
    this.windowId = t.windowId;
    if (url) await this.waitForLoad(20000);
    const now = await this.tab();
    return `Nova aba id=${now.id} aberta${url ? `: "${now.title}" (${now.url})` : ' (em branco; use navigate)'}. Ela é agora a aba de trabalho.`;
  }

  async switchTab({ tab_id } = {}) {
    const t = await chrome.tabs.get(Number(tab_id));
    await chrome.tabs.update(t.id, { active: true });
    this.tabId = t.id;
    this.windowId = t.windowId;
    return `Aba de trabalho agora é id=${t.id}: "${t.title}" (${t.url}).`;
  }

  async closeTab({ tab_id } = {}) {
    const id = tab_id != null ? Number(tab_id) : await this.ensureTab();
    await chrome.tabs.remove(id);
    if (id === this.tabId) {
      this.tabId = null;
      const t = await this.init();
      return `Aba ${id} fechada. Aba de trabalho agora: id=${t.id} "${t.title}".`;
    }
    return `Aba ${id} fechada.`;
  }

  async screenshot({ full_page = false, highlight = true } = {}) {
    const t = await this.activate();
    let n = 0;
    if (highlight) {
      n = await this.exec(overlayScript, [true]).catch(() => 0);
      if (!n) {
        await this.exec(pageStateScript, [{ maxText: 0 }]).catch(() => null);
        n = await this.exec(overlayScript, [true]).catch(() => 0);
      }
    }
    await sleep(150);
    let dataUrl;
    try {
      if (full_page && (await this.cdp())) {
        const m = await this.send('Page.getLayoutMetrics');
        const cs = m.cssContentSize || m.contentSize;
        const height = Math.min(cs.height, 5000);
        const res = await this.send('Page.captureScreenshot', { format: 'jpeg', quality: 70, captureBeyondViewport: true, clip: { x: 0, y: 0, width: cs.width, height, scale: 1 } });
        dataUrl = 'data:image/jpeg;base64,' + res.data;
      } else {
        dataUrl = await chrome.tabs.captureVisibleTab(t.windowId, { format: 'jpeg', quality: 78 });
      }
    } finally {
      if (highlight) await this.exec(overlayScript, [false]).catch(() => {});
    }
    const img = await downscale(dataUrl, 1280, full_page ? 4000 : 1600);
    return {
      text: `Captura de tela ${img.width}×${img.height} da aba "${t.title}" (${t.url}).${highlight && n ? ` As etiquetas numeradas na imagem são os índices de get_page_state (${n} elementos visíveis).` : ''}`,
      image: { data: img.data, mediaType: 'image/jpeg', width: img.width, height: img.height }
    };
  }

  async evaluate({ code } = {}) {
    if (!code) throw new Error('Informe code');
    const t = await this.tab();
    this.assertAllowed(t.url);
    if (await this.cdp()) {
      const r = await this.send('Runtime.evaluate', { expression: String(code), returnByValue: true, awaitPromise: true, userGesture: true });
      if (r.exceptionDetails) throw new Error('Erro no JS: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
      const v = r.result?.value;
      const s = typeof v === 'string' ? v : JSON.stringify(v ?? null, null, 0);
      return `Resultado: ${s.length > 20000 ? s.slice(0, 20000) + '\n[… truncado]' : s}`;
    }
    const r = await this.exec(mainWorldEval, [String(code)], 'MAIN');
    if (!r?.ok) throw new Error('Erro no JS: ' + (r?.error || 'sem resultado'));
    const s = typeof r.value === 'string' ? r.value : JSON.stringify(r.value);
    return `Resultado: ${s.length > 20000 ? s.slice(0, 20000) + '\n[… truncado]' : s}`;
  }

  async consoleLogs({ clear = false } = {}) {
    if (!(await this.cdp())) return 'Console indisponível: o DevTools Protocol não pôde ser anexado' + (this.debuggerError ? ` (${this.debuggerError})` : '') + '.';
    const b = cdpBuffers.get(this.tabId);
    const items = b ? [...b.console] : [];
    if (clear && b) b.console.length = 0;
    if (!items.length) return 'Nenhuma mensagem de console capturada desde que o agente se conectou a esta aba.';
    return `Console (${items.length} mensagens, mais recentes por último):\n` + items.slice(-80).map((e) => `[${e.type}] ${String(e.text).slice(0, 300)}`).join('\n');
  }

  async networkRequests({ filter, clear = false } = {}) {
    if (!(await this.cdp())) return 'Rede indisponível: o DevTools Protocol não pôde ser anexado' + (this.debuggerError ? ` (${this.debuggerError})` : '') + '.';
    const b = cdpBuffers.get(this.tabId);
    let items = b ? [...b.net.values()] : [];
    if (filter) items = items.filter((r) => r.url.toLowerCase().includes(String(filter).toLowerCase()));
    if (clear && b) b.net.clear();
    if (!items.length) return 'Nenhuma requisição capturada desde que o agente se conectou a esta aba (recarregue a página para capturar do início).';
    return `Requisições (${items.length}):\n` + items.slice(-80).map((r) => `${r.method} ${r.status || (r.error ? 'ERRO ' + r.error : '…')} ${r.type || ''} ${r.url.slice(0, 160)}${r.ms ? ' ' + r.ms + 'ms' : ''}`).join('\n');
  }

  async searchHistory({ query, max_results = 20 } = {}) {
    if (!chrome.history) throw new Error('Permissão de histórico indisponível.');
    const items = await chrome.history.search({ text: String(query || ''), maxResults: Math.min(100, max_results | 0 || 20), startTime: 0 });
    if (!items.length) return `Nada no histórico para "${query}".`;
    return items.map((h) => `- ${new Date(h.lastVisitTime).toLocaleString('pt-BR')} "${(h.title || '').slice(0, 70)}" ${h.url}`).join('\n');
  }

  async download({ url, filename } = {}) {
    if (!chrome.downloads) throw new Error('Permissão de downloads indisponível.');
    const u = normalizeUrl(url);
    const id = await chrome.downloads.download({ url: u, filename: filename || undefined, saveAs: false });
    return `Download iniciado (id ${id}): ${u}`;
  }

  async copyToClipboard({ text } = {}) {
    try {
      await navigator.clipboard.writeText(String(text ?? ''));
    } catch {
      const ta = document.createElement('textarea');
      ta.value = String(text ?? '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    return 'Texto copiado para a área de transferência.';
  }

  async currentInfo() {
    try {
      const t = await this.tab();
      const info = { id: t.id, title: t.title, url: t.url };
      if (this.tabNote) info.note = this.tabNote;
      return info;
    } catch {
      return null;
    }
  }

  async dispose() {
    try {
      await this.exec(overlayScript, [false]);
    } catch {}
    await this.detachAll();
  }
}

// ============================================================
// Formatação
// ============================================================

function formatItem(it) {
  let s = `[${it.i}] <${it.tag}`;
  if (it.type) s += ` type=${it.type}`;
  if (it.role) s += ` role=${it.role}`;
  if (it.name) s += ` name="${it.name}"`;
  if (it.id) s += ` id="${it.id}"`;
  s += '>';
  if (it.text) s += ' ' + JSON.stringify(it.text);
  if (it.placeholder) s += ` placeholder="${it.placeholder}"`;
  if (it.value) s += ` value="${it.value}"`;
  if (it.options) s += ` (${it.options} opções)`;
  if (it.href) s += ` → ${it.href}`;
  if (it.checked != null) s += it.checked ? ' [marcado]' : ' [desmarcado]';
  if (it.editable) s += ' [editável]';
  if (it.disabled) s += ' [desabilitado]';
  if (!it.inViewport) s += ' (fora da tela)';
  return s;
}

export function formatState(s, includeText = true) {
  const lines = [
    `URL: ${s.url}`,
    `Título: ${s.title}`,
    `Viewport: ${s.viewport.w}×${s.viewport.h} · Scroll: ${s.scroll.y}/${s.scroll.max}px${s.scroll.max === 0 ? ' (página sem rolagem)' : s.scroll.y >= s.scroll.max - 2 ? ' (fim)' : s.scroll.y === 0 ? ' (topo)' : ''}`,
    '',
    `Elementos interativos (${s.items.length}${s.total > s.items.length ? ` de ${s.total}; role a página ou use find_elements para ver outros` : ''}):`
  ];
  if (!s.items.length) lines.push('(nenhum elemento interativo visível)');
  for (const it of s.items) lines.push(formatItem(it));
  if (includeText) {
    lines.push('', `Texto visível (${Math.min(s.textLength, s.textExcerpt.length)} de ${s.textLength} caracteres; use get_page_text para o restante):`, s.textExcerpt || '(sem texto)');
  }
  return lines.join('\n');
}

// ============================================================
// Controlador de demonstração (fora da extensão)
// ============================================================

export class FakeBrowser {
  constructor() {
    this.url = 'https://exemplo.com/';
    this.title = 'Exemplo — página de demonstração';
  }
  async init() {
    return { id: 1, url: this.url, title: this.title };
  }
  async currentInfo() {
    return { id: 1, url: this.url, title: this.title };
  }
  async getState() {
    return formatState({
      url: this.url,
      title: this.title,
      viewport: { w: 1280, h: 800 },
      scroll: { y: 0, max: 1200 },
      total: 3,
      items: [
        { i: 0, tag: 'input', type: 'search', name: 'q', placeholder: 'Buscar', inViewport: true, text: '' },
        { i: 1, tag: 'button', text: 'Buscar', inViewport: true },
        { i: 2, tag: 'a', text: 'Preços', href: '/precos', inViewport: true }
      ],
      textExcerpt: 'Bem-vindo à página de demonstração. Esta é uma simulação usada fora da extensão.',
      textLength: 80
    });
  }
  async findElements(q) {
    return `1 elemento(s) para "${q}":\n[2] <a> "Preços" → /precos`;
  }
  async getText() {
    return 'Texto (0–80 de 80 caracteres):\nBem-vindo à página de demonstração.';
  }
  async getHtml() {
    return 'HTML (0–60 de 60 caracteres):\n<html><body><h1>Demo</h1></body></html>';
  }
  async viewSource() {
    return this.getHtml();
  }
  async click({ index }) {
    if (index === 2) {
      this.url = 'https://exemplo.com/precos';
      this.title = 'Preços — Exemplo';
    }
    return `Clique em [${index}]. Chame get_page_state para ver o resultado.`;
  }
  async typeText({ text }) {
    return `Texto "${text}" digitado.`;
  }
  async pressKey({ key }) {
    return `Tecla ${key} pressionada.`;
  }
  async selectOption() {
    return 'Opção selecionada.';
  }
  async scroll() {
    return 'Rolagem feita. Posição: 680/1200px.';
  }
  async hover() {
    return 'Mouse sobre o elemento.';
  }
  async navigate({ url }) {
    this.url = url;
    this.title = 'Página ' + url;
    return `Página carregada: "${this.title}" (${url}).`;
  }
  async navigateHistory() {
    return 'Voltou.';
  }
  async wait({ ms }) {
    await sleep(Math.min(ms || 300, 300));
    return `Aguardou ${ms || 1000} ms.`;
  }
  async listTabs() {
    return `Abas abertas (1); aba de trabalho: 1\n- id=1 [trabalho] [ativa] "${this.title}" ${this.url}`;
  }
  async openTab({ url }) {
    return `Nova aba id=2 aberta${url ? ' em ' + url : ''}.`;
  }
  async switchTab({ tab_id }) {
    return `Aba de trabalho agora é id=${tab_id}.`;
  }
  async closeTab() {
    return 'Aba fechada.';
  }
  async screenshot() {
    const c = new OffscreenCanvas(640, 400);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 640, 400);
    ctx.fillStyle = '#fff';
    ctx.font = '28px sans-serif';
    ctx.fillText('Captura simulada — ' + this.title, 20, 60);
    const blob = await c.convertToBlob({ type: 'image/jpeg', quality: 0.7 });
    const buf = new Uint8Array(await blob.arrayBuffer());
    let bin = '';
    for (const b of buf) bin += String.fromCharCode(b);
    return { text: `Captura de tela 640×400 da aba "${this.title}".`, image: { data: btoa(bin), mediaType: 'image/jpeg', width: 640, height: 400 } };
  }
  async evaluate({ code }) {
    return `Resultado: (simulado) ${code}`;
  }
  async consoleLogs() {
    return 'Console (2 mensagens):\n[log] demo carregada\n[warn] exemplo';
  }
  async networkRequests() {
    return 'Requisições (1):\nGET 200 Document https://exemplo.com/';
  }
  async searchHistory({ query }) {
    return `- hoje "Exemplo" https://exemplo.com/?q=${query}`;
  }
  async download({ url }) {
    return `Download iniciado (simulado): ${url}`;
  }
  async copyToClipboard() {
    return 'Texto copiado.';
  }
  async dispose() {}
}

export async function captureActiveTab() {
  const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!t || !/^https?:|^file:/i.test(t.url || '')) throw new Error('Abra uma página web para capturar.');
  const dataUrl = await chrome.tabs.captureVisibleTab(t.windowId, { format: 'jpeg', quality: 80 });
  const img = await downscale(dataUrl, 1600, 2000, 0.8);
  return { ...img, title: t.title, url: t.url };
}

export function createBrowser(opts) {
  return HAS_CHROME ? new BrowserController(opts) : new FakeBrowser();
}
