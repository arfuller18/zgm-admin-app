import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { Badge } from "@/components/ui/badge";

export default async function LocationsPage() {
  await requireUser();
  const locations = await prisma.location.findMany({
    include: { _count: { select: { unitProductions: true, bookings: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Locations</h1>
        <p className="mt-1 text-muted-foreground">Shared across every ZGM production.</p>
      </div>

      {locations.length === 0 ? (
        <p className="mt-10 text-center text-muted-foreground">No locations yet.</p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {locations.map((l) => (
            <Link
              key={l.id}
              href={`/locations/${l.id}`}
              className="rounded-2xl border border-border bg-surface p-5 shadow-sm shadow-black/[0.03] transition-all hover:-translate-y-0.5 hover:shadow-lg"
            >
              <h3 className="font-semibold">{l.name}</h3>
              {l.address && <p className="mt-0.5 text-sm text-muted-foreground">{l.address}</p>}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {l.locationType.map((t) => (
                  <Badge key={t} tone="blue">
                    {t}
                  </Badge>
                ))}
                {l._count.unitProductions > 0 && (
                  <Badge tone="neutral">Used {l._count.unitProductions}x</Badge>
                )}
                {l._count.bookings > 0 && <Badge tone="warning">{l._count.bookings} bookings</Badge>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
