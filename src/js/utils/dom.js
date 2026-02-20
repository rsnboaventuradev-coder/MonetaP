/**
 * Cria um elemento HTML com atributos e conteúdo de forma segura.
 * @param {string} tag - A tag HTML (ex: 'div', 'li')
 * @param {object} attributes - Objeto com atributos (class, id, src, dataset, eventos onClick, etc)
 * @param {string|HTMLElement|Array} content - Conteúdo interno (texto ou outros elementos)
 * @returns {HTMLElement}
 */
export function createElement(tag, attributes = {}, content = '') {
    const element = document.createElement(tag);

    // Definir atributos
    Object.entries(attributes).forEach(([key, value]) => {
        if (key === 'className') {
            element.className = value;
        } else if (key === 'dataset' && typeof value === 'object') {
            Object.entries(value).forEach(([dataKey, dataValue]) => {
                element.dataset[dataKey] = dataValue;
            });
        } else if (key.startsWith('on') && typeof value === 'function') {
            // Adiciona listeners de evento (ex: onClick -> click)
            element.addEventListener(key.substring(2).toLowerCase(), value);
        } else {
            element.setAttribute(key, value);
        }
    });

    // Definir conteúdo
    const appendContent = (child) => {
        if (child instanceof Node) {
            element.appendChild(child);
        } else if (child !== null && child !== undefined) {
            // Safe text content, prevents XSS
            element.appendChild(document.createTextNode(String(child)));
        }
    };

    if (Array.isArray(content)) {
        content.forEach(appendContent);
    } else {
        appendContent(content);
    }

    return element;
}

/**
 * Limpa o conteúdo de um elemento pelo ID
 * @param {string} elementId
 * @returns {HTMLElement|null}
 */
export function clearElement(elementId) {
    const el = document.getElementById(elementId);
    if (el) el.innerHTML = '';
    return el;
}
