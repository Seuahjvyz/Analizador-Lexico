
// ══════════════════════════════════════════════════
//  ARBOL SINTACTICO (AST)
// ══════════════════════════════════════════════════
const AST_NODE_TYPES = {
    PROGRAM: 'Programa',
    BLOCK: 'Bloque',
    VAR_DECL: 'Declaración',
    ASSIGN: 'Asignación',
    IF: 'If',
    WHILE: 'While',
    FOR: 'For',
    RETURN: 'Return',
    FUNCTION_CALL: 'Llamada a función',
    FUNCTION_DECL: 'Declaración de función',
    BINARY_OP: 'Operación binaria',
    UNARY_OP: 'Operación unaria',
    IDENTIFIER: 'Identificador',
    NUMBER: 'Número',
    STRING: 'Cadena',
    BOOLEAN: 'Booleano',
    MEMBER_ACCESS: 'Acceso a miembro',
    ARRAY_INDEX: 'Indexación',
    CONDITIONAL: 'Condicional',
    PARAM: 'Parámetro',
    ARGUMENT: 'Argumento',
};

class ASTNode {
    constructor(type, value = null, children = []) {
        this.type = type;
        this.value = value;
        this.children = children;
    }
    addChild(child) {
        this.children.push(child);
        return this;
    }
}

// ══════════════════════════════════════════════════
//  PARSER SINTACTICO
// ══════════════════════════════════════════════════
class Parser {
    constructor(tokens) {
        this.tokens = tokens.filter(([t]) => !['ESPACIO_BLANCO', 'TABULADOR', 'SALTO_LINEA', 'COMENTARIO'].includes(t));
        this.pos = 0;
    }

    peek() { return this.tokens[this.pos] || [null, null]; }
    advance() { return this.tokens[this.pos++]; }
    match(type, value = null) {
        const [t, v] = this.peek();
        if (t === type && (value === null || v === value)) {
            this.advance();
            return true;
        }
        if (type === 'OPERADOR' && t === 'CARACTER_ESPECIAL' && (value === null || v === value)) {
            this.advance();
            return true;
        }
        return false;
    }
    expect(type, value = null) {
        const [t, v] = this.peek();
        if (t === type && (value === null || v === value)) {
            return this.advance();
        }
        throw new Error(`Se esperaba ${value || type}, pero se encontró ${v || t} en posición ${this.pos}`);
    }
    isType(type, value = null) {
        const [t, v] = this.peek();
        if (type === 'OPERADOR' && t === 'CARACTER_ESPECIAL') {
            return value === null || v === value;
        }
        return t === type && (value === null || v === value);
    }
    isEOF() { return this.pos >= this.tokens.length; }

    parse() {
        const program = new ASTNode(AST_NODE_TYPES.PROGRAM);
        while (!this.isEOF()) {
            program.addChild(this.parseStatement());
        }
        return program;
    }

    parseStatement() {
        const [t, v] = this.peek();

        if (this.match('CARACTER_ESPECIAL', ';')) {
            return new ASTNode('Empty');
        }
        if (t === 'PALABRA_RESERVADA' && (v === 'if' || v === 'elif')) {
            return this.parseIf();
        }
        if (t === 'PALABRA_RESERVADA' && v === 'else') {
            return this.parseElse();
        }
        if (t === 'PALABRA_RESERVADA' && v === 'while') {
            return this.parseWhile();
        }
        if (t === 'PALABRA_RESERVADA' && v === 'for') {
            return this.parseFor();
        }
        if (t === 'PALABRA_RESERVADA' && v === 'return') {
            return this.parseReturn();
        }
        if (t === 'PALABRA_RESERVADA' && (v === 'break' || v === 'continue')) {
            this.advance();
            this.match('CARACTER_ESPECIAL', ';');
            return new ASTNode(v === 'break' ? 'Break' : 'Continue');
        }
        if (t === 'PALABRA_RESERVADA' && (v === 'function' || v === 'def')) {
            return this.parseFunctionDecl();
        }
        if (t === 'PALABRA_RESERVADA' && v === 'class') {
            return this.parseClassDecl();
        }
        return this.parseExpressionStatement();
    }

    parseIf() {
        this.expect('PALABRA_RESERVADA');
        this.match('CARACTER_ESPECIAL', '(');
        const cond = this.parseExpression();
        this.match('CARACTER_ESPECIAL', ')');
        const body = this.parseBlock();
        const node = new ASTNode(AST_NODE_TYPES.IF, 'if', [cond, body]);
        if (!this.isEOF()) {
            const [t, v] = this.peek();
            if (t === 'PALABRA_RESERVADA' && (v === 'elif' || v === 'else')) {
                node.addChild(this.parseStatement());
            }
        }
        return node;
    }

    parseElse() {
        this.advance();
        const body = this.parseBlock();
        return new ASTNode('Else', 'else', [body]);
    }

    parseWhile() {
        this.advance();
        this.match('CARACTER_ESPECIAL', '(');
        const cond = this.parseExpression();
        this.match('CARACTER_ESPECIAL', ')');
        const body = this.parseBlock();
        return new ASTNode(AST_NODE_TYPES.WHILE, 'while', [cond, body]);
    }

    parseFor() {
        this.advance();
        this.match('CARACTER_ESPECIAL', '(');
        const init = this.parseExpression();
        this.match('CARACTER_ESPECIAL', ';');
        const cond = this.isType('CARACTER_ESPECIAL', ';') ? null : this.parseExpression();
        this.match('CARACTER_ESPECIAL', ';');
        const step = this.isType('CARACTER_ESPECIAL', ')') ? null : this.parseExpression();
        this.match('CARACTER_ESPECIAL', ')');
        const body = this.parseBlock();
        return new ASTNode(AST_NODE_TYPES.FOR, 'for', [init, cond, step, body].filter(Boolean));
    }

    parseReturn() {
        this.advance();
        let expr = null;
        if (!this.isType('CARACTER_ESPECIAL', ';')) {
            expr = this.parseExpression();
        }
        this.match('CARACTER_ESPECIAL', ';');
        return new ASTNode(AST_NODE_TYPES.RETURN, 'return', expr ? [expr] : []);
    }

    parseFunctionDecl() {
        this.advance();
        const nameTok = this.advance();
        const name = new ASTNode(AST_NODE_TYPES.IDENTIFIER, nameTok[1]);
        this.match('CARACTER_ESPECIAL', '(');
        const params = [];
        if (!this.isType('CARACTER_ESPECIAL', ')')) {
            params.push(this.parseExpression());
            while (this.match('CARACTER_ESPECIAL', ',')) {
                params.push(this.parseExpression());
            }
        }
        this.match('CARACTER_ESPECIAL', ')');
        const body = this.parseBlock();
        const node = new ASTNode(AST_NODE_TYPES.FUNCTION_DECL, nameTok[1], [name, body]);
        params.forEach(p => node.addChild(new ASTNode(AST_NODE_TYPES.PARAM, null, [p])));
        return node;
    }

    parseClassDecl() {
        this.advance();
        const nameTok = this.advance();
        const name = new ASTNode(AST_NODE_TYPES.IDENTIFIER, nameTok[1]);
        const body = this.parseBlock();
        return new ASTNode('Class', 'class', [name, body]);
    }

    parseBlock() {
        if (this.match('CARACTER_ESPECIAL', '{')) {
            const block = new ASTNode(AST_NODE_TYPES.BLOCK);
            while (!this.isType('CARACTER_ESPECIAL', '}') && !this.isEOF()) {
                block.addChild(this.parseStatement());
            }
            this.match('CARACTER_ESPECIAL', '}');
            return block;
        }
        const stmt = this.parseStatement();
        this.match('CARACTER_ESPECIAL', ';');
        return new ASTNode(AST_NODE_TYPES.BLOCK, null, [stmt]);
    }

    parseExpressionStatement() {
        const expr = this.parseExpression();
        this.match('CARACTER_ESPECIAL', ';');
        if (expr.type === AST_NODE_TYPES.ASSIGN || expr.type === AST_NODE_TYPES.VAR_DECL) {
            return expr;
        }
        return expr;
    }

    parseExpression() {
        return this.parseAssignment();
    }

    parseAssignment() {
        let left = this.parseLogicalOr();
        if (this.match('OPERADOR', '=')) {
            if (this.isType('OPERADOR', '=')) {
                this.pos--;
                return left;
            }
            const right = this.parseAssignment();
            return new ASTNode(AST_NODE_TYPES.ASSIGN, '=', [left, right]);
        }
        return left;
    }

    parseLogicalOr() {
        let left = this.parseLogicalAnd();
        while (this.isType('PALABRA_RESERVADA', 'or')) {
            this.advance();
            left = new ASTNode(AST_NODE_TYPES.BINARY_OP, 'or', [left, this.parseLogicalAnd()]);
        }
        return left;
    }

    parseLogicalAnd() {
        let left = this.parseEquality();
        while (this.isType('PALABRA_RESERVADA', 'and')) {
            this.advance();
            left = new ASTNode(AST_NODE_TYPES.BINARY_OP, 'and', [left, this.parseEquality()]);
        }
        return left;
    }

    parseEquality() {
        let left = this.parseRelational();
        while (this.isType('OPERADOR') && (this.peek()[1] === '==' || this.peek()[1] === '!=')) {
            const op = this.advance()[1];
            left = new ASTNode(AST_NODE_TYPES.BINARY_OP, op, [left, this.parseRelational()]);
        }
        return left;
    }

    parseRelational() {
        let left = this.parseAdditive();
        while (this.isType('OPERADOR') && ['<', '>', '<=', '>='].includes(this.peek()[1])) {
            const op = this.advance()[1];
            left = new ASTNode(AST_NODE_TYPES.BINARY_OP, op, [left, this.parseAdditive()]);
        }
        return left;
    }

    parseAdditive() {
        let left = this.parseMultiplicative();
        while (this.isType('OPERADOR') && (this.peek()[1] === '+' || this.peek()[1] === '-')) {
            const op = this.advance()[1];
            left = new ASTNode(AST_NODE_TYPES.BINARY_OP, op, [left, this.parseMultiplicative()]);
        }
        return left;
    }

    parseMultiplicative() {
        let left = this.parseUnary();
        while (this.isType('OPERADOR') && (this.peek()[1] === '*' || this.peek()[1] === '/' || this.peek()[1] === '%')) {
            const op = this.advance()[1];
            left = new ASTNode(AST_NODE_TYPES.BINARY_OP, op, [left, this.parseUnary()]);
        }
        return left;
    }

    parseUnary() {
        if (this.isType('OPERADOR') && (this.peek()[1] === '-' || this.peek()[1] === '!' || this.peek()[1] === '~')) {
            const op = this.advance()[1];
            return new ASTNode(AST_NODE_TYPES.UNARY_OP, op, [this.parseUnary()]);
        }
        if (this.isType('PALABRA_RESERVADA') && (this.peek()[1] === 'not' || this.peek()[1] === 'typeof')) {
            const op = this.advance()[1];
            return new ASTNode(AST_NODE_TYPES.UNARY_OP, op, [this.parseUnary()]);
        }
        return this.parseCall();
    }

    parseCall() {
        let expr = this.parsePrimary();
        while (true) {
            if (this.match('CARACTER_ESPECIAL', '(')) {
                const args = [];
                if (!this.isType('CARACTER_ESPECIAL', ')')) {
                    args.push(this.parseExpression());
                    while (this.match('CARACTER_ESPECIAL', ',')) {
                        args.push(this.parseExpression());
                    }
                }
                this.match('CARACTER_ESPECIAL', ')');
                expr = new ASTNode(AST_NODE_TYPES.FUNCTION_CALL, expr.value || 'call', [expr, ...args]);
            } else if (this.match('CARACTER_ESPECIAL', '[')) {
                const index = this.parseExpression();
                this.match('CARACTER_ESPECIAL', ']');
                expr = new ASTNode(AST_NODE_TYPES.ARRAY_INDEX, '[]', [expr, index]);
            } else if (this.match('CARACTER_ESPECIAL', '.')) {
                const member = this.advance();
                expr = new ASTNode(AST_NODE_TYPES.MEMBER_ACCESS, member[1], [expr, new ASTNode(AST_NODE_TYPES.IDENTIFIER, member[1])]);
            } else {
                break;
            }
        }
        return expr;
    }

    parsePrimary() {
        const [t, v] = this.peek();

        if (t === 'ENTERO' || t === 'REAL') {
            this.advance();
            return new ASTNode(AST_NODE_TYPES.NUMBER, v);
        }
        if (t === 'CADENA') {
            this.advance();
            return new ASTNode(AST_NODE_TYPES.STRING, v);
        }
        if (t === 'PALABRA_RESERVADA' && (v === 'true' || v === 'false' || v === 'True' || v === 'False')) {
            this.advance();
            return new ASTNode(AST_NODE_TYPES.BOOLEAN, v);
        }
        if (t === 'PALABRA_RESERVADA' && (v === 'null' || v === 'None')) {
            this.advance();
            return new ASTNode('Null', v);
        }
        if (t === 'CARACTER_ESPECIAL' && v === '(') {
            this.advance();
            const expr = this.parseExpression();
            this.match('CARACTER_ESPECIAL', ')');
            return expr;
        }
        if (t === 'VARIABLE' || t === 'PALABRA_RESERVADA') {
            this.advance();
            const isType = ['int', 'float', 'double', 'char', 'bool', 'boolean', 'string', 'String', 'var', 'let', 'const', 'long', 'short', 'byte', 'void'].includes(v);
            if (isType) {
                const [nextT, nextV] = this.peek();
                if (nextT === 'VARIABLE' || nextT === 'PALABRA_RESERVADA') {
                    const nameNode = new ASTNode(AST_NODE_TYPES.IDENTIFIER, nextV);
                    this.advance();
                    if (this.match('OPERADOR', '=')) {
                        const val = this.parseExpression();
                        return new ASTNode(AST_NODE_TYPES.VAR_DECL, v, [nameNode, val]);
                    } else if (this.match('CARACTER_ESPECIAL', '(')) {
                        this.pos -= 2;
                        return this.parseFunctionDecl();
                    } else {
                        this.match('CARACTER_ESPECIAL', ';');
                        return new ASTNode(AST_NODE_TYPES.VAR_DECL, v, [nameNode]);
                    }
                }
            }
            return new ASTNode(AST_NODE_TYPES.IDENTIFIER, v);
        }

        this.advance();
        return new ASTNode('Empty');
    }
}

// ══════════════════════════════════════════════════
//  RENDERIZADO DEL ARBOL
// ══════════════════════════════════════════════════
function createTreeSVG(ast) {
    const nodeW = 56;
    const nodeH = 36;
    const gapX = 64;
    const gapY = 70;

    function leafCount(n) {
        if (!n.children || n.children.length === 0) return 1;
        return n.children.reduce((s, c) => s + leafCount(c), 0);
    }

    function treeDepth(n) {
        if (!n.children || n.children.length === 0) return 1;
        return 1 + Math.max(...n.children.map(treeDepth));
    }

    function layout(n, left, depth, out) {
        const w = leafCount(n) * gapX;
        const cx = left + w / 2;
        const cy = depth * gapY + nodeH / 2;
        out.push({ n, cx, cy });
        if (n.children && n.children.length > 0) {
            let cur = left;
            n.children.forEach(ch => {
                const cw = leafCount(ch) * gapX;
                layout(ch, cur, depth + 1, out);
                out.push({ edge: true, x1: cx, y1: cy + nodeH / 2, x2: cur + cw / 2, y2: (depth + 1) * gapY + nodeH / 2 - nodeH / 2 });
                cur += cw;
            });
        }
    }

    const items = [];
    layout(ast, 0, 0, items);

    const tw = leafCount(ast) * gapX;
    const th = treeDepth(ast) * gapY + nodeH;
    const pad = 30;

    let s = `<svg width="${tw + pad * 2}" height="${th + pad * 2}" xmlns="http://www.w3.org/2000/svg">`;
    s += `<defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 1L8 5L0 9z" fill="#5b8df6"/></marker></defs>`;

    items.filter(i => i.edge).forEach(e => {
        s += `<line x1="${e.x1 + pad}" y1="${e.y1 + pad}" x2="${e.x2 + pad}" y2="${e.y2 + pad}" stroke="#252a38" stroke-width="1.5" marker-end="url(#arr)"/>`;
    });

    items.filter(i => !i.edge).forEach(p => {
        const lbl = p.n.value !== null && p.n.value !== undefined && p.n.value !== '' ? p.n.value : p.n.type;
        const short = lbl.length > 7 ? lbl.slice(0, 6) + '…' : lbl;
        s += `<rect x="${p.cx - nodeW / 2 + pad}" y="${p.cy - nodeH / 2 + pad}" width="${nodeW}" height="${nodeH}" fill="#1a1e2a" stroke="#5b8df6" stroke-width="1.5" rx="2"/>`;
        s += `<text x="${p.cx + pad}" y="${p.cy + 4 + pad}" text-anchor="middle" fill="#e2e8f4" font-family="JetBrains Mono,monospace" font-size="10" font-weight="600">${short}</text>`;
    });

    s += '</svg>';
    return s;
}

function renderTree(ast, container) {
    container.innerHTML = '';
    if (!ast) return;

    container.classList.add('has-tree');

    const treeDiv = document.createElement('div');
    treeDiv.className = 'tree';
    treeDiv.innerHTML = createTreeSVG(ast);

    container.appendChild(treeDiv);
}

function analizarArbol(tokens) {
    try {
        const parser = new Parser(tokens);
        const ast = parser.parse();
        return ast;
    } catch (e) {
        console.error('Error de parseo:', e);
        return new ASTNode('Error', e.message);
    }
}

function renderAstTree(ast, container) {
    if (!ast) {
        container.innerHTML = '<div class="placeholder"><span class="placeholder-icon">∅</span><span>No se pudo generar el árbol</span></div>';
        return;
    }
    if (ast.type === 'Error') {
        container.innerHTML = `<div class="placeholder"><span class="placeholder-icon">⚠</span><span>Error: ${ast.value}</span></div>`;
        return;
    }
    renderTree(ast, container);
}
