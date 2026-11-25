/**
 * A type or category name as it reads mid-sentence: "Sarees" → "sarees",
 * while names styled with a capital or hyphen after the first letter keep it
 * ("T-shirts", "PVC bags").
 * @param {string} word
 * @returns {string}
 */
export function inSentence(word) {
  const second = word.charAt(1);
  if (second === "-" || (second && second !== second.toLowerCase())) return word;
  return word.charAt(0).toLowerCase() + word.slice(1);
}
