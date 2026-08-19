import { z } from "zod";

const numberish = z.union([z.number(), z.string()]).transform((value, context) => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    context.addIssue({ code: "custom", message: "Expected a finite number" });
    return z.NEVER;
  }
  return parsed;
});

const optionalNumberish = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((value, context) => {
    if (value === null || value === undefined || value === "") return null;
    const parsed = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(parsed)) {
      context.addIssue({ code: "custom", message: "Expected a finite number" });
      return z.NEVER;
    }
    return parsed;
  });

const blankToNull = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" && value.trim() ? value.trim() : null));

export const rawOmmSchema = z
  .object({
    OBJECT_NAME: z.string().min(1),
    OBJECT_ID: z.string(),
    EPOCH: z.string().min(1),
    MEAN_MOTION: numberish,
    ECCENTRICITY: numberish,
    INCLINATION: numberish,
    RA_OF_ASC_NODE: numberish,
    ARG_OF_PERICENTER: numberish,
    MEAN_ANOMALY: numberish,
    EPHEMERIS_TYPE: numberish.pipe(z.literal(0)),
    CLASSIFICATION_TYPE: z.enum(["U", "C"]),
    NORAD_CAT_ID: numberish,
    ELEMENT_SET_NO: numberish,
    REV_AT_EPOCH: optionalNumberish,
    BSTAR: numberish,
    MEAN_MOTION_DOT: numberish,
    MEAN_MOTION_DDOT: numberish,
  })
  .passthrough();

export const rawOmmArraySchema = z.array(rawOmmSchema).min(1);

export const rawSatcatSchema = z
  .object({
    OBJECT_NAME: z.string().min(1),
    OBJECT_ID: z.string(),
    NORAD_CAT_ID: numberish,
    OBJECT_TYPE: z.enum(["PAY", "R/B", "DEB", "UNK"]).catch("UNK"),
    OPS_STATUS_CODE: blankToNull,
    OWNER: blankToNull,
    LAUNCH_DATE: blankToNull,
    LAUNCH_SITE: blankToNull,
    PERIOD: optionalNumberish,
    INCLINATION: optionalNumberish,
    APOGEE: optionalNumberish,
    PERIGEE: optionalNumberish,
    RCS: optionalNumberish,
  })
  .passthrough();

export const rawSatcatArraySchema = z.array(rawSatcatSchema).min(1);

export type RawOmm = z.infer<typeof rawOmmSchema>;
export type RawSatcat = z.infer<typeof rawSatcatSchema>;

