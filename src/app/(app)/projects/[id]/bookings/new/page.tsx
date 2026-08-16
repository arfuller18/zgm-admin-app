import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { BookingForm } from "./booking-form";

export default async function NewBookingPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;

  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) notFound();

  const [unitProductions, people, locations, equipment] = await Promise.all([
    prisma.unitProduction.findMany({ where: { projectId: id }, orderBy: { name: "asc" } }),
    prisma.person.findMany({ orderBy: { fullName: "asc" } }),
    prisma.location.findMany({ orderBy: { name: "asc" } }),
    prisma.equipment.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={`/projects/${id}?tab=bookings`}
        className="text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        ← Back to {project.name}
      </Link>
      <h1 className="mt-3 text-2xl font-bold tracking-tight">New Booking</h1>
      <p className="mt-1 text-muted-foreground">
        Book a person, location, or piece of equipment against {project.name} for a date range.
        We&apos;ll check for double-bookings across every other project automatically.
      </p>

      <div className="mt-6 rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <BookingForm
          projectId={id}
          unitProductions={unitProductions.map((u) => ({ id: u.id, label: u.name }))}
          people={people.map((p) => ({ id: p.id, label: p.fullName }))}
          locations={locations.map((l) => ({ id: l.id, label: l.name }))}
          equipment={equipment.map((e) => ({ id: e.id, label: e.name }))}
        />
      </div>
    </div>
  );
}
