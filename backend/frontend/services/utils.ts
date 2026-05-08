import { clsx, type ClassValue } from "clsx";
import { format } from "date-fns";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(value?: string | null, fallback = "Not set") {
  if (!value) {
    return fallback;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }

  return format(parsed, "dd MMM yyyy");
}

export function formatDateTime(value?: string | null, fallback = "Not set") {
  if (!value) {
    return fallback;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }

  return format(parsed, "dd MMM yyyy, HH:mm");
}

export function formatNumber(value?: number | null, maximumFractionDigits = 0) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  }).format(value ?? 0);
}

export function formatCurrency(value?: number | null) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

export function initials(value?: string | null) {
  if (!value) {
    return "EC";
  }

  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function getStatusTone(status: string) {
  const normalized = status.toLowerCase();

  if (normalized.includes("complete") || normalized.includes("closed") || normalized.includes("acknowledged")) {
    return "success";
  }

  if (normalized.includes("overdue") || normalized.includes("cancel")) {
    return "danger";
  }

  if (normalized.includes("pending")) {
    return "warning";
  }

  return "neutral";
}

export function getPriorityTone(priority: string) {
  switch (priority) {
    case "Critical":
      return "danger";
    case "High":
      return "warning";
    case "Low":
      return "success";
    default:
      return "neutral";
  }
}

export function normalizeHexColor(value?: string | null, fallback = "#1d6b4d") {
  if (!value) {
    return fallback;
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith("#")) {
    return fallback;
  }

  return trimmed;
}
