import { categoryColors, colors } from "@money/shared";

const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

/** Writes the dark theme from the shared tokens into CSS variables. Dark only for now. */
export function applyTheme() {
  const c = colors.dark;
  const vars = [
    ...Object.entries(c).map(([k, v]) => `--${kebab(k)}:${v}`),
    ...Object.entries(categoryColors).map(([k, v]) => `--cat-${k}:${v.dark}`),
  ].join(";");
  const style = document.createElement("style");
  style.textContent = `:root{${vars}}`;
  document.head.appendChild(style);
}
