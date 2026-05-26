'use strict';

/* ── Textura metálica fosca no card ─────────────────────────────
   Gera ruído canvas (grain + estrias + diagonal) com mix-blend-mode
   soft-light sobre o gradiente do card, simulando metal escovado. */
function iniciarTexturaCard() {
    const canvas = document.getElementById('card-texture');
    if (!canvas) return;

    const box = canvas.parentElement.getBoundingClientRect();
    const w   = Math.ceil(box.width)  || 400;
    const h   = Math.ceil(box.height) || 500;

    canvas.width  = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(w, h);
    const px  = img.data;

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const idx    = (y * w + x) * 4;
            const grain  = Math.random();
            const stripe = (Math.sin(y * 0.4 + Math.random() * 0.6) + 1) / 2;
            const diag   = (Math.sin((x + y) * 0.08) + 1) / 2;
            const val    = Math.floor((grain * 0.55 + stripe * 0.30 + diag * 0.15) * 255);

            px[idx] = px[idx + 1] = px[idx + 2] = val;
            px[idx + 3] = 255;
        }
    }

    ctx.putImageData(img, 0, 0);
    ctx.filter = 'blur(0.4px)';
    ctx.drawImage(canvas, 0, 0);
}

/* ── Slogan typewriter ──────────────────────────────────────────
   Digita e apaga o slogan em loop contínuo. */
function iniciarSlogan() {
    const sloganEl = document.getElementById('slogan');
    const cursorEl = document.getElementById('cursor');
    if (!sloganEl || !cursorEl) return;

    const SLOGAN = 'Onde suas ideias jamais caem no esquecimento';
    let pos = 0, typing = true;

    function typeWriter() {
        if (typing) {
            if (pos < SLOGAN.length) {
                sloganEl.textContent += SLOGAN.charAt(pos++);
                setTimeout(typeWriter, 60);
            } else {
                setTimeout(() => { typing = false; typeWriter(); }, 2000);
            }
        } else {
            if (pos > 0) {
                sloganEl.textContent = SLOGAN.substring(0, --pos);
                setTimeout(typeWriter, 30);
            } else {
                setTimeout(() => { typing = true; typeWriter(); }, 500);
            }
        }
    }

    setInterval(() => {
        cursorEl.style.opacity = cursorEl.style.opacity === '0' ? '1' : '0';
    }, 500);

    typeWriter();
}

/* ── Post-its caindo ────────────────────────────────────────────
   Estado persistido via sessionStorage para continuidade visual
   entre navegações do fluxo auth. */
function iniciarPostits() {
    const canvas = document.getElementById('postit-canvas');
    if (!canvas) return;

    const ctx        = canvas.getContext('2d');
    const COLORS     = ['#FFFF99', '#FFFF99', '#FF65A3', '#FF9933', '#D2DE40', '#A6CCF5', '#FFB3C5'];
    const TOTAL      = 32;
    const STATE_KEY  = 'synapsoo_postits';

    function redimensionar() {
        canvas.width  = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    redimensionar();
    window.addEventListener('resize', redimensionar);

    function criarPostit() {
        return {
            x:       Math.random() * window.innerWidth,
            y:       Math.random() * -window.innerHeight,
            size:    Math.random() * 14 + 10,
            color:   COLORS[Math.floor(Math.random() * COLORS.length)],
            speed:   Math.random() * 0.6 + 0.3,
            drift:   (Math.random() - 0.5) * 0.4,
            angle:   Math.random() * Math.PI * 2,
            spin:    (Math.random() - 0.5) * 0.012,
            opacity: Math.random() * 0.35 + 0.25,
        };
    }

    function carregarEstado() {
        try {
            const raw   = sessionStorage.getItem(STATE_KEY);
            const salvo = raw ? JSON.parse(raw) : null;
            if (Array.isArray(salvo) && salvo.length === TOTAL && salvo[0].x !== undefined) {
                return salvo;
            }
        } catch (_) { /* sessionStorage indisponível */ }
        return Array.from({ length: TOTAL }, criarPostit);
    }

    function salvarEstado() {
        try { sessionStorage.setItem(STATE_KEY, JSON.stringify(postits)); }
        catch (_) { /* quota excedida */ }
    }

    const postits = carregarEstado();

    document.addEventListener('click',  e => { if (e.target.closest('a, button[type="submit"]')) salvarEstado(); });
    document.addEventListener('submit', salvarEstado);
    window.addEventListener('beforeunload', salvarEstado);

    function desenharPostit(p) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.globalAlpha   = p.opacity;
        ctx.shadowColor   = 'rgba(0,0,0,0.12)';
        ctx.shadowBlur    = 3;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 2;

        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);

        const fold = p.size * 0.28;
        ctx.fillStyle = 'rgba(0,0,0,0.08)';
        ctx.beginPath();
        ctx.moveTo( p.size / 2 - fold, -p.size / 2);
        ctx.lineTo( p.size / 2,        -p.size / 2 + fold);
        ctx.lineTo( p.size / 2 - fold, -p.size / 2 + fold);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    function animar() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (const p of postits) {
            p.y += p.speed; p.x += p.drift; p.angle += p.spin;
            if (p.y > canvas.height + p.size) {
                p.y = -p.size * 2;
                p.x = Math.random() * canvas.width;
            }
            desenharPostit(p);
        }
        requestAnimationFrame(animar);
    }

    animar();
}

/* ── Toggle mostrar/ocultar senha ───────────────────────────────
   Recebe IDs do botão, input e ícone SVG. Reutilizado em login,
   registrar e senha_reset_confirmar. */
const SVG_OLHO_ABERTO  = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
const SVG_OLHO_FECHADO = `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                           <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                           <line x1="1" y1="1" x2="23" y2="23"/>`;

function configurarToggleSenha(btnId, inputId, iconId) {
    const btn   = document.getElementById(btnId);
    const input = document.getElementById(inputId);
    const icon  = document.getElementById(iconId);
    if (!btn || !input || !icon) return;

    btn.addEventListener('click', () => {
        const oculto   = input.type === 'password';
        input.type     = oculto ? 'text' : 'password';
        icon.innerHTML = oculto ? SVG_OLHO_FECHADO : SVG_OLHO_ABERTO;
        btn.setAttribute('aria-pressed', String(oculto));
    });
}

/* ── Validator de força de senha ────────────────────────────────
   Usado apenas no cadastro e reset confirmar. */
function iniciarValidatorSenha() {
    const campo     = document.getElementById('campo-senha');
    const validator = document.getElementById('password-validator');
    if (!campo || !validator) return;

    const REGRAS = [
        { id: 'check-maiuscula', ok: v => /[a-z]/.test(v) && /[A-Z]/.test(v) },
        { id: 'check-numero',    ok: v => /[0-9]/.test(v) },
        { id: 'check-especial',  ok: v => /[^a-zA-Z0-9]/.test(v) },
        { id: 'check-tamanho',   ok: v => v.length >= 8 },
    ];

    const NIVEIS = [
        { cor: '#ef4444', texto: 'Fraca' },
        { cor: '#f97316', texto: 'Razoável' },
        { cor: '#eab308', texto: 'Boa' },
        { cor: '#22c55e', texto: 'Forte' },
    ];

    campo.addEventListener('focus', () => validator.classList.remove('hidden'));
    campo.addEventListener('blur',  () => setTimeout(() => validator.classList.add('hidden'), 150));
    campo.addEventListener('input', e => {
        const v = e.target.value;
        let aprovados = 0;

        REGRAS.forEach(r => {
            const el     = document.getElementById(r.id);
            const passou = r.ok(v);
            aprovados   += passou ? 1 : 0;
            el.textContent  = passou ? '💡' : '❌';
            el.style.filter = passou ? 'drop-shadow(0 0 6px #fcd34d)' : 'none';
        });

        const nivel = aprovados === 0 ? 0 : aprovados - 1;
        document.getElementById('barra-forca').style.width      = `${aprovados * 25}%`;
        document.getElementById('barra-forca').style.background = NIVEIS[nivel].cor;
        document.getElementById('texto-forca').textContent      = v.length > 0 ? NIVEIS[nivel].texto : '';
    });
}

/* ── Inicialização ──────────────────────────────────────────────
   Cada função verifica se seu elemento existe antes de rodar.
   Seguro chamar em todas as telas sem condicionais no HTML. */
document.addEventListener('DOMContentLoaded', () => {
    iniciarTexturaCard();
    iniciarSlogan();
    iniciarPostits();
    iniciarValidatorSenha();
});