/**
 * categoria.js
 * Classe CategorySelector — autocomplete, seleção, remoção e criação de categorias.
 *
 * Substitui as 4 implementações duplicadas em:
 *   - criar.html
 *   - editar.html
 *   - composer_bar.html (feed)
 *   - grid_campo.html (campo)
 *
 * Uso:
 *   import { CategorySelector } from './categoria.js';
 *
 *   const selector = new CategorySelector({
 *       inputBuscaId:      'feed-busca-cat',
 *       dropdownId:        'feed-dropdown-cat',
 *       selecionadasId:    'feed-cats-selecionadas',
 *       modalValidatorId:  'modal-cat-feed',
 *       inputNovaId:       'feed-nova-cat-input',
 *       feedbackId:        'feed-cat-feedback',
 *       btnSalvarId:       'feed-btn-salvar-cat',
 *       checksPrefix:      'feed-check',   // gera: feed-check-letras, feed-check-palavra, etc.
 *       accentColor:       'purple',       // classe Tailwind ring-{color}-400
 *   });
 */

import { getCsrf } from './utils.js';

const REGEX_LETRAS = /^[A-Za-zÀ-ÿ]+$/;

export class CategorySelector {
    /**
     * @param {{
     *   inputBuscaId:     string,
     *   dropdownId:       string,
     *   selecionadasId:   string,
     *   modalValidatorId: string,
     *   inputNovaId:      string,
     *   feedbackId:       string,
     *   btnSalvarId:      string,
     *   checksPrefix:     string,
     *   accentColor?:     string,
     *   onSelect?:        function,
     * }} opcoes
     */
    constructor(opcoes) {
        this._opts      = opcoes;
        this._selecionadas = new Set();

        this._inputBusca    = document.getElementById(opcoes.inputBuscaId);
        this._dropdown      = document.getElementById(opcoes.dropdownId);
        this._containerTags = document.getElementById(opcoes.selecionadasId);

        if (!this._inputBusca || !this._dropdown || !this._containerTags) {
            console.warn('[CategorySelector] Elementos não encontrados para:', opcoes);
            return;
        }

        this._bindAutocomplete();
        this._bindValidator();
    }

    // ── API pública ───────────────────────────────────────────────────────────

    /** Retorna Set com os IDs selecionados (somente leitura). */
    get ids() {
        return new Set(this._selecionadas);
    }

    /** Retorna true se ao menos uma categoria foi selecionada. */
    get temSelecionadas() {
        return this._selecionadas.size > 0;
    }

    /** Pré-carrega categorias existentes (uso em editar.html). */
    preCarregar(lista) {
        lista.forEach(({ id, nome, cor }) => this._adicionar(id, nome, cor));
    }

    /** Seleciona uma categoria por ID (chamável externamente). */
    selecionar(id, nome, cor) {
        this._adicionar(id, nome, cor);
    }

    /** Abre o modal validator de nova categoria. */
    abrirValidator() {
        const modal = document.getElementById(this._opts.modalValidatorId);
        if (!modal) return;
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        document.getElementById(this._opts.inputNovaId)?.focus();
    }

    /** Fecha o modal validator. */
    fecharValidator() {
        const modal = document.getElementById(this._opts.modalValidatorId);
        if (!modal) return;
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        const input = document.getElementById(this._opts.inputNovaId);
        if (input) input.value = '';
        this._resetarChecks();
    }

    // ── Autocomplete ──────────────────────────────────────────────────────────

    _bindAutocomplete() {
        this._inputBusca.addEventListener('input', async () => {
            const termo = this._inputBusca.value.trim();
            if (termo.length < 2) { this._dropdown.classList.add('hidden'); return; }

            try {
                const res  = await fetch(`/api/categorias/buscar/?q=${encodeURIComponent(termo)}`);
                const data = await res.json();

                if (!data.categorias.length) { this._dropdown.classList.add('hidden'); return; }

                this._dropdown.innerHTML = data.categorias.map(c => `
                    <button type="button"
                            data-cat-id="${c.id}"
                            data-cat-nome="${c.nome}"
                            data-cat-cor="${c.cor}"
                            class="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition flex items-center gap-2">
                        <span class="w-3 h-3 rounded-full flex-shrink-0" style="background:${c.cor}"></span>
                        ${c.nome}
                    </button>
                `).join('');

                this._dropdown.querySelectorAll('button').forEach(btn => {
                    btn.addEventListener('click', () => {
                        this._adicionar(
                            parseInt(btn.dataset.catId),
                            btn.dataset.catNome,
                            btn.dataset.catCor,
                        );
                    });
                });

                this._dropdown.classList.remove('hidden');
            } catch (e) {
                console.error('[CategorySelector] Erro no autocomplete:', e);
            }
        });

        document.addEventListener('click', (e) => {
            if (!this._inputBusca.contains(e.target) && !this._dropdown.contains(e.target)) {
                this._dropdown.classList.add('hidden');
            }
        });
    }

    // ── Adicionar / remover tag ───────────────────────────────────────────────

    _adicionar(id, nome, cor) {
        if (this._selecionadas.has(id)) return;
        this._selecionadas.add(id);

        const tag = document.createElement('span');
        tag.className = 'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold';
        tag.style.backgroundColor = `${cor}25`;
        tag.style.color = cor;
        tag.dataset.catId = id;
        tag.innerHTML = `${nome} <button type="button" class="ml-1 hover:text-red-500">✕</button>`;
        tag.querySelector('button').addEventListener('click', () => this._remover(id, tag));
        this._containerTags.appendChild(tag);

        // Hidden input para formulários Django tradicionais (criar.html / editar.html)
        const hidden = document.createElement('input');
        hidden.type  = 'hidden';
        hidden.name  = 'categorias_selecionadas';
        hidden.value = id;
        hidden.id    = `hidden-cat-${id}`;
        this._containerTags.appendChild(hidden);

        this._inputBusca.value = '';
        this._dropdown.classList.add('hidden');

        this._opts.onSelect?.({ id, nome, cor });
    }

    _remover(id, tagEl) {
        this._selecionadas.delete(id);
        tagEl.remove();
        document.getElementById(`hidden-cat-${id}`)?.remove();
    }

    // ── Validator de nova categoria ───────────────────────────────────────────

    _bindValidator() {
        const input    = document.getElementById(this._opts.inputNovaId);
        const btnSalvar = document.getElementById(this._opts.btnSalvarId);
        if (!input || !btnSalvar) return;

        input.addEventListener('input', () => {
            btnSalvar.disabled = !this._validarChecks(input.value.trim());
        });

        btnSalvar.addEventListener('click', () => this._salvarNovaCategoria());
    }

    _validarChecks(valor) {
        const p = this._opts.checksPrefix;
        const checks = {
            [`${p}-letras`]:  REGEX_LETRAS.test(valor),
            [`${p}-palavra`]: !valor.includes(' '),
            [`${p}-minimo`]:  valor.length >= 3,
            [`${p}-maximo`]:  valor.length <= 30,
        };

        let tudo = true;
        for (const [id, valido] of Object.entries(checks)) {
            const li   = document.getElementById(id);
            if (!li) continue;
            const lamp = li.querySelector('span');
            if (valido) {
                li.classList.replace('text-gray-400', 'text-green-600');
                if (lamp) lamp.style.filter = 'drop-shadow(0 0 6px #fbbf24)';
            } else {
                li.classList.replace('text-green-600', 'text-gray-400');
                if (lamp) lamp.style.filter = 'none';
                tudo = false;
            }
        }
        return tudo;
    }

    _resetarChecks() {
        const p = this._opts.checksPrefix;
        [`${p}-letras`, `${p}-palavra`, `${p}-minimo`, `${p}-maximo`].forEach(id => {
            const li = document.getElementById(id);
            if (!li) return;
            li.className = 'flex items-center gap-2 text-gray-400';
            const lamp = li.querySelector('span');
            if (lamp) lamp.style.filter = 'none';
        });
        const btn = document.getElementById(this._opts.btnSalvarId);
        if (btn) btn.disabled = true;
    }

    async _salvarNovaCategoria() {
        const input    = document.getElementById(this._opts.inputNovaId);
        const feedback = document.getElementById(this._opts.feedbackId);
        const btn      = document.getElementById(this._opts.btnSalvarId);
        if (!input || !btn) return;

        const nome = input.value.trim();
        btn.disabled    = true;
        btn.textContent = 'Salvando...';

        try {
            const res  = await fetch('/api/categorias/criar/', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrf() },
                body:    JSON.stringify({ nome }),
            });
            const data = await res.json();

            if (!res.ok) {
                if (feedback) {
                    feedback.textContent = data.erro;
                    feedback.className   = 'text-sm mb-4 text-red-500';
                    feedback.classList.remove('hidden');
                }
                btn.disabled    = false;
                btn.textContent = 'Criar';
                return;
            }

            this.fecharValidator();
            this._adicionar(data.id, data.nome, data.cor);

        } catch {
            if (feedback) {
                feedback.textContent = 'Erro de conexão.';
                feedback.className   = 'text-sm mb-4 text-red-500';
                feedback.classList.remove('hidden');
            }
            btn.disabled    = false;
            btn.textContent = 'Criar';
        }
    }
}