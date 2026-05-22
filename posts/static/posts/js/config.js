/**
 * config.js
 * Lê o bloco de configuração JSON injetado pelo Django no base.html
 * e exporta um objeto imutável consumido pelos demais módulos.
 *
 * Elimina todas as interpolações Django dentro de arquivos JS
 * ({{ user.is_authenticated|yesno:"true,false" }}, {{ user.username }}, etc.)
 */

const _raw = document.getElementById('bn-config');

if (!_raw) {
    console.warn(
        '[Blognotes] Bloco #bn-config não encontrado no DOM. ' +
        'Verifique se base.html inclui o bloco <script type="application/json" id="bn-config">.'
    );
}

const _data = _raw ? JSON.parse(_raw.textContent) : {};

/**
 * Configuração global da sessão atual.
 * @type {{
 *   isAuth:    boolean,
 *   meUsername: string,
 *   meAvatar:   string,
 * }}
 */
const Config = Object.freeze({
    isAuth:     Boolean(_data.isAuth),
    meUsername: String(_data.meUsername ?? ''),
    meAvatar:   String(_data.meAvatar   ?? ''),
});

export default Config;