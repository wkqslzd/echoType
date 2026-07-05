/** Keep the typing cursor in the passage viewport (upper third by default). */
export function scrollPassageToTypingCursor(
  container: HTMLElement,
  anchorRatio = 1 / 3,
): void {
  const cursor = container.querySelector<HTMLElement>('[data-typing-cursor]');
  if (!cursor) {
    container.scrollTop = 0;
    return;
  }

  const containerRect = container.getBoundingClientRect();
  const cursorRect = cursor.getBoundingClientRect();
  const cursorCenterY =
    cursorRect.top + cursorRect.height / 2 - containerRect.top + container.scrollTop;
  const targetScrollTop = cursorCenterY - container.clientHeight * anchorRatio;
  const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
  container.scrollTop = Math.max(0, Math.min(targetScrollTop, maxScroll));
}

/** Keep the caret visible inside a fixed-height (two-line) textarea. */
export function scrollTextareaToCaret(textarea: HTMLTextAreaElement, visibleLines = 2): void {
  const style = getComputedStyle(textarea);
  const lineHeight = Number.parseFloat(style.lineHeight) || 26;
  const textBeforeCaret = textarea.value.slice(0, textarea.selectionStart);
  const lineIndex = textBeforeCaret.split('\n').length - 1;
  const targetLine = Math.max(0, lineIndex - visibleLines + 1);
  textarea.scrollTop = targetLine * lineHeight;
}
