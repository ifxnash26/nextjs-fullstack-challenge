import { AssetStatus, Role } from "@prisma/client";
import { z } from "zod";

export const credentialsSchema = z.object({
  email: z
    .string()
    .email()
    .transform((value) => value.toLowerCase()),
  password: z.string().min(6),
});

export const assetInputSchema = z.object({
  assetTag: z.string().min(1).trim(),
  serialNumber: z.string().optional(),
  category: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  status: z.nativeEnum(AssetStatus).default(AssetStatus.IN_STOCK),
  location: z.string().optional(),
  vendor: z.string().optional(),
  purchaseDate: z.coerce.date().optional(),
  warrantyEnd: z.coerce.date().optional(),
  assignedToId: z.string().optional().nullable(),
  notes: z.string().optional(),
});

export const assetUpdateSchema = assetInputSchema.partial().extend({
  id: z.string(),
  workspaceId: z.string(),
});

export const assetFilterSchema = z.object({
  q: z.string().optional(),
  assetTags: z.array(z.string()).optional(),
  status: z.array(z.nativeEnum(AssetStatus)).optional(),
  category: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  location: z.string().optional(),
  vendor: z.string().optional(),
  assignedTo: z.string().optional(),
  sort: z.enum(["createdAt", "purchaseDate", "warrantyEnd", "assetTag"]).optional(),
  direction: z.enum(["asc", "desc"]).optional(),
});

export const filterSpecSchema = z.object({
  statuses: z.array(z.nativeEnum(AssetStatus)).optional(),
  search: z.string().optional(),
  assetTags: z.array(z.string()).optional(),
  category: z.string().optional(),
  location: z.string().optional(),
  vendor: z.string().optional(),
  assignedTo: z.string().optional(),
});

export const workspaceNameSchema = z.object({
  name: z.string().min(2).max(80),
});

export const userCreateSchema = z.object({
  name: z.string().optional(),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.nativeEnum(Role),
});

export type AssetInput = z.infer<typeof assetInputSchema>;
export type AssetUpdateInput = z.infer<typeof assetUpdateSchema>;
export type AssetFilterInput = z.infer<typeof assetFilterSchema>;
export type FilterSpec = z.infer<typeof filterSpecSchema>;
