const CebulaEngine = {
  grammar: null,
  semantics: null,
  context: {
    enums: {},
    views: new Set(),
    stateVars: new Set(),
    setters: {},
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

  compile(cebulaCode) {
    this.context.enums = {};
    this.context.views = new Set();
    this.context.stateVars = new Set();
    this.context.setters = {};

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
        'Wskazówka: Timery działają tylko w warstwie logiki. Użyj "efekt { cyklicznie(...) }" dla timerów startujących przy ładowaniu.',
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

  // ── Helper ───────────────────────────────────────────────────────────────

  _setterName(name) {
    return 'set' + name.charAt(0).toUpperCase() + name.slice(1);
  },

  _attachCompilerRules() {
    const ctx = this.context;
    const self = this;

    this.semantics.addOperation('toJS', {
      Program: (modules) => modules.children.map((m) => m.toJS()).join('\n\n'),

      Module: (_, id, _1, data, view, logic, _2) => {
        ctx.stateVars = new Set();
        ctx.setters = {};

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

      LayerData: (_, _1, _2, stmts, _3) => {
        const enums = [],
          params = [],
          vars = [];
        stmts.children.forEach((s) => {
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

      LayerView: (_, _1, _2, stmts, _3) =>
        stmts.children.map((s) => s.toJS()).join('\n  '),

      LayerLogic: (_, _1, _2, stmts, _3) =>
        stmts.children.map((s) => s.toJS() + ';').join('\n  '),

      StanyDecl: (_, id, _2, _3, list, _4) => {
        const enumName = id.sourceString;
        const values = list.asIteration().children.map((i) => i.sourceString);
        ctx.enums[enumName] = values;
        return {
          type: 'enum',
          code: `const ${enumName} = Object.freeze({${values.map((v) => `"${v}":"${v}"`).join(',')}});`,
        };
      },

      ParamDecl: (_, id) => {
        const name = id.sourceString;
        const setter = self._setterName(name);
        ctx.stateVars.add(name);
        ctx.setters[name] = setter;
        return {
          type: 'param',
          code: `const [${name}, ${setter}] = React.useState(_props.${name});`,
        };
      },

      VarDecl: (_, id, _2, exp) => {
        const name = id.sourceString;
        const setter = self._setterName(name);
        ctx.stateVars.add(name);
        ctx.setters[name] = setter;
        return {
          type: 'var',
          code: `const [${name}, ${setter}] = React.useState(${exp.toJS()});`,
        };
      },

      ViewStatement_main: (_, _1, _2, exp) =>
        `const VIEW_main = () => ${exp.toJS()};`,

      ViewStatement_other: (_, id, _1, exp) => {
        ctx.views.add(id.sourceString);
        return `const VIEW_${id.sourceString} = () => ${exp.toJS()};`;
      },

      ActionDef: (_, id, _1, stmts, _2) =>
        `const ${id.sourceString} = () => { ${stmts.children.map((s) => s.toJS() + ';').join(' ')} };`,

      // ── Timers ──────────────────────────────────────────────────────────

      EfektStmt: (_, _1, stmts, _2) =>
        `React.useEffect(() => { ${stmts.children.map((s) => s.toJS() + ';').join(' ')} }, [])`,

      OpóźnijStmt: (_, _1, delay, _2, action, _3) =>
        `setTimeout(${action.sourceString}, ${delay.toJS()})`,

      CyklicznieStmt: (_, _1, interval, _2, action, _3) =>
        `setInterval(${action.sourceString}, ${interval.toJS()})`,

      // ── Assignments & control flow ───────────────────────────────────────

      AssignStmt_simpleIdent: (_, target, _2, exp) => {
        const name = target.sourceString;
        const setter = ctx.setters[name] || self._setterName(name);
        return `${setter}(${exp.toJS()})`;
      },

      AssignStmt_memberAcc: (_, target, _2, exp) => {
        const parts = target.sourceString.split('.');
        const setter = ctx.setters[parts[0]] || self._setterName(parts[0]);
        if (parts.length === 2) {
          return `${setter}(prev => ({...prev, ${parts[1]}: ${exp.toJS()}}))`;
        }
        return `/* nieobsługiwane głębokie przypisanie: ${target.sourceString} */`;
      },

      IfStmt: (_, exp, _1, stmts, _2, elseClause) => {
        const elseJs =
          elseClause.children.length > 0 ? elseClause.child(0).toJS() : '';
        return `if(${exp.toJS()}){${stmts.children.map((s) => s.toJS() + ';').join(' ')}} ${elseJs}`;
      },

      ElseClause: (_, _1, stmts, _2) =>
        `else { ${stmts.children.map((s) => s.toJS() + ';').join(' ')} }`,

      CallStmt: (_, id) => `${id.sourceString}()`,
      PrintStmt: (_, _1, exp, _2) => `console.log(${exp.toJS()})`,

      // ── Layout ──────────────────────────────────────────────────────────

      WierszExp_props: (_, _1, props, _2, arr, _3) =>
        `_row(${props.toJS()}, ${arr.toJS()})`,
      WierszExp_simple: (_, _1, arr, _2) => `_row(null, ${arr.toJS()})`,

      KolumnaExp_props: (_, _1, props, _2, arr, _3) =>
        `_col(${props.toJS()}, ${arr.toJS()})`,
      KolumnaExp_simple: (_, _1, arr, _2) => `_col(null, ${arr.toJS()})`,

      RozciągnijExp: (_, _1, props, _2, exp, _3) =>
        `_stretch(${props.toJS()}, ${exp.toJS()})`,

      // ── Styling ─────────────────────────────────────────────────────────

      StylExp: (_, _1, props, _2, exp, _3) =>
        `_styl(${props.toJS()}, ${exp.toJS()})`,

      // ── Match ───────────────────────────────────────────────────────────

      MatchExp: (_, val, _1, cases, def, _2) =>
        `(() => { switch(${val.toJS()}) { ${cases.children.map((c) => c.toJS()).join('')} default: ${def.children.length > 0 ? def.child(0).toJS() : 'return null;'} } })()`,
      MatchCase: (_, val, _1, exp, _2) =>
        `case ${val.toJS()}: return ${exp.toJS()};`,
      OtherwiseCase: (_, _1, exp, _2) => `return ${exp.toJS()};`,

      // ── Collections ─────────────────────────────────────────────────────

      ArrayExp: (_1, list, _2) =>
        `[${list
          .asIteration()
          .children.map((c) => c.toJS())
          .join(',')}]`,

      ObjectLiteral: (_1, list, _2) =>
        `{${list
          .asIteration()
          .children.map((c) => c.toJS())
          .join(',')}}`,

      KeyValuePair: (key, _, val) => {
        let k = key.sourceString;
        if (k.startsWith('"')) k = k.slice(1, -1);
        return `"${k}": ${val.toJS()}`;
      },

      // ── Components & views ──────────────────────────────────────────────

      UseModuleExp: (_, id, _1, props) =>
        `React.createElement(Module_${id.sourceString}, ${props.toJS()})`,

      ViewRef: (_, _1, id, _2) => `VIEW_${id.sourceString}()`,

      ActionIdent: (id) => id.sourceString,

      ButtonExp_props: (_, _1, txt, _2, act, _3, props, _4) =>
        `_btn(${txt.toJS()}, ${act.toJS()}, ${props.toJS()})`,
      ButtonExp_simple: (_, _1, txt, _2, act, _3) =>
        `_btn(${txt.toJS()}, ${act.toJS()}, null)`,

      HeaderExp: (_, _1, lvl, _2, txt, _3) =>
        `React.createElement('h'+${lvl.toJS()}, {style:{color:'#5a7d2a',margin:0}}, ${txt.toJS()})`,
      AkapitExp: (_, _1, txt, _2) =>
        `React.createElement('p', {style:{lineHeight:'1.6',margin:0}}, ${txt.toJS()})`,
      BoldExp: (_, _1, txt, _2) =>
        `React.createElement('b', null, ${txt.toJS()})`,
      ColorExp: (_, _1, col, _2, txt, _3) =>
        `React.createElement('span', {style:{color:${col.toJS()}}}, ${txt.toJS()})`,

      // ── Form inputs ─────────────────────────────────────────────────────

      InputExp: (_, _1, label, _2, varName, _3) => {
        const name = varName.sourceString;
        const setter = ctx.setters[name] || self._setterName(name);
        return `_input(${label.toJS()}, ${name}, ${setter})`;
      },
      RadioExp: (_, _1, label, _2, opts, _3, varName, _4) => {
        const name = varName.sourceString;
        const setter = ctx.setters[name] || self._setterName(name);
        return `_radio(${label.toJS()}, ${opts.toJS()}, "${name}", ${name}, ${setter})`;
      },
      CheckboxExp: (_, _1, label, _2, varName, _3) => {
        const name = varName.sourceString;
        const setter = ctx.setters[name] || self._setterName(name);
        return `_checkbox(${label.toJS()}, ${name}, ${setter})`;
      },

      // ── Expressions ─────────────────────────────────────────────────────

      ChooseExp: (_, _1, cond, _2, t, _3, f, _4) =>
        `(${cond.toJS()} ? ${t.toJS()} : ${f.toJS()})`,

      CompExp_eq: (a, _, b) => `${a.toJS()} == ${b.toJS()}`,
      CompExp_toEq: (a, _, b) => `${a.toJS()} === ${b.toJS()}`,
      CompExp_gt: (a, _, b) => `${a.toJS()} > ${b.toJS()}`,
      CompExp_lt: (a, _, b) => `${a.toJS()} < ${b.toJS()}`,

      AddExp_plus: (a, _, b) => `(${a.toJS()} + ${b.toJS()})`,
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
