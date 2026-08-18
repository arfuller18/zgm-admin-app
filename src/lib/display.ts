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
  BudgetStatus,
  TaskStatus,
  TaskPriority,
  ProjectContactRelation,
  RequirementStatus,
  VariationStatus,
  ShootDayStatus,
} from "../../generated/prisma/enums";

// These four are genuinely different states and the UI must not blur them:
// defined-but-unplaced, planned inside a scenario, operationally scheduled,
// and finished. "Scheduled in a variation" is emphatically not "complete".
export const REQUIREMENT_STATUS_LABEL: Record<RequirementStatus, string> = {
  DRAFT: "Unscheduled",
  SCHEDULED_IN_VARIATION: "In a variation",
  ON_MASTER: "On Master",
  COMPLETE: "Complete",
};

export const REQUIREMENT_STATUS_TONE: Record<RequirementStatus, BadgeTone> = {
  DRAFT: "neutral",
  SCHEDULED_IN_VARIATION: "info",
  ON_MASTER: "success",
  COMPLETE: "brand",
};

export const VARIATION_STATUS_LABEL: Record<VariationStatus, string> = {
  DRAFT: "Draft",
  UNDER_REVIEW: "Under review",
  ARCHIVED: "Archived",
};

export const VARIATION_STATUS_TONE: Record<VariationStatus, BadgeTone> = {
  DRAFT: "neutral",
  UNDER_REVIEW: "warning",
  ARCHIVED: "neutral",
};

export const SHOOT_DAY_STATUS_LABEL: Record<ShootDayStatus, string> = {
  PLANNED: "Planned",
  CONFIRMED: "Confirmed",
  SHOT: "Shot",
  CANCELLED: "Cancelled",
};

export const PROJECT_CONTACT_RELATION_LABEL: Record<ProjectContactRelation, string> = {
  EXECUTIVE_OWNER: "Executive Owner",
  DAY_TO_DAY_OWNER: "Day-to-Day Owner",
  SHOWRUNNER: "Showrunner",
  KEY_TALENT: "Key Talent",
  KEY_CREW: "Key Crew",
  IMPORTANT_CONTACT: "Important Contact",
};

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
  WRAPPED: "Wrapped",
  ARCHIVED: "Archived",
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
  WRAPPED: "brand",
  ARCHIVED: "neutral",
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

export const PROJECT_COLOR_LABEL: Record<ProjectColor, string> = {
  PINK: "Pink",
  PURPLE: "Purple",
  BLUE: "Blue",
  GREEN: "Green",
  YELLOW: "Yellow",
  ORANGE: "Orange",
  RED: "Red",
};

export const BUDGET_STATUS_LABEL: Record<BudgetStatus, string> = {
  DRAFT: "Draft",
  FINAL: "Final",
};

export const BUDGET_STATUS_TONE: Record<BudgetStatus, BadgeTone> = {
  DRAFT: "warning",
  FINAL: "success",
};

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  BLOCKED: "Blocked",
  COMPLETE: "Complete",
};

export const TASK_STATUS_TONE: Record<TaskStatus, BadgeTone> = {
  NOT_STARTED: "neutral",
  IN_PROGRESS: "info",
  BLOCKED: "danger",
  COMPLETE: "success",
};

export const TASK_PRIORITY_LABEL: Record<TaskPriority, string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

export const TASK_PRIORITY_TONE: Record<TaskPriority, BadgeTone> = {
  CRITICAL: "danger",
  HIGH: "orange",
  MEDIUM: "warning",
  LOW: "neutral",
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
