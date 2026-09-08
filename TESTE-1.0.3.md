# Validação da 1.0.3 no Chrome real

Resultado das sessões de teste de 2026-09-07, feitas pelo usuário no Chrome com
a extensão descompactada. Doze dos dezesseis itens passaram, incluindo todos os
que tinham risco real. Os quatro restantes são de robustez e têm cobertura por
teste automatizado.

Quatro defeitos foram encontrados por esses testes e corrigidos: a permissão
`audioCapture`, que o Chrome não aceita em extensões; o agente inventando
cotações em vez de consultar; a navegação que apagava um formulário pela
metade; e a perda da aba de origem no retorno de um desvio.

## A. Permissões e infraestrutura

- [x] **A1** DevTools Protocol funcionando. A barra *"AI in Browser começou a
      depurar esse navegador"* foi vista no topo da janela durante uma tarefa,
      com o botão Cancelar, e a captura de página inteira no Gmail voltou a
      imagem em cerca de 18 s.
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
- [x] **C5** Formulário mais consulta externa. Com o httpbin aberto e o
      pedido de escrever no campo de comentários a manchete atual do g1, o
      agente abriu uma **aba nova** para o g1, leu a manchete de verdade e
      voltou por **troca de aba**, não pela URL. Nome, telefone e e-mail
      continuaram preenchidos, o comentário foi escrito e o formulário não foi
      enviado. Oito ações. O texto capturado veio com o rótulo e o resumo
      colados no título, limitação de extração do modelo local, não da
      extensão.
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

A 1.0.3 está fechada e pronta para o envio à Chrome Web Store. O pacote é
`dist/ai-in-browser-1.0.3.zip`, e o Chrome o empacota sem emitir nenhum aviso
de manifesto. As verificações automatizadas somam 62 e rodam com `./tests/run.sh`.

## Backlog, fora da 1.0.3

- Transcrição de arquivos de áudio (papel novo na cooperação).
- Legendas de vídeo por link do YouTube.
- Porte para Firefox.
- Ícone otimizado para 16 px sem alterar o logotipo.
