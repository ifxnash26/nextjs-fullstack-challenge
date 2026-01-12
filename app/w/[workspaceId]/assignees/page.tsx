import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormSubmitButton } from "@/components/form-submit-button";
import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditAssets, effectiveRole } from "@/lib/rbac";
import { parse } from "csv-parse/sync";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

function normalizeCsvHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function buildCsvLookup(record: Record<string, string>) {
  const lookup: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    const normalizedKey = normalizeCsvHeader(key);
    if (!normalizedKey || typeof value !== "string") continue;
    lookup[normalizedKey] = value;
  }
  return lookup;
}

function getCsvValue(lookup: Record<string, string>, candidates: string[]) {
  for (const candidate of candidates) {
    const value = lookup[normalizeCsvHeader(candidate)];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function detectCsvDelimiter(csvText: string) {
  const sampleLine = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length) ?? "";
  const candidates = [",", ";", "\t", "|"];
  let best = ",";
  let bestCount = 0;

  for (const candidate of candidates) {
    const count = sampleLine.split(candidate).length - 1;
    if (count > bestCount) {
      bestCount = count;
      best = candidate;
    }
  }

  return best;
}

async function createPersonAction(formData: FormData) {
  "use server";
  const session = await getCurrentSession();
  if (!session?.user?.id) redirect("/login");

  const workspaceId = String(formData.get("workspaceId") || "");
  const name = String(formData.get("name") || "").trim();
  const email = formData.get("email") ? String(formData.get("email")) : null;
  const title = formData.get("title") ? String(formData.get("title")) : null;

  if (!workspaceId || !name) return;

  await prisma.person.upsert({
    where: { workspaceId_name: { workspaceId, name } },
    update: { email, title },
    create: { workspaceId, name, email, title },
  });

  revalidatePath(`/w/${workspaceId}/assignees`);
}

async function bulkCreatePeopleAction(formData: FormData) {
  "use server";
  const session = await getCurrentSession();
  if (!session?.user?.id) redirect("/login");

  const workspaceId = String(formData.get("workspaceId") || "");
  const raw = String(formData.get("people") || "").trim();
  if (!workspaceId || !raw) return;

  const rows = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const row of rows) {
    const parts = row.split(",").map((part) => part.trim());
    const name = parts[0];
    if (!name) continue;
    const email = parts[1] || null;
    const title = parts[2] || null;

    await prisma.person.upsert({
      where: { workspaceId_name: { workspaceId, name } },
      update: { ...(email ? { email } : {}), ...(title ? { title } : {}) },
      create: { workspaceId, name, email, title },
    });
  }

  revalidatePath(`/w/${workspaceId}/assignees`);
}

async function importPeopleCsvAction(formData: FormData) {
  "use server";
  const session = await getCurrentSession();
  if (!session?.user?.id) redirect("/login");

  const workspaceId = String(formData.get("workspaceId") || "");
  const file = formData.get("file");
  if (!workspaceId || !file || !(file instanceof Blob)) return;

  const csvText = await file.text();
  if (!csvText.trim()) {
    redirect(`/w/${workspaceId}/assignees?importError=${encodeURIComponent("CSV file is empty.")}`);
  }

  const delimiter = detectCsvDelimiter(csvText);
  let records: Record<string, string>[] = [];
  try {
    records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
      delimiter,
    }) as Record<string, string>[];
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to parse CSV.";
    redirect(`/w/${workspaceId}/assignees?importError=${encodeURIComponent(`Import failed. ${message}`)}`);
  }

  const rows: Array<{ name: string; email?: string; title?: string }> = [];
  let skipped = 0;
  const seenNames = new Set<string>();

  for (const record of records) {
    const lookup = buildCsvLookup(record);
    const name = getCsvValue(lookup, [
      "name",
      "full name",
      "full_name",
      "employee name",
      "employee_name",
      "assignee",
      "assignee name",
      "assignee_name",
    ]);
    if (!name) {
      skipped += 1;
      continue;
    }
    const normalizedName = name.trim();
    const dedupeKey = normalizedName.toLowerCase();
    if (seenNames.has(dedupeKey)) {
      skipped += 1;
      continue;
    }
    seenNames.add(dedupeKey);
    const email = getCsvValue(lookup, ["email", "email address", "email_address", "e-mail", "mail"]);
    const title = getCsvValue(lookup, ["title", "role", "position", "job title", "job_title", "designation"]);

    rows.push({ name: normalizedName, email, title });
  }

  if (!rows.length) {
    redirect(
      `/w/${workspaceId}/assignees?importError=${encodeURIComponent(
        "No valid rows found. Expected headers: name, email, title.",
      )}`,
    );
  }

  const existing = await prisma.person.findMany({
    where: {
      workspaceId,
      name: { in: rows.map((row) => row.name) },
    },
    select: { name: true },
  });
  const existingNames = new Set(existing.map((person) => person.name.toLowerCase()));

  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const updateData: { email?: string; title?: string } = {};
    if (row.email) updateData.email = row.email;
    if (row.title) updateData.title = row.title;

    await prisma.person.upsert({
      where: { workspaceId_name: { workspaceId, name: row.name } },
      update: updateData,
      create: { workspaceId, name: row.name, email: row.email ?? null, title: row.title ?? null },
    });

    if (existingNames.has(row.name.toLowerCase())) {
      updated += 1;
    } else {
      created += 1;
    }
  }

  revalidatePath(`/w/${workspaceId}/assignees`);
  redirect(`/w/${workspaceId}/assignees?imported=${created}&updated=${updated}&skipped=${skipped}`);
}

async function updatePersonAction(formData: FormData) {
  "use server";
  const session = await getCurrentSession();
  if (!session?.user?.id) redirect("/login");
  const id = String(formData.get("id") || "");
  const workspaceId = String(formData.get("workspaceId") || "");
  if (!id || !workspaceId) return;

  const name = String(formData.get("name") || "").trim();
  const email = formData.get("email") ? String(formData.get("email")) : null;
  const title = formData.get("title") ? String(formData.get("title")) : null;

  await prisma.person.update({
    where: { id },
    data: { name: name || undefined, email, title },
  });

  revalidatePath(`/w/${workspaceId}/assignees`);
}

async function deletePersonAction(formData: FormData) {
  "use server";
  const session = await getCurrentSession();
  if (!session?.user?.id) redirect("/login");
  const id = String(formData.get("id") || "");
  const workspaceId = String(formData.get("workspaceId") || "");
  if (!id || !workspaceId) return;

  await prisma.asset.updateMany({
    where: { workspaceId, assignedToId: id },
    data: { assignedToId: null },
  });

  await prisma.person.delete({ where: { id } });
  revalidatePath(`/w/${workspaceId}/assignees`);
}

export default async function AssigneesPage({
  params,
  searchParams,
}: {
  params: { workspaceId: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const session = await getCurrentSession();
  if (!session?.user?.id) redirect("/login");

  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: session.user.id, workspaceId: params.workspaceId } },
  });
  if (!membership) redirect("/login");

  const role = effectiveRole(session.user.role, membership.role);
  if (!canEditAssets(role)) redirect(`/w/${params.workspaceId}/assets`);

  const people = await prisma.person.findMany({
    where: { workspaceId: params.workspaceId },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { assets: true } },
    },
  });

  const importError = typeof searchParams?.importError === "string" ? searchParams.importError : null;
  const hasImportSummary = typeof searchParams?.imported === "string";
  const importedCount = hasImportSummary ? Number(searchParams?.imported ?? "0") : 0;
  const updatedCount = hasImportSummary ? Number(searchParams?.updated ?? "0") : 0;
  const skippedCount = hasImportSummary ? Number(searchParams?.skipped ?? "0") : 0;

  return (
    <div className="space-y-6 px-4 md:px-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-muted-foreground">Workspace</p>
          <h1 className="text-3xl font-semibold leading-tight text-foreground">Manage assignees</h1>
          <p className="text-muted-foreground">Add, edit, or remove people used as asset assignees.</p>
        </div>
        <Button
          asChild
          variant="secondary"
          className="rounded-full px-4 text-sm font-semibold shadow-sm transition hover:shadow-md"
        >
          <a href={`/w/${params.workspaceId}/assets`}>Back to assets</a>
        </Button>
      </div>

      {importError ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {importError}
        </div>
      ) : null}
      {!importError && hasImportSummary ? (
        <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground">
          Import complete: {importedCount} created, {updatedCount} updated, {skippedCount} skipped.
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Add assignee</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <form action={createPersonAction} className="grid grid-cols-1 gap-3 md:grid-cols-4 md:items-end">
            <input type="hidden" name="workspaceId" value={params.workspaceId} />
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="name">
                Name
              </label>
              <Input id="name" name="name" placeholder="Ada Lovelace" required />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="email">
                Email
              </label>
              <Input id="email" name="email" type="email" placeholder="ada@example.com" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="title">
                Title
              </label>
              <Input id="title" name="title" placeholder="IT Lead" />
            </div>
            <Button
              type="submit"
              variant="secondary"
              className="h-10 rounded-full px-4 text-sm font-semibold shadow-sm transition hover:shadow-md"
            >
              Add User
            </Button>
          </form>

          <form action={bulkCreatePeopleAction} className="space-y-3">
            <input type="hidden" name="workspaceId" value={params.workspaceId} />
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="people">
                Bulk add assignees
              </label>
              <Textarea
                id="people"
                name="people"
                rows={4}
                placeholder="Name, email, title&#10;Ada Lovelace, ada@example.com, IT Lead&#10;Grace Hopper, grace@example.com, Engineer"
              />
              <p className="text-xs text-muted-foreground">One user per line. Format: name, optional email, optional title. Existing names are updated.</p>
            </div>
            <Button
              type="submit"
              variant="secondary"
              className="h-10 rounded-full px-4 text-sm font-semibold shadow-sm transition hover:shadow-md"
            >
              Add Users
            </Button>
          </form>

          <form action={importPeopleCsvAction} encType="multipart/form-data" className="space-y-3">
            <input type="hidden" name="workspaceId" value={params.workspaceId} />
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="assigneeCsv">
                Import assignees CSV
              </label>
              <Input id="assigneeCsv" name="file" type="file" accept=".csv,text/csv" required />
              <p className="text-xs text-muted-foreground">
                CSV headers: name, optional email, optional title. Quote values that include commas.
              </p>
            </div>
            <FormSubmitButton
              type="submit"
              variant="secondary"
              className="h-10 rounded-full px-4 text-sm font-semibold shadow-sm transition hover:shadow-md"
              defaultText="Import CSV"
              pendingText="Importing..."
            />
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assignee directory</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Name</span>
            <span>Email</span>
            <span>Title</span>
            <span>Assets</span>
            <span className="text-right">Actions</span>
          </div>
          {people.map((person) => (
            <div key={person.id} className="grid grid-cols-5 items-center rounded-lg border border-border bg-card px-3 py-2 text-sm">
              <form action={updatePersonAction} className="contents">
                <input type="hidden" name="id" value={person.id} />
                <input type="hidden" name="workspaceId" value={params.workspaceId} />
                <Input name="name" defaultValue={person.name} className="h-9" />
                <Input name="email" defaultValue={person.email ?? ""} className="h-9" />
                <Input name="title" defaultValue={person.title ?? ""} className="h-9" />
                <span className="text-muted-foreground">{person._count.assets}</span>
                <div className="flex items-center justify-end gap-2">
                  <Button type="submit" variant="ghost" size="sm" className="rounded-full px-3 text-xs font-semibold">
                    Save
                  </Button>
                  <Button
                    type="submit"
                    formAction={deletePersonAction}
                    variant="ghost"
                    size="sm"
                    className="rounded-full px-3 text-xs font-semibold text-red-600"
                  >
                    Remove
                  </Button>
                </div>
              </form>
            </div>
          ))}
          {people.length === 0 ? <p className="text-sm text-muted-foreground">No assignees yet.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
