import React from "react";
import clsx from "clsx";

export interface AlertProps {
  variant?: "info" | "success" | "warning" | "error";
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({
  variant = "info",
  title,
  children,
  className,
}) => {
  const variantStyles = {
    info: "bg-blue-50 border-blue-200 text-blue-900",
    success: "bg-emerald-50 border-emerald-200 text-emerald-900",
    warning: "bg-amber-50 border-amber-200 text-amber-900",
    error: "bg-rose-50 border-rose-200 text-rose-900",
  };

  const iconStyles = {
    info: "ℹ️",
    success: "✅",
    warning: "⚠️",
    error: "🚫",
  };

  return (
    <div
      role="alert"
      className={clsx("rounded-lg border p-4 text-sm flex gap-3", variantStyles[variant], className)}
    >
      <span className="text-base select-none">{iconStyles[variant]}</span>
      <div className="flex-1">
        {title && <p className="font-semibold mb-0.5">{title}</p>}
        <div className="text-xs opacity-90 leading-relaxed">{children}</div>
      </div>
    </div>
  );
};
