import React from "react";
import { cn } from "@wevlo/ui-web";

interface LogoProps {
  className?: string;
  size?: number;
}

export const Logo: React.FC<LogoProps> = ({ className, size = 32 }) => {
  return (
    <div className={cn("flex items-center gap-2 font-bold tracking-tight", className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="text-primary"
      >
        <rect width="40" height="40" rx="8" fill="currentColor" fillOpacity="0.1" />
        <path
          d="M10 12L15 28L20 18L25 28L30 12"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-xl">Wevlo</span>
    </div>
  );
};
