// ── Compile-time CSS property map (Polish → CSS) ─────────────────────────────
// All identifier keys in ObjectLiterals are translated at compile time.
// CSS values must be valid CSS strings (English) or JS expressions.
const CSS_MAP = {
  // Background & spacing
  tło: 'background',
  wypełnienie: 'padding',
  wypełnienieGóra: 'paddingTop',
  wypełnienieDół: 'paddingBottom',
  wypełnienieLewo: 'paddingLeft',
  wypełnieniePrawo: 'paddingRight',
  margines: 'margin',
  marginesGóra: 'marginTop',
  marginesDół: 'marginBottom',
  marginesLewo: 'marginLeft',
  marginesPrawo: 'marginRight',
  odstęp: 'gap',
  // Flexbox
  proporcja: 'flex',
  wyrównanieElementów: 'alignItems',
  wyrównanieZawartości: 'justifyContent',
  zawijanie: 'flexWrap',
  wyświetlanie: 'display',
  // Size
  szerokość: 'width',
  minSzerokość: 'minWidth',
  maxSzerokość: 'maxWidth',
  wysokość: 'height',
  minWysokość: 'minHeight',
  maxWysokość: 'maxHeight',
  // Position
  pozycja: 'position',
  góra: 'top',
  dół: 'bottom',
  lewo: 'left',
  prawo: 'right',
  przepełnienie: 'overflow',
  zIndex: 'zIndex',
  // Typography
  kolor: 'color',
  czcionka: 'fontSize',
  rodzinaCzcionki: 'fontFamily',
  grubośćCzcionki: 'fontWeight',
  stylCzcionki: 'fontStyle',
  wyrównanieTekstu: 'textAlign',
  dekoracjaTekstu: 'textDecoration',
  wysokośćLinii: 'lineHeight',
  odstępLiter: 'letterSpacing',
  // Border
  obramowanie: 'border',
  obramowanieGóra: 'borderTop',
  obramowanieDół: 'borderBottom',
  obramowanieLewo: 'borderLeft',
  obramowaniePrawo: 'borderRight',
  zaokrąglenie: 'borderRadius',
  // Visual
  cień: 'boxShadow',
  przezroczystość: 'opacity',
  kursor: 'cursor',
  transformacja: 'transform',
  przejście: 'transition',
};

// Polish characters for identifier boundary detection (used in stale-closure fix)
const POLISH_CHARS = 'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ';

function _escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─────────────────────────────────────────────────────────────────────────────

const CebulaEngine = {
  grammar: null,
  semantics: null,
  context: {
    enums: {},
    views: new Set(),
    stateVars: new Set(),
    setters: {},
    currentModule: '',
    hotReload: false,
  },

  init(grammar) {
    this.grammar = ohm.grammar(grammar);
    this.semantics = this.grammar.createSemantics();
    this._attachCompilerRules();
  },

  getKeywords() {
    return [
      ...this.grammar.rules.keyword.body.terms.map((t) => t.obj),
      'główny',
    ];
  },

  getCSSProperties() {
    return CSS_MAP;
  },

  compile(cebulaCode, { hotReload = false } = {}) {
    this.context.enums = {};
    this.context.views = new Set();
    this.context.stateVars = new Set();
    this.context.setters = {};
    this.context.currentModule = '';
    this.context.hotReload = hotReload;

    const match = this.grammar.match(cebulaCode);
    if (match.succeeded()) {
      try {
        return { success: true, jsCode: this.semantics(match).toJS() };
      } catch (error) {
        return {
          success: false,
          error: this._formatError(
            'Semantyczny',
            this._enrichSemanticError(error.message),
          ),
        };
      }
    }
    return {
      success: false,
      error: this._formatError(
        'Składniowy',
        this._translateSyntaxError(match.message),
      ),
    };
  },

  // ── Error formatting ─────────────────────────────────────────────────────

  _formatError(kind, msg) {
    const html = msg
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>')
      .replace(/ /g, '&nbsp;');
    return `<div style="color:#f44336;font-family:monospace;padding:20px;font-size:14px;line-height:1.7">
      <b>&#128721; Błąd ${kind}:</b><br><br>${html}
    </div>`;
  },

  _translateSyntaxError(raw) {
    if (!raw) return raw;

    let msg = raw
      .replace(/Line (\d+), col (\d+)/g, 'Linia $1, kolumna $2')
      .replace(/Expected/g, 'Oczekiwano')
      .replace(/\bor\b/g, 'lub')
      .replace(/but end of input was found/g, 'ale napotkano koniec pliku')
      .replace(/but "([^"]+)" was found/g, 'ale znaleziono: "$1"')
      .replace(/\bwas found\b/g, 'znaleziono')
      .replace(/\bbut\b/g, 'ale')
      .replace(/end of input/g, 'koniec pliku')
      .replace(/\bspace\b/g, 'spację')
      .replace(/\bnewline\b/g, 'nową linię')
      .replace(/\bany character\b/g, 'dowolny znak');

    const hints = [];

    if (/zmienna|parametr|stany/.test(raw) && /szablon|widoku/.test(raw))
      hints.push(
        'Wskazówka: Deklaracje (zmienna, parametr, stany) należą do warstwy danych, nie widoku.',
      );
    if (/ustaw|wywołaj|akcja/.test(raw) && /szablon|widoku/.test(raw))
      hints.push(
        'Wskazówka: Instrukcje (ustaw, wywołaj, akcja) należą do warstwy logiki, nie widoku.',
      );
    if (/\}/.test(raw) && /Oczekiwano|Expected/.test(raw))
      hints.push(
        'Wskazówka: Sprawdź, czy wszystkie bloki { } i nawiasy ( ) są poprawnie zamknięte.',
      );
    if (/"to"/.test(raw))
      hints.push(
        'Wskazówka: Słowo "to" służy do przypisania wartości, np.: zmienna x to 0',
      );
    if (/opóźnij|cyklicznie/.test(raw))
      hints.push(
        'Wskazówka: Timery i inne instrukcje inicjalizacyjne pisz bezpośrednio w warstwa logiki, poza blokiem akcja — uruchomią się automatycznie przy starcie.',
      );

    if (hints.length > 0) msg += '\n\n' + hints.join('\n');
    return msg;
  },

  _enrichSemanticError(msg) {
    const hints = {
      'Cannot read properties of undefined':
        'Odwołanie do niezdefiniowanej zmiennej lub akcji. Sprawdź nazwy w warstwie danych i logiki.',
      'toJS is not a function':
        'Wewnętrzny błąd kompilatora — prawdopodobnie użyto niedozwolonej składni w tym miejscu.',
    };
    for (const [pattern, hint] of Object.entries(hints)) {
      if (msg.includes(pattern)) return hint;
    }
    return msg;
  },

  // ── Code generation helpers ───────────────────────────────────────────────

  _stmtsToJS(stmts) {
    return stmts.children.map((s) => s.toJS() + ';').join(' ');
  },

  _registerStateVar(name, initializer) {
    const setter = this._setterName(name);
    this.context.stateVars.add(name);
    this.context.setters[name] = setter;

    if (!this.context.hotReload) {
      return `const [${name}, ${setter}] = React.useState(${initializer});`;
    }

    const moduleName = this.context.currentModule;
    const storeKey = `(\`\${_props._ck ?? "${moduleName}"}.${name}\`)`;
    return [
      `const [${name}, ${setter}] = React.useState(() => {`,
      `  const _k = ${storeKey};`,
      `  return Object.prototype.hasOwnProperty.call(__cebulaHotReloadStore, _k) ? __cebulaHotReloadStore[_k] : (${initializer});`,
      `});`,
      `React.useEffect(() => { __cebulaHotReloadStore[${storeKey}] = ${name}; }, [${name}]);`,
    ].join('\n  ');
  },

  _setter(name) {
    return this.context.setters[name] || this._setterName(name);
  },

  _setterName(name) {
    return 'set' + name.charAt(0).toUpperCase() + name.slice(1);
  },

  _timerCall(fn, intervalOrDelay, action) {
    return `${fn}(${action.sourceString}, ${intervalOrDelay.toJS()})`;
  },

  _attachCompilerRules() {
    const ctx = this.context;
    const self = this;
    const stmts = (node) => self._stmtsToJS(node);

    this.semantics.addOperation('toJS', {
      Program: (modules) => `
        (() => {
          const _plusExp = (a, b) => {
            const isPrimitive = (v) => (typeof v !== 'object' || v === null);
            if (isPrimitive(a) && isPrimitive(b)) {
              return a + b; // Zwykła konkatenacja/dodawanie dla typów prostych
            }
            const arrA = Array.isArray(a) ? a : [a];
            const arrB = Array.isArray(b) ? b : [b];
            return [...arrA, ...arrB];
          };
          ${modules.children.map((m) => m.toJS()).join('\n\n')}
          return Module_główny;
        })()
      `,

      Module: (_, id, _1, data, view, logic, _2) => {
        ctx.stateVars = new Set();
        ctx.setters = {};
        ctx.currentModule = id.sourceString;

        const name = id.sourceString;
        const d = data.toJS();
        const v = view.toJS();
        const l = logic.toJS();

        const body = [d.params, d.vars, v, l]
          .filter((s) => s && s.trim())
          .join('\n  ');

        return `${d.enums}
      function Module_${name}(_props = {}) {
        ${body}
        return VIEW_main ? VIEW_main() : null;
      }`;
      },

      LayerData: (_, _1, _2, dataStmts, _3) => {
        const enums = [],
          params = [],
          vars = [];
        dataStmts.children.forEach((s) => {
          const r = s.toJS();
          if (r.type === 'enum') enums.push(r.code);
          if (r.type === 'param') params.push(r.code);
          if (r.type === 'var') vars.push(r.code);
        });
        return {
          enums: enums.join('\n'),
          params: params.join('\n  '),
          vars: vars.join('\n  '),
        };
      },

      DataStatement: (decl) => decl.toJS(),

      LayerView: (_, _1, _2, viewStmts, _3) =>
        viewStmts.children.map((s) => s.toJS()).join('\n  '),

      LayerLogic: (_, _1, _2, logicStmts, _3) => {
        const actions = [];
        const init = [];
        logicStmts.children.forEach((s) => {
          if (s.children[0].ctorName === 'ActionDef') {
            actions.push(s.toJS() + ';');
          } else {
            init.push(s.toJS() + ';');
          }
        });
        const initBlock =
          init.length > 0
            ? `React.useEffect(() => { ${init.join(' ')} }, []);`
            : '';
        return [...actions, initBlock].filter(Boolean).join('\n  ');
      },

      StanyDecl: (_, id, _2, _3, list, _4, _5) => {
        const enumName = id.sourceString;
        const values = list.asIteration().children.map((i) => i.sourceString);
        ctx.enums[enumName] = values;
        return {
          type: 'enum',
          code: `const ${enumName} = Object.freeze({${values.map((v) => `"${v}":"${v}"`).join(',')}});`,
        };
      },

      ParamDecl: (_, id) => ({
        type: 'param',
        code: `const ${id.sourceString} = _props.${id.sourceString}`,
      }),

      VarDecl: (_, id, _2, exp) => ({
        type: 'var',
        code: self._registerStateVar(id.sourceString, exp.toJS()),
      }),

      ViewStatement_main: (_, _1, _2, exp) =>
        `const VIEW_main = () => ${exp.toJS()};`,

      ViewStatement_other: (_, id, _1, exp) => {
        ctx.views.add(id.sourceString);
        return `const VIEW_${id.sourceString} = () => ${exp.toJS()};`;
      },

      ActionDef: (_, id, _1, actionStmts, _2) =>
        `const ${id.sourceString} = () => { ${stmts(actionStmts)} };`,

      // ── List & range helpers ─────────────────────────────────────────────
      DlaKażdegoExp: (_, _2, varName, _z, list, _colon, body) => {
        const bodyJs = body.toJS();
        const loopBody = ctx.hotReload
          ? `(() => {
              const _rawEl = ${bodyJs};
              if (_rawEl && _rawEl.props && _rawEl.props._ck !== undefined) {
                return React.cloneElement(_rawEl, { _ck: _rawEl.props._ck + ':' + _i });
              }
              return _rawEl;
            })()`
          : bodyJs;
        return `(${list.toJS()} || []).map((${varName.sourceString}, _i) => {
          const _el = ${loopBody};
          return React.isValidElement(_el) ? React.cloneElement(_el, { key: _el.key ?? _i }) : _el;
        })`;
      },

      ZakresExp_double: (_, _1, a, _2, b, _3) =>
        `Array.from({ length: Math.max(0, ${b.toJS()} - ${a.toJS()}) }, (_, i) => i + (${a.toJS()}))`,

      ZakresExp_single: (_, _1, a, _2) =>
        `Array.from({ length: Math.max(0, ${a.toJS()}) }, (_, i) => i)`,

      // ── Timers ──────────────────────────────────────────────────────────
      OpóźnijStmt: (_, _1, delay, _2, action, _3) =>
        self._timerCall('setTimeout', delay, action),
      OpóźnijExp: (_, _1, delay, _2, action, _3) =>
        self._timerCall('setTimeout', delay, action),
      CyklicznieStmt: (_, _1, interval, _2, action, _3) =>
        self._timerCall('setInterval', interval, action),
      CyklicznieExp: (_, _1, interval, _2, action, _3) =>
        self._timerCall('setInterval', interval, action),

      AnulujStmt: (_, _1, exp, _2) => `clearInterval(${exp.toJS()})`,

      // ── Assignments & control flow ───────────────────────────────────────
      AssignStmt_simpleIdent: (_, target, _2, exp) => {
        const name = target.sourceString;
        const setter = self._setter(name);
        if (ctx.stateVars.has(name)) {
          const boundaryRe = new RegExp(
            `(?<![a-zA-Z0-9_${POLISH_CHARS}])${_escapeRegex(name)}(?![a-zA-Z0-9_${POLISH_CHARS}])`,
            'g',
          );
          if (boundaryRe.test(exp.sourceString)) {
            boundaryRe.lastIndex = 0;
            return `${setter}(prev => ${exp.toJS().replace(boundaryRe, 'prev')})`;
          }
        }
        return `${setter}(${exp.toJS()})`;
      },
      AssignStmt_memberAcc: (_, target, _2, exp) => {
        const parts = target.sourceString.split('.');
        const setter = self._setter(parts[0]);
        if (parts.length === 2) {
          return `${setter}(prev => ({...prev, ${parts[1]}: ${exp.toJS()}}))`;
        }
        return `/* nieobsługiwane głębokie przypisanie: ${target.sourceString} */`;
      },
      IfStmt: (_, exp, _1, ifStmts, _2, elseClause) => {
        const elseJs =
          elseClause.children.length > 0 ? elseClause.child(0).toJS() : '';
        return `if(${exp.toJS()}){${stmts(ifStmts)}} ${elseJs}`;
      },
      ElseClause: (_, _1, elseStmts, _2) => `else { ${stmts(elseStmts)} }`,
      CallStmt: (_, id) => `${id.sourceString}()`,
      PrintStmt: (_, _1, exp, _2) => `console.log(${exp.toJS()})`,

      // ── Layout ──────────────────────────────────────────────────────────
      WierszExp_props: (_, _1, props, _2, arr, _3) =>
        `React.createElement('div', { className: 'cebula-row', style: ${props.toJS()} }, ...(${arr.toJS()}))`,
      WierszExp_simple: (_, _1, arr, _2) =>
        `React.createElement('div', { className: 'cebula-row' }, ...(${arr.toJS()}))`,
      KolumnaExp_props: (_, _1, props, _2, arr, _3) =>
        `React.createElement('div', { className: 'cebula-col', style: ${props.toJS()} }, ...(${arr.toJS()}))`,
      KolumnaExp_simple: (_, _1, arr, _2) =>
        `React.createElement('div', { className: 'cebula-col' }, ...(${arr.toJS()}))`,
      RozciągnijExp: (_, _1, props, _2, exp, _3) =>
        `React.createElement('div', { style: ${props.toJS()} }, ${exp.toJS()})`,
      StylExp: (_, _1, props, _2, exp, _3) =>
        `React.createElement('div', { style: ${props.toJS()} }, ${exp.toJS()})`,

      // ── Match ───────────────────────────────────────────────────────────
      MatchExp: (_, val, _1, cases, def, _2) =>
        `(() => { switch(${val.toJS()}) { ${cases.children.map((c) => c.toJS()).join('')} default: ${def.children.length > 0 ? def.child(0).toJS() : 'return null;'} } })()`,
      MatchCase: (_, val, _1, exp, _2) =>
        `case ${val.toJS()}: return ${exp.toJS()};`,
      OtherwiseCase: (_, _1, exp, _2) => `return ${exp.toJS()};`,

      // ── Collections ─────────────────────────────────────────────────────
      ArrayExp: (_1, list, _2, _3) =>
        `[${list
          .asIteration()
          .children.map((c) => c.toJS())
          .join(',')}]`,
      ObjectLiteral: (_1, list, _2, _3) =>
        `{${list
          .asIteration()
          .children.map((c) => c.toJS())
          .join(',')}}`,
      KeyValuePair: (key, _, val) => {
        let k = key.sourceString;
        k = k.startsWith('"') ? k.slice(1, -1) : (CSS_MAP[k] ?? k);
        return `"${k}": ${val.toJS()}`;
      },

      // ── Components & views ──────────────────────────────────────────────
      UseModuleExp: function (_, id, _1, props) {
        const offset = this.source.startIdx;
        const propsJs = props.toJS();
        if (!ctx.hotReload) {
          return `React.createElement(Module_${id.sourceString}, ${propsJs})`;
        }
        // _ck (cebula-key): stabilny unikalny klucz instancji oparty na pozycji
        // w kodzie źródłowym. Przeżywa hot-reload bo offset nie zmienia się
        // gdy edytujesz kod poniżej tego wywołania.
        const ck = `"użyj@${offset}"`;
        // Scalamy _ck z propsami użytkownika (props są obiektem JS)
        const mergedProps =
          propsJs === '{}' ? `{ _ck: ${ck} }` : `{ ...${propsJs}, _ck: ${ck} }`;
        return `React.createElement(Module_${id.sourceString}, ${mergedProps})`;
      },
      ViewRef: (_, _1, id, _2) => `VIEW_${id.sourceString}()`,
      ActionIdent: (id) => id.sourceString,

      ButtonExp_props: (_, _1, txt, _2, act, _3, props, _4) =>
        `React.createElement('button', { className: 'cebula-btn', onClick: ${act.toJS()} || null, style: ${props.toJS()} }, ${txt.toJS()})`,
      ButtonExp_simple: (_, _1, txt, _2, act, _3) =>
        `React.createElement('button', { className: 'cebula-btn', onClick: ${act.toJS()} || null }, ${txt.toJS()})`,

      HeaderExp: (_, _1, lvl, _2, txt, _3) =>
        `React.createElement('h'+${lvl.toJS()}, { className: 'cebula-header' }, ${txt.toJS()})`,
      AkapitExp: (_, _1, txt, _2) =>
        `React.createElement('p', { className: 'cebula-p' }, ${txt.toJS()})`,
      BoldExp: (_, _1, txt, _2) =>
        `React.createElement('b', null, ${txt.toJS()})`,
      ColorExp: (_, _1, col, _2, txt, _3) =>
        `React.createElement('span', { style: { color: ${col.toJS()} } }, ${txt.toJS()})`,

      // ── Form inputs ─────────────────────────────────────────────────────
      InputExp_props: (_, _1, label, _2, varName, _3, props, _4) => {
        const name = varName.sourceString;
        return `React.createElement('label', { className: 'cebula-field-wrap' },
          React.createElement('span', { className: 'cebula-label-text' }, ${label.toJS()}),
          React.createElement('input', { type: 'text', className: 'cebula-input', value: ${name} || '', onChange: e => ${self._setter(name)}(e.target.value), style: ${props.toJS()} })
        )`;
      },
      InputExp_simple: (_, _1, label, _2, varName, _3) => {
        const name = varName.sourceString;
        return `React.createElement('label', { className: 'cebula-field-wrap' },
          React.createElement('span', { className: 'cebula-label-text' }, ${label.toJS()}),
          React.createElement('input', { type: 'text', className: 'cebula-input', value: ${name} || '', onChange: e => ${self._setter(name)}(e.target.value) })
        )`;
      },
      PasswordExp_props: (_, _1, label, _2, varName, _3, props, _4) => {
        const name = varName.sourceString;
        return `React.createElement('label', { className: 'cebula-field-wrap' },
          React.createElement('span', { className: 'cebula-label-text' }, ${label.toJS()}),
          React.createElement('input', { type: 'password', className: 'cebula-input', value: ${name} || '', onChange: e => ${self._setter(name)}(e.target.value), style: ${props.toJS()} })
        )`;
      },
      PasswordExp_simple: (_, _1, label, _2, varName, _3) => {
        const name = varName.sourceString;
        return `React.createElement('label', { className: 'cebula-field-wrap' },
          React.createElement('span', { className: 'cebula-label-text' }, ${label.toJS()}),
          React.createElement('input', { type: 'password', className: 'cebula-input', value: ${name} || '', onChange: e => ${self._setter(name)}(e.target.value) })
        )`;
      },
      RadioExp: (_, _1, label, _2, opts, _3, varName, _4) => {
        const name = varName.sourceString;
        return `React.createElement('fieldset', { className: 'cebula-fieldset' },
          React.createElement('legend', { className: 'cebula-legend' }, ${label.toJS()}),
          React.createElement('div', { className: 'cebula-radio-group' },
            Object.entries(${opts.toJS()}).map(([k, v]) =>
              React.createElement('label', { key: k, className: 'cebula-check-label' },
                React.createElement('input', { type: 'radio', name: "${name}", value: v, checked: v === ${name}, onChange: e => ${self._setter(name)}(e.target.value) }),
                k
              )
            )
          )
        )`;
      },
      CheckboxExp: (_, _1, label, _2, varName, _3) => {
        const name = varName.sourceString;
        return `React.createElement('label', { className: 'cebula-check-label' },
          React.createElement('input', { type: 'checkbox', checked: !!${name}, onChange: e => ${self._setter(name)}(e.target.checked) }),
          React.createElement('span', { className: 'cebula-label-text' }, ${label.toJS()})
        )`;
      },

      // ── Expressions ─────────────────────────────────────────────────────

      ChooseExp: (_, _1, cond, _2, t, _3, f, _4) =>
        `(${cond.toJS()} ? ${t.toJS()} : ${f.toJS()})`,

      CompExp_eq: (a, _, b) => `${a.toJS()} == ${b.toJS()}`,
      CompExp_toEq: (a, _, b) => `${a.toJS()} === ${b.toJS()}`,
      CompExp_gt: (a, _, b) => `${a.toJS()} > ${b.toJS()}`,
      CompExp_lt: (a, _, b) => `${a.toJS()} < ${b.toJS()}`,

      AddExp_plus: (a, _, b) => `_plusExp(${a.toJS()}, ${b.toJS()})`,
      AddExp_minus: (a, _, b) => `${a.toJS()} - ${b.toJS()}`,
      MulExp_times: (a, _, b) => `${a.toJS()} * ${b.toJS()}`,
      MulExp_divide: (a, _, b) => `${a.toJS()} / ${b.toJS()}`,

      ParenExp: (_1, exp, _2) => `(${exp.toJS()})`,

      NicExp: (_) => 'null',
      BrakExp: (_) => 'null',
      BoolExp: function (_) {
        return this.sourceString.toLowerCase() === 'prawda' ? 'true' : 'false';
      },

      MemberAccessExp: function (_id, _dots, _props) {
        return this.sourceString;
      },

      ident: function (_) {
        return ctx.views.has(this.sourceString)
          ? `VIEW_${this.sourceString}()`
          : this.sourceString;
      },

      string: function (_o, _c, _q) {
        return this.sourceString;
      },
      number: function (_i, _d, _f) {
        return this.sourceString;
      },
    });
  },
};

export default CebulaEngine;
