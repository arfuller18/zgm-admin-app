import Link from "next/link";
import { requireUser } from "@/lib/session";
import { NewProjectForm } from "./new-project-form";

export default async function NewProjectPage() {
  await requireUser();

  return (
    <div className="mx-auto max-w-xl">
      <Link href="/projects" className="text-sm font-medium text-muted-foreground hover:text-foreground">
        ← All projects
      </Link>
      <h1 className="mt-3 text-2xl font-bold tracking-tight">New Project</h1>
      <div className="mt-6 rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <NewProjectForm />
      </div>
    </div>
  );
}
