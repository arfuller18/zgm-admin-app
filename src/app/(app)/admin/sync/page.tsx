import Link from "next/link";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SyncButton } from "./sync-button";

export default async function AdminSyncPage() {
  await requireRole("ADMIN");
  const logs = await prisma.syncLog.findMany({
    orderBy: { startedAt: "desc" },
    take: 10,
  });
  const airtableConfigured = Boolean(process.env.AIRTABLE_API_KEY);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Airtable Sync</h1>
          <p className="mt-1 text-muted-foreground">
            Pulls the latest Projects, Unit Productions, Schedule, Shoot Days, Locations and
            linked Contacts from the ZGM Airtable base. One-directional — nothing is written
            back to Airtable, and Bookings/Equipment (which don&apos;t exist in Airtable) are
            never touched by this.
          </p>
        </div>
        <Link href="/admin/users" className="shrink-0 text-sm font-medium text-brand hover:underline">
          Users &amp; roles →
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Run sync</CardTitle>
          <CardDescription>
            {airtableConfigured
              ? "AIRTABLE_API_KEY is configured."
              : "Set AIRTABLE_API_KEY (a Personal Access Token) in your environment first."}
          </CardDescription>
        </CardHeader>
        <CardContent>{airtableConfigured && <SyncButton />}</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent runs</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sync runs yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {logs.map((log) => (
                <li key={log.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <span className="font-medium">{log.direction}</span>{" "}
                    <span className="text-muted-foreground">
                      {log.startedAt.toLocaleString()} · {log.recordsProcessed} records
                    </span>
                    {log.message && <div className="text-danger">{log.message}</div>}
                  </div>
                  <Badge tone={log.status === "success" ? "success" : "danger"}>{log.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
