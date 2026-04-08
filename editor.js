// ── Tokenizer (shared by formatter) ──────────────────────────────────────────
const POLISH = 'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ';
const TOKEN_RE = new RegExp(
  [
    /\/\/[^\n]*/.source, // comment
    /"(?:[^"\\]|\\.)*"/.source, // string
    /==/.source, // double-char op first
    /[{}()\[\],:.]/.source, // punctuation
    /[+\-*\/<>]/.source, // operators
    /[0-9]+(?:\.[0-9]+)?/.source, // number
    `[a-zA-Z_${POLISH}][a-zA-Z0-9_${POLISH}]*`, // identifier / keyword
    /\s+/.source, // whitespace (skipped)
    /./.source, // fallback
  ].join('|'),
  'g',
);

function _tokenize(src) {
  const tokens = [];
  let m;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(src)) !== null) {
    const v = m[0];
    if (/^\s+$/.test(v)) continue;
    let type;
    if (v.startsWith('//')) type = 'comment';
    else if (v.startsWith('"')) type = 'string';
    else if (v === '{') type = 'lbrace';
    else if (v === '}') type = 'rbrace';
    else if (v === '(') type = 'lparen';
    else if (v === ')') type = 'rparen';
    else if (v === '[') type = 'lbracket';
    else if (v === ']') type = 'rbracket';
    else if (v === ',') type = 'comma';
    else if (v === '.') type = 'dot';
    else if (v === ':') type = 'colon';
    else if (/^[+\-*\/<>]$|^==$/.test(v)) type = 'op';
    else if (/^[0-9]/.test(v)) type = 'number';
    else if (/^[a-zA-Z_]/.test(v) || POLISH.includes(v[0])) type = 'word';
    else type = 'other';
    tokens.push({ type, value: v });
  }
  return tokens;
}

// ── Formatter ────────────────────────────────────────────────────────────────
// Keywords that introduce a new statement and should start on a fresh line.
const STMT_KW = new Set([
  'moduł',
  'warstwa',
  'zmienna',
  'parametr',
  'stany',
  'szablon',
  'akcja',
  'jeśli',
  'inaczej',
  'ustaw',
  'wypisz',
  'wywołaj',
  'efekt',
  'opóźnij',
  'cyklicznie',
]);

function _formatCebula(src) {
  const tokens = _tokenize(src);
  const IND = '    ';

  let out = '';
  let brace = 0; // depth of statement blocks  { }
  let paren = 0; // depth of expression context ( ) [ ] { }

  const ind = () => IND.repeat(brace);
  const nl = () => {
    out = out.trimEnd();
    out += '\n' + ind();
  };
  const sp = () => {
    if (out.length && !/[ \n]$/.test(out)) out += ' ';
  };
  const noSpc = () => out.trimEnd() === out; // true when no trailing space

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    const nxt = tokens[i + 1];

    // ── Comments ────────────────────────────────────────────
    if (tok.type === 'comment') {
      if (!/\n$/.test(out)) nl();
      out += tok.value;
      nl();
      continue;
    }

    // ── Block braces (only at paren depth 0) ────────────────
    if (tok.type === 'lbrace' && paren === 0) {
      sp();
      out += '{';
      brace++;
      if (nxt?.type !== 'rbrace') nl();
      continue;
    }
    if (tok.type === 'rbrace' && paren === 0) {
      brace = Math.max(0, brace - 1);
      out = out.trimEnd();
      out += '\n' + ind() + '}';
      const nextIsInaczej = nxt?.type === 'word' && nxt.value === 'inaczej';
      const nextIsRbrace = nxt?.type === 'rbrace';
      if (!nextIsInaczej && !nextIsRbrace && nxt) nl();
      continue;
    }

    // ── Expression grouping ─────────────────────────────────
    if (tok.type === 'lbrace') {
      paren++;
      sp();
      out += '{';
      continue;
    }
    if (tok.type === 'rbrace') {
      paren--;
      out += '}';
      continue;
    }
    if (tok.type === 'lparen') {
      paren++;
      out += '(';
      continue;
    }
    if (tok.type === 'rparen') {
      paren--;
      out += ')';
      continue;
    }
    if (tok.type === 'lbracket') {
      paren++;
      out += '[';
      continue;
    }
    if (tok.type === 'rbracket') {
      paren--;
      out += ']';
      continue;
    }

    // ── Punctuation ─────────────────────────────────────────
    if (tok.type === 'comma') {
      out += ',';
      sp();
      continue;
    }
    if (tok.type === 'colon') {
      out += ':';
      sp();
      continue;
    }
    if (tok.type === 'dot') {
      out += '.';
      continue;
    }
    if (tok.type === 'op') {
      sp();
      out += tok.value;
      sp();
      continue;
    }

    // ── Statement keywords (at block level only) ────────────
    if (tok.type === 'word' && STMT_KW.has(tok.value) && paren === 0) {
      const endsWithBrace = out.trimEnd().endsWith('}');
      if (tok.value === 'inaczej' && endsWithBrace) {
        // `} inaczej {` — keep on same line
        sp();
      } else if (out.length > 0) {
        nl();
      }
      out += tok.value;
      continue;
    }

    // ── Everything else ─────────────────────────────────────
    if (!/[ \n(\[.]$/.test(out) && out.length > 0) sp();
    out += tok.value;
  }

  return out.trimEnd() + '\n';
}

// ── Editor ───────────────────────────────────────────────────────────────────
const CebulaEditor = {
  editor: null,

  init(id, code, engine) {
    require(['vs/editor/editor.main'], () => {
      monaco.languages.register({ id: 'cebula' });

      // ── Syntax highlighting ──────────────────────────────
      monaco.languages.setMonarchTokensProvider('cebula', {
        keywords: [...engine.getKeywords()],
        tokenizer: {
          root: [
            [/\/\/.*/, 'comment'],
            [/".*?"/, 'string'],
            [/[0-9]+(?:\.[0-9]+)?/, 'number'],
            [
              new RegExp(`[a-zA-Z_${POLISH}][a-zA-Z0-9_${POLISH}]*`),
              { cases: { '@keywords': 'keyword', '@default': 'identifier' } },
            ],
          ],
        },
      });

      // ── Auto-formatter ───────────────────────────────────
      monaco.languages.registerDocumentFormattingEditProvider('cebula', {
        provideDocumentFormattingEdits(model) {
          const formatted = _formatCebula(model.getValue());
          return [
            {
              range: model.getFullModelRange(),
              text: formatted,
            },
          ];
        },
      });

      this.editor = monaco.editor.create(document.getElementById(id), {
        value: code,
        language: 'cebula',
        theme: 'vs-dark',
        automaticLayout: true,
        fontSize: 14,
        minimap: { enabled: false },
        formatOnPaste: true,
      });
    });
  },
};

export default CebulaEditor;
