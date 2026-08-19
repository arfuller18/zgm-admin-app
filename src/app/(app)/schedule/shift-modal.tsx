"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import type { ShiftUnit } from "@/lib/scheduling/work-calendar";
import type { FlatWorkspaceAssignment } from "@/lib/scheduling/queries";
import {
  previewShiftAction,
  applyShiftTyped,
  type ShiftScopeInput,
  type ShiftPreviewRowView,
} from "./actions";

// Bulk shift — "the whole show moved back two weeks." The service layer
// (assignments.previewShift / applyShift) already supports four ways to
// scope a shift; this is the UI that actually offers all four, and — like
// the push-to-Master form — never applies a shift the user hasn't already
// seen previewed.

type ScopeKind = ShiftScopeInput["kind"];

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function ShiftControls({
  variationId,
  projects,
  assignments: flat,
}: {
  variationId: string;
  projects: { id: string; name: string }[];
  /** One row per placed assignment, already flattened and date-formatted server-side. */
  assignments: FlatWorkspaceAssignment[];
}) {
  const [open, setOpen] = useState(false);

  const [amount, setAmount] = useState(14);
  const [unit, setUnit] = useState<ShiftUnit>("CALENDAR_DAYS");
  const [scopeKind, setScopeKind] = useState<ScopeKind>("ENTIRE_VARIATION");
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [selectedAssignments, setSelectedAssignments] = useState<string[]>([]);
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");

  const [preview, setPreview] = useState<ShiftPreviewRowView[] | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreviewing, startPreview] = useTransition();
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applied, setApplied] = useState<number | null>(null);
  const [isApplying, startApply] = useTransition();

  function currentScope(): ShiftScopeInput | null {
    switch (scopeKind) {
      case "ENTIRE_VARIATION":
        return { kind: "ENTIRE_VARIATION" };
      case "SELECTED_PROJECTS":
        return selectedProjects.length > 0
          ? { kind: "SELECTED_PROJECTS", projectIds: selectedProjects }
          : null;
      case "SELECTED_ASSIGNMENTS":
        return selectedAssignments.length > 0
          ? { kind: "SELECTED_ASSIGNMENTS", assignmentIds: selectedAssignments }
          : null;
      case "DATE_RANGE":
        return rangeFrom && rangeTo ? { kind: "DATE_RANGE", from: rangeFrom, to: rangeTo } : null;
    }
  }
  const scope = currentScope();

  // Any change to what would be shifted invalidates whatever was last shown
  // — the point of previewing first is that Apply always matches what the
  // user actually looked at, never a stale guess.
  function invalidate() {
    setPreview(null);
    setPreviewError(null);
    setApplied(null);
    setApplyError(null);
  }

  function runPreview() {
    if (!scope) return;
    startPreview(async () => {
      const res = await previewShiftAction({ variationId, scope, amount, unit });
      if (res.ok) {
        setPreview(res.rows);
        setPreviewError(null);
      } else {
        setPreview(null);
        setPreviewError(res.message);
      }
      setApplied(null);
      setApplyError(null);
    });
  }

  function runApply() {
    if (!scope || !preview) return;
    startApply(async () => {
      const res = await applyShiftTyped({ variationId, scope, amount, unit });
      if (res.ok) {
        setApplied(res.moved);
        setPreview(null);
      } else {
        setApplyError(res.message);
      }
    });
  }

  const scopeTab = (kind: ScopeKind, label: string) => (
    <label
      key={kind}
      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${
        scopeKind === kind ? "border-brand bg-brand/5 font-medium" : "border-border hover:bg-surface-muted"
      }`}
    >
      <input
        type="radio"
        name="scope-kind"
        className="sr-only"
        checked={scopeKind === kind}
        onChange={() => {
          setScopeKind(kind);
          invalidate();
        }}
      />
      {label}
    </label>
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left font-medium hover:bg-surface-muted"
      >
        Push schedule by a number of days
        <span className={`text-xs text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-border p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground" htmlFor="shift-amount">
                Amount (negative moves earlier)
              </label>
              <Input
                id="shift-amount"
                type="number"
                value={amount}
                onChange={(e) => {
                  setAmount(Number(e.target.value));
                  invalidate();
                }}
                className="!w-28"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground" htmlFor="shift-unit">
                Counted in
              </label>
              <Select
                id="shift-unit"
                value={unit}
                onChange={(e) => {
                  setUnit(e.target.value as ShiftUnit);
                  invalidate();
                }}
                className="!w-44"
              >
                <option value="CALENDAR_DAYS">Calendar days</option>
                <option value="PRODUCTION_DAYS">Production days</option>
              </Select>
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">What should this shift?</p>
            <div className="flex flex-wrap gap-2">
              {scopeTab("ENTIRE_VARIATION", "Everything in this schedule")}
              {scopeTab("SELECTED_PROJECTS", "Selected projects")}
              {scopeTab("SELECTED_ASSIGNMENTS", "Selected placements")}
              {scopeTab("DATE_RANGE", "Everything in a date range")}
            </div>
          </div>

          {scopeKind === "SELECTED_PROJECTS" && (
            <div className="flex flex-wrap gap-1.5">
              {projects.map((p) => {
                const checked = selectedProjects.includes(p.id);
                return (
                  <label
                    key={p.id}
                    className={`flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                      checked ? "bg-brand text-brand-foreground" : "bg-surface-muted hover:bg-border"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={(e) => {
                        setSelectedProjects((s) =>
                          e.target.checked ? [...s, p.id] : s.filter((x) => x !== p.id)
                        );
                        invalidate();
                      }}
                    />
                    {p.name}
                  </label>
                );
              })}
              {projects.length === 0 && (
                <p className="text-xs text-muted-foreground">No projects in this schedule yet.</p>
              )}
            </div>
          )}

          {scopeKind === "SELECTED_ASSIGNMENTS" && (
            <div className="max-h-56 overflow-y-auto rounded-xl border border-border">
              {flat.length === 0 ? (
                <p className="p-3 text-xs text-muted-foreground">Nothing is placed yet.</p>
              ) : (
                <ul className="divide-y divide-border text-sm">
                  {flat.map((a) => {
                    const checked = selectedAssignments.includes(a.id);
                    return (
                      <li key={a.id}>
                        <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-surface-muted">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setSelectedAssignments((s) =>
                                e.target.checked ? [...s, a.id] : s.filter((x) => x !== a.id)
                              );
                              invalidate();
                            }}
                          />
                          <span className="font-medium">{a.projectName}</span>
                          <span className="text-muted-foreground">· {a.label}</span>
                          <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                            {fmt(a.startDate)} – {fmt(a.endDate)}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {scopeKind === "DATE_RANGE" && (
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground" htmlFor="shift-from">
                  From
                </label>
                <Input
                  id="shift-from"
                  type="date"
                  value={rangeFrom}
                  onChange={(e) => {
                    setRangeFrom(e.target.value);
                    invalidate();
                  }}
                  className="!w-40"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground" htmlFor="shift-to">
                  To
                </label>
                <Input
                  id="shift-to"
                  type="date"
                  value={rangeTo}
                  onChange={(e) => {
                    setRangeTo(e.target.value);
                    invalidate();
                  }}
                  className="!w-40"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Placements starting on or after &ldquo;From&rdquo; and ending on or before &ldquo;To.&rdquo;
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" disabled={!scope || isPreviewing} onClick={runPreview}>
              {isPreviewing ? "Previewing…" : "Preview shift"}
            </Button>
            {!scope && (
              <span className="text-xs text-muted-foreground">
                {scopeKind === "SELECTED_PROJECTS" && "Select at least one project."}
                {scopeKind === "SELECTED_ASSIGNMENTS" && "Select at least one placement."}
                {scopeKind === "DATE_RANGE" && "Pick both dates."}
              </span>
            )}
          </div>

          {previewError && (
            <p className="rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">{previewError}</p>
          )}

          {preview && (
            <div className="space-y-3">
              {preview.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing matches this scope.</p>
              ) : (
                <>
                  <div className="max-h-64 overflow-y-auto rounded-xl border border-border">
                    <table className="w-full text-left text-sm">
                      <thead className="sticky top-0 bg-surface-muted text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-medium">Placement</th>
                          <th className="px-3 py-2 font-medium">From</th>
                          <th className="px-3 py-2 font-medium">To</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {preview.map((r) => (
                          <tr key={r.assignmentId}>
                            <td className="px-3 py-2">
                              <span className="font-medium">{r.projectName}</span>{" "}
                              <span className="text-muted-foreground">· {r.label}</span>
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {fmt(r.fromStart)} – {fmt(r.fromEnd)}
                            </td>
                            <td className="px-3 py-2">
                              {fmt(r.toStart)} – {fmt(r.toEnd)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="button" disabled={isApplying} onClick={runApply}>
                      {isApplying ? "Applying…" : `Apply shift to ${preview.length} placement${preview.length === 1 ? "" : "s"}`}
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      Durations are preserved — a five-day block stays five production days wherever
                      it lands.
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          {applyError && (
            <p className="rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">{applyError}</p>
          )}
          {applied !== null && (
            <Badge tone="success">
              Moved {applied} placement{applied === 1 ? "" : "s"}.
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
