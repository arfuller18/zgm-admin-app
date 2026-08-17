import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { PROJECT_CONTACT_RELATION_LABEL } from "@/lib/display";
import { ProjectEditForm } from "./project-edit-form";
import { addProjectContact, removeProjectContact } from "../actions";

export default async function ProjectEditPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;

  const [project, contacts, people] = await Promise.all([
    prisma.project.findUnique({ where: { id } }),
    prisma.projectContact.findMany({ where: { projectId: id }, include: { person: true } }),
    prisma.person.findMany({ orderBy: { fullName: "asc" }, select: { id: true, fullName: true } }),
  ]);
  if (!project) notFound();

  return (
    <div>
      <Link
        href={`/projects/${id}`}
        className="text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        ← Back to {project.name}
      </Link>

      <h1 className="mt-3 text-2xl font-bold tracking-tight">Edit {project.name}</h1>

      <div className="mt-6">
        <ProjectEditForm project={project} />
      </div>

      <section className="mt-6 rounded-2xl border border-border bg-surface p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Key People</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Showrunner, Executive/Day-to-Day Owner, Key Talent, Key Crew, and other important contacts.
        </p>

        <div className="mt-4 space-y-3">
          {contacts.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-muted/50 px-3 py-2 text-sm"
            >
              <div>
                <span className="font-medium text-foreground">{c.person.fullName}</span>{" "}
                <span className="text-muted-foreground">— {PROJECT_CONTACT_RELATION_LABEL[c.relation]}</span>
              </div>
              <form action={removeProjectContact}>
                <input type="hidden" name="contactId" value={c.id} />
                <input type="hidden" name="projectId" value={id} />
                <Button type="submit" variant="ghost" size="sm">
                  Remove
                </Button>
              </form>
            </div>
          ))}
          {contacts.length === 0 && (
            <p className="text-sm text-muted-foreground">No key people linked yet.</p>
          )}
        </div>

        <form action={addProjectContact} className="mt-5 flex flex-wrap items-end gap-3">
          <input type="hidden" name="projectId" value={id} />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="personId">
              Person
            </label>
            <Select id="personId" name="personId" required defaultValue="">
              <option value="" disabled>
                Select a person…
              </option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="relation">
              Role
            </label>
            <Select id="relation" name="relation" required defaultValue="">
              <option value="" disabled>
                Select a role…
              </option>
              {Object.entries(PROJECT_CONTACT_RELATION_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" variant="outline">
            + Add
          </Button>
        </form>
      </section>
    </div>
  );
}
