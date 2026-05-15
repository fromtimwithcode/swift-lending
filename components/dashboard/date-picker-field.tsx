"use client";

import { CalendarIcon, X } from "lucide-react";
import { format, isValid, parse } from "date-fns";
import { useState } from "react";

import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type DateValueFormat = "us" | "iso";

type DatePickerFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  valueFormat?: DateValueFormat;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  buttonClassName?: string;
  fromYear?: number;
  toYear?: number;
  ariaLabel?: string;
};

function parseDateValue(value: string, valueFormat: DateValueFormat) {
  if (!value) return undefined;

  const parsed = parse(value, valueFormat === "iso" ? "yyyy-MM-dd" : "MM/dd/yyyy", new Date());
  return isValid(parsed) ? parsed : undefined;
}

function formatDateValue(date: Date, valueFormat: DateValueFormat) {
  return format(date, valueFormat === "iso" ? "yyyy-MM-dd" : "MM/dd/yyyy");
}

function DatePickerField({
  value,
  onChange,
  placeholder = "Select date",
  valueFormat = "us",
  disabled = false,
  required = false,
  className,
  buttonClassName,
  fromYear = 2000,
  toYear = new Date().getFullYear() + 10,
  ariaLabel,
}: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState<Date>(new Date());
  const selectedDate = parseDateValue(value, valueFormat);

  const selectDate = (date: Date) => {
    onChange(formatDateValue(date, valueFormat));
    setOpen(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) setMonth(selectedDate ?? new Date());
  };

  return (
    <div className={cn("relative", className)}>
      <Popover open={open} onOpenChange={handleOpenChange} modal="trap-focus">
        <PopoverTrigger
          type="button"
          disabled={disabled}
          aria-label={ariaLabel ?? placeholder}
          className={cn(
            "group/date-picker flex min-h-10 w-full items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_2px_rgba(0,0,0,0.03)] outline-none transition-[border-color,box-shadow,background-color,scale] duration-200 ease-out hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 data-[popup-open]:border-ring data-[popup-open]:ring-2 data-[popup-open]:ring-ring/20",
            !value && "text-muted-foreground",
            !disabled && "active:scale-[0.96]",
            buttonClassName
          )}
        >
          <span className={cn("truncate tabular-nums", value && "text-foreground")}>
            {selectedDate ? format(selectedDate, "MMM d, yyyy") : value || placeholder}
          </span>
          <CalendarIcon className="size-4 shrink-0 text-muted-foreground transition-[opacity,scale,filter,color] duration-200 ease-out group-data-[popup-open]/date-picker:scale-110 group-data-[popup-open]/date-picker:text-foreground" />
        </PopoverTrigger>
        <PopoverContent className="max-w-[calc(100vw-1rem)] overflow-x-auto" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            month={month}
            onMonthChange={setMonth}
            captionLayout="dropdown"
            startMonth={new Date(fromYear, 0)}
            endMonth={new Date(toYear, 11)}
            onSelect={(date) => {
              if (!date) return;
              selectDate(date);
            }}
          />
          <div className="flex gap-2 p-2 shadow-[inset_0_1px_0_var(--border)]">
            <button
              type="button"
              onClick={() => selectDate(new Date())}
              className="flex min-h-10 flex-1 items-center justify-center rounded-lg text-sm font-medium text-foreground transition-[background-color,color,scale] hover:bg-muted active:scale-[0.96]"
            >
              Today
            </button>
            {!required && value && (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-medium text-muted-foreground transition-[background-color,color,scale] hover:bg-muted hover:text-foreground active:scale-[0.96]"
              >
                <X className="size-4" />
                Clear date
              </button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export { DatePickerField };
