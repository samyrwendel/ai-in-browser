# Política de Privacidade — AI in Browser

**Última atualização:** 6 de setembro de 2026

O AI in Browser é uma extensão de código aberto que roda inteiramente no seu
navegador. **Não existe servidor do AI in Browser.** Não coletamos, não
armazenamos e não transmitimos dados para nós, porque não há um "nós" no meio da
conversa: a extensão fala diretamente com o provedor de IA que **você** escolher.

## O que fica salvo no seu navegador

Tudo é gravado apenas em `chrome.storage.local`, no seu perfil, e nunca sai dali
por iniciativa da extensão:

- Chaves de API que você cadastrar.
- Endereços (URLs base) dos provedores configurados.
- Histórico de conversas, incluindo mensagens, anexos e os passos do agente.
- Preferências: tema, modelo escolhido, favoritos e ajustes do agente.

Você pode apagar tudo a qualquer momento em **Configurações → Dados**, ou
removendo a extensão.

## O que é enviado para fora

Somente para o provedor que você configurou e apenas quando você envia uma
mensagem ou executa uma tarefa. Nesse envio vão:

- Suas mensagens e o histórico da conversa atual.
- Anexos que você adicionar (imagens e arquivos de texto).
- O conteúdo da página quando você anexa a página, seleciona um trecho ou usa o
  modo Navegar (texto visível, lista de elementos interativos e, se o modelo
  tiver visão e a opção estiver ligada, capturas de tela da aba).

O destino é exclusivamente a URL base da conexão ativa, por exemplo
`https://openrouter.ai/api/v1`, `https://api.openai.com/v1`,
`https://api.anthropic.com/v1` ou `http://localhost:11434/v1`. Com um modelo
local (Ollama, LM Studio), **nada sai do seu computador**.

O tratamento dos dados depois disso é regido pela política do provedor
escolhido. Consulte a política de quem você usar, por exemplo
[OpenRouter](https://openrouter.ai/privacy),
[OpenAI](https://openai.com/policies/privacy-policy) ou
[Anthropic](https://www.anthropic.com/legal/privacy).

## O que a extensão nunca faz

- Não usa telemetria, analytics, rastreadores, cookies ou identificadores.
- Não vende, aluga nem compartilha dados com terceiros.
- Não envia dados para nenhum servidor dos autores da extensão.
- Não lê páginas em segundo plano: só acessa a aba quando você pede
  (botão Página, menu de contexto ou uma tarefa no modo Navegar).
- Não carrega código remoto. Todo o código executado está no pacote publicado.

## Permissões e por que existem

| Permissão | Para quê |
|---|---|
| `sidePanel` | Mostrar o chat no painel lateral |
| `storage`, `unlimitedStorage` | Salvar preferências, chaves e conversas localmente |
| `contextMenus` | Itens "Perguntar ao AI in Browser" e "Resumir esta página" |
| `activeTab`, `scripting` | Ler o conteúdo da aba e executar as ações do agente, sempre a partir de uma ação sua |
| `tabs` | Ver título/URL da aba de trabalho e abrir, alternar ou fechar abas durante uma tarefa |
| `clipboardWrite` | Copiar respostas e trechos de código |
| `declarativeNetRequestWithHostAccess` | Remover o cabeçalho `Origin` apenas das requisições da própria extensão para os servidores de modelos locais ou personalizados que você configurou, para que aceitem a conexão sem configuração extra. Não altera requisições de sites |
| `host_permissions: <all_urls>` | Falar com a API do provedor que você configurar (inclusive `localhost`) e atuar na aba que você indicar |
| `debugger` | Cliques e teclas confiáveis, captura de página inteira, console, rede e código-fonte durante tarefas do modo Navegar. Só é anexada à aba enquanto uma tarefa pedida por você roda, e é liberada ao terminar. Pode ser desligada em Configurações → Agente |
| `audioCapture` *(opcional)* | Ditado por voz. Pedida só quando você clica no microfone. O áudio é transcrito pelo serviço de reconhecimento de voz do navegador e nunca é enviado ao provedor de IA; só o texto vai |
| `history` *(opcional)* | Ferramenta de busca no histórico. Desligada por padrão |
| `downloads` *(opcional)* | Ferramenta de download de arquivos. Desligada por padrão |

## Modo Navegar (agente)

Quando ativado, o modelo recebe informações da aba de trabalho para executar a
tarefa que você pediu. O agente é instruído a pedir confirmação antes de ações
sensíveis (compras, pagamentos, envio de mensagens, exclusões, alteração de
configurações de conta), a nunca digitar credenciais que você não tenha
fornecido e a não resolver CAPTCHAs. Você pode interromper a qualquer momento,
bloquear domínios em **Configurações → Agente** e desativar a execução de
JavaScript na página.

Ainda assim, um modelo de IA pode errar. Não use o modo Navegar em páginas com
dados sensíveis sem acompanhar o que ele faz.

## Crianças

A extensão não é direcionada a menores de 13 anos e não coleta dados de forma
consciente de nenhuma faixa etária.

## Alterações

Mudanças nesta política serão publicadas neste arquivo, no repositório do
projeto, com a data de atualização revisada.

## Contato

Abra uma issue no repositório do projeto:
<https://github.com/samyrwendel/ai-in-browser/issues>
