"use client";

import { DayPicker, getDefaultClassNames, type DayPickerProps } from "react-day-picker";
import "react-day-picker/style.css";

import { cn } from "@/lib/utils";

function Calendar({ className, classNames, ...props }: DayPickerProps) {
  const defaultClassNames = getDefaultClassNames();

  return (
    <DayPicker
      className={cn("p-3", className)}
      classNames={{
        ...defaultClassNames,
        root: cn(defaultClassNames.root, "text-sm"),
        months: cn(defaultClassNames.months, "flex flex-col gap-4"),
        month_caption: cn(defaultClassNames.month_caption, "flex h-10 items-center justify-center px-10"),
        caption_label: cn(defaultClassNames.caption_label, "text-sm font-semibold"),
        dropdowns: cn(defaultClassNames.dropdowns, "flex items-center gap-2"),
        dropdown_root: cn(defaultClassNames.dropdown_root, "relative"),
        dropdown: cn(
          defaultClassNames.dropdown,
          "h-10 rounded-lg border border-border bg-background px-2 text-sm font-medium outline-none transition-[border-color,box-shadow,background-color] hover:bg-muted/40 focus:border-ring focus:ring-2 focus:ring-ring/30"
        ),
        months_dropdown: cn(defaultClassNames.months_dropdown, "min-w-28"),
        years_dropdown: cn(defaultClassNames.years_dropdown, "min-w-20 tabular-nums"),
        nav: cn(defaultClassNames.nav, "absolute inset-x-3 top-3 flex items-center justify-between"),
        button_previous: cn(
          defaultClassNames.button_previous,
          "flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-[background-color,color,scale] hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 active:scale-[0.96]"
        ),
        button_next: cn(
          defaultClassNames.button_next,
          "flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-[background-color,color,scale] hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 active:scale-[0.96]"
        ),
        month_grid: cn(defaultClassNames.month_grid, "w-full border-separate border-spacing-y-1"),
        weekdays: cn(defaultClassNames.weekdays, "text-muted-foreground"),
        weekday: cn(defaultClassNames.weekday, "h-8 text-center text-[0.72rem] font-medium uppercase tracking-wide"),
        week: cn(defaultClassNames.week, "mt-1"),
        day: cn(defaultClassNames.day, "size-10 p-0 text-center align-middle"),
        day_button: cn(
          defaultClassNames.day_button,
          "flex size-10 items-center justify-center rounded-lg text-sm tabular-nums transition-[background-color,color,scale] hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 active:scale-[0.96]"
        ),
        today: cn(defaultClassNames.today, "[&_button]:bg-primary/10 [&_button]:font-semibold [&_button]:text-foreground"),
        selected: cn(defaultClassNames.selected, "[&_button]:bg-primary [&_button]:font-semibold [&_button]:text-primary-foreground [&_button]:hover:bg-primary/90"),
        outside: cn(defaultClassNames.outside, "text-muted-foreground/45 [&_button]:text-muted-foreground/45"),
        disabled: cn(defaultClassNames.disabled, "opacity-35"),
        hidden: cn(defaultClassNames.hidden, "invisible"),
        ...classNames,
      }}
      {...props}
    />
  );
}

export { Calendar };
