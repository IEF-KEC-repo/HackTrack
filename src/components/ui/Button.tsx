import React, { forwardRef } from "react";
import clsx from "clsx";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed rounded-md shadow-sm";

    const variantStyles = {
      primary:
        "bg-indigo-600 text-white hover:bg-indigo-500 focus:ring-indigo-600 border border-transparent",
      secondary:
        "bg-slate-800 text-white hover:bg-slate-700 focus:ring-slate-800 border border-transparent",
      danger:
        "bg-rose-600 text-white hover:bg-rose-500 focus:ring-rose-600 border border-transparent",
      outline:
        "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 focus:ring-indigo-500",
      ghost:
        "bg-transparent text-slate-700 hover:bg-slate-100 focus:ring-indigo-500 shadow-none border border-transparent",
    };

    const sizeStyles = {
      sm: "px-2.5 py-1.5 text-xs",
      md: "px-3.5 py-2 text-sm",
      lg: "px-4.5 py-2.5 text-base",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={clsx(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8H4z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
