/** Single-line card preview: collapse newlines so line-clamp-1 stays one visual row. */
export function toCardPreviewLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
