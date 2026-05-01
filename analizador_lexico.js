
// ══════════════════════════════════════════════════
//  DEFINICIONES
// ══════════════════════════════════════════════════
const PALABRAS_RESERVADAS = new Set([
    // Control de flujo
    'if', 'else', 'elif', 'while', 'for', 'do', 'return', 'break', 'continue', 'switch', 'case', 'default',
    // Tipos de datos
    'int', 'float', 'double', 'char', 'void', 'bool', 'boolean', 'long', 'short', 'byte',
    // String con mayúscula y minúscula
    'string', 'String',
    // Booleanos y nulos
    'true', 'false', 'null', 'None', 'True', 'False',
    // OOP
    'class', 'new', 'this', 'super', 'extends', 'implements', 'interface', 'abstract', 'enum',
    'public', 'private', 'protected', 'static', 'final', 'void',
    // Java específico
    'main', 'import', 'package', 'instanceof', 'throws', 'throw', 'try', 'catch', 'finally', 'synchronized',
    // Python específico
    'def', 'from', 'in', 'pass', 'and', 'or', 'not', 'with', 'as', 'yield', 'lambda', 'global', 'nonlocal', 'del', 'assert', 'raise', 'except',
    // JS/TS específico
    'const', 'let', 'var', 'function', 'typeof', 'instanceof', 'of', 'async', 'await', 'yield',
    // Otros comunes
    'print', 'input', 'return', 'include', 'using', 'namespace',
]);

const OPERADORES = new Set(['=', '+', '-', '*', '/', '%', '&', '|', '^', '~', '<', '>', '!', '?']);

const ESPECIALES = new Set([...'(){}[];,.:@#']);

const META = {
    ESPACIO_BLANCO: { label: 'ESPACIO_BLANCO', bg: 'var(--c-espacio)', fg: 'var(--t-espacio)' },
    TABULADOR: { label: 'TABULADOR', bg: 'var(--c-tab)', fg: 'var(--t-tab)' },
    SALTO_LINEA: { label: 'SALTO_LINEA', bg: 'var(--c-salto)', fg: 'var(--t-salto)' },
    PALABRA_RESERVADA: { label: 'PALABRA_RESERVADA', bg: 'var(--c-reservada)', fg: 'var(--t-reservada)' },
    VARIABLE: { label: 'VARIABLE', bg: 'var(--c-variable)', fg: 'var(--t-variable)' },
    ENTERO: { label: 'ENTERO', bg: 'var(--c-entero)', fg: 'var(--t-entero)' },
    REAL: { label: 'REAL', bg: 'var(--c-real)', fg: 'var(--t-real)' },
    CADENA: { label: 'CADENA', bg: 'var(--c-cadena)', fg: 'var(--t-cadena)' },
    COMENTARIO: { label: 'COMENTARIO', bg: 'var(--c-comentario)', fg: 'var(--t-comentario)' },
    OPERADOR: { label: 'OPERADOR', bg: 'var(--c-operador)', fg: 'var(--t-operador)' },
    CARACTER_ESPECIAL: { label: 'CARACTER_ESPECIAL', bg: 'var(--c-especial)', fg: 'var(--t-especial)' },
    DESCONOCIDO: { label: 'DESCONOCIDO', bg: 'var(--c-desconocido)', fg: 'var(--t-desconocido)' },
};

// ══════════════════════════════════════════════════
//  TOKENIZADOR
// ══════════════════════════════════════════════════
function tokenizar(src) {
    const tokens = [];
    let i = 0, n = src.length;

    while (i < n) {
        const c = src[i];

        // SALTO DE LINEA
        if (c === '\r' && src[i + 1] === '\n') { tokens.push(['SALTO_LINEA', '\\r\\n']); i += 2; continue; }
        if (c === '\n' || c === '\r') { tokens.push(['SALTO_LINEA', '\\n']); i++; continue; }

        // TABULADOR
        if (c === '\t') { tokens.push(['TABULADOR', '\\t']); i++; continue; }

        // ESPACIO EN BLANCO
        if (c === ' ') { tokens.push(['ESPACIO_BLANCO', 'ESPACIO']); i++; continue; }

        // COMENTARIO de línea //
        if (c === '/' && src[i + 1] === '/') {
            let j = i; while (j < n && src[j] !== '\n') j++;
            tokens.push(['COMENTARIO', src.slice(i, j)]); i = j; continue;
        }
        // COMENTARIO de bloque /* */
        if (c === '/' && src[i + 1] === '*') {
            let j = i + 2; while (j < n - 1 && !(src[j] === '*' && src[j + 1] === '/')) j++;
            j += 2; tokens.push(['COMENTARIO', src.slice(i, j)]); i = j; continue;
        }
        // COMENTARIO Python #
        if (c === '#') {
            let j = i; while (j < n && src[j] !== '\n') j++;
            tokens.push(['COMENTARIO', src.slice(i, j)]); i = j; continue;
        }

        // CADENA " o '
        if (c === '"' || c === "'") {
            const q = c;
            // Primera comilla como CARACTER_ESPECIAL
            tokens.push(['CARACTER_ESPECIAL', q]);
            let j = i + 1;
            let contenido = '';
            while (j < n && src[j] !== q) {
                if (src[j] === '\\' && j + 1 < n) {
                    contenido += src[j] + src[j + 1];
                    j += 2;
                } else {
                    contenido += src[j];
                    j++;
                }
            }
            // Contenido de la cadena como CADENA
            if (contenido.length > 0) {
                tokens.push(['CADENA', contenido]);
            }
            // Comilla de cierre como CARACTER_ESPECIAL
            if (j < n && src[j] === q) {
                tokens.push(['CARACTER_ESPECIAL', q]);
                j++;
            }
            i = j;
            continue;
        }

        // ENTERO o REAL
        if (c >= '0' && c <= '9') {
            let j = i; while (j < n && src[j] >= '0' && src[j] <= '9') j++;
            if (j < n && src[j] === '.' && j + 1 < n && src[j + 1] >= '0' && src[j + 1] <= '9') {
                j++; while (j < n && src[j] >= '0' && src[j] <= '9') j++;
                tokens.push(['REAL', src.slice(i, j)]);
            } else {
                tokens.push(['ENTERO', src.slice(i, j)]);
            }
            i = j; continue;
        }

        // VARIABLE / PALABRA RESERVADA
        if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_') {
            let j = i;
            while (j < n && (/[a-zA-Z0-9_]/.test(src[j]))) j++;
            const lex = src.slice(i, j);
            tokens.push([PALABRAS_RESERVADAS.has(lex) ? 'PALABRA_RESERVADA' : 'VARIABLE', lex]);
            i = j; continue;
        }

        // OPERADOR
        if (OPERADORES.has(c)) { tokens.push(['OPERADOR', c]); i++; continue; }

        // CARACTER ESPECIAL
        if (ESPECIALES.has(c)) { tokens.push(['CARACTER_ESPECIAL', c]); i++; continue; }

        // DESCONOCIDO
        tokens.push(['DESCONOCIDO', c]); i++;
    }
    return tokens;
}

// ══════════════════════════════════════════════════
//  RENDERIZADO
// ══════════════════════════════════════════════════
function analizar() {
    const src = document.getElementById('src').value;
    const mostrarWS = document.getElementById('show-ws').checked;

    if (!src.trim()) { limpiar(); return; }

    const tokens = tokenizar(src);
    const visibles = mostrarWS ? tokens : tokens.filter(([t]) => !['ESPACIO_BLANCO', 'TABULADOR', 'SALTO_LINEA'].includes(t));

    // ── Estadísticas ──
    const conteo = {};
    for (const [tipo] of tokens) conteo[tipo] = (conteo[tipo] || 0) + 1;

    const total = visibles.length;
    const statsGrid = document.getElementById('stats-grid');
    statsGrid.innerHTML = `<div class="stat-card"><div class="stat-num">${total}</div><div class="stat-label">Total tokens</div></div>`
        + Object.entries(conteo)
            .filter(([t]) => mostrarWS || !['ESPACIO_BLANCO', 'TABULADOR', 'SALTO_LINEA'].includes(t))
            .sort((a, b) => b[1] - a[1])
            .map(([tipo, n]) => {
                const m = META[tipo] || META.DESCONOCIDO;
                return `<div class="stat-card">
            <div class="stat-num" style="color:${m.fg}">${n}</div>
            <div class="stat-label">${m.label.replace('_', '<br>')}</div>
          </div>`;
            }).join('');

    // ── Tabla ──
    const wrap = document.getElementById('table-wrap');
    if (!visibles.length) {
        wrap.innerHTML = '<div class="placeholder"><span class="placeholder-icon">∅</span><span>Sin tokens para mostrar</span></div>';
    } else {
        const filas = visibles.map(([tipo, val], idx) => {
            const m = META[tipo] || META.DESCONOCIDO;
            const escaped = val.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            return `<tr>
              <td>${idx + 1}</td>
              <td><span class="badge" style="background:${m.bg};color:${m.fg}">${m.label}</span></td>
              <td style="color:${m.fg};font-family:var(--mono)">${escaped}</td>
            </tr>`;
        }).join('');

        wrap.innerHTML = `<table>
        <thead><tr><th>#</th><th>Tipo</th><th>Lexema</th></tr></thead>
        <tbody>${filas}</tbody>
      </table>`;
    }

    // ── Árbol Sintáctico ──
    const ast = analizarArbol(tokens);
    const treeWrap = document.getElementById('tree-wrap');
    renderAstTree(ast, treeWrap);

    // ── Leyenda ──
    const tipos = [...new Set(visibles.map(([t]) => t))];
    const legend = document.getElementById('legend');
    legend.innerHTML = tipos.map(t => {
        const m = META[t] || META.DESCONOCIDO;
        return `<div class="leg-item">
      <div class="leg-dot" style="background:${m.fg}"></div>
      ${m.label}
    </div>`;
    }).join('');
}

function limpiar() {
    document.getElementById('src').value = '';
    document.getElementById('table-wrap').innerHTML =
        '<div class="placeholder"><span class="placeholder-icon">{ }</span><span>Ingresa código y presiona Analizar</span></div>';
    const treeWrap = document.getElementById('tree-wrap');
    treeWrap.innerHTML = `<div class="tree-placeholder" id="tree-placeholder">
          <img src="nodos.png" alt="Árbol sintáctico">
          <span>El árbol sintáctico aparecerá aquí</span>
        </div>`;
    document.getElementById('stats-grid').innerHTML = '';
    document.getElementById('legend').innerHTML = '';
}

// Ctrl+Enter para analizar
document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') analizar();
});

// Tab dentro del textarea inserta \t en lugar de saltar al siguiente elemento
document.getElementById('src').addEventListener('keydown', e => {
    if (e.key === 'Tab') {
        e.preventDefault();
        const ta = e.target;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        ta.value = ta.value.slice(0, start) + '\t' + ta.value.slice(end);
        ta.selectionStart = ta.selectionEnd = start + 1;
    }
});
