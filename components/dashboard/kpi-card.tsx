"use client";

import { cn } from "@/lib/utils";
import { type LucideIcon } from "lucide-react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
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
    if (hasAnimated.current) return;
    hasAnimated.current = true;
    if (isNaN(target)) return;

    animate(motionVal, target, {
      duration: 0.8,
      ease: [0.25, 0.46, 0.45, 0.94],
    });
  }, [motionVal, target]);

  useEffect(() => {
    const unsubscribe = rounded.on("change", (v) => {
      if (nodeRef.current) nodeRef.current.textContent = v;
    });
    return unsubscribe;
  }, [rounded]);

  return <span ref={nodeRef}>{display}</span>;
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
  return (
    <motion.div
      variants={staggerItem}
      initial="hidden"
      animate="visible"
      className={cn(
        "card-premium group relative overflow-hidden p-6",
        className
      )}
    >
      {/* Hover gradient overlay */}
      <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-br from-primary/0 to-primary/0 transition-all duration-300 group-hover:from-primary/[0.02] group-hover:to-primary/[0.04]" />

      <div className="relative flex items-center justify-between">
        <p className="truncate text-[13px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        {Icon && (
          <div className="rounded-lg bg-primary/8 p-2 transition-colors duration-200 group-hover:bg-primary/12">
            <Icon className="size-4 text-primary" />
          </div>
        )}
      </div>
      <div className="relative mt-3">
        <p className="text-[28px] font-bold leading-none tracking-tight">
          <AnimatedValue value={value} />
        </p>
        {subtitle && (
          <p className="mt-1.5 truncate text-sm text-muted-foreground">{subtitle}</p>
        )}
        {trend && (
          <span
            className={cn(
              "mt-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
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
