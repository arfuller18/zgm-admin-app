"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { SyncSummary } from "@/lib/airtable-sync";
import { runSync } from "./actions";

export function SyncButton() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<
    { ok: true; summary: SyncSummary } | { ok: false; error: string } | null
  >(null);

  return (
    <div>
      <Button
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setResult(await runSync());
          })
        }
      >
        {isPending ? "Syncing…" : "Sync now"}
      </Button>
      {result && (
        <div
          className={`mt-4 rounded-lg px-3 py-2 text-sm ${
            result.ok ? "bg-success-bg text-success" : "bg-danger-bg text-danger"
          }`}
        >
          {result.ok ? (
            <pre className="whitespace-pre-wrap font-sans">{JSON.stringify(result.summary, null, 2)}</pre>
          ) : (
            result.error
          )}
        </div>
      )}
    </div>
  );
}
