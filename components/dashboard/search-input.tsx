"use client";

import { Search } from "lucide-react";
import { useEffect, useState } from "react";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
}: SearchInputProps) {
  const [internal, setInternal] = useState(value);

  useEffect(() => {
    setInternal(value);
  }, [value]);

  useEffect(() => {
    const timer = setTimeout(() => {
      onChange(internal.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [internal, onChange]);

  return (
    <div className="group relative w-full max-w-sm">
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-colors duration-200 group-focus-within:text-primary" />
      <input
        type="search"
        aria-label={placeholder}
        placeholder={placeholder}
        value={internal}
        onChange={(e) => setInternal(e.target.value)}
        className="min-h-11 w-full rounded-2xl border border-border bg-card px-4 pl-10 text-sm shadow-[0_1px_2px_oklch(0_0_0_/_3%)] transition-[background-color,border-color,box-shadow] duration-200 placeholder:text-muted-foreground/60 focus:border-ring focus:bg-background focus:outline-none focus:ring-2 focus:ring-ring/30 focus:shadow-[0_0_0_3px_oklch(0.30_0.10_250_/_8%)]"
      />
    </div>
  );
}
