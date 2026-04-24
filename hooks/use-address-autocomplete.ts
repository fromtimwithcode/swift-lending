import { useState, useRef, useCallback, useEffect } from "react";

interface Prediction {
  description: string;
  place_id: string;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
}

export function useAddressAutocomplete() {
  const [suggestions, setSuggestions] = useState<Prediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    setSuggestions([]);
    setIsLoading(false);
    setError(null);
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const search = useCallback((input: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (abortRef.current) abortRef.current.abort();

    if (input.trim().length < 3) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    timerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(
          `/api/places?input=${encodeURIComponent(input.trim())}`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error("Failed to fetch suggestions");
        const data = await res.json();
        setSuggestions(data.predictions ?? []);
        if (data.error) {
          setError(data.error);
        } else {
          setError(null);
        }
        setIsLoading(false);
      } catch (err) {
        // On abort, bail without touching state — a new search() already set isLoading=true
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("Address suggestions unavailable");
        setSuggestions([]);
        setIsLoading(false);
      }
    }, 300);
  }, []);

  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { suggestions, isLoading, error, search, clear };
}
