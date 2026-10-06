import React, { forwardRef } from "react";
import clsx from "clsx";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  error?: string;
  hint?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, options, error, hint, id, ...props }, ref) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={selectId} className="block text-sm font-medium text-slate-700 mb-1">
            {label}
          </label>
        )}
        <select
          id={selectId}
          ref={ref}
          className={clsx(
            "block w-full rounded-md border text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 px-3 py-2 bg-white disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed",
            error
              ? "border-rose-300 text-rose-900 focus:border-rose-500 focus:ring-rose-500"
              : "border-slate-300 text-slate-900 focus:border-indigo-500 focus:ring-indigo-500",
            className
          )}
          aria-invalid={Boolean(error)}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
        {error && (
          <p role="alert" className="mt-1 text-xs text-rose-600 font-medium">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = "Select";
