/**
 * main.js
 * Entry point da aplicação frontend.
 */

import { registrarModaisGlobal } from './utils.js';
import Config from './config.js';
import { CategorySelector } from './categoria.js';
import { ImageUploadWidget } from './image-upload.js';
import { ThreadManager } from './comentarios.js';
import { registrarModalUniversalGlobal } from './modal-universal.js';
import { PostComposer } from './composer.js';
import { registrarFeedGlobal } from './feed.js';
import { registrarCampoGlobal, iniciarCampo } from './campo.js';
import { registrarNotesGlobal } from './notes.js';

// ── Registrar globais ─────────────────────────────────────────────────────────
registrarModaisGlobal();
registrarModalUniversalGlobal();
registrarFeedGlobal();
registrarCampoGlobal();
registrarNotesGlobal();

if (Config.isAuth) {
    console.debug('[Blognotes] Sessão autenticada:', Config.meUsername);
}

// ── Instanciações por página ──────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {

    // ── criar.html ────────────────────────────────────────────────────────────
    if (document.getElementById('input-busca-categoria')) {
        const catCriar = new CategorySelector({
            inputBuscaId:     'input-busca-categoria',
            dropdownId:       'dropdown-categorias',
            selecionadasId:   'categorias-selecionadas',
            modalValidatorId: 'modal-categoria',
            inputNovaId:      'input-nova-categoria',
            feedbackId:       'feedback-categoria',
            btnSalvarId:      'btn-salvar-categoria',
            checksPrefix:     'check',
        });
        window._catCriar = catCriar;
        window.abrirValidatorCategoria  = () => catCriar.abrirValidator();
        window.fecharValidatorCategoria = () => catCriar.fecharValidator();

        const el     = document.getElementById('categorias-iniciais-data');
        const catStr = el?.dataset.ids ?? '';
        if (catStr) {
            fetch(`/api/categorias/por-ids/?ids=${catStr}`)
                .then(r => r.json())
                .then(data => data.categorias.forEach(c => catCriar.selecionar(c.id, c.nome, c.cor)));
        }

        new ImageUploadWidget({ n: 1, prefix: '' });
        new ImageUploadWidget({ n: 2, prefix: '' });
    }

    // ── editar.html ───────────────────────────────────────────────────────────
    if (document.getElementById('categorias-editar-data')) {
        const catEditar = new CategorySelector({
            inputBuscaId:     'input-busca-categoria',
            dropdownId:       'dropdown-categorias',
            selecionadasId:   'categorias-selecionadas',
            modalValidatorId: 'modal-categoria',
            inputNovaId:      'input-nova-categoria',
            feedbackId:       'feedback-categoria',
            btnSalvarId:      'btn-salvar-categoria',
            checksPrefix:     'check',
        });
        window._catEditar = catEditar;
        window.abrirValidatorCategoria  = () => catEditar.abrirValidator();
        window.fecharValidatorCategoria = () => catEditar.fecharValidator();

        const el        = document.getElementById('categorias-editar-data');
        const existentes = JSON.parse(el.dataset.categorias || '[]');
        catEditar.preCarregar(existentes);

        new ImageUploadWidget({ n: 1, prefix: '' });
        new ImageUploadWidget({ n: 2, prefix: '' });
    }

    // ── composer_bar.html (feed) ──────────────────────────────────────────────
    if (document.getElementById('feed-busca-cat')) {
        const catFeed = new CategorySelector({
            inputBuscaId:     'feed-busca-cat',
            dropdownId:       'feed-dropdown-cat',
            selecionadasId:   'feed-cats-selecionadas',
            modalValidatorId: 'modal-cat-feed',
            inputNovaId:      'feed-nova-cat-input',
            feedbackId:       'feed-cat-feedback',
            btnSalvarId:      'feed-btn-salvar-cat',
            checksPrefix:     'feed-check',
        });
        window._catFeed         = catFeed;
        window.abrirValidatorCatFeed  = () => catFeed.abrirValidator();
        window.fecharValidatorCatFeed = () => catFeed.fecharValidator();

        const img1Feed = new ImageUploadWidget({ n: 1, prefix: 'feed' });
        const img2Feed = new ImageUploadWidget({ n: 2, prefix: 'feed' });
        window._feedImgs        = { img1: img1Feed, img2: img2Feed };
        window._feedCatSelector = catFeed;

        const composerFeed = new PostComposer({
            modalId:         'modal-composer-feed',
            tituloId:        'feed-composer-titulo',
            conteudoId:      'feed-composer-conteudo',
            tituloCapaId:    'feed-composer-titulo-capa',
            erroId:          'feed-composer-erro',
            btnPublicarId:   'btn-publicar-feed',
            visibilidade:    'feed',
            cor:             '#8B5CF6',
            labelPublicar:   '👥 Publicar no Feed',
            capaObrigatoria: true,
            getCatSelector:  () => window._feedCatSelector,
            getImgs:         () => window._feedImgs,
            redirectParam:   'ideia_feed',
            catsContainerId: 'feed-cats-selecionadas',
            buscaCatId:      'feed-busca-cat',
        });
        window.abrirComposerFeed  = () => composerFeed.abrir();
        window.fecharComposerFeed = () => composerFeed.fechar();
        window.publicarNoFeed     = () => composerFeed.publicar();
    }

    // ── grid_campo.html (campo) ───────────────────────────────────────────────
    if (document.getElementById('composer-busca-cat')) {
        const catCampo = new CategorySelector({
            inputBuscaId:     'composer-busca-cat',
            dropdownId:       'composer-dropdown-cat',
            selecionadasId:   'composer-cats-selecionadas',
            modalValidatorId: 'modal-cat-campo',
            inputNovaId:      'campo-nova-cat-input',
            feedbackId:       'campo-cat-feedback',
            btnSalvarId:      'campo-btn-salvar-cat',
            checksPrefix:     'campo-check',
        });
        window._catCampo         = catCampo;
        window.abrirValidatorCatCampo  = () => catCampo.abrirValidator();
        window.fecharValidatorCatCampo = () => catCampo.fecharValidator();

        const img1Campo = new ImageUploadWidget({ n: 1, prefix: 'campo' });
        const img2Campo = new ImageUploadWidget({ n: 2, prefix: 'campo' });
        window._campoImgs        = { img1: img1Campo, img2: img2Campo };
        window._campoCatSelector = catCampo;

        const composerCampo = new PostComposer({
            modalId:         'modal-composer-campo',
            tituloId:        'composer-campo-titulo',
            conteudoId:      'composer-campo-conteudo',
            tituloCapaId:    'composer-campo-titulo-capa',
            erroId:          'composer-campo-erro',
            btnPublicarId:   'btn-publicar-campo',
            visibilidade:    'campo',
            cor:             '#F97316',
            labelPublicar:   '🌍 Publicar no Campo',
            capaObrigatoria: false,
            getCatSelector:  () => window._campoCatSelector,
            getImgs:         () => window._campoImgs,
            redirectParam:   'ideia_campo',
            catsContainerId: 'composer-cats-selecionadas',
            buscaCatId:      'composer-busca-cat',
        });
        window.abrirComposerCampo  = () => composerCampo.abrir();
        window.fecharComposerCampo = () => composerCampo.fechar();
        window.publicarNoCampo     = () => composerCampo.publicar();

        iniciarCampo();
    }

    // ── ThreadManager: modal universal ────────────────────────────────────────
    window._threadsModal = {};

    window._criarThreadModal = function (postId) {
        if (window._threadsModal[postId]) return window._threadsModal[postId];

        const thread = new ThreadManager({
            postId,
            containerID: 'mu-comentarios',
            totalElID:   'mu-total-comentarios',
            composerID:  'mu-composer',
            prefix:      'mu',
            cardTotalID: `total-comentarios-${postId}`,
            onForumizar: () => window._muAbrirForum?.(),
            onSubthread: (pid, cid) => window._muAbrirSubthread?.(pid, cid),
        });

        window._threadsModal[postId] = thread;
        return thread;
    };

    // ── ThreadManager: modal de detalhe do campo ──────────────────────────────
    window._threadsCampo = {};

    window._criarThreadCampo = function (postId) {
        if (window._threadsCampo[postId]) return window._threadsCampo[postId];

        const thread = new ThreadManager({
            postId,
            containerID: 'detalhe-comentarios',
            totalElID:   'detalhe-total-comentarios',
            composerID:  'detalhe-composer',
            prefix:      'dc',
            onForumizar: () => {
                const m = document.getElementById('modal-forum-campo');
                if (m) { m.classList.remove('hidden'); m.classList.add('flex'); }
            },
            onSubthread: (pid, cid) => window._abrirSubthreadCampo?.(pid, cid),
        });

        window._threadsCampo[postId] = thread;
        return thread;
    };

});