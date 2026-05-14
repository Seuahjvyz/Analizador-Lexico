// ══════════════════════════════════════════════════
//  ÁRBOL SINTÁCTICO — SVG vertical, sin desbordamiento
// ══════════════════════════════════════════════════

class ASTNode {
    constructor(lexema = null, children = []) {
        this.lexema   = lexema;
        this.children = [...children];
    }
    addChild(child) { if (child) this.children.push(child); return this; }
}

// ══════════════════════════════════════════════════
//  TOKENIZADOR FILTRADO
// ══════════════════════════════════════════════════
const IGNORAR = new Set(['ESPACIO_BLANCO','TABULADOR','SALTO_LINEA','COMENTARIO']);

// ══════════════════════════════════════════════════
//  PARSER
// ══════════════════════════════════════════════════
class Parser {
    constructor(tokens) {
        this.toks = tokens.filter(([t]) => !IGNORAR.has(t));
        this.pos  = 0;
    }

    peek()    { return this.toks[this.pos]   || [null,null]; }
    advance() { return this.toks[this.pos++] || [null,null]; }
    isEOF()   { return this.pos >= this.toks.length; }

    is(type, val=null) {
        const [t,v] = this.peek();
        return t===type && (val===null || v===val);
    }
    eat(type,val=null){ if(this.is(type,val)){this.advance();return true;} return false; }

    // ─────────────────────────────────────────────
    parse() {
        const root = new ASTNode('PROGRAMA');
        while (!this.isEOF()) {
            const s = this.parseStatement();
            if (s) root.addChild(s);
        }
        return root;
    }

    parseStatement() {
        const [t,v] = this.peek();

        // punto y coma suelto → ignorar
        if (this.is('CARACTER_ESPECIAL',';')) { this.advance(); return null; }
        // punto suelto → ignorar
        if (this.is('CARACTER_ESPECIAL','.')) { this.advance(); return null; }

        if (t === 'PALABRA_RESERVADA') {
            switch(v){
                case 'if':      return this.parseIf();
                case 'else':    return this.parseElseAlone();
                case 'while':   return this.parseWhile();
                case 'for':     return this.parseFor();
                case 'return':  return this.parseReturn();
                case 'class':   return this.parseClass();
                case 'def': case 'function': return this.parseFunction();
                case 'int': case 'float': case 'double': case 'char':
                case 'string': case 'String': case 'bool': case 'boolean':
                case 'long': case 'short': case 'void':
                case 'var': case 'let': case 'const':
                    return this.parseDeclaration();
            }
        }

        return this.parseExpr();
    }

    // tipo [nombre] [= expr] ;
    parseDeclaration() {
        const typeNode = new ASTNode(this.advance()[1]);
        let nameNode = null;
        if (this.is('VARIABLE')) {
            nameNode = new ASTNode(this.advance()[1]);
            typeNode.addChild(nameNode);
        }
        if (this.is('OPERADOR','=')) {
            this.advance();
            const eq = new ASTNode('=');
            if (nameNode) typeNode.children.pop();
            eq.addChild(nameNode || new ASTNode('?'));
            eq.addChild(this.parseExpr());
            typeNode.addChild(eq);
        }
        this.eat('CARACTER_ESPECIAL',';');
        return typeNode;
    }

    // class Name { ... }
    parseClass() {
        const node = new ASTNode('class');
        this.advance();
        if (this.is('VARIABLE')) node.addChild(new ASTNode(this.advance()[1]));
        if (this.is('CARACTER_ESPECIAL','{')) node.addChild(this.parseBlock());
        return node;
    }

    // { sentencias }  → nodo '{ }'
    parseBlock() {
        const node = new ASTNode('{ }');
        this.eat('CARACTER_ESPECIAL','{');
        while (!this.is('CARACTER_ESPECIAL','}') && !this.isEOF()) {
            const s = this.parseStatement();
            if (s) node.addChild(s);
        }
        this.eat('CARACTER_ESPECIAL','}');
        return node;
    }

    parseBody() {
        if (this.is('CARACTER_ESPECIAL','{')) return this.parseBlock();
        return this.parseStatement();
    }

    parseIf() {
        const node = new ASTNode('if');
        this.advance();
        node.addChild(this.parseParenGroup());
        node.addChild(this.parseBody());
        if (this.is('PALABRA_RESERVADA','else')) {
            this.advance();
            const e = new ASTNode('else');
            e.addChild(this.parseBody());
            node.addChild(e);
        }
        return node;
    }
    parseElseAlone() {
        const n = new ASTNode('else'); this.advance();
        n.addChild(this.parseBody()); return n;
    }
    parseWhile() {
        const n = new ASTNode('while'); this.advance();
        n.addChild(this.parseParenGroup()); n.addChild(this.parseBody()); return n;
    }
    parseFor() {
        const n = new ASTNode('for'); this.advance();
        n.addChild(this.parseParenGroup()); n.addChild(this.parseBody()); return n;
    }
    parseReturn() {
        const n = new ASTNode('return'); this.advance();
        if (!this.is('CARACTER_ESPECIAL',';') && !this.isEOF()) n.addChild(this.parseExpr());
        this.eat('CARACTER_ESPECIAL',';');
        return n;
    }
    parseFunction() {
        const n = new ASTNode(this.advance()[1]);
        if (this.is('VARIABLE')) n.addChild(new ASTNode(this.advance()[1]));
        n.addChild(this.parseParenGroup());
        n.addChild(this.parseBody());
        return n;
    }

    // ( expr, expr… )  →  nodo '( )'  con hijos = exprs internas
    parseParenGroup() {
        const node = new ASTNode('( )');
        this.eat('CARACTER_ESPECIAL','(');
        while (!this.is('CARACTER_ESPECIAL',')') && !this.isEOF()) {
            if (this.is('CARACTER_ESPECIAL',',') || this.is('CARACTER_ESPECIAL',';')) { this.advance(); continue; }
            const e = this.parseExpr(); if (e) node.addChild(e);
        }
        this.eat('CARACTER_ESPECIAL',')');
        return node;
    }

    // [ expr, expr… ]  →  nodo '[ ]'
    parseBracketGroup() {
        const node = new ASTNode('[ ]');
        this.eat('CARACTER_ESPECIAL','[');
        while (!this.is('CARACTER_ESPECIAL',']') && !this.isEOF()) {
            if (this.is('CARACTER_ESPECIAL',',')) { this.advance(); continue; }
            // spread ...x
            if (this.is('CARACTER_ESPECIAL','.')) {
                // consume hasta 3 puntos
                let dots=''; while(this.is('CARACTER_ESPECIAL','.')){this.advance();dots+='.';}
                const spread = new ASTNode('...');
                if (this.is('VARIABLE')) spread.addChild(new ASTNode(this.advance()[1]));
                node.addChild(spread); continue;
            }
            const e = this.parseExpr(); if (e) node.addChild(e);
        }
        this.eat('CARACTER_ESPECIAL',']');
        return node;
    }

    // ── Expresiones ──────────────────────────────
    parseExpr()   { return this.parseAssign(); }

    parseAssign() {
        const left = this.parseOr();
        if (this.is('OPERADOR','=')) {
            this.advance();
            const n = new ASTNode('=');
            n.addChild(left); n.addChild(this.parseAssign()); return n;
        }
        return left;
    }
    parseOr() {
        let l = this.parseAnd();
        while (this.is('PALABRA_RESERVADA','or')||this.is('OPERADOR','|')) {
            const n=new ASTNode(this.advance()[1]); n.addChild(l); n.addChild(this.parseAnd()); l=n;
        } return l;
    }
    parseAnd() {
        let l = this.parseEq();
        while (this.is('PALABRA_RESERVADA','and')||this.is('OPERADOR','&')) {
            const n=new ASTNode(this.advance()[1]); n.addChild(l); n.addChild(this.parseEq()); l=n;
        } return l;
    }
    parseEq() {
        let l = this.parseRel();
        while (this.is('OPERADOR')&&['==','!='].includes(this.peek()[1])) {
            const n=new ASTNode(this.advance()[1]); n.addChild(l); n.addChild(this.parseRel()); l=n;
        } return l;
    }
    parseRel() {
        let l = this.parseAdd();
        while (this.is('OPERADOR')&&['<','>','<=','>='].includes(this.peek()[1])) {
            const n=new ASTNode(this.advance()[1]); n.addChild(l); n.addChild(this.parseAdd()); l=n;
        } return l;
    }
    parseAdd() {
        let l = this.parseMul();
        while (this.is('OPERADOR')&&['+','-'].includes(this.peek()[1])) {
            const n=new ASTNode(this.advance()[1]); n.addChild(l); n.addChild(this.parseMul()); l=n;
        } return l;
    }
    parseMul() {
        let l = this.parseUnary();
        while (this.is('OPERADOR')&&['*','/','%'].includes(this.peek()[1])) {
            const n=new ASTNode(this.advance()[1]); n.addChild(l); n.addChild(this.parseUnary()); l=n;
        } return l;
    }
    parseUnary() {
        if (this.is('OPERADOR')&&['-','!','~'].includes(this.peek()[1])) {
            const n=new ASTNode(this.advance()[1]); n.addChild(this.parseUnary()); return n;
        }
        if (this.is('PALABRA_RESERVADA','not')) {
            this.advance(); const n=new ASTNode('not'); n.addChild(this.parseUnary()); return n;
        }
        return this.parsePostfix();
    }
    parsePostfix() {
        let node = this.parsePrimary();
        while (true) {
            // acceso a propiedad: obj.prop
            if (this.is('CARACTER_ESPECIAL','.')) {
                this.advance();
                const acc = new ASTNode('.');
                acc.addChild(node);
                if (this.is('VARIABLE')) acc.addChild(new ASTNode(this.advance()[1]));
                node = acc;
            }
            // llamada: fn( args )
            else if (this.is('CARACTER_ESPECIAL','(')) {
                const args = new ASTNode('( )');
                this.eat('CARACTER_ESPECIAL','(');
                while (!this.is('CARACTER_ESPECIAL',')') && !this.isEOF()) {
                    if (this.is('CARACTER_ESPECIAL',',')){ this.advance(); continue; }
                    const e = this.parseExpr(); if(e) args.addChild(e);
                }
                this.eat('CARACTER_ESPECIAL',')');
                const call = new ASTNode('call');
                call.addChild(node); call.addChild(args);
                node = call;
            }
            // índice: arr[ idx ]
            else if (this.is('CARACTER_ESPECIAL','[')) {
                const idx = this.parseBracketGroup();
                const wrap = new ASTNode('[ ]');
                wrap.addChild(node);
                for (const c of idx.children) wrap.addChild(c);
                node = wrap;
            }
            else break;
        }
        return node;
    }
    parsePrimary() {
        const [t,v] = this.peek();
        if (t==='ENTERO'||t==='REAL')                      { this.advance(); return new ASTNode(v); }
        if (t==='CADENA')                                  { this.advance(); return new ASTNode('"'+v+'"'); }
        if (t==='VARIABLE'||t==='PALABRA_RESERVADA')       { this.advance(); return new ASTNode(v); }
        if (t==='CARACTER_ESPECIAL'&&v==='(')              return this.parseParenGroup();
        if (t==='CARACTER_ESPECIAL'&&v==='[')              return this.parseBracketGroup();
        if (t==='CARACTER_ESPECIAL'&&v==='{')              return this.parseBlock();
        // spread ...x
        if (t==='CARACTER_ESPECIAL'&&v==='.') {
            let dots=''; while(this.is('CARACTER_ESPECIAL','.')){this.advance();dots+='.';}
            const n=new ASTNode('...');
            if(this.is('VARIABLE')) n.addChild(new ASTNode(this.advance()[1]));
            return n;
        }
        if (t!==null) { this.advance(); return new ASTNode(v); }
        return null;
    }
}

// ══════════════════════════════════════════════════
//  LAYOUT — Reingold-Tilford simplificado
//  X = horizontal (entre hermanos)
//  Y = vertical   (entre niveles, crece hacia abajo)
// ══════════════════════════════════════════════════
const CFG = {
    nodeH   : 34,   // alto del rectángulo de nodo
    levelGap: 60,   // distancia vertical entre centros de nivel
    hGap    : 14,   // espacio mínimo horizontal entre nodos hermanos
    fontSize: 11,
    charW   : 7.5,  // ancho aproximado por carácter
    padX    : 12,   // padding horizontal dentro del nodo
};

function nodeW(label) {
    return Math.max(String(label).length * CFG.charW + CFG.padX * 2, 44);
}

// Ancho total que requiere el subárbol
function subtreeW(node) {
    if (!node) return 0;
    const self = nodeW(node.lexema) + CFG.hGap;
    if (!node.children || node.children.length === 0) return self;
    const kids = node.children.reduce((s,c) => s + subtreeW(c), 0);
    return Math.max(self, kids);
}

// Asignar coordenadas (_x, _y) a cada nodo
function layout(node, level, leftEdge) {
    if (!node) return;
    const sw   = subtreeW(node);
    node._x    = leftEdge + sw / 2;                      // centro horizontal del subárbol
    node._y    = level * CFG.levelGap + CFG.nodeH / 2;   // centro vertical del nodo
    let cursor = leftEdge;
    for (const c of (node.children || [])) {
        const cw = subtreeW(c);
        layout(c, level + 1, cursor);
        cursor += cw;
    }
}

function collectAll(node, nodes=[], edges=[]) {
    if (!node) return {nodes,edges};
    nodes.push(node);
    for (const c of (node.children||[])) {
        edges.push({from:node, to:c});
        collectAll(c, nodes, edges);
    }
    return {nodes,edges};
}

// Dimensiones totales del árbol
function treeDims(ast) {
    const w = subtreeW(ast);
    let maxLevel = 0;
    function depth(n,lv){ maxLevel=Math.max(maxLevel,lv); (n.children||[]).forEach(c=>depth(c,lv+1)); }
    depth(ast, 0);
    const h = (maxLevel + 1) * CFG.levelGap + CFG.nodeH;
    return { w: Math.max(w, 120), h };
}

// ══════════════════════════════════════════════════
//  ESTILOS DE NODO
// ══════════════════════════════════════════════════
const _KW     = new Set(['if','else','while','for','return','class','def','function',
    'int','float','double','char','string','String','bool','boolean','long','short',
    'void','var','let','const','new','import','from','print',
    'true','false','True','False','null','None','this','super']);
const _OPS    = new Set(['=','==','!=','<','>','<=','>=','+','-','*','/','%','!','and','or','not','&','|','~','...']);
const _STRUCT = new Set(['PROGRAMA','{ }','( )','[ ]','call','.']);

function nStyle(lbl) {
    const l = String(lbl);
    if (l==='PROGRAMA')             return {fill:'#0f2744',stroke:'#5b8df6',text:'#93c5fd',fw:700};
    if (_STRUCT.has(l))             return {fill:'#0d2137',stroke:'#38bdf8',text:'#7dd3fc',fw:600};
    if (_KW.has(l))                 return {fill:'#2d1060',stroke:'#a78bfa',text:'#ddd6fe',fw:600};
    if (_OPS.has(l))                return {fill:'#431407',stroke:'#f97316',text:'#fed7aa',fw:700};
    if (/^".*"$/.test(l))           return {fill:'#2e1065',stroke:'#c084fc',text:'#e9d5ff',fw:400};
    if (/^\d+(\.\d+)?$/.test(l))    return {fill:'#3a1a00',stroke:'#fb923c',text:'#fdba74',fw:400};
    return {fill:'#021b0e',stroke:'#4ade80',text:'#86efac',fw:400};
}

// ══════════════════════════════════════════════════
//  RENDER SVG
// ══════════════════════════════════════════════════
function buildSVG(ast) {
    const PAD = 20;
    const { w, h } = treeDims(ast);

    layout(ast, 0, 0);
    const { nodes, edges } = collectAll(ast);

    // ── Aristas (curvas Bézier) ──
    let edgesSVG = '';
    for (const { from, to } of edges) {
        const x1 = from._x, y1 = from._y + CFG.nodeH / 2;
        const x2 = to._x,   y2 = to._y   - CFG.nodeH / 2;
        const my  = (y1 + y2) / 2;
        edgesSVG += `<path d="M${x1.toFixed(1)},${y1.toFixed(1)} C${x1.toFixed(1)},${my.toFixed(1)} ${x2.toFixed(1)},${my.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}"
            fill="none" stroke="#334155" stroke-width="1.5" stroke-linecap="round"/>`;
    }

    // ── Nodos ──
    let nodesSVG = '';
    for (const node of nodes) {
        const lbl = node.lexema !== null && node.lexema !== undefined ? String(node.lexema) : '?';
        const s   = nStyle(lbl);
        const nw  = nodeW(lbl);
        const cx  = node._x, cy = node._y;
        const esc = lbl.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

        nodesSVG += `<g transform="translate(${cx.toFixed(1)},${cy.toFixed(1)})">
          <rect x="${(-nw/2).toFixed(1)}" y="${(-CFG.nodeH/2).toFixed(1)}"
            width="${nw}" height="${CFG.nodeH}" rx="7"
            fill="${s.fill}" stroke="${s.stroke}" stroke-width="1.5"/>
          <text x="0" y="1" text-anchor="middle" dominant-baseline="middle"
            font-family="JetBrains Mono,monospace"
            font-size="${CFG.fontSize}" font-weight="${s.fw}" fill="${s.text}">${esc}</text>
        </g>`;
    }

    const vbW = w  + PAD * 2;
    const vbH = h  + PAD * 2;

    return `<svg xmlns="http://www.w3.org/2000/svg"
        viewBox="${-PAD} ${-PAD} ${vbW} ${vbH}"
        width="${vbW}" height="${vbH}">
      ${edgesSVG}${nodesSVG}
    </svg>`;
}

// ══════════════════════════════════════════════════
//  API PÚBLICA
// ══════════════════════════════════════════════════
function analizarArbol(tokens) {
    try { return new Parser(tokens).parse(); }
    catch(e){ console.error('Parser error:', e); return null; }
}

function renderAstTree(ast, container) {
    if (!ast || !ast.children || ast.children.length === 0) {
        container.classList.remove('has-tree');
        container.innerHTML = `<div class="tree-placeholder" id="tree-placeholder">
            <img src="nodos.png" alt="Árbol sintáctico">
            <span>El árbol sintáctico aparecerá aquí</span>
        </div>`;
        return;
    }

    container.classList.add('has-tree');

    const svg = buildSVG(ast);

    // El wrapper permite scroll en ambas direcciones si el árbol es grande,
    // pero NUNCA desborda el panel contenedor
    container.innerHTML = `
        <div style="
            width:100%;
            height:100%;
            overflow:auto;
            display:flex;
            align-items:flex-start;
            justify-content:center;
            padding:1rem;
            box-sizing:border-box;
        ">${svg}</div>`;
}