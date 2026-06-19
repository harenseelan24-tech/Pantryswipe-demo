const colors = {
  light: {
    // ── Brand primaries ──────────────────────────────────────────────
    primary:              "#F5A623",  // Saffron — CTAs, active states
    primaryForeground:    "#1A1714",  // Dark text on saffron
    secondary:            "#4CAF76",  // Herb Green — success, match, streak
    secondaryForeground:  "#FFFFFF",
    danger:               "#E84040",  // Skip Red — destructive
    dangerForeground:     "#FFFFFF",
    accent:               "#5B8EF5",  // Save Blue — links, save action
    accentForeground:     "#FFFFFF",

    // ── Backgrounds ──────────────────────────────────────────────────
    background:           "#FAFAF8",
    foreground:           "#1A1714",

    // ── Surface hierarchy ────────────────────────────────────────────
    surface:              "#FFFFFF",
    surfaceElevated:      "#F0EEE8",
    card:                 "#FFFFFF",
    cardForeground:       "#1A1714",
    cardElevated:         "#F0EEE8",

    // ── Text ─────────────────────────────────────────────────────────
    text:                 "#1A1714",
    textPrimary:          "#1A1714",
    textSecondary:        "#6B6560",
    textMuted:            "#A09890",

    // ── Borders & inputs ─────────────────────────────────────────────
    border:               "#E8E4DC",
    input:                "#E8E4DC",

    // ── Muted surfaces ───────────────────────────────────────────────
    muted:                "#F0EEE8",
    mutedForeground:      "#6B6560",

    // ── Semantic / action aliases (backward compat) ──────────────────
    tint:                 "#F5A623",
    saffron:              "#F5A623",
    herbGreen:            "#4CAF76",
    skipRed:              "#E84040",
    saveBlue:             "#5B8EF5",
    save:                 "#5B8EF5",
    destructive:          "#E84040",
    destructiveForeground:"#FFFFFF",

    // ── Overlay & tab bar ────────────────────────────────────────────
    overlay:              "rgba(0,0,0,0.45)",
    tabBar:               "#FFFFFF",
  },
  dark: {
    // ── Brand primaries ──────────────────────────────────────────────
    primary:              "#F5A623",
    primaryForeground:    "#1A1714",
    secondary:            "#4CAF76",
    secondaryForeground:  "#FFFFFF",
    danger:               "#E84040",
    dangerForeground:     "#FFFFFF",
    accent:               "#5B8EF5",
    accentForeground:     "#FFFFFF",

    // ── Backgrounds ──────────────────────────────────────────────────
    background:           "#141210",
    foreground:           "#F5F3EF",

    // ── Surface hierarchy ────────────────────────────────────────────
    surface:              "#1E1C1A",
    surfaceElevated:      "#272421",
    card:                 "#1E1C1A",
    cardForeground:       "#F5F3EF",
    cardElevated:         "#272421",

    // ── Text ─────────────────────────────────────────────────────────
    text:                 "#F5F3EF",
    textPrimary:          "#F5F3EF",
    textSecondary:        "#A09890",
    textMuted:            "#6B6560",

    // ── Borders & inputs ─────────────────────────────────────────────
    border:               "#2E2B27",
    input:                "#2E2B27",

    // ── Muted surfaces ───────────────────────────────────────────────
    muted:                "#272421",
    mutedForeground:      "#A09890",

    // ── Semantic / action aliases (backward compat) ──────────────────
    tint:                 "#F5A623",
    saffron:              "#F5A623",
    herbGreen:            "#4CAF76",
    skipRed:              "#E84040",
    saveBlue:             "#5B8EF5",
    save:                 "#5B8EF5",
    destructive:          "#E84040",
    destructiveForeground:"#FFFFFF",

    // ── Overlay & tab bar ────────────────────────────────────────────
    overlay:              "rgba(0,0,0,0.65)",
    tabBar:               "#141210",
  },
  radius: 16,
};

export default colors;
