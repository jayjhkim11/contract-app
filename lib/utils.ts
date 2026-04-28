import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** YYYY. MM. DD. → "YYYY" */
export function yearOf(dateString: string): number {
  const m = dateString.match(/^(\d{4})/);
  return m ? parseInt(m[1], 10) : new Date().getFullYear();
}
