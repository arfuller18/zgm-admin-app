import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { ProjectCard } from "@/components/project-card";
import { LinkButton } from "@/components/ui/button";
import { PROJECT_STATUS_LABEL } from "@/lib/display";
import type { ProjectStatus } from "../../../../generated/prisma/enums";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  await requireUser();
  const { status, q } = await searchParams;

  const projects = await prisma.project.findMany({
    where: {
      // Default view hides archived projects entirely; picking the
      // "Archived" status pill explicitly still shows them.
      currentStatus: status ? (status as ProjectStatus) : { not: "ARCHIVED" },
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { projectCode: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ priority: "asc" }, { name: "asc" }],
  });

  const statuses = Object.keys(PROJECT_STATUS_LABEL) as ProjectStatus[];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="mt-1 text-muted-foreground">The ZGM development &amp; production slate.</p>
        </div>
        <div className="flex gap-2">
          <form className="flex gap-2">
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search projects…"
              className="w-56 rounded-lg border border-border bg-surface px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            />
          </form>
          <LinkButton href="/projects/new">+ New Project</LinkButton>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        <Link
          href="/projects"
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            !status ? "bg-brand text-brand-foreground" : "bg-surface-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          All ({projects.length})
        </Link>
        {statuses.map((s) => (
          <Link
            key={s}
            href={`/projects?status=${s}`}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              status === s
                ? "bg-brand text-brand-foreground"
                : "bg-surface-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {PROJECT_STATUS_LABEL[s]}
          </Link>
        ))}
      </div>

      {projects.length === 0 ? (
        <p className="mt-10 text-center text-muted-foreground">No projects match.</p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </div>
  );
}
