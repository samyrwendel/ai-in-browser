# Validação da 1.0.2 no Chrome real

Resultado da sessão de testes de 2026-09-07, feita pelo usuário no Chrome com a
extensão descompactada. Dez dos quinze itens passaram, incluindo todos os que
tinham risco real. Os cinco restantes são de robustez e têm cobertura por teste
automatizado.

## A. Permissões e infraestrutura

- [x] **A1** DevTools Protocol funcionando: a captura de página inteira levou
      cerca de 18 s numa aba do Gmail e voltou a imagem. A barra do Chrome
      *"começou a depurar este navegador"* não foi conferida visualmente, mas a
      captura só existe se o depurador tiver anexado.
- [x] **A2** Ditado por voz: o texto falado apareceu no campo de composição.
- [ ] **A3** Fechar o painel no meio de uma tarefa. Não testado. Coberto pelo
      desanexo síncrono em `sidepanel.js` e por `blocklist.test.mjs`.

## B. Ollama e provedores

- [x] **B1** Testar conexão lista os modelos do Ollama.
- [x] **B2** Chat pelo Ollama responde sem o erro 403.
- [x] **B3** Chat por um modelo do OpenRouter responde.

## C. Agente e cooperação

- [x] **C1** Navegar: pesquisa por "gatos" no Google concluída em quatro ações,
      com digitação no campo de busca e leitura dos resultados.
- [x] **C2** Anexo descrito corretamente, com o chip *Visão: GPT-5.6 Luna*. A
      resposta foi sobre o anexo, não sobre a aba aberta.
- [ ] **C3** Parar durante uma descrição de visão. Não testado. Coberto por
      `timeout.test.mjs`.
- [ ] **C4** Expiração da visão em 90 s. Não testado. Coberto por
      `timeout.test.mjs`.

## D. Segurança

- [x] **D1** Domínio bloqueado: o agente recusa ler a página, não só agir nela.
- [ ] **D2** Anexar um mp3. Não testado. O caminho de rejeição de binários é
      código de guarda simples em `sidepanel.js`.

## E. Interface

- [x] **E1** Barra de composição sem sobreposição no painel estreito.
- [ ] **E2** Persistência da altura da caixa de texto. Não testado.
- [x] **E3** Ícone correto na aba e na barra de extensões.

---

## Conclusão

A 1.0.2 está fechada e pronta para o envio à Chrome Web Store. O pacote é
`dist/ai-in-browser-1.0.2.zip`.

## Backlog, fora da 1.0.2

- Transcrição de arquivos de áudio (papel novo na cooperação).
- Legendas de vídeo por link do YouTube.
- Porte para Firefox.
- Ícone otimizado para 16 px sem alterar o logotipo.
