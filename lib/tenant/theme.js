/** Tenant theme field → CSS custom property used by app/globals.css. */
const THEME_VARIABLES = {
  brand: "--color-brand",
  brandSecondary: "--color-brand-secondary",
  accent: "--color-accent",
  text: "--color-text",
  textMuted: "--color-text-muted",
  background: "--color-background",
  surface: "--color-surface",
  border: "--color-border",
};

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/**
 * Inline style for <html> that applies a store's colours. Values are
 * re-validated so stored data can never inject arbitrary CSS.
 * @param {Partial<import("@/lib/tenant/types").TenantTheme>} theme
 * @returns {Record<string, string>}
 */
export function themeToCssVariables(theme = {}) {
  const style = {};
  for (const [key, variable] of Object.entries(THEME_VARIABLES)) {
    const value = theme[key];
    if (typeof value === "string" && HEX_COLOR.test(value)) style[variable] = value;
  }
  return style;
}
