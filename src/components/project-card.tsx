import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  PROJECT_STATUS_LABEL,
  PROJECT_STATUS_TONE,
  PRIORITY_LABEL,
  PRIORITY_TONE,
  PROJECT_FORMAT_LABEL,
  PROJECT_COLOR_HEX,
} from "@/lib/display";
import type {
  ProjectColor,
  ProjectFormat,
  ProjectStatus,
  Priority,
} from "../../generated/prisma/enums";

export interface ProjectCardData {
  id: string;
  name: string;
  projectCode: string | null;
  format: ProjectFormat | null;
  currentStatus: ProjectStatus | null;
  priority: Priority | null;
  projectColor: ProjectColor | null;
  episodeCount: number | null;
  logline: string | null;
  nextAction: string | null;
}

export function ProjectCard({ project }: { project: ProjectCardData }) {
  const accent = project.projectColor ? PROJECT_COLOR_HEX[project.projectColor] : "#8b5cf6";

  return (
    <Link
      href={`/projects/${project.id}`}
      className="group relative block overflow-hidden rounded-2xl border border-border bg-surface shadow-sm shadow-black/[0.03] transition-all hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="h-1.5 w-full" style={{ backgroundColor: accent }} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold leading-tight text-foreground group-hover:text-brand">
              {project.name}
            </h3>
            <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {project.projectCode ?? "—"} · {project.format ? PROJECT_FORMAT_LABEL[project.format] : "Format TBD"}
            </p>
          </div>
        </div>

        {project.logline && (
          <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{project.logline}</p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          {project.currentStatus && (
            <Badge tone={PROJECT_STATUS_TONE[project.currentStatus]}>
              {PROJECT_STATUS_LABEL[project.currentStatus]}
            </Badge>
          )}
          {project.priority && (
            <Badge tone={PRIORITY_TONE[project.priority]}>{PRIORITY_LABEL[project.priority]} priority</Badge>
          )}
          {project.episodeCount != null && (
            <Badge tone="neutral">{project.episodeCount} eps</Badge>
          )}
        </div>

        {project.nextAction && (
          <p className="mt-3 truncate text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Next:</span> {project.nextAction}
          </p>
        )}
      </div>
    </Link>
  );
}
