// AI in Browser — definições das ferramentas do agente (formato neutro)
// Convertidas para o formato OpenAI (tools/functions), Anthropic (tools) ou
// para um protocolo JSON em texto quando o modelo não suporta tool calling.

export const TOOLS = [
  {
    name: 'get_page_state',
    description:
      'Observe the current tab: URL, title, scroll position, the list of interactive elements (each with an index like [12] you can click/type into) and an excerpt of the visible text. Call this first and again after every action that may have changed the page.',
    parameters: {
      type: 'object',
      properties: {
        include_text: { type: 'boolean', description: 'Include an excerpt of the page text (default true).' }
      }
    }
  },
  {
    name: 'get_page_text',
    description: 'Read the full text of the current page in slices (for long articles, results, tables). Use offset to page through.',
    parameters: {
      type: 'object',
      properties: {
        offset: { type: 'integer', description: 'Character offset to start from (default 0).' },
        max_chars: { type: 'integer', description: 'Maximum characters to return (default 8000, max 30000).' }
      }
    }
  },
  {
    name: 'get_page_html',
    description: 'Get the live DOM HTML (outerHTML) of the page or of a CSS selector, in slices.',
    parameters: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'Optional CSS selector. Default: whole document.' },
        offset: { type: 'integer', description: 'Character offset (default 0).' },
        max_chars: { type: 'integer', description: 'Max characters (default 15000, max 40000).' }
      }
    }
  },
  {
    name: 'view_source',
    description: 'Get the raw HTML source code of the page as it was loaded from the server (like view-source:), in slices.',
    parameters: {
      type: 'object',
      properties: {
        offset: { type: 'integer', description: 'Character offset (default 0).' },
        max_chars: { type: 'integer', description: 'Max characters (default 15000, max 40000).' }
      }
    }
  },
  {
    name: 'find_elements',
    description: 'Search interactive elements on the page by text, placeholder, name, id or href (case-insensitive). Returns matching indexes usable with click/type_text.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Text to search for.' } },
      required: ['query']
    }
  },
  {
    name: 'click',
    description: 'Click an element by index (from get_page_state) or CSS selector.',
    parameters: {
      type: 'object',
      properties: {
        index: { type: 'integer', description: 'Element index from get_page_state.' },
        selector: { type: 'string', description: 'CSS selector (alternative to index).' },
        double: { type: 'boolean', description: 'Double-click (default false).' }
      }
    }
  },
  {
    name: 'type_text',
    description: 'Type text into an input, textarea or contenteditable element (by index or selector). Optionally press Enter afterwards.',
    parameters: {
      type: 'object',
      properties: {
        index: { type: 'integer' },
        selector: { type: 'string' },
        text: { type: 'string', description: 'Text to type.' },
        clear: { type: 'boolean', description: 'Clear the field first (default true).' },
        press_enter: { type: 'boolean', description: 'Press Enter after typing (default false).' }
      },
      required: ['text']
    }
  },
  {
    name: 'press_key',
    description: 'Press a keyboard key or shortcut on the focused element, e.g. "Enter", "Tab", "Escape", "ArrowDown", "Backspace", "Control+a".',
    parameters: {
      type: 'object',
      properties: { key: { type: 'string' } },
      required: ['key']
    }
  },
  {
    name: 'select_option',
    description: 'Choose an option in a <select> element by visible label or value.',
    parameters: {
      type: 'object',
      properties: {
        index: { type: 'integer' },
        selector: { type: 'string' },
        label: { type: 'string', description: 'Visible option text.' },
        value: { type: 'string', description: 'Option value attribute.' }
      }
    }
  },
  {
    name: 'scroll',
    description: 'Scroll the page: down/up by an amount, to top/bottom, or bring an element (index) into view.',
    parameters: {
      type: 'object',
      properties: {
        direction: { type: 'string', enum: ['down', 'up', 'top', 'bottom'] },
        amount: { type: 'integer', description: 'Pixels (default: one viewport).' },
        index: { type: 'integer', description: 'Scroll this element into view instead.' }
      }
    }
  },
  {
    name: 'hover',
    description: 'Move the mouse over an element (opens hover menus/tooltips).',
    parameters: {
      type: 'object',
      properties: { index: { type: 'integer' }, selector: { type: 'string' } }
    }
  },
  {
    name: 'navigate',
    description: 'Navigate the current tab to a URL and wait for it to load. Use full URLs (https://...). WARNING: this discards anything typed into the current page; if the tab has a partially filled form or draft, use open_tab instead.',
    parameters: {
      type: 'object',
      properties: { url: { type: 'string' } },
      required: ['url']
    }
  },
  {
    name: 'navigate_history',
    description: 'Go back, go forward or reload the current tab.',
    parameters: {
      type: 'object',
      properties: { action: { type: 'string', enum: ['back', 'forward', 'reload'] } },
      required: ['action']
    }
  },
  {
    name: 'wait',
    description: 'Wait some milliseconds, or until a CSS selector or a text appears on the page.',
    parameters: {
      type: 'object',
      properties: {
        ms: { type: 'integer', description: 'Milliseconds to wait (default 1000).' },
        selector: { type: 'string', description: 'Wait until this selector exists.' },
        text: { type: 'string', description: 'Wait until this text appears.' },
        timeout_ms: { type: 'integer', description: 'Max wait when using selector/text (default 10000).' }
      }
    }
  },
  {
    name: 'list_tabs',
    description: 'List open browser tabs (id, title, url, active).',
    parameters: { type: 'object', properties: {} }
  },
  {
    name: 'open_tab',
    description: 'Open a new tab (optionally at a URL) and make it the working tab.',
    parameters: { type: 'object', properties: { url: { type: 'string' } } }
  },
  {
    name: 'switch_tab',
    description: 'Make another tab the working tab.',
    parameters: { type: 'object', properties: { tab_id: { type: 'integer' } }, required: ['tab_id'] }
  },
  {
    name: 'close_tab',
    description: 'Close a tab (default: the working tab).',
    parameters: { type: 'object', properties: { tab_id: { type: 'integer' } } }
  },
  {
    name: 'screenshot',
    description: 'Take a screenshot of the working tab. Elements from get_page_state are labeled with their indexes on the image. Use when layout or images matter.',
    parameters: {
      type: 'object',
      properties: {
        full_page: { type: 'boolean', description: 'Capture the whole page instead of the viewport (default false).' },
        highlight: { type: 'boolean', description: 'Draw index labels on interactive elements (default true).' }
      }
    },
    vision: true
  },
  {
    name: 'evaluate_js',
    description: 'Run JavaScript in the page (main world) and return the result as JSON. Use for data extraction or advanced interactions. Example: "document.title" or "[...document.querySelectorAll(\'h2\')].map(h=>h.textContent)".',
    parameters: { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] }
  },
  {
    name: 'get_console_logs',
    description: 'Read console messages and JS errors captured from the working tab (requires DevTools protocol).',
    parameters: { type: 'object', properties: { clear: { type: 'boolean' } } }
  },
  {
    name: 'get_network_requests',
    description: 'List recent network requests of the working tab (method, URL, status, type). Optional substring filter.',
    parameters: { type: 'object', properties: { filter: { type: 'string' }, clear: { type: 'boolean' } } }
  },
  {
    name: 'search_history',
    description: "Search the user's browsing history by text.",
    parameters: {
      type: 'object',
      properties: { query: { type: 'string' }, max_results: { type: 'integer' } },
      required: ['query']
    }
  },
  {
    name: 'download',
    description: 'Download a file from a URL using the browser download manager.',
    parameters: { type: 'object', properties: { url: { type: 'string' }, filename: { type: 'string' } }, required: ['url'] }
  },
  {
    name: 'copy_to_clipboard',
    description: "Copy text to the user's clipboard.",
    parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] }
  },
  {
    name: 'ask_user',
    description: 'Pause and ask the user a question (missing information, confirmation before a sensitive or irreversible action). The run continues when the user answers.',
    parameters: { type: 'object', properties: { question: { type: 'string' } }, required: ['question'] }
  },
  {
    name: 'done',
    description: 'Finish the task. Provide the final answer/summary for the user, including any information collected.',
    parameters: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'Final answer for the user, in their language. Use Markdown.' },
        success: { type: 'boolean', description: 'Whether the task was completed.' }
      },
      required: ['summary']
    }
  }
];

export function toolsFor({ vision = true, debugger: dbg = true, history = true, downloads = true, js = true } = {}) {
  return TOOLS.filter((t) => {
    if (t.vision && !vision) return false;
    if (!js && t.name === 'evaluate_js') return false;
    if (!dbg && (t.name === 'get_console_logs' || t.name === 'get_network_requests')) return false;
    if (!history && t.name === 'search_history') return false;
    if (!downloads && t.name === 'download') return false;
    return true;
  });
}

export function toOpenAITools(tools) {
  return tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));
}

export function toAnthropicTools(tools) {
  return tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters }));
}

export function toolsAsText(tools) {
  return tools
    .map((t) => {
      const props = t.parameters?.properties || {};
      const req = new Set(t.parameters?.required || []);
      const args = Object.entries(props)
        .map(([k, v]) => `${k}${req.has(k) ? '' : '?'}: ${v.enum ? v.enum.join('|') : v.type}${v.description ? ' — ' + v.description : ''}`)
        .join('; ');
      return `- ${t.name}(${args})\n  ${t.description}`;
    })
    .join('\n');
}

// Rótulo legível (pt-BR) para exibir cada passo na interface
export function stepLabel(name, args = {}) {
  const el = args.index != null ? `[${args.index}]` : args.selector ? `“${args.selector}”` : '';
  const short = (s, n = 60) => (s && s.length > n ? s.slice(0, n - 1) + '…' : s || '');
  switch (name) {
    case 'get_page_state':
      return 'Observar a página';
    case 'get_page_text':
      return `Ler texto da página${args.offset ? ` (a partir de ${args.offset})` : ''}`;
    case 'get_page_html':
      return `Ler HTML${args.selector ? ` de “${args.selector}”` : ''}`;
    case 'view_source':
      return 'Ver código-fonte';
    case 'find_elements':
      return `Procurar “${short(args.query, 40)}”`;
    case 'click':
      return `${args.double ? 'Clique duplo' : 'Clicar'} em ${el}`;
    case 'type_text':
      return `Digitar “${short(args.text, 40)}” em ${el}${args.press_enter ? ' + Enter' : ''}`;
    case 'press_key':
      return `Pressionar ${args.key}`;
    case 'select_option':
      return `Selecionar “${args.label || args.value}” em ${el}`;
    case 'scroll':
      return args.index != null ? `Rolar até ${el}` : `Rolar ${{ down: 'para baixo', up: 'para cima', top: 'ao topo', bottom: 'ao fim' }[args.direction] || ''}`;
    case 'hover':
      return `Passar o mouse em ${el}`;
    case 'navigate':
      return `Abrir ${short(args.url, 70)}`;
    case 'navigate_history':
      return { back: 'Voltar', forward: 'Avançar', reload: 'Recarregar' }[args.action] || 'Navegar';
    case 'wait':
      return args.selector ? `Aguardar “${short(args.selector, 40)}”` : args.text ? `Aguardar texto “${short(args.text, 40)}”` : `Aguardar ${args.ms || 1000} ms`;
    case 'list_tabs':
      return 'Listar abas';
    case 'open_tab':
      return `Abrir nova aba${args.url ? ' em ' + short(args.url, 60) : ''}`;
    case 'switch_tab':
      return `Ir para a aba ${args.tab_id}`;
    case 'close_tab':
      return 'Fechar aba';
    case 'screenshot':
      return args.full_page ? 'Captura de tela (página inteira)' : 'Captura de tela';
    case 'evaluate_js':
      return `Executar JS: ${short(args.code, 50)}`;
    case 'get_console_logs':
      return 'Ler console';
    case 'get_network_requests':
      return 'Ler requisições de rede';
    case 'search_history':
      return `Buscar no histórico “${short(args.query, 40)}”`;
    case 'download':
      return `Baixar ${short(args.url, 60)}`;
    case 'copy_to_clipboard':
      return 'Copiar para a área de transferência';
    case 'ask_user':
      return 'Perguntar ao usuário';
    case 'done':
      return 'Concluir';
    default:
      return name;
  }
}

export function stepIcon(name) {
  const m = {
    get_page_state: '👁️',
    get_page_text: '📖',
    get_page_html: '🧩',
    view_source: '📄',
    find_elements: '🔎',
    click: '🖱️',
    type_text: '⌨️',
    press_key: '⌨️',
    select_option: '☑️',
    scroll: '↕️',
    hover: '🫧',
    navigate: '🌐',
    navigate_history: '↩️',
    wait: '⏳',
    list_tabs: '🗂️',
    open_tab: '➕',
    switch_tab: '🗂️',
    close_tab: '✖️',
    screenshot: '📸',
    evaluate_js: '⚙️',
    get_console_logs: '🧾',
    get_network_requests: '📡',
    search_history: '🕘',
    download: '⬇️',
    copy_to_clipboard: '📋',
    ask_user: '❓',
    done: '✅'
  };
  return m[name] || '🔧';
}
