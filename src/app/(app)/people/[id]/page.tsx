import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BOOKING_STATUS_LABEL, BOOKING_STATUS_TONE } from "@/lib/display";
import { datesOverlap } from "@/lib/date-utils";

export default async function PersonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;

  const person = await prisma.person.findUnique({
    where: { id },
    include: {
      directingUnits: { include: { project: true } },
      writingUnits: { include: { project: true } },
      projectContacts: { include: { project: true } },
      bookings: { include: { project: true }, orderBy: { startDate: "asc" } },
    },
  });
  if (!person) notFound();

  const relationLabel: Record<string, string> = {
    EXECUTIVE_OWNER: "Executive Owner",
    DAY_TO_DAY_OWNER: "Day-to-Day Owner",
    SHOWRUNNER: "Showrunner",
    KEY_TALENT: "Key Talent",
    KEY_CREW: "Key Crew",
    IMPORTANT_CONTACT: "Important Contact",
  };

  const bookings = person.bookings;
  const conflictIds = new Set<string>();
  for (let i = 0; i < bookings.length; i++) {
    for (let j = i + 1; j < bookings.length; j++) {
      if (
        bookings[i].status !== "CANCELLED" &&
        bookings[j].status !== "CANCELLED" &&
        bookings[i].projectId !== bookings[j].projectId &&
        datesOverlap(bookings[i].startDate, bookings[i].endDate, bookings[j].startDate, bookings[j].endDate)
      ) {
        conflictIds.add(bookings[i].id);
        conflictIds.add(bookings[j].id);
      }
    }
  }

  return (
    <div>
      <Link href="/people" className="text-sm font-medium text-muted-foreground hover:text-foreground">
        ← All people
      </Link>

      <div className="mt-3 rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight">{person.fullName}</h1>
        <div className="mt-1 flex flex-wrap gap-3 text-sm text-muted-foreground">
          {person.email && <span>{person.email}</span>}
          {person.phone && <span>{person.phone}</span>}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {person.profession.map((p) => (
            <Badge key={p} tone="purple">
              {p}
            </Badge>
          ))}
          {person.contactType.map((t) => (
            <Badge key={t} tone="neutral">
              {t}
            </Badge>
          ))}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Creative credits</CardTitle>
          </CardHeader>
          <CardContent>
            {person.directingUnits.length === 0 && person.writingUnits.length === 0 && person.projectContacts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No credits on file.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {person.directingUnits.map((u) => (
                  <li key={`dir-${u.id}`} className="flex items-center justify-between">
                    <Link href={`/projects/${u.projectId}`} className="font-medium hover:text-brand">
                      {u.name}
                    </Link>
                    <Badge tone="blue">Director</Badge>
                  </li>
                ))}
                {person.writingUnits.map((u) => (
                  <li key={`wri-${u.id}`} className="flex items-center justify-between">
                    <Link href={`/projects/${u.projectId}`} className="font-medium hover:text-brand">
                      {u.name}
                    </Link>
                    <Badge tone="green">Writer</Badge>
                  </li>
                ))}
                {person.projectContacts.map((c) => (
                  <li key={c.id} className="flex items-center justify-between">
                    <Link href={`/projects/${c.projectId}`} className="font-medium hover:text-brand">
                      {c.project.name}
                    </Link>
                    <Badge tone="neutral">{relationLabel[c.relation] ?? c.relation}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bookings across all projects</CardTitle>
          </CardHeader>
          <CardContent>
            {bookings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No bookings yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {bookings.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5">
                    <div>
                      <Link href={`/projects/${b.projectId}`} className="font-medium hover:text-brand">
                        {b.project.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {b.startDate.toLocaleDateString()} – {b.endDate.toLocaleDateString()}
                        {b.roleOnProject ? ` · ${b.roleOnProject}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {conflictIds.has(b.id) && <Badge tone="danger">Conflict</Badge>}
                      <Badge tone={BOOKING_STATUS_TONE[b.status]}>{BOOKING_STATUS_LABEL[b.status]}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
