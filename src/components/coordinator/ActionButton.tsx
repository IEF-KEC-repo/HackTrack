"use client";

import React from "react";
import { Button, ButtonProps } from "@/components/ui/Button";
import { useCoordinator } from "./CoordinatorShell";

export interface ActionButtonProps extends ButtonProps {
  viewOnlyMessage?: string;
}

export const ActionButton: React.FC<ActionButtonProps> = ({
  disabled,
  viewOnlyMessage = "Action disabled in View-Only mode",
  children,
  title,
  ...props
}) => {
  const { isReadOnly } = useCoordinator();
  const shouldDisable = disabled || isReadOnly;

  return (
    <span
      className="inline-block"
      title={isReadOnly ? viewOnlyMessage : title}
      tabIndex={isReadOnly ? 0 : undefined}
      aria-disabled={shouldDisable}
    >
      <Button
        disabled={shouldDisable}
        {...props}
      >
        {children}
      </Button>
    </span>
  );
};
