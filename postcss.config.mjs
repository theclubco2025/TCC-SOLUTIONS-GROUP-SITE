/**
 * Explicitly empty. PostCSS searches upward for a config, and C:\Users\thecl
 * holds a stray tailwind postcss.config.js from an unrelated project that Next
 * would otherwise inherit and fail on. This file stops the search here. TCCSG
 * uses plain CSS — no Tailwind.
 */
export default { plugins: {} }
