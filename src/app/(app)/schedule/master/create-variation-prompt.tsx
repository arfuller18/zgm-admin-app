"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { createVariationFromMasterAction } from "../actions";

/**
 * What any blocked edit on the Master Calendar opens: a copy of Master to
 * actually make the change in, since Master itself takes no direct edits
 * (see CalendarMonth's readOnly prop). One hook, so every interception point
 * — a block click, a drag attempt, a drawer drop — shares the same modal and
 * the same in-flight request instead of each wiring its own.
 */
export function useCreateVariationPrompt() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function requestEdit() {
    setError(null);
    setOpen(true);
  }

  function confirmCreate() {
    startTransition(async () => {
      const res = await createVariationFromMasterAction();
      if (res.ok) {
        router.push(`/schedule/v/${res.id}`);
      } else {
        setError(res.message);
      }
    });
  }

  const modal = open
    ? createPortal(
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => !isPending && setOpen(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5 shadow-xl">
              <h3 className="font-semibold">Master can&apos;t be edited directly</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Create a variation — a copy of Master — to make this change, then publish it back
                when you&apos;re ready.
              </p>
              {error && <p className="mt-2 text-xs text-danger">{error}</p>}
              <div className="mt-4 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isPending}
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="button" size="sm" disabled={isPending} onClick={confirmCreate}>
                  {isPending ? "Creating…" : "Create variation"}
                </Button>
              </div>
            </div>
          </div>
        </>,
        document.body
      )
    : null;

  return { requestEdit, modal };
}
