import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ShippopClient, toArray } from "../client.js";
import { AddressSchema, ParcelSchema, PriceRequestShipmentSchema } from "../schemas.js";
import { COURIER_BY_CODE } from "../couriers.js";
import { describeErrorCode } from "../errors.js";
import { guard, ok } from "../result.js";

interface CourierQuote {
  courier_code: string;
  courier_name?: string;
  price?: string | number;
  available?: boolean;
  estimate_time?: string;
  err_code?: string;
  error_code?: string;
  remark?: string;
  notice?: string;
  price_cod?: number;
  price_cod_vat?: number;
  price_fuel_surcharge?: number;
  price_remote_area?: number;
  price_travel_area?: number;
  price_island_area?: number;
  price_zone?: string;
}

interface PriceResponse {
  status: boolean;
  data?: unknown;
}

function normaliseQuote(q: CourierQuote) {
  const errCode = q.err_code ?? q.error_code;
  const meaningfulErr = errCode && errCode !== "ERR_DEFAULT" ? errCode : q.available ? undefined : errCode;
  return {
    courier_code: q.courier_code,
    courier_name: q.courier_name ?? COURIER_BY_CODE[q.courier_code]?.name,
    available: q.available === true,
    price: q.price !== undefined ? Number(q.price) : undefined,
    estimate_time: q.estimate_time,
    surcharges: {
      fuel: q.price_fuel_surcharge,
      remote_area: q.price_remote_area,
      travel_area: q.price_travel_area,
      island_area: q.price_island_area,
    },
    cod_charge: q.price_cod,
    cod_charge_vat: q.price_cod_vat,
    price_zone: q.price_zone,
    remark: q.remark,
    notice: q.notice,
    error_code: meaningfulErr,
    error_meaning: describeErrorCode(meaningfulErr),
    note: COURIER_BY_CODE[q.courier_code]?.note,
  };
}

/** Turn the per-shipment `{ FLE: {...}, EMST: {...} }` map into a price-sorted list. */
function quotesForShipment(entry: unknown) {
  const quotes = Object.values((entry ?? {}) as Record<string, CourierQuote>).map(normaliseQuote);
  return quotes.sort((a, b) => {
    if (a.available !== b.available) return a.available ? -1 : 1;
    return (a.price ?? Infinity) - (b.price ?? Infinity);
  });
}

export async function checkPrice(client: ShippopClient, shipments: z.infer<typeof PriceRequestShipmentSchema>[], showall: boolean) {
  const data: Record<string, unknown> = {};
  shipments.forEach((s, i) => {
    data[String(i)] = { ...s, showall: showall ? 1 : 0 };
  });
  const res = await client.post<PriceResponse>("/pricelist/", { data });
  return toArray<unknown>(res.data).map(quotesForShipment);
}

const SAMPLE_FROM = {
  name: "Sample sender",
  address: "1/1",
  district: "แขวงห้วยขวาง",
  state: "เขตห้วยขวาง",
  province: "กรุงเทพมหานคร",
  postcode: "10310",
  tel: "0800000000",
};
const SAMPLE_TO = {
  name: "Sample receiver",
  address: "2/2",
  district: "สีลม",
  state: "บางรัก",
  province: "กรุงเทพมหานคร",
  postcode: "10500",
  tel: "0800000000",
};
const SAMPLE_PARCEL = { name: "-", weight: 1000, width: 20, length: 20, height: 20 };

export function registerPricingTools(server: McpServer, client: ShippopClient) {
  server.registerTool(
    "shippop_list_couriers",
    {
      title: "List couriers on hand",
      description:
        "List the couriers enabled for this SHIPPOP account (\"couriers on hand\") with their codes, names and availability. " +
        "Uses a sample Bangkok→Bangkok 1 kg parcel unless you pass from/to/parcel; the price shown is for that route only — use shippop_check_price for a real quote. " +
        "Call this first when you need a courier_code.",
      inputSchema: {
        from: AddressSchema.optional(),
        to: AddressSchema.optional(),
        parcel: ParcelSchema.optional(),
      },
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    },
    guard(client.env, async ({ from, to, parcel }) => {
      const shipment = { from: from ?? SAMPLE_FROM, to: to ?? SAMPLE_TO, parcel: parcel ?? SAMPLE_PARCEL };
      const [quotes = []] = await checkPrice(client, [shipment], true);
      return ok({
        environment: client.env,
        sample_route: `${shipment.from.postcode} → ${shipment.to.postcode}, ${shipment.parcel.weight} g`,
        couriers: quotes.map((q) => ({
          courier_code: q.courier_code,
          courier_name: q.courier_name,
          available_for_sample_route: q.available,
          sample_price: q.price,
          estimate_time: q.estimate_time,
          error_code: q.error_code,
          error_meaning: q.error_meaning,
          note: q.note,
        })),
      });
    }),
  );

  server.registerTool(
    "shippop_check_price",
    {
      title: "Check shipping price",
      description:
        "Quote shipping prices for one or more prospective shipments across the account's couriers. No side effects. " +
        "Each shipment needs from/to addresses and parcel dimensions (weight in GRAMS). " +
        "Returns per-shipment quotes sorted cheapest-first with availability and any courier error codes. Always do this before shippop_create_booking.",
      inputSchema: {
        shipments: z.array(PriceRequestShipmentSchema).min(1).max(50),
        showall: z
          .boolean()
          .default(false)
          .describe("true = include couriers that are NOT available for this route (with the reason); false = only available ones"),
      },
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    },
    guard(client.env, async ({ shipments, showall }) => {
      const results = await checkPrice(client, shipments, showall);
      return ok({
        environment: client.env,
        shipments: results.map((quotes, i) => ({
          index: i,
          route: `${shipments[i].from.postcode} → ${shipments[i].to.postcode}`,
          cheapest_available: quotes.find((q) => q.available)?.courier_code ?? null,
          quotes,
        })),
      });
    }),
  );
}
