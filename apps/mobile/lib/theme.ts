import { categoryColor, colors, radius, space } from "@money/shared";

/** Dark only for now, same tokens as the web app. */
export const c = colors.dark;
export { radius, space };

export const cat = (key: string) => categoryColor(key, "dark");

/** Minimum touch target. */
export const TARGET = 44;
