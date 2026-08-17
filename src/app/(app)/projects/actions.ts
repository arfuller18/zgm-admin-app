"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import type { ProjectFormat, ProjectStatus } from "../../../../generated/prisma/enums";

function str(formData: FormData, name: string): string | null {
  const v = formData.get(name);
  if (typeof v !== "string") return null;
  return v.trim() || null;
}

export type NewProjectFormState = { status: "idle" } | { status: "error"; message: string };

export async function createProject(
  _prevState: NewProjectFormState,
  formData: FormData
): Promise<NewProjectFormState> {
  await requireUser();

  const name = str(formData, "name");
  if (!name) return { status: "error", message: "Project name is required." };

  const project = await prisma.project.create({
    data: {
      name,
      format: (str(formData, "format") as ProjectFormat | null) ?? null,
      currentStatus: (str(formData, "currentStatus") as ProjectStatus | null) ?? "IDEA",
    },
  });

  redirect(`/projects/${project.id}/edit`);
}

export async function archiveProject(formData: FormData) {
  await requireUser();
  const projectId = String(formData.get("projectId") ?? "");
  if (!projectId) return;
  await prisma.project.update({ where: { id: projectId }, data: { currentStatus: "ARCHIVED" } });
  redirect(`/projects/${projectId}`);
}

export async function deleteProject(formData: FormData) {
  await requireUser();
  const projectId = String(formData.get("projectId") ?? "");
  if (!projectId) return;
  await prisma.project.delete({ where: { id: projectId } });
  redirect(`/projects`);
}
