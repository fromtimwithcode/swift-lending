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
    <div className="group relative max-w-sm">
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-colors duration-200 group-focus-within:text-primary" />
      <input
        type="text"
        placeholder={placeholder}
        value={internal}
        onChange={(e) => setInternal(e.target.value)}
        className="w-full rounded-xl border border-border bg-muted/30 py-2 pl-9 pr-4 text-sm placeholder:text-muted-foreground/60 transition-all duration-200 focus:border-ring focus:bg-background focus:outline-none focus:ring-2 focus:ring-ring/30 focus:shadow-[0_0_0_3px_oklch(0.45_0.24_264_/_8%)]"
      />
    </div>
  );
}
