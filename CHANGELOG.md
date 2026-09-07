# Changelog

Todas as mudanças relevantes deste projeto são documentadas aqui.
O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e
[SemVer](https://semver.org/lang/pt-BR/).

## [1.0.1] — 2026-09-07

### Corrigido
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
- `debugger`, `history` e `downloads` são permissões **opcionais**, pedidas
  apenas quando o recurso é usado.
- Lista de domínios bloqueados para o agente e interruptor para desativar a
  execução de JavaScript na página.
- Nenhuma telemetria: as chaves ficam em `chrome.storage.local` e o tráfego vai
  apenas para o provedor escolhido.
