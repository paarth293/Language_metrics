import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Utility function to merge Tailwind CSS class names.
 * Combines clsx and tailwind-merge for maximum composability.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
