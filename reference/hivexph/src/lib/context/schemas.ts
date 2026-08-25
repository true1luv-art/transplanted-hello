import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Offers activation memo
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Written to posting_json_metadata under memo.offers_activated
 * after the user sends 1 HIVE to dvpm.
 *
 * {
 *   memo: {
 *     offers_activated: {
 *       time_started: 1749513600,
 *       time_ended:   1749600000
 *     }
 *   }
 * }
 */
export const offersActivatedSchema = z.object({
  time_started: z.number().int().positive(),
  time_ended:   z.number().int().positive(),
});

export type OffersActivated = z.infer<typeof offersActivatedSchema>;

export const memoSchema = z.object({
  offers_activated: offersActivatedSchema.optional(),
});

export type MemoValues = z.infer<typeof memoSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Primitives
// ─────────────────────────────────────────────────────────────────────────────

/** A valid Hive username: 3–16 chars, lowercase letters/numbers/dots/hyphens. */
export const hiveUsernameSchema = z
  .string()
  .min(1, "Hive username is required.")
  .transform((val) => val.replace(/^@/, "").trim())
  .pipe(
    z
      .string()
      .min(3, "Username must be at least 3 characters.")
      .max(16, "Username must be 16 characters or fewer.")
      .regex(
        /^[a-z0-9.-]+$/,
        "Username may only contain lowercase letters, numbers, dots, and hyphens.",
      ),
  );

/** Optional URL — must be a valid URL when provided. */
const optionalUrl = z
  .string()
  .optional()
  .refine((val) => !val || z.string().url().safeParse(val).success, {
    message: "Must be a valid URL.",
  });

/** Optional Telegram handle — @handle or just handle. */
const telegramHandle = z
  .string()
  .optional()
  .refine(
    (val) => !val || /^@?[a-zA-Z0-9_]{5,32}$/.test(val),
    { message: "Must be a valid Telegram handle (e.g. @yourhandle)." },
  );

/** Optional Discord username — user#0000 or new format. */
const discordHandle = z
  .string()
  .optional()
  .refine(
    (val) => !val || /^.{2,32}(#[0-9]{4})?$/.test(val),
    { message: "Must be a valid Discord username." },
  );

// ─────────────────────────────────────────────────────────────────────────────
// Contacts
// ─────────────────────────────────────────────────────────────────────────────

export const contactsSchema = z.object({
  facebook:        optionalUrl,
  telegram:        telegramHandle,
  discord:         discordHandle,
  merchant_account: optionalUrl,
});

export type ContactsValues = z.infer<typeof contactsSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Offers — offers: { buy: OfferEntry[], sell: OfferEntry[] }
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single offer object stored in the buy or sell array.
 *
 * {
 *   price: number,          // rate per token in fiat
 *   limit: { min, max },    // order size limits in fiat
 *   token: string,          // token symbol e.g. "HIVE", "HBD"
 * }
 */
export const offerEntrySchema = z.object({
  /** Price per token expressed in fiat (e.g. PHP per HIVE) */
  price: z.number().positive(),
  /** Order size limits in fiat */
  limit: z.object({
    min: z.number().positive(),
    max: z.number().positive(),
  }),
  /** Token symbol e.g. "HIVE", "HBD", "DEC" */
  token: z.string().min(1).max(20),
  /**
   * Payment methods accepted for this offer — copied from top-level
   * payment_methods at the time the offer is written so it travels with it.
   */
  payment_methods: z.array(z.string()).default([]),
});

export type OfferEntry = z.infer<typeof offerEntrySchema>;

/**
 * Form schema for the Create Offer dialog.
 * price, limit.min, limit.max, token come from string inputs so we coerce them.
 */
export const offerFormSchema = z
  .object({
    side:      z.enum(["buy", "sell"]),
    token:     z.string().min(1, "Token is required.").max(20),
    price:     z.coerce.number().positive("Price must be positive."),
    limitMin:  z.coerce.number().positive("Min must be positive."),
    limitMax:  z.coerce.number().positive("Max must be positive."),
  })
  .refine((d) => d.limitMax > d.limitMin, {
    message: "Max limit must be greater than min limit.",
    path: ["limitMax"],
  });

export type OfferFormValues = z.infer<typeof offerFormSchema>;

/**
 * Top-level offers object: { buy: OfferEntry[], sell: OfferEntry[] }
 */
export const offersSchema = z.object({
  buy:  z.array(offerEntrySchema).default([]),
  sell: z.array(offerEntrySchema).default([]),
});

export type OffersValues = z.infer<typeof offersSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Payment methods — payment_methods: string[]
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A simple array of payment method labels.
 * e.g. ["GCash", "Bank Transfer", "Maya"]
 */
export const paymentMethodsSchema = z
  .array(z.string().min(1).max(50))
  .default([]);

export type PaymentMethodsValues = z.infer<typeof paymentMethodsSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Full posting_json_metadata shape
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Describes the complete top-level structure stored in posting_json_metadata:
 *
 * {
 *   profile:         { name, about, location, website, version }
 *   contact:         { facebook, telegram, whatsapp, discord }
 *   offers:          { buy: OfferEntry[], sell: OfferEntry[] }
 *   payment_methods: string[]
 * }
 */
export const postingMetaSchema = z.object({
  profile: z
    .object({
      name:     z.string().max(50).optional(),
      about:    z.string().max(160).optional(),
      location: z.string().max(100).optional(),
      website:  optionalUrl,
      version:  z.number().optional(),
    })
    .optional(),
  contact:         contactsSchema.optional(),
  offers:          offersSchema.optional(),
  payment_methods: paymentMethodsSchema.optional(),
  memo:            memoSchema.optional(),
});

export type PostingMeta = z.infer<typeof postingMetaSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  username: hiveUsernameSchema,
});

export type LoginFormValues = z.infer<typeof loginSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Account settings
// ─────────────────────────────────────────────────────────────────────────────

export const accountSettingsSchema = z.object({
  name: z
    .string()
    .max(50, "Name must be 50 characters or fewer.")
    .optional(),
  contacts: contactsSchema,
});

export type AccountSettingsValues = z.infer<typeof accountSettingsSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// P2P order
// ─────────────────────────────────────────────────────────────────────────────

export const p2pOrderSchema = z.object({
  phpAmount: z
    .string()
    .min(1, "Amount is required.")
    .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
      message: "Amount must be a positive number.",
    }),
  paymentMethod: z
    .string()
    .min(1, "Please select a payment method."),
});

export type P2POrderValues = z.infer<typeof p2pOrderSchema>;
