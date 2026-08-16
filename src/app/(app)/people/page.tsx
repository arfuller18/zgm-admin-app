import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { Badge } from "@/components/ui/badge";

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireUser();
  const { q } = await searchParams;

  const people = await prisma.person.findMany({
    where: q
      ? {
          OR: [
            { fullName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    include: { _count: { select: { bookings: true, directingUnits: true, writingUnits: true } } },
    orderBy: { fullName: "asc" },
  });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">People</h1>
          <p className="mt-1 text-muted-foreground">Directors, writers, and other contacts linked into productions.</p>
        </div>
        <form>
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search people…"
            className="w-56 rounded-lg border border-border bg-surface px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          />
        </form>
      </div>

      {people.length === 0 ? (
        <p className="mt-10 text-center text-muted-foreground">No people found.</p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {people.map((p) => (
            <Link
              key={p.id}
              href={`/people/${p.id}`}
              className="rounded-2xl border border-border bg-surface p-5 shadow-sm shadow-black/[0.03] transition-all hover:-translate-y-0.5 hover:shadow-lg"
            >
              <h3 className="font-semibold group-hover:text-brand">{p.fullName}</h3>
              {p.email && <p className="mt-0.5 truncate text-sm text-muted-foreground">{p.email}</p>}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {p.profession.map((prof) => (
                  <Badge key={prof} tone="purple">
                    {prof}
                  </Badge>
                ))}
                {p._count.directingUnits > 0 && (
                  <Badge tone="blue">Directs ({p._count.directingUnits})</Badge>
                )}
                {p._count.writingUnits > 0 && <Badge tone="green">Writes ({p._count.writingUnits})</Badge>}
                {p._count.bookings > 0 && <Badge tone="neutral">{p._count.bookings} bookings</Badge>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
