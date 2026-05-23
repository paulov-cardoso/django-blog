/**
 * utils.js
 * Funções utilitárias puras — sem dependência de DOM, estado ou outros módulos.
 * Importado por todos os outros módulos.
 */

/**
 * Lê o token CSRF do cookie do Django.
 * @returns {string}
 */
export function getCsrf() {
    return document.cookie
        .split(';')
        .map(c => c.trim())
        .find(c => c.startsWith('csrftoken='))
        ?.split('=')[1] ?? '';
}

/**
 * Formata uma data ISO em tempo relativo legível (ex: "3min", "2h", "5d").
 * @param {string} isoStr
 * @returns {string}
 */
export function timesince(isoStr) {
    const diff = Math.floor((Date.now() - new Date(isoStr)) / 1000);
    if (diff < 60)    return `${diff}s`;
    if (diff < 3600)  return `${Math.floor(diff / 60)}min`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
}

/**
 * Abre um modal pelo ID semântico (sem o prefixo "modal-").
 * Adiciona "flex", remove "hidden", trava scroll do body.
 * @param {string} id — ex: "excluir-42", "perfil-externo"
 */
export function abrirModal(id) {
    const el = document.getElementById(`modal-${id}`);
    if (!el) return;
    el.classList.remove('hidden');
    el.classList.add('flex');
    document.body.style.overflow = 'hidden';
}

/**
 * Fecha um modal pelo ID semântico.
 * Remove "flex", adiciona "hidden", restaura scroll do body.
 * @param {string} id
 */
export function fecharModal(id) {
    const el = document.getElementById(`modal-${id}`);
    if (!el) return;
    el.classList.add('hidden');
    el.classList.remove('flex');
    document.body.style.overflow = '';
}

/**
 * Handler de clique para fechar modal ao clicar no backdrop.
 * Uso: onclick="fecharModalFora(event, 'meu-id')"
 * @param {MouseEvent} event
 * @param {string} id
 */
export function fecharModalFora(event, id) {
    if (event.target === event.currentTarget) fecharModal(id);
}

/**
 * Expõe as três funções de modal no escopo global para que templates Django
 * possam continuar usando onclick="abrirModal(...)" sem alteração.
 * Chamado uma única vez em main.js.
 */
export function registrarModaisGlobal() {
    window.abrirModal     = abrirModal;
    window.fecharModal    = fecharModal;
    window.fecharModalFora = fecharModalFora;
}