"use client";

import { useState, useEffect } from "react";
import { HexColorPicker } from "react-colorful";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  className?: string;
}

export function ColorPicker({ value, onChange, className }: ColorPickerProps) {
  const [hex, setHex] = useState(value);

  useEffect(() => {
    setHex(value);
  }, [value]);

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setHex(val);
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      onChange(val);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "w-full h-11 rounded-xl border border-slate-200 dark:border-gray-700 flex items-center gap-3 px-3 hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors",
            className
          )}
        >
          <div
            className="w-6 h-6 rounded-md border border-slate-200 dark:border-gray-600 shrink-0"
            style={{ backgroundColor: value }}
          />
          <span className="text-sm font-mono text-gray-700 dark:text-gray-300">
            {value}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-4 rounded-xl border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900"
        align="start"
      >
        <div className="space-y-3">
          <HexColorPicker color={hex} onChange={onChange} />
          <div className="flex items-center gap-2">
            <Input
              value={hex}
              onChange={handleHexChange}
              className="h-9 font-mono text-sm rounded-lg border-slate-200 dark:border-gray-700"
              placeholder="#000000"
              maxLength={7}
            />
            <div
              className="w-9 h-9 rounded-lg border border-slate-200 dark:border-gray-700 shrink-0"
              style={{ backgroundColor: hex }}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}