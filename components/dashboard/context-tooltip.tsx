"use client";

import { Tooltip } from "@base-ui/react/tooltip";
import { Info } from "lucide-react";
import { useId } from "react";

type ContextTooltipProps = {
  label: string;
  content: string;
};

export function ContextTooltip({ label, content }: ContextTooltipProps) {
  const tooltipId = useId();

  return (
    <Tooltip.Provider delay={300} closeDelay={100}>
      <Tooltip.Root>
        <Tooltip.Trigger
          type="button"
          closeOnClick={false}
          aria-label={`More information about ${label}`}
          aria-describedby={tooltipId}
          className="relative ml-1 inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-[background-color,color,scale] duration-150 after:absolute after:left-1/2 after:top-1/2 after:size-10 after:-translate-x-1/2 after:-translate-y-1/2 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[popup-open]:bg-muted data-[popup-open]:text-foreground active:scale-[0.96]"
        >
          <Info className="size-3.5" aria-hidden="true" />
        </Tooltip.Trigger>
        <Tooltip.Portal keepMounted>
          <Tooltip.Positioner sideOffset={8} className="z-50 outline-none">
            <Tooltip.Popup
              id={tooltipId}
              role="tooltip"
              className="max-w-72 origin-[var(--transform-origin)] rounded-lg bg-popover px-3 py-2.5 text-xs leading-5 text-popover-foreground shadow-[0_12px_32px_rgba(0,0,0,0.14),0_2px_8px_rgba(0,0,0,0.08),inset_0_0_0_1px_var(--border)] outline-none transition-[opacity,transform] duration-150 ease-out data-[ending-style]:translate-y-1 data-[ending-style]:scale-[0.98] data-[ending-style]:opacity-0 data-[starting-style]:translate-y-1 data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0 motion-reduce:transition-none"
            >
              {content}
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
