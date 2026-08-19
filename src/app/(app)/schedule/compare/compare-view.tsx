"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/input";
import { CalendarMonth } from "../calendar-month";
import type { loadCalendarSectionData } from "../calendar-section";

type PaneData = Awaited<ReturnType<typeof loadCalendarSectionData>>;
type Target = { id: string; name: string; kind: "MASTER" | "VARIATION" };

/** Two independently-scrolling calendars, side by side. */
export function CompareView({
  targets,
  leftId,
  rightId,
  left,
  right,
  leftReadOnly,
  rightReadOnly,
}: {
  targets: Target[];
  leftId: string;
  rightId: string;
  left: PaneData;
  right: PaneData;
  leftReadOnly?: boolean;
  rightReadOnly?: boolean;
}) {
  const router = useRouter();

  function navigate(next: { left?: string; right?: string }) {
    const params = new URLSearchParams({ left: next.left ?? leftId, right: next.right ?? rightId });
    router.push(`/schedule/compare?${params.toString()}`);
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="min-w-0">
        <SchedulePicker
          label="Left"
          targets={targets}
          value={leftId}
          onChange={(id) => navigate({ left: id })}
        />
        <div className="mt-3">
          <CalendarMonth {...left} readOnly={leftReadOnly} />
        </div>
      </div>

      <div className="min-w-0">
        <SchedulePicker
          label="Right"
          targets={targets}
          value={rightId}
          onChange={(id) => navigate({ right: id })}
        />
        <div className="mt-3">
          <CalendarMonth {...right} readOnly={rightReadOnly} />
        </div>
      </div>
    </div>
  );
}

function SchedulePicker({
  label,
  targets,
  value,
  onChange,
}: {
  label: string;
  targets: Target[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="shrink-0 font-medium text-muted-foreground">{label}</span>
      <Select value={value} onChange={(e) => onChange(e.target.value)} className="!w-auto flex-1">
        {targets.map((t) => (
          <option key={t.id} value={t.id}>
            {t.kind === "MASTER" ? `${t.name} (Master)` : t.name}
          </option>
        ))}
      </Select>
    </label>
  );
}
