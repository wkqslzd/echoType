import { useCallback, useEffect, useRef, useState } from 'react';

const SEARCH_DEBOUNCE_MS = 300;

/** Debounced search query; skips commits while IME composition is active. */
export function useImeAwareDebouncedSearch(debounceMs = SEARCH_DEBOUNCE_MS) {
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const composingRef = useRef(false);

  const commit = useCallback((value: string) => {
    setQuery(value.trim());
  }, []);

  useEffect(() => {
    if (composingRef.current) return;
    const id = window.setTimeout(() => commit(draft), debounceMs);
    return () => window.clearTimeout(id);
  }, [draft, debounceMs, commit]);

  const clear = useCallback(() => {
    composingRef.current = false;
    setDraft('');
    setQuery('');
  }, []);

  const onCompositionStart = useCallback(() => {
    composingRef.current = true;
  }, []);

  const onCompositionEnd = useCallback(
    (value: string) => {
      composingRef.current = false;
      setDraft(value);
      commit(value);
    },
    [commit],
  );

  return {
    draft,
    query,
    clear,
    setDraft,
    onCompositionStart,
    onCompositionEnd,
    showClear: draft.length > 0 || query.length > 0,
  };
}
