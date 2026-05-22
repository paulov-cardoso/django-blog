/**
 * image-upload.js
 * Classe ImageUploadWidget — preview e remoção de imagens de capa.
 *
 * Substitui as 3 implementações duplicadas em:
 *   - criar.html      (previewImagem / removerImagem)
 *   - editar.html     (previewImagem / removerImagem)
 *   - composer_bar.html  (feedPreviewImagem / feedRemoverImagem)
 *   - grid_campo.html    (campoPreviewImagem / campoRemoverImagem)
 *
 * Uso:
 *   import { ImageUploadWidget } from './image-upload.js';
 *
 *   // Instancia um widget por slot de imagem (1 e 2)
 *   new ImageUploadWidget({ n: 1, prefix: 'feed' });
 *   new ImageUploadWidget({ n: 2, prefix: 'feed' });
 *
 * IDs esperados no HTML (substituindo {prefix} e {n}):
 *   input:       {prefix}-input-capa-{n}
 *   img:         {prefix}-img-preview-{n}
 *   placeholder: {prefix}-placeholder-{n}
 *   btnRemover:  {prefix}-btn-remover-{n}
 */

export class ImageUploadWidget {
    /**
     * @param {{ n: number, prefix: string }} opcoes
     *   n      — número do slot (1 ou 2)
     *   prefix — prefixo dos IDs no HTML ('feed', 'campo', '' para criar/editar)
     */
    constructor({ n, prefix = '' }) {
        const p = prefix ? `${prefix}-` : '';

        this._input       = document.getElementById(`${p}input-capa-${n}`);
        this._img         = document.getElementById(`${p}img-preview-${n}`);
        this._placeholder = document.getElementById(`${p}placeholder-${n}`);
        this._btnRemover  = document.getElementById(`${p}btn-remover-${n}`);

        if (!this._input) return;

        this._input.addEventListener('change', () => this._onFileChange());
        this._btnRemover?.addEventListener('click', (e) => this._onRemover(e));
    }

    // ── API pública ───────────────────────────────────────────────────────────

    /** Limpa o slot programaticamente (usado ao fechar o composer). */
    limpar() {
        this._input.value = '';
        if (this._img) {
            this._img.src = '';
            this._img.classList.add('hidden');
        }
        this._placeholder?.classList.remove('hidden');
        this._btnRemover?.classList.add('hidden');
    }

    /** Retorna true se há um arquivo selecionado. */
    get temArquivo() {
        return Boolean(this._input?.files?.length);
    }

    /** Retorna o File selecionado ou null. */
    get arquivo() {
        return this._input?.files?.[0] ?? null;
    }

    // ── Handlers privados ─────────────────────────────────────────────────────

    _onFileChange() {
        const file = this._input.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            if (this._img) {
                this._img.src = e.target.result;
                this._img.classList.remove('hidden');
            }
            this._placeholder?.classList.add('hidden');
            this._btnRemover?.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }

    _onRemover(event) {
        event.stopPropagation();
        this.limpar();
    }
}