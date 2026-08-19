"use client";

import { useTransition } from "react";
import { Select } from "@/components/ui/input";
import { TASK_STATUS_LABEL } from "@/lib/display";
import { updateTaskStatus } from "./actions";
import type { TaskStatus } from "../../../../../generated/prisma/enums";

export function TaskStatusSelect({
  taskId,
  projectId,
  status,
}: {
  taskId: string;
  projectId: string;
  status: TaskStatus;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Select
      defaultValue={status}
      disabled={isPending}
      onChange={(e) => {
        const formData = new FormData();
        formData.set("taskId", taskId);
        formData.set("projectId", projectId);
        formData.set("status", e.target.value);
        startTransition(() => {
          updateTaskStatus(formData);
        });
      }}
      className="!w-auto"
    >
      {Object.entries(TASK_STATUS_LABEL).map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </Select>
  );
}
