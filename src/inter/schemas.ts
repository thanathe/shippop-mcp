import { z } from "zod";

export const InterOriginAddressSchema = z
  .object({
    name: z.string().min(1).max(50).describe("Sender full name (1-50 chars)"),
    company: z.string().optional(),
    taxpayer_id: z.string().optional().describe("Tax ID (13 digits)"),
    phone: z.string().min(1).describe("Phone with country code, e.g. +66-812345678"),
    email: z.string().optional().describe("Contact email. Required by SHIPPOP for the sender — defaults to the account email when omitted."),
    address: z.string().min(1).max(50).describe("Address line 1 (max 50 chars, English)"),
    address2: z.string().max(50).optional(),
    address3: z.string().max(50).optional(),
    state: z.string().min(1).describe("District / state, e.g. Phayathai"),
    city: z.string().min(1).describe("City / province, e.g. Bangkok"),
    postcode: z.string().min(1),
  })
  .describe("Sender address in Thailand, in English");

export const InterDestinationAddressSchema = InterOriginAddressSchema.extend({
  country_code: z.string().length(2).describe("Destination country, ISO alpha-2 (e.g. US, JP, TW)"),
}).describe("Receiver address abroad, in English");

export const InterGoodsSchema = z.object({
  name: z.string().min(1).describe("Item description for customs (English)"),
  pieces: z.number().int().positive(),
  weight: z.number().int().positive().describe("Weight per line in GRAMS"),
  price: z.number().nonnegative().describe("Declared value"),
  currency: z.string().default("THB"),
  sku_number: z.string().optional(),
  hs_code: z.string().optional().describe("Customs HS code"),
  manufacturer_country_code: z.string().length(2).describe("Country of manufacture, ISO alpha-2"),
});

export const InterShipmentSchema = z.object({
  type: z.enum(["parcel", "document"]).default("parcel"),
  width: z.number().int().positive().describe("cm"),
  length: z.number().int().positive().describe("cm"),
  height: z.number().int().positive().describe("cm"),
  total_weight: z.number().int().positive().describe("Total weight incl. packaging, in GRAMS"),
  remark: z.string().optional(),
  require_coverage: z.boolean().default(false).describe("Buy the courier's extra insurance coverage"),
  origin_address: InterOriginAddressSchema,
  destination_address: InterDestinationAddressSchema,
  goods: z.array(InterGoodsSchema).min(1).describe("Customs declaration lines"),
});

export const INTER_COURIER_REFS: Record<string, string> = {
  CRARMPPX: "Aramex PPX — priority parcel (pickup at door only)",
  CRARMEPX: "Aramex EPX — economy parcel (pickup at door only)",
  CRARMPDX: "Aramex PDX — priority document (pickup at door only)",
  CRTPEP: "Thai Post ePacket — economy (drop at post office, ~50 branches)",
  CRTPEWD: "Thai Post EMS World — document (pickup or drop at post office)",
  CRTPEWP: "Thai Post EMS World — package (pickup or drop at post office)",
};
