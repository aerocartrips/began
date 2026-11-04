/**
 * Characters that must not appear raw inside an inline <script>:
 * "<" (could close the tag), ">" and "&" (HTML-significant in some parsers),
 * and U+2028/U+2029 (line terminators in older JavaScript engines).
 * Each is replaced by its JSON unicode escape, so the parsed value is unchanged.
 */
const UNSAFE = /[<>&\u2028\u2029]/g;
const ESCAPES = { "<": "\\u003c", ">": "\\u003e", "&": "\\u0026", "\u2028": "\\u2028", "\u2029": "\\u2029" };

/**
 * JSON for a `<script type="application/ld+json">` element. Store-entered text
 * (product names, FAQ answers, guide titles) can never break out of the script.
 * @param {unknown} data
 * @returns {string}
 */
export function serializeJsonLd(data) {
  return JSON.stringify(data).replace(UNSAFE, (character) => ESCAPES[character]);
}
