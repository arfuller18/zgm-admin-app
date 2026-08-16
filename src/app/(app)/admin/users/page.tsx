import Link from "next/link";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { ROLE_LABEL } from "@/lib/display";
import { inviteUser } from "./actions";
import { UserRow } from "./user-row";

export default async function AdminUsersPage() {
  const me = await requireRole("ADMIN");
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users &amp; Roles</h1>
          <p className="mt-1 text-muted-foreground">
            Control who can sign in and what they can see. New Google accounts stay inactive
            until you activate them here.
          </p>
        </div>
        <Link href="/admin/sync" className="shrink-0 text-sm font-medium text-brand hover:underline">
          Airtable sync →
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invite a user</CardTitle>
          <CardDescription>
            Pre-provision access by email — they&apos;ll be active immediately, so their first
            Google sign-in just works.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={inviteUser} className="grid gap-4 sm:grid-cols-[2fr_2fr_2fr_auto] sm:items-end">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required placeholder="name@zerogravitymedia.com" />
            </div>
            <div>
              <Label htmlFor="name">Name (optional)</Label>
              <Input id="name" name="name" placeholder="Jane Doe" />
            </div>
            <div>
              <Label htmlFor="role">Role</Label>
              <Select id="role" name="role" defaultValue="CREW_STAFF">
                {Object.entries(ROLE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit">Invite</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All users ({users.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 font-medium">User</th>
                  <th className="pb-2 font-medium">Role</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <UserRow key={u.id} user={u} isSelf={u.id === me.id} />
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
