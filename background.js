// AI in Browser — service worker (Manifest V3)
// Responsável por: comportamento do side panel, menus de contexto e atalhos.

import { loadSettings } from './lib/storage.js';
import { syncOriginRules } from './lib/netrules.js';

const MENU_ASK_SELECTION = 'prism-ask-selection';
const MENU_SUMMARIZE = 'prism-summarize-page';
const MENU_OPEN_TAB = 'prism-open-tab';
const MENU_OPTIONS = 'prism-options';

function tabUrl() {
  return chrome.runtime.getURL('sidepanel.html?mode=tab');
}

async function enableSidePanelOnClick() {
  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  } catch (e) {
    // Navegadores sem side panel (Arc, Edge antigo): o clique abre em aba.
    chrome.action.onClicked.addListener(() => chrome.tabs.create({ url: tabUrl() }));
  }
}

function createMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ASK_SELECTION,
      title: 'Perguntar ao AI in Browser sobre "%s"',
      contexts: ['selection']
    });
    chrome.contextMenus.create({
      id: MENU_SUMMARIZE,
      title: 'Resumir esta página com o AI in Browser',
      contexts: ['page']
    });
    chrome.contextMenus.create({
      id: MENU_OPEN_TAB,
      title: 'Abrir o AI in Browser em uma aba',
      contexts: ['action']
    });
    chrome.contextMenus.create({
      id: MENU_OPTIONS,
      title: 'Configurações',
      contexts: ['action']
    });
  });
}

async function syncRules() {
  try {
    const s = await loadSettings();
    return await syncOriginRules(s.connections);
  } catch (e) {
    console.warn('[netrules] falha ao sincronizar', e);
    return { ok: false, reason: e?.message || String(e) };
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.settings) syncRules();
});

chrome.runtime.onInstalled.addListener(async (details) => {
  await enableSidePanelOnClick();
  createMenus();
  syncRules();
  if (details.reason === 'install') {
    chrome.tabs.create({ url: tabUrl() });
  }
});

chrome.runtime.onStartup.addListener(() => {
  enableSidePanelOnClick();
  createMenus();
  syncRules();
});

function openPanel(tab) {
  // sidePanel.open() precisa ser chamado de forma síncrona dentro do gesto do usuário.
  if (tab?.id != null && chrome.sidePanel?.open) {
    chrome.sidePanel.open({ tabId: tab.id }).catch(() => chrome.tabs.create({ url: tabUrl() }));
    return;
  }
  chrome.tabs.create({ url: tabUrl() });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === MENU_OPEN_TAB) {
    chrome.tabs.create({ url: tabUrl() });
    return;
  }
  if (info.menuItemId === MENU_OPTIONS) {
    chrome.runtime.openOptionsPage();
    return;
  }
  const pending = {
    ts: Date.now(),
    tabId: tab?.id ?? null,
    url: info.pageUrl || tab?.url || '',
    title: tab?.title || ''
  };
  if (info.menuItemId === MENU_ASK_SELECTION) {
    pending.action = 'selection';
    pending.text = info.selectionText || '';
  } else if (info.menuItemId === MENU_SUMMARIZE) {
    pending.action = 'summarize';
  } else {
    return;
  }
  // grava sem await para não perder o gesto do usuário
  chrome.storage.session.set({ pending });
  openPanel(tab);
});

// Mensagens vindas das páginas da extensão
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'open-tab') {
    chrome.tabs.create({ url: tabUrl() });
    sendResponse({ ok: true });
  } else if (msg?.type === 'open-options') {
    chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
  } else if (msg?.type === 'sync-rules') {
    syncRules().then(sendResponse);
    return true;
  }
  return false;
});
