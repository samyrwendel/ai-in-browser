// AI in Browser — renderizador Markdown compacto e seguro (sem dependências)
// Todo texto é escapado antes de virar HTML; apenas links http(s)/mailto são permitidos.

import { highlight } from './highlight.js';

const PH_OPEN = '';
const PH_CLOSE = '';

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function safeUrl(u) {
  return /^(https?:\/\/|mailto:)/i.test(u);
}

function codeBlock(code, lang) {
  const label = lang ? esc(lang) : 'texto';
  const cls = lang ? ` class="language-${esc(lang)}"` : '';
  return (
    `<div class="codeblock"><div class="codeblock-head"><span class="codeblock-lang">${label}</span>` +
    `<button class="copy-code" type="button" title="Copiar código">Copiar</button></div>` +
    `<pre><code${cls}>${highlight(code, lang)}</code></pre></div>`
  );
}

export function inline(text) {
  const codes = [];
  let s = esc(text);

  // code spans
  s = s.replace(/(`+)([\s\S]*?[^`])\1(?!`)/g, (_, ticks, c) => {
    codes.push(`<code>${c.replace(/^ (.*) $/, '$1')}</code>`);
    return `${PH_OPEN}${codes.length - 1}${PH_CLOSE}`;
  });

  // imagens
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, (_, alt, src) =>
    safeUrl(src) ? `<img src="${src}" alt="${alt}" loading="lazy">` : alt
  );

  // links
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, (_, label, href) =>
    safeUrl(href) ? `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>` : label
  );

  // autolinks
  s = s.replace(/(^|[^"'>=\w/])(https?:\/\/[^\s<]+?)([.,;:!?)\]]*)(?=\s|$|<)/g, (_, pre, url, tail) => {
    return `${pre}<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>${tail}`;
  });

  // ênfases
  s = s.replace(/\*\*\*([^*\n]+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  s = s.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/__([^_\n]+?)__/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*\w])\*([^*\n]+?)\*(?![*\w])/g, '$1<em>$2</em>');
  s = s.replace(/(^|[^_\w])_([^_\n]+?)_(?![_\w])/g, '$1<em>$2</em>');
  s = s.replace(/~~([^~\n]+?)~~/g, '<del>$1</del>');

  // quebras de linha
  s = s.replace(/ {2,}\n|\\\n/g, '<br>').replace(/\n/g, '<br>');

  // restaura code spans
  s = s.replace(new RegExp(`${PH_OPEN}(\\d+)${PH_CLOSE}`, 'g'), (_, n) => codes[Number(n)]);
  return s;
}

const LIST_RE = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const FENCE_RE = /^\s*(```+|~~~+)\s*([\w+#.-]*)\s*$/;
const TABLE_SEP_RE = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

function isBlockStart(line) {
  return (
    FENCE_RE.test(line) ||
    /^\s{0,3}#{1,6}\s/.test(line) ||
    /^\s*>/.test(line) ||
    LIST_RE.test(line) ||
    /^\s*([-*_])(\s*\1){2,}\s*$/.test(line)
  );
}

function splitRow(row) {
  let r = row.trim();
  if (r.startsWith('|')) r = r.slice(1);
  if (r.endsWith('|')) r = r.slice(0, -1);
  return r.split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, '|').trim());
}

function parseList(lines, start) {
  const first = lines[start].match(LIST_RE);
  const baseIndent = first[1].length;
  const ordered = /\d/.test(first[2]);
  const startNum = ordered ? parseInt(first[2], 10) : 1;
  const contentIndent = baseIndent + first[2].length + 1;
  const items = [];
  let i = start;

  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) {
      const nxt = lines[i + 1];
      if (nxt === undefined) break;
      const nm = nxt.match(LIST_RE);
      const nIndent = nxt.match(/^\s*/)[0].length;
      if ((nm && nm[1].length >= baseIndent) || (nxt.trim() && nIndent >= contentIndent)) {
        if (items.length) items[items.length - 1].push('');
        i++;
        continue;
      }
      break;
    }
    const m = l.match(LIST_RE);
    const indent = l.match(/^\s*/)[0].length;
    if (m && m[1].length === baseIndent) {
      if (/\d/.test(m[2]) !== ordered) break;
      items.push([m[3]]);
      i++;
      continue;
    }
    if (m && m[1].length < baseIndent) break;
    if (indent > baseIndent && items.length) {
      items[items.length - 1].push(l.slice(Math.min(indent, contentIndent)));
      i++;
      continue;
    }
    break;
  }

  const html = items
    .map((it) => {
      let firstLine = it[0];
      let cls = '';
      const task = firstLine.match(/^\[([ xX])\]\s+(.*)$/);
      if (task) {
        const checked = task[1] !== ' ';
        cls = ' class="task"';
        firstLine = `<input type="checkbox" disabled${checked ? ' checked' : ''}> ${inline(task[2])}`;
      } else {
        firstLine = inline(firstLine);
      }
      const rest = it.slice(1).join('\n');
      let inner = firstLine;
      if (rest.trim()) {
        if (/^\s*([-*+]|\d+[.)])\s+|^\s*(```|~~~)|^\s*>/m.test(rest)) inner += render(rest);
        else inner += '<br>' + inline(rest.trim());
      }
      return `<li${cls}>${inner}</li>`;
    })
    .join('');

  const tag = ordered ? `<ol${startNum !== 1 ? ` start="${startNum}"` : ''}>${html}</ol>` : `<ul>${html}</ul>`;
  return [tag, i];
}

function parseTable(lines, i) {
  const header = splitRow(lines[i]);
  const aligns = splitRow(lines[i + 1]).map((c) => {
    const l = c.startsWith(':');
    const r = c.endsWith(':');
    return l && r ? 'center' : r ? 'right' : l ? 'left' : '';
  });
  let j = i + 2;
  const rows = [];
  while (j < lines.length && lines[j].includes('|') && lines[j].trim()) {
    rows.push(splitRow(lines[j]));
    j++;
  }
  const th = header.map((h, k) => `<th${aligns[k] ? ` style="text-align:${aligns[k]}"` : ''}>${inline(h)}</th>`).join('');
  const body = rows
    .map(
      (r) =>
        '<tr>' +
        header.map((_, k) => `<td${aligns[k] ? ` style="text-align:${aligns[k]}"` : ''}>${inline(r[k] ?? '')}</td>`).join('') +
        '</tr>'
    )
    .join('');
  return [`<div class="table-wrap"><table><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table></div>`, j];
}

export function render(src) {
  const lines = String(src ?? '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    const fence = line.match(FENCE_RE);
    if (fence) {
      const marker = fence[1][0];
      const minLen = fence[1].length;
      const lang = fence[2];
      const buf = [];
      i++;
      while (i < lines.length) {
        const t = lines[i].trim();
        if (t.startsWith(marker.repeat(minLen)) && t.split(marker).join('') === '') break;
        buf.push(lines[i]);
        i++;
      }
      i++;
      out.push(codeBlock(buf.join('\n'), lang));
      continue;
    }

    if (!line.trim()) {
      i++;
      continue;
    }

    const h = line.match(/^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (h) {
      out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
      i++;
      continue;
    }

    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      out.push('<hr>');
      i++;
      continue;
    }

    if (/^\s*>/.test(line)) {
      const buf = [];
      while (i < lines.length && (/^\s*>/.test(lines[i]) || (lines[i].trim() && !isBlockStart(lines[i]) && buf.length))) {
        buf.push(lines[i].replace(/^\s*>\s?/, ''));
        i++;
      }
      out.push(`<blockquote>${render(buf.join('\n'))}</blockquote>`);
      continue;
    }

    if (line.includes('|') && i + 1 < lines.length && TABLE_SEP_RE.test(lines[i + 1])) {
      const [html, next] = parseTable(lines, i);
      out.push(html);
      i = next;
      continue;
    }

    if (LIST_RE.test(line)) {
      const [html, next] = parseList(lines, i);
      out.push(html);
      i = next;
      continue;
    }

    if (/^ {4}|^\t/.test(line) && (i === 0 || !lines[i - 1].trim())) {
      const buf = [];
      while (i < lines.length && (/^ {4}|^\t/.test(lines[i]) || !lines[i].trim())) {
        buf.push(lines[i].replace(/^( {4}|\t)/, ''));
        i++;
      }
      while (buf.length && !buf[buf.length - 1].trim()) buf.pop();
      out.push(codeBlock(buf.join('\n'), ''));
      continue;
    }

    const buf = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !isBlockStart(lines[i]) &&
      !(lines[i].includes('|') && TABLE_SEP_RE.test(lines[i + 1] || ''))
    ) {
      buf.push(lines[i]);
      i++;
    }
    out.push(`<p>${inline(buf.join('\n'))}</p>`);
  }

  return out.join('\n');
}
