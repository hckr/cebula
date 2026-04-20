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
    params: new Set(),
    setters: {},
    currentModule: '',
    hotReload: false,
  },

  init(grammar) {
    this.grammar = ohm.grammar(grammar);
    this.semantics = this.grammar.createSemantics();
    this._attachCompilerRules();
    this._attachScanDeclsOperation();
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
    this.context.params = new Set();
    this.context.setters = {};
    this.context.currentModule = '';
    this.context.hotReload = hotReload;
    this.context.moduleDecls = {};

    const match = this.grammar.match(cebulaCode);
    if (match.succeeded()) {
      try {
        this.context.moduleDecls = this.semantics(match).scanDecls();
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

  _bindTargetGetSet(sourceStr) {
    const root = sourceStr.split('.')[0];
    if (!this.context.stateVars.has(root)) {
      throw new Error(
        `"${sourceStr}" nie może być użyte jako cel wiązania pola formularza.\n` +
          `"${root}" nie jest zmienną reaktywną – parametry i stałe są tylko do odczytu.\n` +
          `Wskazówka: Zadeklaruj "zmienna ${root} to ..." w warstwie danych.`,
      );
    }
    if (sourceStr.includes('.')) {
      const parts = sourceStr.split('.');
      const field = parts.slice(1).join('.');
      const setter = this._setter(root);
      return {
        getter: sourceStr,
        setter: `(v) => ${setter}(prev => ({...prev, ${field}: v}))`,
      };
    }
    return {
      getter: sourceStr,
      setter: this._setter(sourceStr),
    };
  },

  _timerCall(fn, intervalOrDelay, action) {
    if (!this.context.hotReload) {
      return `${fn}(${action.sourceString}, ${intervalOrDelay.toJS()})`;
    }
    const actionKey = `"${this.context.currentModule}.${action.sourceString}"`;
    return `${fn}(() => { const _a = __cebulaHotReloadActions[${actionKey}]; if (_a) _a(); }, ${intervalOrDelay.toJS()})`;
  },

  // ── Object key extraction helper (used for compile-time param validation) ──

  _getObjectKeys(objNode) {
    // objNode: ObjectLiteral CST node
    // ObjectLiteral = "{" ListOf<KeyValuePair, ","> ","? "}"
    const list = objNode.children[1];
    return list.asIteration().children.map((kv) => {
      // KeyValuePair = (propName | string) ":" Exp
      const keyStr = kv.children[0].sourceString.trim();
      return keyStr.startsWith('"') ? keyStr.slice(1, -1) : keyStr;
    });
  },

  _unwrapToObjectLiteral(node) {
    // Traverse Exp → CompExp → AddExp → MulExp → PriExp → ObjectLiteral
    // Each passthrough step has exactly one child.
    let cur = node;
    while (cur && cur.ctorName !== 'ObjectLiteral') {
      if (!cur.children || cur.children.length !== 1) return null;
      cur = cur.children[0];
    }
    return cur && cur.ctorName === 'ObjectLiteral' ? cur : null;
  },

  // ── Compile-time declarations pre-pass ───────────────────────────────────

  _attachScanDeclsOperation() {
    const self = this;
    this.semantics.addOperation('scanDecls', {
      Program(modules) {
        return Object.assign({}, ...modules.children.map((m) => m.scanDecls()));
      },
      Module(_kw, id, _lb, data, _view, logic, _rb) {
        const name = id.sourceString;
        const params = []; // { name, type: 'param' | 'action' }
        const actionParams = {}; // actionName -> [paramName, ...]

        // Scan warstwa danych: LayerData = "warstwa" "danych" "{" DataStatement* "}"
        data.children[3].children.forEach((stmt) => {
          const child = stmt.children[0];
          if (child.ctorName === 'ParamDecl') {
            params.push({
              name: child.children[1].sourceString,
              type: 'param',
            });
          } else if (child.ctorName === 'AkcjaParamDecl') {
            params.push({
              name: child.children[1].sourceString,
              type: 'action',
            });
          }
        });

        // Scan warstwa logiki: LayerLogic = "warstwa" "logiki" "{" LogicStatement* "}"
        logic.children[3].children.forEach((stmt) => {
          const child = stmt.children[0];
          if (child.ctorName === 'ActionDef') {
            // ActionDef = "akcja" ident "{" ActionParamDecl* LogicStatement* "}"
            const actionName = child.children[1].sourceString;
            const paramDecls = child.children[3].children; // ActionParamDecl*
            // ActionParamDecl = "parametr" ident  →  children[1] = ident
            actionParams[actionName] = paramDecls.map(
              (p) => p.children[1].sourceString,
            );
          }
        });

        return { [name]: { params, actionParams } };
      },
      _nonterminal() {
        return {};
      },
      _terminal() {
        return {};
      },
    });
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
              return a + b;
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
        ctx.params = new Set();
        ctx.setters = {};
        ctx.currentModule = id.sourceString;

        const name = id.sourceString;
        const d = data.toJS();
        const v = view.toJS();
        const l = logic.toJS();

        const paramValidations = d.paramNames.map(
          (p) =>
            `if(!Object.prototype.hasOwnProperty.call(_props,'${p}'))throw new Error('Moduł "${name}": brakuje parametru \\"${p}\\"');`,
        );
        const actionParamValidations = d.actionParamNames.map(
          (p) =>
            `if(typeof _props['${p}']!=='function')throw new Error('Moduł "${name}": parametr akcji \\"${p}\\" musi być funkcją (użyj: wykonaj ... z {...})');`,
        );
        const validationCode = [
          ...paramValidations,
          ...actionParamValidations,
        ].join('\n  ');

        const body = [validationCode, d.params, d.vars, v, l]
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
        const paramNames = [],
          actionParamNames = [];
        dataStmts.children.forEach((s) => {
          const r = s.toJS();
          if (r.type === 'enum') enums.push(r.code);
          if (r.type === 'param') {
            params.push(r.code);
            paramNames.push(r.name);
          }
          if (r.type === 'actionParam') {
            params.push(r.code);
            actionParamNames.push(r.name);
          }
          if (r.type === 'var') vars.push(r.code);
        });
        return {
          enums: enums.join('\n'),
          params: params.join('\n  '),
          vars: vars.join('\n  '),
          paramNames,
          actionParamNames,
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

      ParamDecl: (_, id) => {
        ctx.params.add(id.sourceString);
        return {
          type: 'param',
          name: id.sourceString,
          code: `const ${id.sourceString} = _props.${id.sourceString}`,
        };
      },

      AkcjaParamDecl: (_, id) => {
        ctx.params.add(id.sourceString);
        return {
          type: 'actionParam',
          name: id.sourceString,
          code: `const ${id.sourceString} = _props.${id.sourceString}`,
        };
      },

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

      ActionDef: (_, id, _1, paramDecls, actionStmts, _2) => {
        const name = id.sourceString;
        const paramNames = paramDecls.children.map((p) => p.toJS());

        const hasParams = paramNames.length > 0;
        const validation = paramNames
          .map(
            (p) =>
              `if(!Object.prototype.hasOwnProperty.call(_params,'${p}'))throw new Error('Akcja \\"${name}\\": brakuje parametru \\"${p}\\"');`,
          )
          .join(' ');
        const paramDeclCode = paramNames
          .map((p) => `const ${p}=_params.${p};`)
          .join(' ');

        const argList = hasParams ? `(_params = {})` : `()`;
        const paramBody = hasParams ? `${validation} ${paramDeclCode} ` : '';

        const body = `const ${name} = ${argList} => { ${paramBody}${stmts(actionStmts)} };`;
        if (!ctx.hotReload) return body;
        const key = `"${ctx.currentModule}.${name}"`;
        return `${body} __cebulaHotReloadActions[${key}] = ${name};`;
      },

      ActionParamDecl: (_, id) => id.sourceString,

      CallStmt: (_, id) => {
        const name = id.sourceString;
        if (ctx.params.has(name)) {
          return `(typeof ${name} === 'function' ? ${name}() : void 0)`;
        }
        return `${name}()`;
      },

      // ── List & range helpers ─────────────────────────────────────────────
      DlaKażdegoExp_noIdx: (_, _2, varName, _z, list, _colon, body) => {
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

      DlaKażdegoExp_withIdx: (
        _,
        _2,
        varName,
        _z,
        list,
        indexClause,
        _colon,
        body,
      ) => {
        const v = varName.sourceString;
        const idxVar = indexClause.children[2].sourceString;
        const bodyJs = body.toJS();
        const loopBody = ctx.hotReload
          ? `(() => {
              const _rawEl = ${bodyJs};
              if (_rawEl && _rawEl.props && _rawEl.props._ck !== undefined) {
                return React.cloneElement(_rawEl, { _ck: _rawEl.props._ck + ':' + ${idxVar} });
              }
              return _rawEl;
            })()`
          : bodyJs;
        return `(${list.toJS()} || []).map((${v}, ${idxVar}) => {
          const _el = ${loopBody};
          return React.isValidElement(_el) ? React.cloneElement(_el, { key: _el.key ?? ${idxVar} }) : _el;
        })`;
      },

      FiltrujExp_noIdx: (_, _2, varName, _z, list, _f, _colon, condition) =>
        `(${list.toJS()} || []).filter((${varName.sourceString}) => ${condition.toJS()})`,

      FiltrujExp_withIdx: (
        _,
        _2,
        varName,
        _z,
        list,
        indexClause,
        _f,
        _colon,
        condition,
      ) => {
        const idxVar = indexClause.children[2].sourceString;
        return `(${list.toJS()} || []).filter((${varName.sourceString}, ${idxVar}) => ${condition.toJS()})`;
      },

      // IndexClause is only accessed via its parent's children[], no standalone handler needed.

      FiltrujStmt: (
        _kw,
        target,
        _dla,
        _każdego,
        varName,
        indexClauseOpt,
        _colon,
        condition,
      ) => {
        const name = target.sourceString;
        const setter = self._setter(name);
        const v = varName.sourceString;
        const hasIdx = indexClauseOpt.children.length > 0;
        const idxVar = hasIdx
          ? indexClauseOpt.children[0].children[2].sourceString
          : null;
        const args = hasIdx ? `(${v}, ${idxVar})` : `(${v})`;
        return `${setter}(prev => prev.filter(${args} => ${condition.toJS()}))`;
      },

      PrzekształćStmt: (
        _kw,
        target,
        _dla,
        _każdego,
        varName,
        indexClauseOpt,
        _colon,
        body,
      ) => {
        const name = target.sourceString;
        const setter = self._setter(name);
        const v = varName.sourceString;
        const hasIdx = indexClauseOpt.children.length > 0;
        const idxVar = hasIdx
          ? indexClauseOpt.children[0].children[2].sourceString
          : null;
        const args = hasIdx ? `(${v}, ${idxVar})` : `(${v})`;
        return `${setter}(prev => prev.map(${args} => ${body.toJS()}))`;
      },

      WykonajExp_withProps: (_, id, _z, props) => {
        const actionName = id.sourceString;
        const declaredParams =
          ctx.moduleDecls?.[ctx.currentModule]?.actionParams?.[actionName];
        if (declaredParams !== undefined) {
          const provided = self._getObjectKeys(props);
          const missing = declaredParams.filter((p) => !provided.includes(p));
          if (missing.length > 0)
            throw new Error(
              `wykonaj "${actionName}": brakuje parametrów: ${missing.map((p) => `"${p}"`).join(', ')}`,
            );
        }
        return `(() => ${actionName}(${props.toJS()}))`;
      },
      WykonajExp_bare: (_, id) => `(() => ${id.sourceString}())`,

      DługośćExp: (_, _1, exp, _2) => `((${exp.toJS()}) || []).length`,

      ElementExp: (_, _1, list, _2, idx, _3) =>
        `((${list.toJS()}) || [])[${idx.toJS()}]`,

      ElementMemberExp: (elemExp, _dots, props) => {
        const fields = props
          .asIteration()
          .children.map((p) => p.sourceString)
          .join('.');
        return `(${elemExp.toJS()}).${fields}`;
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
      UseModuleExp_withProps: function (_, id, _z, props) {
        const offset = this.source.startIdx;
        const moduleName = id.sourceString;
        const decls = ctx.moduleDecls?.[moduleName];
        if (decls) {
          const objNode = self._unwrapToObjectLiteral(props);
          const provided = objNode ? self._getObjectKeys(objNode) : null;
          if (provided !== null) {
            const missing = decls.params
              .filter((p) => !provided.includes(p.name))
              .map(
                (p) =>
                  `"${p.name}" (${p.type === 'action' ? 'akcja' : 'parametr'})`,
              );
            if (missing.length > 0)
              throw new Error(
                `użyj ${moduleName}: brakuje: ${missing.join(', ')}`,
              );
          }
        }
        const propsJs = props.toJS();
        if (!ctx.hotReload) {
          return `React.createElement(Module_${moduleName}, ${propsJs})`;
        }
        const ck = `"użyj@${offset}"`;
        const mergedProps =
          propsJs === '{}' ? `{ _ck: ${ck} }` : `{ ...${propsJs}, _ck: ${ck} }`;
        return `React.createElement(Module_${moduleName}, ${mergedProps})`;
      },

      UseModuleExp_bare: function (_, id) {
        const offset = this.source.startIdx;
        if (!ctx.hotReload) {
          return `React.createElement(Module_${id.sourceString}, {})`;
        }
        const ck = `"użyj@${offset}"`;
        return `React.createElement(Module_${id.sourceString}, { _ck: ${ck} })`;
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
      BindTarget: function (_) {
        return this.sourceString;
      },

      InputExp_props: (_, _1, label, _2, varName, _3, props, _4) => {
        const { getter, setter } = self._bindTargetGetSet(varName.sourceString);
        return `React.createElement('label', { className: 'cebula-field-wrap' },
          React.createElement('span', { className: 'cebula-label-text' }, ${label.toJS()}),
          React.createElement('input', { type: 'text', className: 'cebula-input', value: ${getter} || '', onChange: e => (${setter})(e.target.value), style: ${props.toJS()} })
        )`;
      },
      InputExp_simple: (_, _1, label, _2, varName, _3) => {
        const { getter, setter } = self._bindTargetGetSet(varName.sourceString);
        return `React.createElement('label', { className: 'cebula-field-wrap' },
          React.createElement('span', { className: 'cebula-label-text' }, ${label.toJS()}),
          React.createElement('input', { type: 'text', className: 'cebula-input', value: ${getter} || '', onChange: e => (${setter})(e.target.value) })
        )`;
      },
      PasswordExp_props: (_, _1, label, _2, varName, _3, props, _4) => {
        const { getter, setter } = self._bindTargetGetSet(varName.sourceString);
        return `React.createElement('label', { className: 'cebula-field-wrap' },
          React.createElement('span', { className: 'cebula-label-text' }, ${label.toJS()}),
          React.createElement('input', { type: 'password', className: 'cebula-input', value: ${getter} || '', onChange: e => (${setter})(e.target.value), style: ${props.toJS()} })
        )`;
      },
      PasswordExp_simple: (_, _1, label, _2, varName, _3) => {
        const { getter, setter } = self._bindTargetGetSet(varName.sourceString);
        return `React.createElement('label', { className: 'cebula-field-wrap' },
          React.createElement('span', { className: 'cebula-label-text' }, ${label.toJS()}),
          React.createElement('input', { type: 'password', className: 'cebula-input', value: ${getter} || '', onChange: e => (${setter})(e.target.value) })
        )`;
      },
      RadioExp: (_, _1, label, _2, opts, _3, varName, _4) => {
        const { getter, setter } = self._bindTargetGetSet(varName.sourceString);
        return `React.createElement('fieldset', { className: 'cebula-fieldset' },
          React.createElement('legend', { className: 'cebula-legend' }, ${label.toJS()}),
          React.createElement('div', { className: 'cebula-radio-group' },
            Object.entries(${opts.toJS()}).map(([k, v]) =>
              React.createElement('label', { key: k, className: 'cebula-check-label' },
                React.createElement('input', { type: 'radio', value: v, checked: v === ${getter}, onChange: e => (${setter})(e.target.value) }),
                k
              )
            )
          )
        )`;
      },
      CheckboxExp: (_, _1, label, _2, varName, _3) => {
        const { getter, setter } = self._bindTargetGetSet(varName.sourceString);
        return `React.createElement('label', { className: 'cebula-check-label' },
          React.createElement('input', { type: 'checkbox', checked: !!${getter}, onChange: e => (${setter})(e.target.checked) }),
          React.createElement('span', { className: 'cebula-label-text' }, ${label.toJS()})
        )`;
      },

      // ── Expressions ─────────────────────────────────────────────────────

      ChooseExp: (_, _1, cond, _2, t, _3, f, _4) =>
        `(${cond.toJS()} ? ${t.toJS()} : ${f.toJS()})`,

      CompExp_eq: (a, _, b) => `${a.toJS()} == ${b.toJS()}`,
      CompExp_neq: (a, _, b) => `${a.toJS()} != ${b.toJS()}`,
      CompExp_toEq: (a, _, b) => `${a.toJS()} === ${b.toJS()}`,
      CompExp_toNotEq: (a, _to, _nie, b) => `${a.toJS()} !== ${b.toJS()}`,
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
      number: function (_s, _i, _d, _f) {
        return this.sourceString;
      },
    });
  },
};

export default CebulaEngine;
