/** Plain-text paragraphs; content is stored as text, never HTML. */
export default function Paragraphs({ text }: { text: string }) {
  return text.split(/\n{2,}/).map((paragraph, index) => <p key={index}>{paragraph}</p>);
}
