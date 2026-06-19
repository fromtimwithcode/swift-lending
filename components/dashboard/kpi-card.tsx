"use client";

import { cn } from "@/lib/utils";
import { type LucideIcon } from "lucide-react";
import { motion, useMotionValue, useTransform, animate, useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";
import { staggerItem } from "@/lib/animations";

function AnimatedValue({ value }: { value: string | number }) {
  const isNumber = typeof value === "number";
  const isFormattedCurrency = typeof value === "string" && /^\$[\d,.]+[KMB]?$/i.test(value);

  if (!isNumber && !isFormattedCurrency) {
    return <span>{value}</span>;
  }

  return <AnimatedNumber display={String(value)} />;
}

function AnimatedNumber({ display }: { display: string }) {
  const shouldReduceMotion = useReducedMotion();
  const nodeRef = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);

  // Extract numeric part
  const prefix = display.match(/^[^0-9]*/)?.[0] ?? "";
  const suffix = display.match(/[^0-9.]*$/)?.[0] ?? "";
  const numStr = display.replace(prefix, "").replace(suffix, "").replace(/,/g, "");
  const target = parseFloat(numStr);
  const hasDecimals = numStr.includes(".");
  const decimalPlaces = hasDecimals ? (numStr.split(".")[1]?.length ?? 0) : 0;

  const motionVal = useMotionValue(0);
  const rounded = useTransform(motionVal, (v) => {
    const formatted = hasDecimals
      ? v.toLocaleString(undefined, { minimumFractionDigits: decimalPlaces, maximumFractionDigits: decimalPlaces })
      : Math.round(v).toLocaleString();
    return `${prefix}${formatted}${suffix}`;
  });

  useEffect(() => {
    if (shouldReduceMotion) return;
    if (hasAnimated.current) return;
    hasAnimated.current = true;
    if (isNaN(target)) return;

    animate(motionVal, target, {
      duration: 0.8,
      ease: [0.25, 0.46, 0.45, 0.94],
    });
  }, [motionVal, shouldReduceMotion, target]);

  useEffect(() => {
    if (shouldReduceMotion) return;
    const unsubscribe = rounded.on("change", (v) => {
      if (nodeRef.current) nodeRef.current.textContent = v;
    });
    return unsubscribe;
  }, [rounded, shouldReduceMotion]);

  if (shouldReduceMotion) {
    return <span className="tabular-nums">{display}</span>;
  }

  return <span ref={nodeRef} className="tabular-nums">{display}</span>;
}

interface KpiCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: { value: number; label: string };
  className?: string;
}

export function KpiCard({
  label,
  value,
  subtitle,
  icon: Icon,
  trend,
  className,
}: KpiCardProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      variants={shouldReduceMotion ? undefined : staggerItem}
      initial={shouldReduceMotion ? false : "hidden"}
      animate={shouldReduceMotion ? undefined : "visible"}
      className={cn(
        "card-premium group relative flex min-h-36 flex-col overflow-hidden p-5 sm:p-6",
        className
      )}
    >
      {/* Hover gradient overlay */}
      <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-br from-primary/0 to-primary/0 transition-[--tw-gradient-from,--tw-gradient-to] duration-300 group-hover:from-primary/[0.02] group-hover:to-primary/[0.04]" />

      <div className="relative flex items-start justify-between gap-3">
        <p className="min-w-0 flex-1 text-xs font-semibold uppercase leading-5 tracking-[0.14em] text-muted-foreground [overflow-wrap:anywhere]">
          {label}
        </p>
        {Icon && (
          <div className="shrink-0 rounded-lg bg-primary/8 p-2 transition-colors duration-200 group-hover:bg-primary/12">
            <Icon className="size-4 text-primary" />
          </div>
        )}
      </div>
      <div className="relative mt-auto pt-4">
        <p className="text-[28px] font-bold leading-none tracking-tight [overflow-wrap:anywhere]">
          <AnimatedValue value={value} />
        </p>
        {subtitle && (
          <p className="mt-1.5 text-sm leading-5 text-muted-foreground text-pretty [overflow-wrap:anywhere]">
            {subtitle}
          </p>
        )}
        {trend && (
          <span
            className={cn(
              "mt-2 inline-flex max-w-full flex-wrap items-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums [overflow-wrap:anywhere]",
              trend.value >= 0
                ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                : "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400"
            )}
          >
            {trend.value >= 0 ? "+" : ""}
            {trend.value}% {trend.label}
          </span>
        )}
      </div>
    </motion.div>
  );
}
