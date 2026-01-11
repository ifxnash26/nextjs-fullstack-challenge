import path from "path";
import os from "os";
import fs from "fs/promises";
import { NextResponse } from "next/server";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import libre from "libreoffice-convert";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth";
import { effectiveRole } from "@/lib/rbac";

export const dynamic = "force-dynamic";

function sanitize(str: string | null | undefined, fallback = "-") {
  if (!str) return fallback;
  const trimmed = String(str).trim();
  return trimmed.length ? trimmed : fallback;
}

async function convertDocxBufferToPdf(buffer: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    libre.convert(buffer, ".pdf", undefined, (err, done) => {
      if (err || !done) return reject(err || new Error("PDF conversion failed"));
      resolve(done);
    });
  });
}

export async function GET(_: Request, { params }: { params: { assetId: string } }) {
  const session = await getCurrentSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const asset = await prisma.asset.findUnique({
    where: { id: params.assetId },
    include: { assignedTo: true },
  });

  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  if ((asset.category ?? "").toLowerCase() !== "ipad") {
    return NextResponse.json({ error: "Handoff is only available for iPad assets" }, { status: 400 });
  }

  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: session.user.id, workspaceId: asset.workspaceId } },
  });
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Ensure user has at least view permission; reuse effectiveRole for consistency
  effectiveRole(session.user.role, membership.role);

  const generatedAt = new Date();
  const generatedDate = generatedAt.toISOString().split("T")[0];

  const templatePath = path.join(process.cwd(), "public", "handoff-template.docx");
  const content = await fs.readFile(templatePath, "binary");

  const zip = new PizZip(content);
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

  const data = {
    employee_name: sanitize(asset.assignedTo?.name, "Unassigned"),
    employee_email: sanitize(asset.assignedTo?.email),
    employee_title: sanitize(asset.assignedTo?.title),
    device_name: sanitize(asset.assetTag ?? asset.model ?? asset.category ?? "Device"),
    device_model: sanitize(asset.model),
    serial_number: sanitize(asset.serialNumber),
    accessories: sanitize((asset as any).accessories),
    purchase_date: asset.purchaseDate ? asset.purchaseDate.toISOString().split("T")[0] : "-",
    warranty_end: asset.warrantyEnd ? asset.warrantyEnd.toISOString().split("T")[0] : "-",
    start_date: generatedDate,
    generated_date: generatedDate,
  };

  try {
    doc.render(data);
  } catch (error) {
    console.error("docx render failed", error);
    return NextResponse.json({ error: "Template render failed" }, { status: 500 });
  }

  const docxBuffer = doc.getZip().generate({ type: "nodebuffer" });

  try {
    const pdfBuffer = await convertDocxBufferToPdf(docxBuffer);
    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=\"handoff-${asset.assetTag || "asset"}.pdf\"`,
      },
    });
  } catch (err) {
    console.warn("PDF conversion failed; returning docx instead", err);
    return new NextResponse(docxBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename=\"handoff-${asset.assetTag || "asset"}.docx\"`,
      },
    });
  }
}
