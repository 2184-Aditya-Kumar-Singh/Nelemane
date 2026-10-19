import { z } from "zod";

export const PG_FACILITIES = [
  "WiFi",
  "AC",
  "Hot water",
  "Laundry",
  "Meals included",
  "Power backup",
  "CCTV",
  "Housekeeping",
  "Parking",
  "Gym",
  "Lift",
  "RO water",
  "TV lounge",
  "Study room",
] as const;

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid upload reference");

export const ownerPhotoReferenceSchema = z.object({
  assetId: objectId.optional(),
  publicId: z.string().trim().min(1).max(500).optional(),
  caption: z.string().trim().max(240).optional(),
}).superRefine((photo, context) => {
  if (Boolean(photo.assetId) === Boolean(photo.publicId)) {
    context.addIssue({ code: "custom", message: "Choose one stored photo", path: ["assetId"] });
  }
});

export const ownerPgDetailsSchema = z.object({
  profilePhoto: ownerPhotoReferenceSchema.nullable().optional(),
  description: z.string().trim().max(2000),
  gender: z.enum(["BOYS", "GIRLS", "COED"]),
  facilities: z.array(z.enum(PG_FACILITIES)).max(PG_FACILITIES.length),
  customFacilities: z.array(z.string().trim().min(1).max(60)).max(20),
  houseRules: z.string().trim().max(4000),
  photos: z.array(ownerPhotoReferenceSchema).max(20),
  rentWindow: z.object({
    startDay: z.number().int().min(1).max(28),
    endDay: z.number().int().min(1).max(28),
  }).refine((window) => window.endDay >= window.startDay, {
    message: "Rent window end day must be on or after its start day",
    path: ["endDay"],
  }),
  reminder: z.object({
    enabled: z.boolean(),
    everyNDays: z.number().int().min(1).max(30),
    email: z.boolean(),
    sms: z.boolean(),
  }),
  isListed: z.boolean(),
});

export const ownerPaymentDetailsSchema = z.object({
  accountType: z.enum(["BUSINESS", "PERSONAL"]),
  qrAccounts: z.array(z.object({
    accountHolderName: z.string().trim().min(2).max(120),
    upiId: z.string().trim().max(100).regex(/^[\w.-]{2,64}@[a-zA-Z0-9.-]{2,64}$/, "Enter a valid UPI ID"),
    qrImage: ownerPhotoReferenceSchema,
  })).max(5),
  bank: z.object({
    accountHolderName: z.string().trim().min(2).max(120),
    bankName: z.string().trim().min(2).max(120),
    accountNumber: z.string().trim().regex(/^\d{9,18}$/, "Enter a valid bank account number"),
    ifsc: z.string().trim().toUpperCase().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Enter a valid IFSC code"),
    branch: z.string().trim().max(120).optional().or(z.literal("")),
  }).nullable().optional(),
  instructions: z.string().trim().max(1000).optional().or(z.literal("")),
}).superRefine((details, context) => {
  if (!details.qrAccounts.length && !details.bank) {
    context.addIssue({ code: "custom", path: ["qrAccounts"], message: "Add a QR account or bank details" });
  }
  if (details.accountType === "PERSONAL" && !details.qrAccounts.length) {
    context.addIssue({ code: "custom", path: ["qrAccounts"], message: "Personal accounts require a QR image" });
  }
});

export const roomTypeInputSchema = z.object({
  name: z.string().trim().min(2).max(100),
  sharing: z.number().int().min(1).max(6),
  ac: z.boolean(),
  attachedBath: z.boolean(),
  rentPaise: z.number().int().min(0).max(100_000_000),
  depositPaise: z.number().int().min(0).max(1_000_000_000),
  description: z.string().trim().max(1000),
  amenities: z.array(z.string().trim().min(1).max(60)).max(20),
  photos: z.array(ownerPhotoReferenceSchema).max(8),
});

export const roomInputSchema = z.object({
  roomTypeId: objectId,
  roomNumber: z.string().trim().min(1).max(30),
  floor: z.string().trim().min(1).max(40),
  block: z.string().trim().max(60).optional().or(z.literal("")),
  capacity: z.number().int().min(1).max(50),
});
