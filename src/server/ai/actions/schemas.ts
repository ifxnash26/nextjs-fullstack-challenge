import { z } from "zod";
import { AssetStatus } from "@prisma/client";
import { filterSpecSchema } from "@/server/ai/filterSpec";

export enum ActionType {
  CREATE_ASSET = "CREATE_ASSET",
  UPDATE_ASSET = "UPDATE_ASSET",
  ASSIGN_ASSET = "ASSIGN_ASSET",
  CHANGE_LOCATION = "CHANGE_LOCATION",
  BULK_UPDATE = "BULK_UPDATE",
  SOFT_DELETE_ASSET = "SOFT_DELETE_ASSET",
}

const selectionSchema = z.union([
  z.object({
    assetIds: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    filterSpec: filterSpecSchema,
  }),
]);

export const updatePayloadSchema = z.object({
  status: z.nativeEnum(AssetStatus).optional(),
  category: z.string().optional(),
  location: z.string().optional(),
  assignedToId: z.string().optional(),
  assignedToName: z
    .string()
    .trim()
    .min(1)
    .optional(),
  warrantyEnd: z.coerce.date().optional(),
  purchaseDate: z.coerce.date().optional(),
  serialNumber: z.string().optional(),
  model: z.string().optional(),
  brand: z.string().optional(),
  notes: z.string().optional(),
});

export const actionSchema = z.object({
  type: z.nativeEnum(ActionType),
  selection: selectionSchema,
  payload: updatePayloadSchema.partial(),
  reason: z.string().optional(),
  limitOne: z.boolean().optional(),
});

export const planSchema = z.object({
  intent: z.string().default("MANAGE_ASSETS"),
  actions: z.array(actionSchema).min(1),
  requiresConfirmation: z.boolean().default(false),
  confirmationText: z.string().optional(),
  clarifyingQuestion: z.string().optional(),
});

export type ActionPlan = z.infer<typeof planSchema>;
export type ActionItem = z.infer<typeof actionSchema>;
