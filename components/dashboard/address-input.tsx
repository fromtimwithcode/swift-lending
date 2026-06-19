"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { useAddressAutocomplete } from "@/hooks/use-address-autocomplete";
import { MapPin, Loader2 } from "lucide-react";
import { toast } from "sonner";

type AddressInputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const AddressInput = React.forwardRef<HTMLInputElement, AddressInputProps>(
  function AddressInput({ onChange, onBlur, onKeyDown, value, name, ...rest }, forwardedRef) {
    const { suggestions, isLoading, error, search, clear } = useAddressAutocomplete();
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const generatedId = React.useId();
    const listboxId = `address-listbox-${generatedId.replace(/:/g, "")}`;

    // Merge forwarded ref with internal ref
    const setRef = useCallback(
      (node: HTMLInputElement | null) => {
        inputRef.current = node;
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      },
      [forwardedRef]
    );

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(e);
      search(e.target.value);
      setOpen(true);
      setActiveIndex(-1);
    };

    const selectSuggestion = useCallback(
      (description: string) => {
        // Fire a synthetic change event compatible with both field() and update() patterns
        if (onChange) {
          const syntheticEvent = {
            target: { value: description, name: name ?? "" },
          } as React.ChangeEvent<HTMLInputElement>;
          onChange(syntheticEvent);
        }
        clear();
        setOpen(false);
        setActiveIndex(-1);
      },
      [onChange, name, clear]
    );

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!open || suggestions.length === 0) {
        onKeyDown?.(e);
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
          break;
        case "ArrowUp":
          e.preventDefault();
          setActiveIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
          break;
        case "Enter":
          if (activeIndex >= 0 && suggestions[activeIndex]) {
            e.preventDefault();
            selectSuggestion(suggestions[activeIndex].description);
          }
          break;
        case "Escape":
          e.preventDefault();
          setOpen(false);
          setActiveIndex(-1);
          break;
        case "Tab":
          setOpen(false);
          setActiveIndex(-1);
          break;
        default:
          onKeyDown?.(e);
      }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      // Delay closing so click on suggestion registers
      setTimeout(() => {
        if (!wrapperRef.current?.contains(document.activeElement)) {
          setOpen(false);
          setActiveIndex(-1);
        }
      }, 150);
      onBlur?.(e);
    };

    // Close on outside click
    useEffect(() => {
      const handler = (e: MouseEvent) => {
        if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
          setOpen(false);
          setActiveIndex(-1);
        }
      };
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }, []);

    useEffect(() => {
      if (error) toast.warning(error, { id: "address-suggestions-unavailable" });
    }, [error]);

    const showDropdown = open && suggestions.length > 0;

    return (
      <div ref={wrapperRef} className="relative">
        <div className="relative">
          <input
            {...rest}
            ref={setRef}
            value={value}
            name={name}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            role="combobox"
            aria-expanded={showDropdown}
            aria-controls={listboxId}
            aria-activedescendant={activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined}
            aria-autocomplete="list"
            autoComplete="off"
          />
          {isLoading && (
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>

        {showDropdown && (
          <ul
            id={listboxId}
            role="listbox"
            className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-border bg-popover py-1 shadow-lg"
          >
            {suggestions.map((s, i) => (
              <li
                key={s.place_id}
                id={`${listboxId}-opt-${i}`}
                role="option"
                aria-selected={i === activeIndex}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectSuggestion(s.description);
                }}
                onMouseEnter={() => setActiveIndex(i)}
                className={`flex cursor-pointer items-start gap-2.5 px-3 py-2 text-sm ${
                  i === activeIndex ? "bg-accent text-accent-foreground" : "text-popover-foreground"
                }`}
              >
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <span className="font-medium">
                    {s.structured_formatting?.main_text ?? s.description}
                  </span>
                  {s.structured_formatting?.secondary_text && (
                    <span className="ml-1 text-muted-foreground">
                      {s.structured_formatting.secondary_text}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

      </div>
    );
  }
);
