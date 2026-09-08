# Ficha da loja — AI in Browser

Textos prontos para colar no [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).

---

## Nome
```
AI in Browser
```

## Descrição curta (máx. 132 caracteres — igual à do manifest)
```
Converse com IA sobre qualquer página e deixe o agente navegar, clicar e preencher por você. OpenRouter, OpenAI, Claude, Ollama.
```

## Categoria
**Ferramentas** (Tools) · Idioma principal: **Português (Brasil)**

## Descrição detalhada
```
AI in Browser coloca o modelo de IA que você quiser dentro do navegador: um painel lateral que enxerga a página aberta, responde perguntas sobre ela e, quando você pede, executa a tarefa sozinho.

VOCÊ ESCOLHE O MODELO
• OpenRouter — uma chave, centenas de modelos: Claude, GPT, Gemini, Grok, DeepSeek, Llama, Qwen, Mistral e outros, com preço e tamanho de contexto na hora de escolher.
• OpenAI e Anthropic — use sua chave direto na API oficial.
• Modelos locais — Ollama e LM Studio são detectados automaticamente. Sem chave, sem nuvem, 100% offline.
• Qualquer endpoint compatível — Groq, DeepSeek, xAI, Mistral, Together, Gemini, vLLM, llama.cpp, Jan e o que mais você configurar.

COOPERAÇÃO ENTRE MODELOS
Seu modelo local não tem visão? Outro modelo ativo descreve a imagem para ele. Não tem tool calling? Outro conduz o agente. Precisa de raciocínio profundo ou de contexto maior? A extensão passa a vez e mostra quem ajudou. Cada habilidade pode ficar em automático, fixa num modelo ou desligada.

CONVERSA COM CONTEXTO DA PÁGINA
• Anexe o texto da aba atual com um clique.
• Selecione um trecho e use o botão direito para perguntar sobre ele.
• Resuma qualquer página pelo menu de contexto.
• Anexe imagens e arquivos de texto, cole prints ou capture a aba.

BUSCA NA WEB SEM DEPENDER DE NINGUÉM
O agente pesquisa por API e lê páginas sem abrir abas. Você escolhe por onde: uma instância própria do SearXNG (sem chave e sem terceiros), o plugin de busca do OpenRouter, Exa ou Tavily. Com SearXNG e um modelo local, a extensão inteira funciona sem tocar em nenhum serviço externo.

MODO NAVEGAR: O AGENTE FAZ POR VOCÊ
Ative o modo Navegar e descreva a tarefa em português. O agente enxerga os elementos da página, clica, digita, seleciona opções, rola, abre e troca abas, espera carregamentos, lê o HTML e o código-fonte, consulta console e requisições de rede e tira capturas de tela quando o modelo tem visão.

Exemplos:
• "Procure neste site um fone bluetooth até R$ 200 e me traga os três mais bem avaliados"
• "Preencha o formulário com meus dados, mas não envie"
• "Quais scripts de rastreamento esta página carrega?"

Cada ação aparece como um passo, com resultado expansível. Você acompanha tudo e interrompe quando quiser.

SEGURANÇA EM PRIMEIRO LUGAR
• O agente pergunta antes de comprar, pagar, enviar mensagens, excluir ou alterar configurações de conta.
• Nunca digita senhas que você não forneceu e não resolve CAPTCHAs.
• Lista de domínios bloqueados: o agente não age nos sites que você proibir.
• A execução de JavaScript na página pode ser desligada.
• Histórico e downloads são permissões opcionais, pedidas só quando o recurso é usado; o DevTools Protocol pode ser desligado nas configurações.

PRIVACIDADE DE VERDADE
Não existe servidor do AI in Browser. Suas chaves ficam apenas no seu navegador e as mensagens vão exclusivamente para o provedor que você configurou. Sem telemetria, sem analytics, sem conta para criar. Com Ollama ou LM Studio, nada sai do seu computador.

TAMBÉM INCLUI
• Respostas em streaming, Markdown completo, realce de código com botão copiar, tabelas e bloco de raciocínio.
• Custo e tokens exibidos em cada resposta.
• Histórico com busca, exportação em Markdown e backup em JSON.
• Temas claro e escuro, seis cores de destaque e tamanho de fonte ajustável.
• Ditado por voz e seletor de esforço de raciocínio (auto, baixo, médio, alto).
• Atalhos: Ctrl/Cmd+Shift+Espaço abre o painel, Ctrl/Cmd+K troca de modelo.

Código aberto sob licença MIT.
```

## Finalidade única (Single purpose)
```
Assistente de IA no navegador: conversar sobre a página aberta e, quando o usuário pedir, executar tarefas nela com o modelo de linguagem que o próprio usuário configurar.
```

## Justificativas de permissão

| Campo no painel | Texto para colar |
|---|---|
| `sidePanel` | Exibir a interface do assistente no painel lateral do navegador. |
| `storage` | Salvar localmente as preferências do usuário, as chaves de API que ele cadastrar e o histórico de conversas. Nada é enviado a servidores da extensão. |
| `unlimitedStorage` | O histórico de conversas fica inteiramente no dispositivo do usuário, em chrome.storage.local, e pode passar da cota padrão de 10 MB. A extensão guarda até 200 conversas, e cada mensagem pode conter imagens que o usuário anexou (até 6 por mensagem, cerca de 250 a 700 KB cada em base64), arquivos de texto de até 200 mil caracteres e trechos da página que ele mandou analisar. Some-se a isso o cache do catálogo de modelos do provedor, que sozinho ocupa cerca de 280 KB. Sem unlimitedStorage, a gravação passa a falhar e o usuário perde conversas antigas sem aviso. Nada disso é enviado a servidores da extensão: o armazenamento é só local, e o usuário pode apagar tudo em Configurações → Dados. |
| `contextMenus` | Oferecer os itens "Perguntar ao AI in Browser" sobre o texto selecionado e "Resumir esta página". |
| `activeTab` | Acessar a aba atual apenas quando o usuário aciona a extensão, para ler o conteúdo que ele quer discutir. |
| `scripting` | Injetar o script que lê o texto e mapeia os elementos interativos da página e que executa as ações solicitadas pelo usuário no modo Navegar. |
| `tabs` | Ler título e URL da aba de trabalho e abrir, alternar ou fechar abas durante uma tarefa que o usuário pediu ao agente. |
| `clipboardWrite` | Copiar respostas e blocos de código para a área de transferência quando o usuário clica em copiar. |
| `declarativeNetRequestWithHostAccess` | Uma única regra dinâmica que remove o cabeçalho Origin apenas das requisições que a própria extensão faz às URLs base de servidores de modelos locais ou personalizados que o usuário configurou, como um Ollama em http://localhost:11434. Esses servidores recusam com HTTP 403 qualquer requisição de navegador cuja origem seja chrome-extension://, e sem essa regra o usuário precisaria reconfigurar o servidor dele. A regra é limitada ao iniciador da extensão e ao tipo xmlhttprequest, e nunca se aplica aos provedores oficiais (OpenRouter, OpenAI, Anthropic). Ela não bloqueia, não redireciona e não modifica nenhuma requisição feita por páginas web: sites visitados pelo usuário não são afetados de forma alguma. |
| `host_permissions` (`<all_urls>`) | Duas funções: (1) enviar as mensagens para a API do provedor que o próprio usuário configurar, que pode estar em qualquer domínio, inclusive um servidor local como http://localhost:11434; (2) ler e agir na aba que o usuário indicar, já que o usuário pode pedir isso em qualquer site. A extensão não acessa páginas em segundo plano: só age após uma ação explícita do usuário. |
| `debugger` | Executar cliques e digitação como eventos confiáveis pelo Chrome DevTools Protocol, capturar a página inteira e ler console, requisições de rede e código-fonte quando o usuário solicita uma tarefa no modo Navegar. O depurador só é anexado à aba de trabalho durante uma tarefa iniciada pelo usuário e é desanexado ao terminar; o Chrome exibe a barra de depuração nesse período. O usuário pode desligar o uso do DevTools Protocol nas configurações, e o agente passa a usar eventos de DOM. |
| `history` (opcional) | Ferramenta de busca no histórico, usada apenas se o usuário ligar essa opção nas configurações. |
| `downloads` (opcional) | Baixar um arquivo quando o usuário pede isso ao agente. Opcional e desligada por padrão. |
| Código remoto | Não. Todo o código executado está no pacote. A extensão não carrega nem executa scripts hospedados remotamente. No modo Navegar, o usuário pode autorizar o agente a rodar JavaScript na página aberta (ferramenta `evaluate_js`), recurso que pode ser desativado nas configurações. |

## Código remoto

Responda **Não**. Todo o JavaScript executado pela extensão está no pacote: não há tags `<script>` externas, nem módulos remotos, nem avaliação de strings no contexto da extensão.

Há um ponto que vale declarar por escrito na justificativa das permissões de host, para não surpreender o revisor: a ferramenta `evaluate_js` do modo Navegar passa uma expressão ao motor de JavaScript **da página aberta**, a pedido do usuário, do mesmo jeito que ele faria no console do DevTools. Isso acontece no contexto da página, nunca no da extensão, e pode ser desativado em Configurações → Agente.

## Uso de dados (Data usage / Privacy practices)

Marque exatamente três caixas:

- **Informações de autenticação** — as chaves de API que o usuário cadastra ficam no armazenamento local e são enviadas apenas ao provedor que ele escolheu.
- **Conteúdo do site** — o conteúdo da página vai ao provedor de IA quando o usuário anexa a página, seleciona um trecho ou usa o modo Navegar.
- **Histórico da Web** — só quando o usuário liga a permissão opcional de histórico; nesse caso a ferramenta de busca no histórico pode enviar títulos e URLs ao modelo. Está desligada por padrão.

Não marque: informações de identificação pessoal, saúde, financeiras, comunicações pessoais, localização e atividade do usuário. A extensão não coleta nada disso; o que passa é o conteúdo da página que o próprio usuário mandou analisar.

Marque as três declarações finais:
1. Não vendo nem transfiro dados a terceiros fora dos casos de uso aprovados.
2. Não uso nem transfiro dados para finalidades alheias à função principal do item.
3. Não uso nem transfiro dados para determinar a capacidade de crédito ou para empréstimos.

**URL da política de privacidade:**
```
https://samyrwendel.github.io/ai-in-browser/privacy.html
```

## Recursos gráficos

| Item | Tamanho | Arquivo |
|---|---|---|
| Ícone da loja | 128×128 | `icons/icon128.png` |
| Captura 1 | 1280×800 | `store/screenshots/01-navegar.png` |
| Captura 2 | 1280×800 | `store/screenshots/02-modelos.png` |
| Captura 3 | 1280×800 | `store/screenshots/03-pagina.png` |
| Captura 4 | 1280×800 | `store/screenshots/04-local.png` |
| Captura 5 | 1280×800 | `store/screenshots/05-config.png` |
| Bloco promocional pequeno | 440×280 | `store/promo/promo-440x280.png` |
| Bloco promocional marquee | 1400×560 | `store/promo/promo-1400x560.png` |
