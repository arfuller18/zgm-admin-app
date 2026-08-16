"use client";

import { useTransition } from "react";
import { Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABEL } from "@/lib/display";
import { updateUserRole, toggleUserActive } from "./actions";

const ROLES = Object.keys(ROLE_LABEL) as Array<keyof typeof ROLE_LABEL>;

export function UserRow({
  user,
  isSelf,
}: {
  user: { id: string; name: string | null; email: string; role: string; active: boolean };
  isSelf: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-3 pr-4">
        <div className="font-medium">{user.name ?? "—"}</div>
        <div className="text-sm text-muted-foreground">{user.email}</div>
      </td>
      <td className="py-3 pr-4">
        <Select
          value={user.role}
          disabled={isPending}
          onChange={(e) => startTransition(() => updateUserRole(user.id, e.target.value))}
          className="w-48"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </Select>
      </td>
      <td className="py-3 pr-4">
        {user.active ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Inactive</Badge>}
      </td>
      <td className="py-3 text-right">
        <button
          type="button"
          disabled={isPending || (isSelf && user.active)}
          onClick={() => startTransition(() => toggleUserActive(user.id, !user.active))}
          className="text-sm font-medium text-brand hover:underline disabled:opacity-40 disabled:no-underline"
        >
          {user.active ? "Deactivate" : "Activate"}
        </button>
      </td>
    </tr>
  );
}
