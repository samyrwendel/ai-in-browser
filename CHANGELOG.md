# Changelog

Todas as mudanças relevantes deste projeto são documentadas aqui.
O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e
[SemVer](https://semver.org/lang/pt-BR/).

## [1.0.2] — 2026-09-07

Auditoria de segurança e privacidade antes do envio à Chrome Web Store.

### Corrigido
- **A lista de sites bloqueados agora vale também para leitura.** Antes ela
  impedia o agente de clicar, digitar e navegar num domínio proibido, mas ele
  ainda podia ler o texto, o HTML, o código-fonte, o console, a rede e tirar
  capturas de tela dele. Todas as ferramentas de leitura passam pelo mesmo
  guarda.
- Sessões do depurador e seus buffers de console e rede não eram liberados
  quando a aba era fechada, acumulando memória; agora são limpos em
  `onDetach` e em `tabs.onRemoved`.
- Fechar o painel no meio de uma tarefa podia deixar a barra de depuração do
  Chrome presa; o desanexo passa a ser feito de forma síncrona ao fechar.
- Dados base64 de imagens são saneados antes de ir para o atributo `src`.

## [1.0.1] — 2026-09-07

### Adicionado
- **Cooperação entre modelos.** O modelo principal pode delegar habilidades que
  não tem a outro modelo ativo, de qualquer provedor: **visão** (descreve
  imagens anexadas e capturas do agente), **navegação** (conduz o modo
  Navegar com tool calling nativo), **raciocínio profundo** (assume quando o
  esforço está em Alto), **documentos longos** (assume quando a mensagem não
  cabe no contexto), **tarefas auxiliares** (títulos de conversa, só com
  modelos locais ou gratuitos) e **reserva** (responde quando o principal
  falha). Cada papel pode ficar em automático, fixo num modelo ou desligado,
  em Configurações → Cooperação. Cada papel tem uma prioridade (qualidade,
  equilíbrio ou preço) e uma tabela comparativa dos modelos ativos com
  qualidade conhecida para a habilidade, preço por milhão de tokens e
  contexto, além da explicação do que o automático escolheria. Roteadores
  como o Auto Router, lotes (`:batch`) e apelidos (`~…-latest`) ficam fora
  das sugestões, e cada tabela tem busca por nome, provedor ou id. As mensagens mostram quem
  cooperou, e um indicador na barra de composição mostra, antes de enviar,
  quantos ajudantes estão em jogo e quem cobre cada habilidade (automático,
  fixo, o principal cobre, desligado). O automático só preenche lacunas:
  se o modelo principal tem a habilidade, ele mesmo cobre; para usar um
  ajudante "melhor" que o principal, fixe-o.

### Alterado
- Composição no estilo do Claude Code: a caixa com borda contém só o texto e os
  controles ficam numa linha própria, colada à borda inferior, que quebra em
  duas linhas apenas quando não cabe (ferramentas à esquerda; modelo, esforço
  e voz à direita). O botão de enviar/parar fica dentro da caixa, no canto
  inferior direito, e a altura se ajusta por uma alça no topo da caixa
  (clique duplo volta ao automático). A caixa de texto
  começa com três linhas e cresce até 45% da altura do painel, para revisar e
  editar o prompt antes de enviar; também pode ser redimensionada pela alça do
  canto, e a altura escolhida é lembrada. Itens da barra e nomes de modelo
  menores e mais discretos.
- O seletor de modelos lista os lançamentos mais recentes primeiro, com a
  data de lançamento e a etiqueta "novo" (30 dias), e permite ordenar por
  nome ou preço; lotes (`:batch`) e apelidos (`~…latest`) só aparecem quando
  procurados. Nas tabelas de cooperação há a coluna "Lançado" e a prioridade
  "Recentes".
- Provedores começam **desativados** e passam a ativos quando você cola uma
  chave, quando o teste de conexão passa ou quando um servidor local é
  detectado no primeiro uso. Só os ativos aparecem no seletor e são sondados.
  Configurações antigas são migradas: provedores sem chave e fora de uso são
  desativados.
- A borda e o selo de cada provedor refletem o último teste real
  ("conectada", "falhou no teste", "não testada"), não mais a simples
  presença de chave.

### Corrigido
- O ditado por voz falhava silenciosamente no painel lateral porque o Chrome
  não exibe o pedido de microfone ali. Agora a extensão solicita a permissão
  opcional `audioCapture` no clique do microfone, e há um botão "Testar
  microfone" em Configurações → Comportamento para conceder e verificar.
- No modo Navegar, imagens anexadas pelo usuário eram ignoradas: o agente
  respondia sobre a aba aberta em vez do anexo. Agora o anexo é descrito antes
  da tarefa (pelo próprio modelo, se enxergar, ou pelo ajudante de visão) e
  entra no contexto, com instrução de não usar a captura de tela como
  substituto.
- Fixar um papel num roteador, num lote `:batch` ou num apelido `~…latest`
  deixava a cooperação sem efeito silenciosamente; agora essas fixações caem
  no automático e a tela explica o motivo.
- Cada passo do agente mostra quem descreveu a captura (`👁️ modelo`) ou avisa
  `sem visão` quando nenhum modelo com visão está ativo, em vez de deixar o
  usuário sem saber se houve cooperação.
- Modelos de visão com `v` no nome (GLM 4.6V, GLM 5V Turbo, Qwen VL) passam a
  ser reconhecidos como capazes de visão.
- Ollama e servidores compatíveis com OpenAI passam a funcionar sem configurar
  `OLLAMA_ORIGINS`: a extensão remove o cabeçalho `Origin` das próprias
  requisições para as URLs base locais ou personalizadas (nova permissão
  `declarativeNetRequestWithHostAccess`, restrita ao iniciador da extensão).
- O botão "Testar conexão" agora faz uma sonda `POST` com a mesma forma do
  chat; antes aprovava a listagem de modelos e o chat falhava com 403.
- O erro 403 sem chave de API explica que a origem foi recusada, em vez de
  acusar chave inválida.
- A resposta do usuário a uma pergunta do agente aparece dentro do bloco da
  pergunta, preservando a ordem da conversa.
- Ícone 128×128 da loja com margem, conforme as diretrizes.
- Quando a aba ativa não é uma página web (configurações da extensão, aba
  em branco, páginas internas), o agente passa a usar a última página web
  aberta **avisando** o modelo e o usuário, em vez de descrevê-la como se
  fosse a tela atual. A aba de trabalho aparece na barra de status e no
  resumo da tarefa.

## [1.0.0] — 2026-09-06

Primeira versão pública, preparada para a Chrome Web Store.

### Adicionado
- Chat no painel lateral e em aba, com streaming, Markdown, realce de código,
  tabelas, bloco de raciocínio, tokens e custo por resposta.
- Provedores: OpenRouter, OpenAI, Anthropic, Ollama, LM Studio e qualquer
  endpoint compatível (presets para Groq, DeepSeek, xAI, Mistral, Together,
  Gemini, vLLM, llama.cpp e Jan).
- Seletor de modelos com busca, favoritos, destaques, filtro de gratuitos,
  preço por milhão de tokens e tamanho de contexto.
- Modo **Navegar** (agente): observa a página com elementos indexados, clica,
  digita, seleciona, rola, navega, controla abas, lê HTML e código-fonte,
  executa JavaScript, lê console e rede, tira capturas com etiquetas e
  pergunta antes de ações sensíveis.
- Anexos (imagens e arquivos de texto), captura da aba, ditado por voz e
  seletor de esforço de raciocínio.
- Histórico com busca, exportação em Markdown e backup JSON.
- Temas claro/escuro, seis cores de destaque e tamanho de fonte.

### Segurança e privacidade
- `history` e `downloads` são permissões **opcionais**, pedidas apenas quando o
  recurso é usado. (`debugger` precisa ser obrigatória: o Chrome não a aceita
  como opcional.)
- Lista de domínios bloqueados para o agente e interruptor para desativar a
  execução de JavaScript na página.
- Nenhuma telemetria: as chaves ficam em `chrome.storage.local` e o tráfego vai
  apenas para o provedor escolhido.
