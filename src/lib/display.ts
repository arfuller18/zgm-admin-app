// Human labels + badge tones for enum values, kept in one place so every
// page renders status/priority/color consistently.

import type { BadgeTone } from "@/components/ui/badge";
import type {
  ProjectStatus,
  Priority,
  ProjectColor,
  ProjectFormat,
  BookingStatus,
  Role,
} from "../../generated/prisma/enums";

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  IDEA: "Idea",
  SUBMISSION: "Submission",
  OPTIONED: "Optioned",
  SCRIPT: "Script",
  PACKAGING: "Packaging",
  FINANCING: "Financing",
  GREENLIGHT_READY: "Greenlight-Ready",
  PREP: "Prep",
  PAUSED: "Paused",
};

export const PROJECT_STATUS_TONE: Record<ProjectStatus, BadgeTone> = {
  IDEA: "neutral",
  SUBMISSION: "info",
  OPTIONED: "info",
  SCRIPT: "purple",
  PACKAGING: "blue",
  FINANCING: "orange",
  GREENLIGHT_READY: "success",
  PREP: "success",
  PAUSED: "warning",
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
  WATCH: "Watch",
};

export const PRIORITY_TONE: Record<Priority, BadgeTone> = {
  HIGH: "danger",
  MEDIUM: "warning",
  LOW: "neutral",
  WATCH: "info",
};

export const PROJECT_FORMAT_LABEL: Record<ProjectFormat, string> = {
  SERIES: "Series",
  FEATURE: "Feature",
  LIMITED_SERIES: "Limited Series",
  UNSCRIPTED: "Unscripted",
  DOCUMENTARY: "Documentary",
  CO_PRO: "Co-Pro",
  SHORT_DIGITAL: "Short / Digital",
  OTHER: "Other",
};

export const PROJECT_COLOR_TONE: Record<ProjectColor, BadgeTone> = {
  PINK: "pink",
  PURPLE: "purple",
  BLUE: "blue",
  GREEN: "green",
  YELLOW: "yellow",
  ORANGE: "orange",
  RED: "red",
};

export const PROJECT_COLOR_HEX: Record<ProjectColor, string> = {
  PINK: "#ec4899",
  PURPLE: "#a855f7",
  BLUE: "#3b82f6",
  GREEN: "#22c55e",
  YELLOW: "#eab308",
  ORANGE: "#f97316",
  RED: "#ef4444",
};

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  CONFIRMED: "Confirmed",
  SOFT_HOLD: "Soft Hold",
  CANCELLED: "Cancelled",
};

export const BOOKING_STATUS_TONE: Record<BookingStatus, BadgeTone> = {
  CONFIRMED: "success",
  SOFT_HOLD: "warning",
  CANCELLED: "neutral",
};

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin",
  EXECUTIVE: "Executive",
  PRODUCER_PM: "Producer / PM",
  DEPARTMENT_LEAD: "Department Lead",
  CREW_STAFF: "Crew / Staff",
  FINANCE: "Finance",
  VENDOR_EXTERNAL: "Vendor / External",
};
