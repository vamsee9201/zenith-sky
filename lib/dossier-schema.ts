import { z } from "zod";

export const dossierRequestSchema = z.object({
  noradId: z.string().regex(/^\d{1,9}$/),
}).strict();

export const dossierSchema = z.object({
  whatItIs: z.string().min(1).max(500),
  operator: z.string().min(1).max(200).nullable(),
  purpose: z.string().min(1).max(500).nullable(),
  story: z.string().min(1).max(1_500),
  confidence: z.enum(["high", "medium", "low"]),
}).strict();

