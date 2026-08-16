import * as React from "react";
import { cn } from "@/lib/utils";

const TONES = {
  neutral: "bg-surface-muted text-foreground",
  brand: "bg-brand/10 text-brand-strong",
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  danger: "bg-danger-bg text-danger",
  info: "bg-info-bg text-info",
  pink: "bg-zgm-pink-bg text-zgm-pink",
  purple: "bg-zgm-purple-bg text-zgm-purple",
  blue: "bg-zgm-blue-bg text-zgm-blue",
  green: "bg-zgm-green-bg text-zgm-green",
  yellow: "bg-zgm-yellow-bg text-zgm-yellow",
  orange: "bg-zgm-orange-bg text-zgm-orange",
  red: "bg-zgm-red-bg text-zgm-red",
} as const;

export type BadgeTone = keyof typeof TONES;

export function Badge({
  className,
  tone = "neutral",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        TONES[tone],
        className
      )}
      {...props}
    />
  );
}
