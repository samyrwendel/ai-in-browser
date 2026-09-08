# Changelog

Todas as mudanças relevantes deste projeto são documentadas aqui.
O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e
[SemVer](https://semver.org/lang/pt-BR/).

## [1.0.4] — 2026-09-08

### Adicionado
- **Busca na web por API.** O agente ganhou a ferramenta `web_search`, que faz
  a consulta por HTTP e recebe uma lista curta de título, endereço e trecho.
  Antes, pesquisar significava abrir um buscador numa aba e ler a página
  inteira: uma pesquisa no Google custava perto de trinta mil tokens e mexia
  nas abas do usuário. Quatro provedores, em Configurações → Busca na web:
  **SearXNG** na sua própria instância, sem chave e sem terceiros;
  **OpenRouter**, pelo plugin `web` da conexão que você já tem; **Exa** e
  **Tavily**, com chave própria. O botão *Testar busca* faz a consulta de
  verdade, pelo mesmo caminho do agente.
- **`fetch_url`: ler uma página sem abrir aba.** Não precisa de chave nenhuma
  e funciona mesmo com a busca desligada. A leitura é anônima, sem cookies e
  sem sessão: página que exige login continua sendo trabalho do modo Navegar,
  na aba real do usuário.
- A orientação do agente passa a mandar buscar antes de abrir aba, e abrir aba
  só quando for preciso agir na página ou quando ela depender do login. Sem
  provedor configurado, ele é avisado de que não tem busca e volta ao caminho
  antigo.

### Segurança
- A lista de sites bloqueados vale para as duas ferramentas novas: resultados
  em domínios bloqueados são omitidos da busca, e `fetch_url` recusa lê-los,
  inclusive quando o bloqueio só aparece depois de um redirecionamento.

## [1.0.3] — 2026-09-08

Correções encontradas testando a extensão no Chrome de verdade, depois que a
1.0.2 foi publicada. Nenhuma delas tinha aparecido nos testes automatizados.

### Corrigido
- **O agente se perdia da aba onde a tarefa começou.** Num desvio para
  consultar outro site, ele voltava navegando pela URL da página original em
  vez de trocar de aba, e a navegação recarregava a página e apagava tudo que
  já tinha sido preenchido. O prompt não dizia qual era a aba de origem nem
  mostrava o identificador da aba atual, então as trocas de aba viravam
  chute. Agora a aba onde a tarefa começou é registrada no primeiro passo e
  aparece no prompt com o identificador, junto da instrução de voltar por
  `switch_tab` e nunca pela URL.
- **`audioCapture` era uma permissão inválida.** O Chrome recusava a
  declaração com *"'audioCapture' is only allowed for packaged apps"*, então
  ela era descartada do manifest e o pedido em tempo de execução falhava com
  *"Only permissions specified in the manifest may be requested"*, poluindo a
  página de erros da extensão. Ela nunca foi necessária: o ditado usa o
  reconhecimento de fala do próprio navegador, que pede o microfone pelo
  diálogo padrão do Chrome. A permissão foi removida do manifest, do módulo
  de permissões, da página de configurações e das justificativas da loja.
  Restam duas opcionais, `history` e `downloads`.
- **O agente inventava dados que mudam com o tempo.** Ao preencher um campo
  com "a cotação do dólar hoje", o modelo escreveu um valor tirado da memória
  do treinamento, sem fazer nenhuma consulta, e ainda listou o valor na
  resposta final como se tivesse verificado. A regra genérica de só confiar
  em resultados de ferramentas não bastava para modelos pequenos. Agora há
  uma proibição explícita: cotações, preços, clima, notícias, placares,
  horários, disponibilidade e qualquer coisa "de hoje" ou "atual" têm de ser
  consultadas com uma ferramenta; sem conseguir consultar, ele avisa e
  pergunta, em vez de escrever um número inventado na página.
- **O agente podia apagar um formulário pela metade.** A orientação mandava
  ir direto a uma URL conhecida quando uma ação falhava, e `navigate` troca a
  página da aba de trabalho, descartando tudo que já tinha sido digitado. Se o
  modelo precisasse consultar algo no meio de um preenchimento, havia boa
  chance de levar a própria aba do formulário para o buscador. Agora ele é
  instruído a nunca navegar a aba que tem trabalho em andamento: abre uma aba
  à parte para o desvio, volta para concluir e fecha o desvio. A descrição da
  ferramenta `navigate` também avisa do descarte.
- **Nenhuma resposta aparecia.** Uma variável usada antes de existir derrubava
  a função que cria a mensagem do assistente, e o envio falhava em silêncio com
  qualquer modelo e qualquer provedor.
- **O microfone dava erro em vez de pedir autorização.** O Chrome nunca exibe
  o diálogo do microfone dentro do painel lateral, e o botão tratava a recusa
  do pedido como falha definitiva. Agora ele consulta o estado da permissão
  antes: se já estiver concedida, dita na hora; se não, explica que a
  liberação precisa acontecer fora do painel e abre Configurações →
  Comportamento, onde "Testar microfone" faz o Chrome perguntar.

### Alterado
- As verificações automatizadas passaram a morar no repositório, em `tests/`,
  com um runner (`tests/run.sh`) que roda tudo com o Node, sem dependências.
  São 62 verificações em sete suítes.
- `build.sh` usa `zip -X`: antes, o campo extra com o horário de acesso dos
  arquivos mudava a cada leitura e dois builds seguidos da mesma cópia saíam
  com bytes diferentes. Entre máquinas os bytes ainda divergem por causa das
  datas de modificação, então a conferência entre o pacote publicado e um
  build local é pela lista de arquivos e CRCs.

## [1.0.2] — 2026-09-07

Auditoria de segurança e privacidade antes do envio à Chrome Web Store.

### Corrigido
- O agente podia ficar preso para sempre numa tarefa de visão. As chamadas ao
  modelo que descreve imagens não tinham prazo, e na descrição de anexos elas
  nem recebiam o sinal de cancelamento, então o botão Parar não as alcançava.
  Agora a descrição expira em 90 segundos e a geração de título em 25, o
  cancelamento vale desde o primeiro instante, e o passo mostra "visão
  expirou" com orientação para o agente seguir pelo texto da página.
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
