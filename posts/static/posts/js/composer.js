/**
 * composer.js
 * Classe PostComposer — abre, fecha, valida e publica posts via composer modal.
 *
 * Substitui as funções inline em:
 *   - composer_bar.html  (abrirComposerFeed, fecharComposerFeed, publicarNoFeed)
 *   - grid_campo.html    (abrirComposerCampo, fecharComposerCampo, publicarNoCampo)
 *
 * Uso:
 *   import { PostComposer } from './composer.js';
 *
 *   const composerFeed = new PostComposer({
 *       modalId:        'modal-composer-feed',
 *       tituloId:       'feed-composer-titulo',
 *       conteudoId:     'feed-composer-conteudo',
 *       tituloCapaId:   'feed-composer-titulo-capa',
 *       erroId:         'feed-composer-erro',
 *       btnPublicarId:  'btn-publicar-feed',
 *       visibilidade:   'feed',
 *       cor:            '#8B5CF6',
 *       labelPublicar:  '👥 Publicar no Feed',
 *       capaObrigatoria: true,
 *       getCatSelector:  () => window._feedCatSelector,
 *       getImgs:         () => window._feedImgs,
 *       redirectParam:   'ideia_feed',
 *   });
 */

import { getCsrf } from './utils.js';

export class PostComposer {
    /**
     * @param {{
     *   modalId:         string,
     *   tituloId:        string,
     *   conteudoId:      string,
     *   tituloCapaId:    string,
     *   erroId:          string,
     *   btnPublicarId:   string,
     *   visibilidade:    'feed' | 'campo',
     *   cor:             string,
     *   labelPublicar:   string,
     *   capaObrigatoria: boolean,
     *   getCatSelector:  () => CategorySelector,
     *   getImgs:         () => { img1: ImageUploadWidget, img2: ImageUploadWidget },
     *   redirectParam:   string,
     *   catsContainerId: string,
     *   buscaCatId:      string,
     * }} opcoes
     */
    constructor(opcoes) {
        this._opts = opcoes;
    }

    // ── API pública ───────────────────────────────────────────────────────────

    abrir() {
        const modal = document.getElementById(this._opts.modalId);
        if (!modal) return;
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        document.getElementById(this._opts.tituloId)?.focus();
    }

    fechar() {
        const modal = document.getElementById(this._opts.modalId);
        if (!modal) return;
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        this._limpar();
    }

    async publicar() {
        const titulo     = document.getElementById(this._opts.tituloId)?.value.trim()     ?? '';
        const conteudo   = document.getElementById(this._opts.conteudoId)?.value.trim()   ?? '';
        const tituloCapa = document.getElementById(this._opts.tituloCapaId)?.value.trim() ?? '';
        const erroEl     = document.getElementById(this._opts.erroId);
        const btn        = document.getElementById(this._opts.btnPublicarId);

        erroEl?.classList.add('hidden');

        if (!this._validar(titulo, conteudo, erroEl)) return;

        if (btn) { btn.disabled = true; btn.textContent = 'Publicando...'; }

        try {
            const formData = this._montarFormData(titulo, conteudo, tituloCapa);
            const res = await fetch('/novo/', {
                method:  'POST',
                headers: { 'X-CSRFToken': getCsrf() },
                body:    formData,
            });

            if (res.redirected) { window.location.href = res.url; return; }
            if (res.ok)         {
                window.location.href = `/?aba=${this._opts.visibilidade}&msg=${this._opts.redirectParam}`;
                return;
            }

            this._mostrarErro(erroEl, 'Erro ao publicar. Tente novamente.');
        } catch {
            this._mostrarErro(erroEl, 'Erro de conexão.');
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = this._opts.labelPublicar; }
        }
    }

    // ── Validação ─────────────────────────────────────────────────────────────

    _validar(titulo, conteudo, erroEl) {
        if (!titulo || !conteudo) {
            this._mostrarErro(erroEl, 'Título e conteúdo são obrigatórios.');
            return false;
        }
        if (this._opts.capaObrigatoria && !this._opts.getImgs?.().img1.temArquivo) {
            this._mostrarErro(erroEl, 'A imagem de capa é obrigatória para o Feed de Ideias.');
            return false;
        }
        if (!this._opts.getCatSelector?.().temSelecionadas) {
            this._mostrarErro(erroEl, 'Ao menos uma categoria é obrigatória.');
            return false;
        }
        return true;
    }

    _mostrarErro(erroEl, mensagem) {
        if (!erroEl) return;
        erroEl.textContent = mensagem;
        erroEl.classList.remove('hidden');
    }

    // ── Montagem do FormData ──────────────────────────────────────────────────

    _montarFormData(titulo, conteudo, tituloCapa) {
        const formData = new FormData();
        formData.append('titulo',       titulo);
        formData.append('conteudo',     conteudo);
        formData.append('titulo_capa',  tituloCapa);
        formData.append('visibilidade', this._opts.visibilidade);
        formData.append('publicado',    'true');
        formData.append('cor',          this._opts.cor);

        const imgs = this._opts.getImgs?.();
        if (imgs?.img1.temArquivo) formData.append('imagem_capa_1', imgs.img1.arquivo);
        if (imgs?.img2.temArquivo) formData.append('imagem_capa_2', imgs.img2.arquivo);

        this._opts.getCatSelector?.().ids.forEach(id =>
            formData.append('categorias_selecionadas', id)
        );

        return formData;
    }

    // ── Limpeza ───────────────────────────────────────────────────────────────

    _limpar() {
        [this._opts.tituloId, this._opts.conteudoId, this._opts.tituloCapaId].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });

        const imgs = this._opts.getImgs?.();
        imgs?.img1.limpar();
        imgs?.img2.limpar();

        const catSelector = this._opts.getCatSelector?.();
        if (catSelector) {
            catSelector._selecionadas?.clear();
            const container = document.getElementById(this._opts.catsContainerId ?? '');
            if (container) container.innerHTML = '';
            const buscaEl = document.getElementById(this._opts.buscaCatId ?? '');
            if (buscaEl) buscaEl.value = '';
        }

        document.getElementById(this._opts.erroId)?.classList.add('hidden');
    }
}