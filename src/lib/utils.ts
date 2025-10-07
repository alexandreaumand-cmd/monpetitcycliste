import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format amounts without € symbol and with max 2 decimals
export function formatAmount(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  // Remove .00 if the number is an integer
  const formatted = num.toFixed(2);
  return formatted.endsWith('.00') ? formatted.slice(0, -3) : formatted;
}

// Format numbers with max 2 decimals
export function formatNumber(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  return Number(num.toFixed(2)).toString();
}
