"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";

import { cn } from "@/lib/utils";

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;
const PopoverPortal = PopoverPrimitive.Portal;

function PopoverContent({
  className,
  sideOffset = 8,
  align = "start",
  children,
  ...props
}: PopoverPrimitive.Popup.Props & {
  sideOffset?: number;
  align?: PopoverPrimitive.Positioner.Props["align"];
}) {
  return (
    <PopoverPortal>
      <PopoverPrimitive.Positioner
        sideOffset={sideOffset}
        align={align}
        className="z-50 outline-none"
      >
        <PopoverPrimitive.Popup
          className={cn(
            "origin-[var(--transform-origin)] rounded-2xl bg-popover p-0 text-popover-foreground shadow-[0_12px_36px_rgba(0,0,0,0.14),0_2px_8px_rgba(0,0,0,0.08),inset_0_0_0_1px_var(--border)] outline-none transition-[opacity,transform] duration-150 ease-out data-[ending-style]:translate-y-1 data-[ending-style]:scale-[0.98] data-[ending-style]:opacity-0 data-[starting-style]:translate-y-1 data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0",
            className
          )}
          {...props}
        >
          {children}
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPortal>
  );
}

export { Popover, PopoverContent, PopoverTrigger };
