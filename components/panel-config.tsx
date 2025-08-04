"use client";

import React from "react";
import { Switch } from "./ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { TooltipProvider } from "./ui/tooltip";

export default function PanelConfig({
  title,
  tooltip,
  enabledTuple,
  disabled,
  children,
}: {
  title: string;
  tooltip: string;
  enabledTuple?: {value: boolean, setValue: (value: boolean) => void};
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  const handleToggle = () => {
    if (enabledTuple) {
      const { value, setValue } = enabledTuple;
      setValue(!value);
    } else {
      console.error("No enabledTuple provided");
    }
  };

  return (
    <div className="space-y-4 mb-6">
      <div className="flex justify-between items-center">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <h1 className="text-black font-medium">{title}</h1>
            </TooltipTrigger>
            <TooltipContent>
              <p>{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {enabledTuple && (
          <Switch
            id={title}
            checked={enabledTuple.value}
            onCheckedChange={handleToggle}
            disabled={disabled}
          />
        )}
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
}
