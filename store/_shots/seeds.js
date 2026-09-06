// Dados de demonstração para gerar as capturas da loja (não fazem parte da extensão).
const now = Date.now();
const OR_MODELS = [
  { id: 'anthropic/claude-sonnet-5', name: 'Anthropic: Claude Sonnet 5', owner: 'anthropic', context: 1000000, promptPrice: 3, completionPrice: 15, modalities: ['text', 'image'], created: now / 1000 },
  { id: 'openai/gpt-5', name: 'OpenAI: GPT-5', owner: 'openai', context: 400000, promptPrice: 1.25, completionPrice: 10, modalities: ['text', 'image'], created: now / 1000 },
  { id: 'google/gemini-3-pro-preview', name: 'Google: Gemini 3 Pro', owner: 'google', context: 1000000, promptPrice: 2, completionPrice: 12, modalities: ['text', 'image'], created: now / 1000 },
  { id: 'x-ai/grok-4', name: 'xAI: Grok 4', owner: 'x-ai', context: 256000, promptPrice: 3, completionPrice: 15, modalities: ['text'], created: now / 1000 },
  { id: 'deepseek/deepseek-v3.2-exp', name: 'DeepSeek: V3.2', owner: 'deepseek', context: 164000, promptPrice: 0.28, completionPrice: 0.42, modalities: ['text'], created: now / 1000 },
  { id: 'moonshotai/kimi-k2-0905', name: 'MoonshotAI: Kimi K2', owner: 'moonshotai', context: 262000, promptPrice: 0.6, completionPrice: 2.5, modalities: ['text'], created: now / 1000 },
  { id: 'z-ai/glm-4.6', name: 'Z.AI: GLM 4.6', owner: 'z-ai', context: 205000, promptPrice: 0.55, completionPrice: 2.2, modalities: ['text'], created: now / 1000 },
  { id: 'qwen/qwen3-max', name: 'Qwen: Qwen3 Max', owner: 'qwen', context: 262000, promptPrice: 0.78, completionPrice: 3.9, modalities: ['text'], created: now / 1000 },
  { id: 'meta-llama/llama-4-maverick', name: 'Meta: Llama 4 Maverick', owner: 'meta-llama', context: 1048576, promptPrice: 0.2, completionPrice: 0.7, modalities: ['text', 'image'], created: now / 1000 },
  { id: 'mistralai/mistral-medium-3.1', name: 'Mistral: Medium 3.1', owner: 'mistralai', context: 131000, promptPrice: 0.4, completionPrice: 2, modalities: ['text'], created: now / 1000 },
  { id: 'deepseek/deepseek-r1-0528:free', name: 'DeepSeek: R1 (grátis)', owner: 'deepseek', context: 163840, promptPrice: 0, completionPrice: 0, free: true, modalities: ['text'], created: now / 1000 },
  { id: 'anthropic/claude-haiku-4.5', name: 'Anthropic: Claude Haiku 4.5', owner: 'anthropic', context: 200000, promptPrice: 1, completionPrice: 5, modalities: ['text', 'image'], created: now / 1000 }
];
const OLLAMA_MODELS = [
  { id: 'llama3.1:8b', name: 'Llama3.1:8b', owner: 'library' },
  { id: 'qwen3:14b', name: 'Qwen3:14b', owner: 'library' },
  { id: 'gemma3:12b', name: 'Gemma3:12b', owner: 'library' },
  { id: 'deepseek-r1:8b', name: 'Deepseek R1:8b', owner: 'library' }
];

const CONNECTIONS = [
  { id: 'openrouter', type: 'openrouter', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', apiKey: 'sk-or-v1-demo', builtin: true, enabled: true },
  { id: 'openai', type: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', apiKey: '', builtin: true, enabled: true },
  { id: 'anthropic', type: 'anthropic', name: 'Anthropic', baseUrl: 'https://api.anthropic.com/v1', apiKey: '', builtin: true, enabled: true },
  { id: 'ollama', type: 'openai', name: 'Ollama (local)', baseUrl: 'http://localhost:11434/v1', apiKey: '', builtin: true, enabled: true, local: true },
  { id: 'lmstudio', type: 'openai', name: 'LM Studio (local)', baseUrl: 'http://localhost:1234/v1', apiKey: '', builtin: true, enabled: true, local: true }
];

function step(o) {
  return { id: 's' + Math.random().toString(36).slice(2, 8), status: 'ok', ...o };
}

const CHAT_AGENT = {
  id: 'c_demo_agent',
  title: 'Comparar preços dos planos',
  createdAt: now - 60000,
  updatedAt: now - 1000,
  connectionId: 'openrouter',
  modelId: 'anthropic/claude-sonnet-5',
  messages: [
    { id: 'm1', role: 'user', content: 'Abra a página de preços deste site e compare os planos numa tabela', ts: now - 60000 },
    {
      id: 'm2',
      role: 'assistant',
      agent: true,
      agentMode: 'native',
      status: 'ok',
      pending: false,
      ts: now - 55000,
      model: 'anthropic/claude-sonnet-5',
      connectionId: 'openrouter',
      duration: 12400,
      usage: { prompt: 9200, completion: 840, total: 10040, cost: 0.0184 },
      steps: [
        step({ name: 'get_page_state', icon: '👁️', label: 'Observar a página', thought: 'Vou ver o que está na tela antes de agir.', result: 'URL: https://exemplo.com/\nTítulo: Exemplo\n\nElementos interativos (18):\n[0] <a> "Produto" → /produto\n[1] <a> "Preços" → /precos\n[2] <button> "Entrar"', ms: 180 }),
        step({ name: 'click', icon: '🖱️', label: 'Clicar em [1]', result: 'Clique em <a> Preços. A página mudou para https://exemplo.com/precos.', ms: 940 }),
        step({ name: 'get_page_text', icon: '📖', label: 'Ler texto da página', result: 'Texto (0–1420 de 1420 caracteres):\nPlanos e preços\nBásico R$ 29/mês — 1 usuário, 10 GB\nPro R$ 79/mês — 5 usuários, 100 GB, API\nEmpresa R$ 249/mês — ilimitado, SSO, suporte 24/7', ms: 210 })
      ],
      content: 'Comparei os três planos:\n\n| Plano | Preço | Destaques |\n|---|---:|---|\n| Básico | R$ 29/mês | 1 usuário, 10 GB |\n| **Pro** | R$ 79/mês | 5 usuários, 100 GB, API |\n| Empresa | R$ 249/mês | Ilimitado, SSO, 24/7 |\n\nO **Pro** tem o melhor custo-benefício.'
    }
  ]
};

const CHAT_PAGE = {
  id: 'c_demo_page',
  title: 'Explicar este artigo',
  createdAt: now - 40000,
  updatedAt: now - 1000,
  connectionId: 'openrouter',
  modelId: 'openai/gpt-5',
  messages: [
    {
      id: 'p1',
      role: 'user',
      content: 'Me explique o que essa função faz e como eu chamaria ela',
      ts: now - 40000,
      context: { kind: 'page', title: 'Web Streams API — MDN', url: 'https://developer.mozilla.org/pt-BR/docs/Web/API/Streams_API', text: '...' }
    },
    {
      id: 'p2',
      role: 'assistant',
      ts: now - 35000,
      model: 'openai/gpt-5',
      connectionId: 'openrouter',
      duration: 4200,
      usage: { prompt: 4120, completion: 380, total: 4500, cost: 0.0089 },
      content: 'Ela lê um `ReadableStream` em pedaços e devolve cada linha completa, sem carregar tudo na memória.\n\n```js\nfor await (const linha of lerLinhas(res.body)) {\n  console.log(linha);\n}\n```\n\nO decodificador usa `{ stream: true }` para não quebrar caracteres acentuados entre um pedaço e outro.'
    }
  ]
};

const CHAT_LOCAL = {
  id: 'c_demo_local',
  title: 'Revisar texto offline',
  createdAt: now - 30000,
  updatedAt: now - 1000,
  connectionId: 'ollama',
  modelId: 'llama3.1:8b',
  messages: [
    { id: 'l1', role: 'user', content: 'Revise este parágrafo do meu contrato e aponte ambiguidades', ts: now - 30000, files: [{ name: 'contrato.txt', text: '...' }] },
    {
      id: 'l2',
      role: 'assistant',
      ts: now - 25000,
      model: 'llama3.1:8b',
      connectionId: 'ollama',
      duration: 3100,
      usage: { prompt: 1240, completion: 260, total: 1500 },
      content: 'Encontrei três pontos ambíguos:\n\n1. **"prazo razoável"** — não define quantos dias. Sugira "até 15 dias corridos".\n2. **"materiais necessários"** — quem decide o que é necessário? Liste no anexo.\n3. **"rescisão a qualquer tempo"** — falta o aviso prévio e a multa aplicável.\n\n> Nada disso saiu do seu computador: o modelo rodou local no Ollama.'
    }
  ]
};

window.SEEDS = { OR_MODELS, OLLAMA_MODELS, CONNECTIONS, CHAT_AGENT, CHAT_PAGE, CHAT_LOCAL, now };
