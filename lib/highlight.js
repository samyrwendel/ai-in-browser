// AI in Browser — realce de sintaxe leve (sem dependências)
// Cobre o suficiente para blocos de código em chat: comentários, strings,
// números, palavras-chave, chamadas de função e pontuação.

const KEYWORDS = new Set(
  (
    'abstract as async await break case catch class const continue debugger default delete do else enum export extends ' +
    'false finally for from function if implements import in instanceof interface let new null of package private protected ' +
    'public return static super switch this throw true try typeof undefined var void while with yield ' +
    'def elif except lambda nonlocal pass raise None True False and or not is global assert del with print ' +
    'fn pub mut impl struct trait match use mod crate self Self where loop unsafe type dyn ref ' +
    'func chan defer select map range go package var const type struct interface nil ' +
    'echo then fi done esac elif local export sudo cd ls rm mkdir git npm pip npx yarn ' +
    'int float double char bool boolean string void long short unsigned signed final override virtual namespace using template typename ' +
    'SELECT FROM WHERE INSERT INTO VALUES UPDATE SET DELETE JOIN LEFT RIGHT INNER OUTER ON GROUP BY ORDER LIMIT OFFSET CREATE TABLE DROP ALTER ' +
    'AND OR NOT NULL AS DISTINCT HAVING UNION PRIMARY KEY FOREIGN REFERENCES INDEX VIEW BEGIN COMMIT ROLLBACK ' +
    'select from where insert into values update set delete join left right inner outer on group by order limit offset create table drop alter ' +
    'and or not null as distinct having union primary key foreign references index view begin commit rollback ' +
    'val fun object companion data sealed when open override suspend ' +
    'guard let var func protocol extension enum struct import throws rethrows defer inout ' +
    'end begin do unless until module require include attr_accessor puts'
  ).split(/\s+/)
);

const HASH_COMMENT_LANGS = new Set([
  'python', 'py', 'bash', 'sh', 'shell', 'zsh', 'yaml', 'yml', 'ruby', 'rb', 'toml', 'ini', 'conf', 'dockerfile', 'makefile', 'r', 'perl', 'pl', 'powershell', 'ps1', 'nginx'
]);

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function highlight(code, lang = '') {
  lang = (lang || '').toLowerCase();
  const hashComments = HASH_COMMENT_LANGS.has(lang);
  const slashComments = !hashComments;
  const isHtml = /^(html|xml|svg|vue|jsx|tsx)$/.test(lang);

  const parts = [];
  const re = /(\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->)|(\/\/[^\n]*)|(#[^\n]*)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b0x[\da-fA-F]+\b|\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b)|(<\/?[A-Za-z][\w:-]*)|(\b[A-Za-z_$][\w$]*\b)(?=\s*\()|(\b[A-Za-z_$][\w$]*\b)|([{}()[\];,.<>=+\-*/%!&|^~?:@])/g;

  let last = 0;
  let m;
  while ((m = re.exec(code))) {
    if (m.index > last) parts.push(esc(code.slice(last, m.index)));
    const [full, block, slash, hash, str, num, tag, fn, word, punct] = m;
    if (block) parts.push(`<span class="tok-c">${esc(full)}</span>`);
    else if (slash) {
      if (slashComments) parts.push(`<span class="tok-c">${esc(full)}</span>`);
      else parts.push(esc(full));
    } else if (hash) {
      if (hashComments) parts.push(`<span class="tok-c">${esc(full)}</span>`);
      else parts.push(esc(full));
    } else if (str) parts.push(`<span class="tok-s">${esc(full)}</span>`);
    else if (num) parts.push(`<span class="tok-n">${esc(full)}</span>`);
    else if (tag) {
      if (isHtml) parts.push(`<span class="tok-t">${esc(full)}</span>`);
      else parts.push(esc(full));
    } else if (fn) {
      if (KEYWORDS.has(full)) parts.push(`<span class="tok-k">${esc(full)}</span>`);
      else parts.push(`<span class="tok-f">${esc(full)}</span>`);
    } else if (word) {
      if (KEYWORDS.has(full)) parts.push(`<span class="tok-k">${esc(full)}</span>`);
      else if (/^[A-Z][\w$]*$/.test(full) && full.length > 1) parts.push(`<span class="tok-ty">${esc(full)}</span>`);
      else parts.push(esc(full));
    } else if (punct) parts.push(`<span class="tok-p">${esc(full)}</span>`);
    else parts.push(esc(full));
    last = m.index + full.length;
  }
  if (last < code.length) parts.push(esc(code.slice(last)));
  return parts.join('');
}
