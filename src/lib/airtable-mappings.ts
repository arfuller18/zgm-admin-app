// Shared string -> enum mappings between Airtable's single-select option
// labels and our Prisma enums. Used by both the one-time seed script
// (prisma/seed.ts) and the ongoing pull-sync job (src/lib/airtable-sync.ts)
// so the two stay consistent.

import type {
  ProjectFormat,
  ProjectStatus,
  Priority,
  ProjectColor,
  BudgetStatus,
  TaskStatus,
  TaskPriority,
} from "../../generated/prisma/enums";

const FORMAT_MAP: Record<string, ProjectFormat> = {
  Series: "SERIES",
  Feature: "FEATURE",
  "Limited Series": "LIMITED_SERIES",
  Unscripted: "UNSCRIPTED",
  Documentary: "DOCUMENTARY",
  "Co-Pro": "CO_PRO",
  "Short / Digital": "SHORT_DIGITAL",
  Other: "OTHER",
};

const STATUS_MAP: Record<string, ProjectStatus> = {
  Idea: "IDEA",
  Submission: "SUBMISSION",
  Optioned: "OPTIONED",
  Script: "SCRIPT",
  Packaging: "PACKAGING",
  Financing: "FINANCING",
  "Greenlight-Ready": "GREENLIGHT_READY",
  Prep: "PREP",
  Paused: "PAUSED",
};

const PRIORITY_MAP: Record<string, Priority> = {
  High: "HIGH",
  Medium: "MEDIUM",
  Low: "LOW",
  Watch: "WATCH",
};

const COLOR_MAP: Record<string, ProjectColor> = {
  Pink: "PINK",
  Purple: "PURPLE",
  Blue: "BLUE",
  Green: "GREEN",
  Yellow: "YELLOW",
  Orange: "ORANGE",
  Red: "RED",
};

const BUDGET_STATUS_MAP: Record<string, BudgetStatus> = {
  Draft: "DRAFT",
  Final: "FINAL",
};

// Airtable's Tasks & Checklists "Status" choices ("To Do"/"In progress"/
// "Done") differ from Task Status ("Not Started"/"In progress"/"Complete"/
// "Blocked") — the latter is what's actually on the field we sync.
const TASK_STATUS_MAP: Record<string, TaskStatus> = {
  "Not Started": "NOT_STARTED",
  "In progress": "IN_PROGRESS",
  Blocked: "BLOCKED",
  Complete: "COMPLETE",
};

const TASK_PRIORITY_MAP: Record<string, TaskPriority> = {
  Critical: "CRITICAL",
  High: "HIGH",
  Medium: "MEDIUM",
  Low: "LOW",
};

export function mapBudgetStatus(value: string | null | undefined) {
  return value ? (BUDGET_STATUS_MAP[value] ?? null) : null;
}

export function mapTaskStatus(value: string | null | undefined) {
  return value ? (TASK_STATUS_MAP[value] ?? "NOT_STARTED") : "NOT_STARTED";
}

export function mapTaskPriority(value: string | null | undefined) {
  return value ? (TASK_PRIORITY_MAP[value] ?? null) : null;
}

export function mapProjectFormat(value: string | null | undefined) {
  return value ? (FORMAT_MAP[value] ?? null) : null;
}

export function mapProjectStatus(value: string | null | undefined) {
  return value ? (STATUS_MAP[value] ?? null) : null;
}

export function mapPriority(value: string | null | undefined) {
  return value ? (PRIORITY_MAP[value] ?? null) : null;
}

export function mapProjectColor(value: string | null | undefined) {
  return value ? (COLOR_MAP[value] ?? null) : null;
}

export function toDate(value: string | null | undefined) {
  return value ? new Date(value) : null;
}

// "General ZGM Info" style placeholder records: no project code, format, or
// status populated. Not real productions — see Airtable base reference §3.1.
export function isPlaceholderProject(p: {
  projectId?: string | null;
  format?: string | null;
  currentStatus?: string | null;
}) {
  return !p.projectId && !p.format && !p.currentStatus;
}
