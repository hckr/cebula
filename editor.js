// ── Tokenizer (shared by formatter) ──────────────────────────────────────────
const POLISH = 'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ';
const TOKEN_RE = new RegExp(
  [
    /\/\/[^\n]*/.source, // comment
    /"(?:[^"\\]|\\.)*"/.source, // string
    /!=/.source, // not-equal op
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
    else if (/^[+\-*\/<>]$|^==$|^!=$/.test(v)) type = 'op';
    else if (/^[0-9]/.test(v)) type = 'number';
    else if (/^[a-zA-Z_]/.test(v) || POLISH.includes(v[0])) type = 'word';
    else type = 'other';
    tokens.push({ type, value: v });
  }
  return tokens;
}

// ── Formatter ────────────────────────────────────────────────────────────────
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
  'opóźnij',
  'cyklicznie',
  'anuluj',
  'przekształć',
]);

// ── Multi-line container detection ───────────────────────────────────────────
// Scans forward from the token *after* an opening bracket to determine whether
// the container should be formatted across multiple lines.
//
// For { } objects:  multi-line when there are 2+ key-value pairs (2+ colons at depth 1).
// For [ ] arrays:   multi-line when there are 2+ elements AND at least one element
//                   is complex (contains a nested call or object — i.e. a '(' or '{').
//
// Both rules use the same scan; the caller decides which metric to evaluate.

function _scanContainer(tokens, startIdx, closerType) {
  let depth = 1;
  let commaCount = 0; // separators at depth 1
  let colonCount = 0; // object key:value colons at depth 1
  let hasComplex = false; // any ( or { found at depth 2
  for (let i = startIdx + 1; i < tokens.length && depth > 0; i++) {
    const t = tokens[i];
    if (t.type === 'lbrace' || t.type === 'lparen' || t.type === 'lbracket') {
      depth++;
      if (depth === 2) hasComplex = true;
    } else if (
      t.type === 'rbrace' ||
      t.type === 'rparen' ||
      t.type === 'rbracket'
    ) {
      depth--;
    } else if (depth === 1) {
      if (t.type === 'comma') commaCount++;
      if (t.type === 'colon') colonCount++;
    }
  }
  if (closerType === 'rbrace') return colonCount >= 2;
  if (closerType === 'rbracket') return commaCount >= 1 && hasComplex;
  return false;
}

function _formatCebula(src) {
  const tokens = _tokenize(src);
  const IND = '  ';

  let out = '';
  let brace = 0; // indentation depth — incremented by both block braces and multi-line containers
  let paren = 0; // total expression nesting depth: (, [, { in expressions

  // Unified stack for expression-level containers ({ } and [ ]).
  // Each entry: { multi: bool, parenDepth: number (paren value before the opener was consumed) }
  const exprContainerStack = [];

  const ind = () => IND.repeat(brace);
  const nl = () => {
    out = out.trimEnd();
    out += '\n' + ind();
  };
  const sp = () => {
    if (out.length && !/[ \n]$/.test(out)) out += ' ';
  };

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    const nxt = tokens[i + 1];

    // ── Comments ─────────────────────────────────────────────────────────
    if (tok.type === 'comment') {
      if (!/\n$/.test(out)) nl();
      out += tok.value;
      nl();
      continue;
    }

    // ── Block-level braces { } (paren === 0 means we're at statement level) ──
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
      if (!nextIsInaczej && nxt?.type !== 'rbrace' && nxt) nl();
      continue;
    }

    // ── Expression { } (object literal) ──────────────────────────────────
    if (tok.type === 'lbrace') {
      const multi = _scanContainer(tokens, i, 'rbrace');
      exprContainerStack.push({ multi, parenDepth: paren });
      paren++;
      sp();
      out += '{';
      if (multi) {
        brace++;
        nl();
      }
      continue;
    }
    if (tok.type === 'rbrace') {
      paren--;
      const entry = exprContainerStack.pop() || { multi: false };
      if (entry.multi) {
        brace--;
        out = out.trimEnd();
        out += '\n' + ind() + '}';
      } else out += '}';
      continue;
    }

    // ── Expression [ ] (array) ────────────────────────────────────────────
    if (tok.type === 'lbracket') {
      const multi = _scanContainer(tokens, i, 'rbracket');
      exprContainerStack.push({ multi, parenDepth: paren });
      paren++;
      out += '[';
      if (multi) {
        brace++;
        nl();
      }
      continue;
    }
    if (tok.type === 'rbracket') {
      paren--;
      const entry = exprContainerStack.pop() || { multi: false };
      if (entry.multi) {
        brace--;
        out = out.trimEnd();
        out += '\n' + ind() + ']';
      } else out += ']';
      continue;
    }

    // ── ( ) ───────────────────────────────────────────────────────────────
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

    // ── Punctuation ───────────────────────────────────────────────────────
    if (tok.type === 'comma') {
      out += ',';
      // Check whether we're directly inside a multi-line container.
      const top =
        exprContainerStack.length > 0
          ? exprContainerStack[exprContainerStack.length - 1]
          : null;
      if (top && top.multi && paren === top.parenDepth + 1) {
        nl();
      } else {
        sp();
      }
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

    // ── Statement keywords (only at block level) ──────────────────────────
    if (tok.type === 'word' && STMT_KW.has(tok.value) && paren === 0) {
      const endsWithBrace = out.trimEnd().endsWith('}');
      if (tok.value === 'inaczej' && endsWithBrace) sp();
      else if (out.length > 0) nl();
      out += tok.value;
      continue;
    }

    // ── Everything else ───────────────────────────────────────────────────
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

      // ── CSS property autocomplete ────────────────────────
      const cssProps = engine.getCSSProperties();
      monaco.languages.registerCompletionItemProvider('cebula', {
        triggerCharacters: ['{', ',', '\n', ' '],
        provideCompletionItems(model, position) {
          const line = model.getLineContent(position.lineNumber);
          const beforeCursor = line.slice(0, position.column - 1).trimStart();

          // Only suggest inside object literals (heuristic: line starts with
          // a word that could be a property, or we're after a comma in such context)
          const inObject =
            /^\s*$/.test(beforeCursor) ||
            /[{,]\s*$/.test(beforeCursor) ||
            /^[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ_]*$/.test(beforeCursor);
          if (!inObject) return { suggestions: [] };

          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: position.column,
            endColumn: position.column,
          };
          const suggestions = Object.entries(cssProps).map(([polish, css]) => ({
            label: polish,
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: polish + ': ',
            detail: css,
            documentation: `CSS: ${css}`,
            range,
          }));
          return { suggestions };
        },
      });

      // ── Auto-formatter ───────────────────────────────────
      monaco.languages.registerDocumentFormattingEditProvider('cebula', {
        provideDocumentFormattingEdits(model) {
          const formatted = _formatCebula(model.getValue());
          return [{ range: model.getFullModelRange(), text: formatted }];
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
