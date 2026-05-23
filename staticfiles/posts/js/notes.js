/**
 * notes.js
 * NotesComposer — composer inline dos Notes Privados.
 *
 * Segue o mesmo padrão de PostComposer (composer.js) mas
 * com campos específicos de notes: título, conteúdo e cor.
 * Visibilidade fixa em 'privado', sem capa e sem categorias.
 *
 * Exporta registrarNotesGlobal() para expor as funções no window.
 */

import { getCsrf } from './utils.js';

// ── Estado ────────────────────────────────────────────────────────────────────

const _COR_PADRAO = '#3B82F6';

// ── Abrir / fechar ────────────────────────────────────────────────────────────

function abrir() {
    const modal = document.getElementById('modal-composer-notes');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.getElementById('notes-composer-titulo')?.focus();
}

function fechar() {
    const modal = document.getElementById('modal-composer-notes');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    _limpar();
}

// ── Publicar ──────────────────────────────────────────────────────────────────

async function publicar() {
    const titulo   = document.getElementById('notes-composer-titulo')?.value.trim()   ?? '';
    const conteudo = document.getElementById('notes-composer-conteudo')?.value.trim() ?? '';
    const cor      = document.getElementById('notes-composer-cor')?.value             ?? _COR_PADRAO;
    const erroEl   = document.getElementById('notes-composer-erro');
    const btn      = document.getElementById('btn-publicar-note');

    erroEl?.classList.add('hidden');

    if (!titulo) {
        _mostrarErro(erroEl, 'O título é obrigatório.');
        return;
    }
    if (!conteudo) {
        _mostrarErro(erroEl, 'O conteúdo não pode estar vazio.');
        return;
    }

    if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }

    try {
        const formData = new FormData();
        formData.append('titulo',       titulo);
        formData.append('conteudo',     conteudo);
        formData.append('cor',          cor);
        formData.append('visibilidade', 'privado');
        formData.append('publicado',    'true');

        const res = await fetch('/novo/', {
            method:  'POST',
            headers: { 'X-CSRFToken': getCsrf() },
            body:    formData,
        });

        if (res.redirected) { window.location.href = res.url; return; }
        if (res.ok)         { window.location.href = '/?aba=notes_privados&msg=note_criado'; return; }

        _mostrarErro(erroEl, 'Erro ao salvar. Tente novamente.');
    } catch {
        _mostrarErro(erroEl, 'Erro de conexão.');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '📓 Salvar Note'; }
    }
}

// ── Utilitários privados ──────────────────────────────────────────────────────

function _mostrarErro(erroEl, mensagem) {
    if (!erroEl) return;
    erroEl.textContent = mensagem;
    erroEl.classList.remove('hidden');
}

function _limpar() {
    const titulo   = document.getElementById('notes-composer-titulo');
    const conteudo = document.getElementById('notes-composer-conteudo');
    const cor      = document.getElementById('notes-composer-cor');
    const erroEl   = document.getElementById('notes-composer-erro');

    if (titulo)   titulo.value   = '';
    if (conteudo) conteudo.value = '';
    if (cor)      cor.value      = _COR_PADRAO;
    erroEl?.classList.add('hidden');
}

// ── Export e globais ──────────────────────────────────────────────────────────

export function registrarNotesGlobal() {
    window.abrirComposerNotes  = abrir;
    window.fecharComposerNotes = fechar;
    window.publicarNote        = publicar;
}