import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BOOKING_STATUS_LABEL, BOOKING_STATUS_TONE } from "@/lib/display";

export default async function LocationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;

  const location = await prisma.location.findUnique({
    where: { id },
    include: {
      unitProductions: { include: { project: true } },
      bookings: { include: { project: true }, orderBy: { startDate: "asc" } },
    },
  });
  if (!location) notFound();

  return (
    <div>
      <Link href="/locations" className="text-sm font-medium text-muted-foreground hover:text-foreground">
        ← All locations
      </Link>

      <div className="mt-3 rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight">{location.name}</h1>
        {location.address && <p className="mt-1 text-sm text-muted-foreground">{location.address}</p>}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {location.locationType.map((t) => (
            <Badge key={t} tone="blue">
              {t}
            </Badge>
          ))}
          {location.agreementStatus && <Badge tone="neutral">{location.agreementStatus}</Badge>}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <DetailRow label="Nearest hospital" value={location.nearestHospital} />
              <DetailRow label="Cell service" value={boolLabel(location.cellService)} />
              <DetailRow label="Wifi available" value={boolLabel(location.wifiAvailable)} />
              <DetailRow label="Parking" value={location.parkingNotes} />
              <DetailRow label="Access notes" value={location.accessNotes} />
              <DetailRow label="Availability" value={location.availabilityNotes} />
              <DetailRow
                label="Location fee"
                value={location.locationFee ? `$${location.locationFee.toString()}` : null}
              />
            </dl>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Used on</CardTitle>
            </CardHeader>
            <CardContent>
              {location.unitProductions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Not yet linked to a unit production.</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {location.unitProductions.map((u) => (
                    <li key={u.id}>
                      <Link href={`/projects/${u.projectId}`} className="font-medium hover:text-brand">
                        {u.name}
                      </Link>{" "}
                      <span className="text-muted-foreground">({u.project.name})</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bookings</CardTitle>
            </CardHeader>
            <CardContent>
              {location.bookings.length === 0 ? (
                <p className="text-sm text-muted-foreground">No bookings yet.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {location.bookings.map((b) => (
                    <li key={b.id} className="flex items-center justify-between rounded-lg border border-border p-2.5">
                      <div>
                        <Link href={`/projects/${b.projectId}`} className="font-medium hover:text-brand">
                          {b.project.name}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {b.startDate.toLocaleDateString()} – {b.endDate.toLocaleDateString()}
                        </div>
                      </div>
                      <Badge tone={BOOKING_STATUS_TONE[b.status]}>{BOOKING_STATUS_LABEL[b.status]}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function boolLabel(v: boolean | null) {
  if (v === null) return null;
  return v ? "Yes" : "No";
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border pb-2 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
