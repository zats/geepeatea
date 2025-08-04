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
  highlightError,
  children,
}: {
  title: string;
  tooltip: string;
  enabledTuple?: {value: boolean, setValue: (value: boolean) => void};
  disabled?: boolean;
  highlightError?: boolean;
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
    <div className={`space-y-4 mb-6 ${highlightError ? 'p-3 border-2 border-red-500 rounded-lg bg-red-50' : ''}`}>
      <div className="flex justify-between items-center">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <h1 className={`font-medium ${highlightError ? 'text-red-700' : 'text-black'}`}>{title}</h1>
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
