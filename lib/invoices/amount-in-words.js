const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

/** 0–99 */
function twoDigits(value) {
  if (value < 20) return ONES[value];
  const unit = value % 10;
  return unit ? `${TENS[Math.floor(value / 10)]}-${ONES[unit]}` : TENS[Math.floor(value / 10)];
}

/** 0–999 */
function threeDigits(value) {
  const hundreds = Math.floor(value / 100);
  const rest = value % 100;
  return [hundreds ? `${ONES[hundreds]} Hundred` : "", rest ? twoDigits(rest) : ""].filter(Boolean).join(" ");
}

/** Whole number in the Indian system: crore, lakh, thousand, hundred. */
function integerInWords(value) {
  if (value === 0) return "Zero";
  const crore = Math.floor(value / 10_000_000);
  const lakh = Math.floor((value % 10_000_000) / 100_000);
  const thousand = Math.floor((value % 100_000) / 1000);
  const rest = value % 1000;
  return [
    crore ? `${integerInWords(crore)} Crore` : "",
    lakh ? `${twoDigits(lakh)} Lakh` : "",
    thousand ? `${twoDigits(thousand)} Thousand` : "",
    rest ? threeDigits(rest) : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Amount in words as Indian invoices print it:
 * 123456.5 → "Indian Rupees One Lakh Twenty-Three Thousand Four Hundred Fifty-Six and Fifty Paise Only".
 * @param {number} amount
 */
export function amountInWords(amount) {
  const paiseTotal = Math.round(Math.abs(Number(amount) || 0) * 100);
  const rupees = Math.floor(paiseTotal / 100);
  const paise = paiseTotal % 100;
  const words = `Indian Rupees ${integerInWords(rupees)}${paise ? ` and ${twoDigits(paise)} Paise` : ""} Only`;
  return Number(amount) < 0 ? `Minus ${words}` : words;
}
