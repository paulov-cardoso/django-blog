// ── Design System — Synapsoo ──────────────────────────────────────────────────
// Fonte única de verdade para todas as decisões visuais do projeto.

export const colors = {
  // Fundos
  bg: {
    deep: "#1a1040", // fundo principal — roxo profundo
    mid: "#2d1558", // fundo secundário
    accent: "#3d1a44", // fundo com acento vinho
    rust: "#5a2015", // acento ferrugem
    surface: "rgba(15, 10, 30, 0.92)", // painéis flutuantes
    card: "rgba(255, 255, 255, 0.06)", // cards sutis
    overlay: "rgba(0, 0, 0, 0.60)", // overlays de modal
  },

  // Gradientes
  gradient: {
    // Gradiente principal — navbar, footer, fundo do Campo
    main: "linear-gradient(155deg, #1a1040 0%, #2d1558 40%, #3d1a44 70%, #5a2015 100%)",
    // Gradiente da navbar
    nav: "linear-gradient(155deg, #3a2d9e 0%, #6832b5 40%, #9a3aaa 65%, #c85838 100%)",
    // Overlay inferior dos cards (texto legível sobre imagem)
    cardOverlay:
      "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.28) 55%, transparent 100%)",
  },

  // Acentos
  accent: {
    primary: "#fb923c", // laranja — Campo, ações principais, aba ativa
    purple: "#6832b5", // roxo médio — navbar
    indigo: "#3a2d9e", // índigo — navbar início
    orange: "#f97316", // laranja FAB
    orangeHover: "#ea6c0a",
  },

  // Texto
  text: {
    primary: "rgba(255, 255, 255, 1.00)",
    secondary: "rgba(255, 255, 255, 0.65)",
    muted: "rgba(255, 255, 255, 0.45)",
    faint: "rgba(255, 255, 255, 0.25)",
  },

  // Bordas
  border: {
    subtle: "rgba(255, 255, 255, 0.08)",
    mid: "rgba(255, 255, 255, 0.15)",
    strong: "rgba(255, 255, 255, 0.25)",
  },
} as const;

export const typography = {
  fontFamily: {
    primary: "'Poppins', sans-serif",
    secondary: "'Work Sans', sans-serif",
  },
  fontSize: {
    xs: "11px",
    sm: "12px",
    base: "13px",
    md: "14px",
    lg: "16px",
    xl: "18px",
    "2xl": "24px",
  },
} as const;

export const spacing = {
  cardGap: 8, // gap entre cards na malha
  cardRadius: 16, // border-radius dos cards
  panelRadius: 20, // border-radius dos painéis flutuantes
} as const;

export const blur = {
  panel: "blur(16px)",
  nav: "blur(12px)",
  card: "blur(6px)",
} as const;

export const animation = {
  snap: 300, // ms — duração do snap do Sliding Puzzle
  toast: 2500, // ms — duração do toast
  fade: 120, // ms — fade de opacidade dos cards
} as const;

// Tipo utilitário — permite usar os tokens com autocomplete total
export type Colors = typeof colors;
export type Typography = typeof typography;
