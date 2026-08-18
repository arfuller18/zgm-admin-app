import Link from "next/link";

// View switcher + project filter. URL-driven on purpose: a planner sharing
// "look at EOTV in March" should be able to paste a link and have it work.

export function ViewControls({
  basePath,
  view,
  month,
  projectId,
  projects,
}: {
  basePath: string;
  view: "calendar" | "timeline" | "list";
  month?: string;
  projectId?: string;
  projects: { id: string; name: string }[];
}) {
  const href = (next: Partial<{ view: string; month: string; project: string }>) => {
    const p = new URLSearchParams();
    const v = next.view ?? view;
    p.set("view", v);
    const m = next.month ?? month;
    if (m && v === "calendar") p.set("month", m);
    const proj = next.project !== undefined ? next.project : projectId;
    if (proj) p.set("project", proj);
    return `${basePath}?${p.toString()}`;
  };

  const tab = (key: "calendar" | "timeline" | "list", label: string) => (
    <Link
      key={key}
      href={href({ view: key })}
      className={`px-3 py-2 text-sm font-medium ${
        view === key ? "bg-brand text-brand-foreground" : "hover:bg-surface-muted"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex overflow-hidden rounded-lg border border-border">
        {tab("calendar", "Calendar")}
        {tab("timeline", "Timeline")}
        {tab("list", "List")}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        <span className="text-muted-foreground">Project:</span>
        <Link
          href={href({ project: "" })}
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            !projectId ? "bg-brand text-brand-foreground" : "bg-surface-muted hover:bg-border"
          }`}
        >
          All
        </Link>
        {projects.map((p) => (
          <Link
            key={p.id}
            href={href({ project: p.id })}
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              projectId === p.id ? "bg-brand text-brand-foreground" : "bg-surface-muted hover:bg-border"
            }`}
          >
            {p.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
