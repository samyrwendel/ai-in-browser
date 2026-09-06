# Como publicar na Chrome Web Store

Passo a passo para o primeiro envio do **AI in Browser**.

## 1. Antes de começar

- [ ] Conta Google para o desenvolvedor (a mesma que vai gerenciar a extensão).
- [ ] Taxa única de **US$ 5** paga no [Developer Dashboard](https://chrome.google.com/webstore/devconsole).
- [ ] Política de privacidade publicada em uma URL pública. Se você usar o
      GitHub Pages deste repositório, ative em **Settings → Pages → Deploy from
      a branch → `main` / `/docs`**. A política fica em
      `https://<seu-usuario>.github.io/ai-in-browser/privacy.html`.

## 2. Gerar o pacote

```bash
./build.sh
```

Isso cria `dist/ai-in-browser-1.0.0.zip` contendo apenas os arquivos da
extensão (sem `store/`, `docs/`, `.github/` nem arquivos de desenvolvimento).

Teste o pacote antes de enviar: descompacte em uma pasta, abra
`chrome://extensions`, ative o **Modo do desenvolvedor** e use **Carregar sem
compactação**. Confirme que o painel abre, que uma conversa funciona e que o
modo Navegar executa uma tarefa simples.

## 3. Criar o item na loja

1. Acesse o [Developer Dashboard](https://chrome.google.com/webstore/devconsole)
   e clique em **Adicionar novo item**.
2. Envie o `.zip` gerado.
3. Preencha a aba **Ficha da loja** com os textos de [`LISTING.md`](LISTING.md):
   - Descrição detalhada, categoria **Ferramentas**, idioma **Português (Brasil)**.
   - Ícone 128×128: `icons/icon128.png`.
   - Capturas 1280×800: as cinco imagens de `store/screenshots/`.
   - Bloco promocional pequeno 440×280: `store/promo/promo-440x280.png`.
   - Bloco marquee 1400×560 (opcional): `store/promo/promo-1400x560.png`.
   - URL da política de privacidade.
4. Na aba **Práticas de privacidade**, preencha a finalidade única, as
   justificativas de cada permissão e as declarações de uso de dados. Todos os
   textos prontos estão em [`LISTING.md`](LISTING.md).
5. Na aba **Distribuição**, escolha visibilidade **Pública** (ou **Não listada**
   para testar antes) e os países.
6. Clique em **Enviar para revisão**.

## 4. O que costuma atrasar a revisão

| Ponto | Como já está tratado |
|---|---|
| Permissões amplas sem explicação | Cada permissão tem justificativa pronta em `LISTING.md`. |
| `debugger` | Declarada como **opcional**: a extensão instala sem ela e só a solicita quando o usuário ativa o modo Navegar. Se recusada, o agente continua funcionando com eventos de DOM. |
| `<all_urls>` | Necessária para falar com a API do provedor escolhido (qualquer domínio, inclusive `localhost`) e para agir na aba indicada pelo usuário. Justificativa pronta. |
| Código remoto | Nenhum. Todo o código está no pacote; nada é baixado e executado. |
| Coleta de dados | Nenhuma pelos autores. A política de privacidade explica o fluxo. |
| Marcas de terceiros | O nome não usa marcas de terceiros. Os nomes de modelos aparecem apenas como descrição de compatibilidade. |

Revisões de extensões que pedem `debugger` e host permissions amplas podem levar
mais dias que a média. Responda a eventuais pedidos de esclarecimento pelo
próprio painel.

## 5. Atualizações futuras

1. Suba o número em `manifest.json` (a Chrome Web Store exige versão sempre
   maior que a publicada).
2. Registre as mudanças em `CHANGELOG.md`.
3. Rode `./build.sh` e envie o novo `.zip` em **Pacote → Enviar novo pacote**.

Marcando uma tag `v*` no GitHub, o workflow `.github/workflows/release.yml`
gera o `.zip` e anexa a uma release automaticamente.

## 6. Regenerar os recursos gráficos

```bash
python3 -m http.server 8765     # na raiz do projeto
./store/_shots/capture.sh       # capturas 1280x800
```

Os blocos promocionais saem de `store/promo/_small.html` e
`store/promo/_marquee.html`, capturados do mesmo jeito nos tamanhos 440×280 e
1400×560.
