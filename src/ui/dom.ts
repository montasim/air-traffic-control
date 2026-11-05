/**
 * Builds an element with its class and, optionally, its text. Menus build cards, tags and badges from
 * data; this keeps each one to a single readable expression.
 */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text?: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

/** Scores read as two-digit counters everywhere they are shown: 00, 07, 12. */
export function formatScore(value: number): string {
  return Math.max(0, value).toString().padStart(2, "0");
}
