import { z } from "zod";

export const AddressSchema = z
  .object({
    name: z.string().min(1).describe("Contact person name"),
    address: z.string().min(1).describe("Street address line (house no., building, soi, road)"),
    district: z.string().min(1).describe("Sub-district: แขวง (Bangkok) / ตำบล (provinces)"),
    state: z.string().min(1).describe("District: เขต (Bangkok) / อำเภอ (provinces)"),
    province: z.string().min(1).describe("Province, e.g. กรุงเทพมหานคร"),
    postcode: z.string().regex(/^\d{5}$/).describe("5-digit Thai postcode"),
    tel: z.string().min(1).describe("Phone number, e.g. 0812345678"),
    email: z.string().optional().describe("Contact email (optional)"),
    lat: z.string().optional().describe("Latitude as string — required for on-demand couriers (LLM, SKT)"),
    lng: z.string().optional().describe("Longitude as string — required for on-demand couriers (LLM, SKT)"),
  })
  .describe("Thai postal address as SHIPPOP expects it");

export const ParcelSchema = z
  .object({
    name: z.string().default("-").describe("Parcel description (free text)"),
    weight: z.number().positive().describe("Weight in GRAMS (1 kg = 1000)"),
    width: z.number().positive().describe("Width in cm"),
    length: z.number().positive().describe("Length in cm"),
    height: z.number().positive().describe("Height in cm"),
  })
  .describe("Physical parcel dimensions. Weight in grams, sizes in cm.");

export const ProductSchema = z
  .object({
    product_code: z.string().describe("Your product code / SKU"),
    name: z.string().describe("Product name"),
    category: z.string().describe("Product category"),
    detail: z.string().optional().describe("Product detail"),
    price: z.number().nonnegative().describe("Unit price (THB)"),
    amount: z.number().int().positive().describe("Quantity"),
    weight: z.number().nonnegative().describe("Unit weight in grams"),
    size: z.string().optional(),
    color: z.string().optional(),
  })
  .describe("Product line inside the parcel. Required by SHIPPOP for COD shipments.");

export const PriceRequestShipmentSchema = z.object({
  from: AddressSchema,
  to: AddressSchema,
  parcel: ParcelSchema,
  courier_code: z.string().optional().describe("Restrict the quote to one courier code (e.g. FLE, EMST). Omit to quote every courier on hand."),
  cod_amount: z.number().nonnegative().optional().describe("COD amount in THB, if cash on delivery"),
});

export const BookingShipmentSchema = z.object({
  from: AddressSchema,
  to: AddressSchema,
  parcel: ParcelSchema,
  courier_code: z.string().min(1).describe("Courier code to book with (get it from shippop_check_price)"),
  products: z.array(ProductSchema).optional().describe("Line items — shown on the label when showproduct=1"),
  remark: z.string().optional(),
  cod_amount: z.number().nonnegative().optional().describe("COD amount in THB"),
  insurance_code: z.enum(["DHPY", "THP"]).optional().describe("DHPY = Dhipaya insurance (all couriers), THP = Thailand Post insurance (Thailand Post only)"),
  declared_value: z.number().nonnegative().optional().describe("Declared value for insurance (THB)"),
  branch_id: z.string().optional().describe("Kerry Offline branch id (required for KRYS)"),
  starttime: z.string().optional().describe("Pickup window start (on-demand couriers only)"),
  finishtime: z.string().optional().describe("Pickup window end (on-demand couriers only)"),
  ref_no_1: z.string().optional().describe("Your reference no. 1 (stored in meta)"),
  ref_no_2: z.string().optional().describe("Your reference no. 2 (stored in meta)"),
});

export const LabelSizeSchema = z.enum([
  "A4",
  "A5",
  "A6",
  "letter",
  "letter4x6",
  "sticker",
  "sticker4x6",
  "sticker100x75",
  "paperang",
]);

export type Address = z.infer<typeof AddressSchema>;
export type Parcel = z.infer<typeof ParcelSchema>;
export type BookingShipment = z.infer<typeof BookingShipmentSchema>;
