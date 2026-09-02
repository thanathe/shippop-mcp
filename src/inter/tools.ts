import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { InterApiError, InterClient } from "./client.js";
import { InterShipmentSchema, INTER_COURIER_REFS } from "./schemas.js";
import { ShippopNetworkError, ShippopTimeoutError } from "../client.js";
import { ok, fail } from "../result.js";

function interGuard<A>(env: string, fn: (args: A) => Promise<CallToolResult>): (args: A) => Promise<CallToolResult> {
  return async (args) => {
    try {
      return await fn(args);
    } catch (err) {
      if (err instanceof InterApiError) {
        const raw = err.raw as { payload?: { fields?: string[] } } | undefined;
        return fail({
          error: "shippop_inter_api_error",
          environment: env,
          endpoint: err.endpoint,
          http_status: err.httpStatus,
          code: err.code,
          message: err.message,
          invalid_fields: raw?.payload?.fields,
          raw: err.raw,
        });
      }
      if (err instanceof ShippopTimeoutError || err instanceof ShippopNetworkError) {
        return fail({
          error: err instanceof ShippopTimeoutError ? "shippop_timeout" : "shippop_network_error",
          environment: env,
          endpoint: err.endpoint,
          message: err.message,
          note: "SHIPPOP Inter may or may not have processed this request. Check state with a read-only tool before retrying anything that creates or pays.",
        });
      }
      return fail({ error: "internal_error", environment: env, message: err instanceof Error ? err.message : String(err) });
    }
  };
}

interface Country {
  id: number;
  text: string;
  alpha_2_code: string;
  alpha_3_code?: string;
  calling_code?: string;
  destination_supported?: boolean;
  manufacturer_supported?: boolean;
}

interface InterCourierPrice {
  id: number;
  name: string;
  price?: string | number;
  duration?: string | number;
  ref?: string;
  code?: string;
  type?: string;
  condition?: unknown;
  tos?: string;
  error_code?: string | null;
}

type InterShipmentInput = z.infer<typeof InterShipmentSchema>;

/** SHIPPOP Inter rejects shipments without a sender email (undocumented); fall back to the account email. */
function withDefaults(shipment: InterShipmentInput, accountEmail: string): InterShipmentInput {
  return {
    ...shipment,
    origin_address: { ...shipment.origin_address, email: shipment.origin_address.email ?? accountEmail },
  };
}

export function registerInterTools(server: McpServer, client: InterClient, env: string, accountEmail: string) {
  server.registerTool(
    "shippop_inter_list_countries",
    {
      title: "Crossborder: list countries",
      description:
        "List countries known to SHIPPOP Inter (crossborder) with ISO codes and whether each is supported as a destination and/or as a country of manufacture. Use it to find country_code values.",
      inputSchema: {
        destination_only: z.boolean().default(true).describe("Only return countries SHIPPOP can ship to"),
        search: z.string().optional().describe("Case-insensitive filter on country name or ISO code"),
      },
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    },
    interGuard(env, async ({ destination_only, search }) => {
      const res = await client.request<{ countries?: Country[] }>("GET", "/api/public/country", undefined, { sort: "text:asc" });
      let list = res.countries ?? [];
      if (destination_only) list = list.filter((c) => c.destination_supported);
      if (search) {
        const q = search.toLowerCase();
        list = list.filter((c) => c.text.toLowerCase().includes(q) || c.alpha_2_code.toLowerCase() === q || c.alpha_3_code?.toLowerCase() === q);
      }
      return ok({
        environment: env,
        count: list.length,
        countries: list.map((c) => ({ country_code: c.alpha_2_code, name: c.text, calling_code: c.calling_code, destination_supported: c.destination_supported, manufacturer_supported: c.manufacturer_supported })),
      });
    }),
  );

  server.registerTool(
    "shippop_inter_check_price",
    {
      title: "Crossborder: check price",
      description:
        "Quote international shipping from Thailand for a parcel of a given weight to a destination country, across SHIPPOP Inter couriers (Aramex, Thai Post EMS World / ePacket). No side effects. Returns courier_ref values needed for creating an order.",
      inputSchema: {
        weight: z.number().int().positive().describe("Total weight in GRAMS"),
        country_code: z.string().length(2).describe("Destination country ISO alpha-2, e.g. JP"),
      },
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    },
    interGuard(env, async ({ weight, country_code }) => {
      const res = await client.request<{ couriers?: InterCourierPrice[] }>("POST", "/api/public/courier/price", { weight, country_code: country_code.toUpperCase(), show_all: true });
      const couriers = (res.couriers ?? [])
        .map((c) => ({
          courier_ref: c.ref,
          courier_code: c.code,
          name: c.name,
          description: c.ref ? INTER_COURIER_REFS[c.ref] : undefined,
          price: c.price !== undefined && c.price !== null ? Number(c.price) : undefined,
          duration_days: c.duration,
          service_type: c.type,
          available: !c.error_code,
          error_code: c.error_code ?? undefined,
          condition: c.condition,
          terms: c.tos,
        }))
        .sort((a, b) => (a.available === b.available ? (a.price ?? Infinity) - (b.price ?? Infinity) : a.available ? -1 : 1));
      return ok({ environment: env, weight_g: weight, country_code: country_code.toUpperCase(), couriers });
    }),
  );

  server.registerTool(
    "shippop_inter_get_coverages",
    {
      title: "Crossborder: insurance coverages for a courier",
      description: "List the optional insurance coverages (coverage_ref, price, terms) offered for a courier_ref. Use a coverage_ref in shippop_inter_create_order when the shipment has require_coverage=true.",
      inputSchema: { courier_ref: z.string().min(1).describe("e.g. CRARMPPX, CRTPEWP") },
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    },
    interGuard(env, async ({ courier_ref }) => {
      const res = await client.request<{ coverages?: unknown[] }>("GET", `/api/platform/coverage/courier/${encodeURIComponent(courier_ref)}`);
      return ok({ environment: env, courier_ref, coverages: res.coverages ?? [] });
    }),
  );

  server.registerTool(
    "shippop_inter_create_shipments",
    {
      title: "Crossborder: create shipments (draft)",
      description:
        "Create one or more international shipment drafts (customs declaration included). Returns an INTxxxx tracking code per shipment. Nothing is booked or charged yet — shipments become an order via shippop_inter_create_order. " +
        "Addresses must be in English; weights in grams; every shipment needs at least one goods line with manufacturer_country_code.",
      inputSchema: { shipments: z.array(InterShipmentSchema).min(1).max(50) },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    interGuard(env, async ({ shipments }) => {
      const res = await client.request<{ shipments?: { tracking_code: string }[] }>("POST", "/api/platform/shipment/many", {
        shipments: shipments.map((s) => withDefaults(s, accountEmail)),
      });
      const codes = (res.shipments ?? []).map((s) => s.tracking_code);
      return ok({
        environment: env,
        tracking_codes: codes,
        next_step: `Call shippop_inter_calculate_order with these tracking codes and a courier_ref (from shippop_inter_check_price) to get the exact total, show it to the user, then shippop_inter_create_order.`,
      });
    }),
  );

  server.registerTool(
    "shippop_inter_list_shipments",
    {
      title: "Crossborder: list my shipments",
      description:
        "List this account's crossborder shipments (drafts and ordered) with status, destination, goods declaration and HS codes. " +
        "Useful to find existing drafts before creating new ones, or to reuse a past goods declaration. (Undocumented endpoint, verified live.)",
      inputSchema: {
        page: z.number().int().positive().default(1),
        limit: z.number().int().positive().max(200).default(50),
      },
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    },
    interGuard(env, async ({ page, limit }) => {
      const res = await client.request<{ shipments?: any[]; total_shipment_amount?: number }>("GET", "/api/platform/shipment", undefined, { page, limit });
      const shipments = (res.shipments ?? []).map((s) => ({
        tracking_code: s.tracking_code,
        status: s.status,
        type: s.type,
        total_weight_g: s.total_weight,
        dimensions_cm: { width: s.width, length: s.length, height: s.height },
        taxpayer: s.taxpayer,
        require_coverage: s.require_coverage,
        destination: s.destination_address ? { name: s.destination_address.name, city: s.destination_address.city, postcode: s.destination_address.postcode, country_id: s.destination_address.country_id } : undefined,
        goods: (s.goods ?? []).map((g: any) => ({ name: g.name, pieces: g.pieces, weight_g: g.weight, price: g.price, currency: g.currency, hs_code: g.hs_code || undefined, sku_number: g.sku_number || undefined })),
        order: s.order_item ?? null,
      }));
      return ok({ environment: env, page, limit, total: res.total_shipment_amount, shipments });
    }),
  );

  server.registerTool(
    "shippop_inter_update_shipment",
    {
      title: "Crossborder: update a draft shipment",
      description: "Replace the details of a draft shipment (before it is ordered) by INT tracking code. Send the full shipment object.",
      inputSchema: { tracking_code: z.string().min(1), shipment: InterShipmentSchema },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    interGuard(env, async ({ tracking_code, shipment }) => {
      await client.request("PUT", `/api/platform/shipment/${encodeURIComponent(tracking_code)}`, { shipment: withDefaults(shipment, accountEmail) });
      return ok({ environment: env, tracking_code, updated: true });
    }),
  );

  server.registerTool(
    "shippop_inter_calculate_order",
    {
      title: "Crossborder: calculate order total",
      description: "Price summary for specific draft shipments with a chosen courier_ref (and optional coverage_ref / coupon_code) — the exact amount the user will pay. No side effects.",
      inputSchema: {
        tracking_codes: z.array(z.string()).min(1).describe("INTxxxx codes from shippop_inter_create_shipments"),
        courier_ref: z.string().min(1),
        coverage_ref: z.string().optional(),
        coupon_code: z.string().optional(),
      },
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    },
    interGuard(env, async ({ tracking_codes, courier_ref, coverage_ref, coupon_code }) => {
      const res = await client.request<{ order?: unknown }>("POST", "/api/platform/order/calculate", { tracking_codes, courier_ref, coverage_ref: coverage_ref ?? "", coupon_code: coupon_code ?? "" });
      return ok({ environment: env, ...(res as object) });
    }),
  );

  server.registerTool(
    "shippop_inter_create_order",
    {
      title: "Crossborder: create order (leads to payment)",
      description:
        "Turn draft shipments into an order with a courier. With payment_method=cash (default) SHIPPOP returns a payment_url the user must open and pay — nothing ships until paid. " +
        "payment_method=credit_term is only for business accounts and CONFIRMS IMMEDIATELY without a payment step (irreversible) — use only if the user explicitly asks. " +
        "After payment, shipments cannot be edited or cancelled. Only call after the user has agreed to the total from shippop_inter_calculate_order.",
      inputSchema: {
        tracking_codes: z.array(z.string()).min(1),
        courier_ref: z.string().min(1),
        coverage_ref: z.string().optional(),
        courier_service_type: z.enum(["pick_up", "drop_off"]).optional().describe("Pickup at door or drop at courier office — options depend on courier"),
        coupon_code: z.string().optional(),
        payment_method: z.enum(["cash", "credit_term"]).default("cash"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    interGuard(env, async ({ tracking_codes, courier_ref, coverage_ref, courier_service_type, coupon_code, payment_method }) => {
      const body: Record<string, unknown> = {
        tracking_codes,
        courier_ref,
        coverage_ref: coverage_ref ?? "",
        coupon_code: coupon_code ?? "",
        accept_term_and_policy_date: new Date().toISOString(),
        payment_method,
      };
      if (courier_service_type) body.courier_service_type = courier_service_type;
      const res = await client.request<{ order_number?: string; payment_url?: string }>("POST", "/api/platform/order", body);
      return ok({
        environment: env,
        order_number: res.order_number,
        payment_url: res.payment_url,
        tracking_codes,
        next_step: res.payment_url
          ? `Give the user this payment_url to pay; shipments are dispatched after payment. Then shippop_inter_get_labels with order_number ${res.order_number}.`
          : `Order ${res.order_number} confirmed on credit term. Call shippop_inter_get_labels to print the labels (and commercial invoice for Aramex).`,
      });
    }),
  );

  server.registerTool(
    "shippop_inter_get_labels",
    {
      title: "Crossborder: get label download URL",
      description: "Get a download URL for the labels (and commercial invoice for Aramex) of an order or specific tracking codes. The URL is valid for 10 minutes.",
      inputSchema: {
        order_number: z.string().optional(),
        tracking_codes: z.array(z.string()).optional(),
      },
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    },
    interGuard(env, async ({ order_number, tracking_codes }) => {
      if (!order_number && !tracking_codes?.length) throw new Error("Provide order_number or tracking_codes");
      const body: Record<string, unknown> = {};
      if (order_number) body.order_number = order_number;
      if (tracking_codes?.length) body.tracking_codes = tracking_codes;
      const res = await client.request<{ label_url?: string }>("POST", "/api/platform/order/labels", body);
      return ok({ environment: env, label_url: res.label_url, note: "Download within 10 minutes; the link expires." });
    }),
  );

  server.registerTool(
    "shippop_inter_track_shipment",
    {
      title: "Crossborder: track shipment",
      description: "Tracking events for an international shipment, by INT tracking code or the courier's tracking number.",
      inputSchema: { tracking_number: z.string().min(1) },
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    },
    interGuard(env, async ({ tracking_number }) => {
      let res: { tracking_data?: { trackings?: any[] } };
      try {
        res = await client.request("GET", `/api/public/tracking/detail/${encodeURIComponent(tracking_number)}`);
      } catch (err) {
        // Verified live: a draft INT shipment that has not been ordered/paid yet is rejected as "Invalid input: tracking_number".
        if (err instanceof InterApiError && err.code === "invalidInput" && /^INT/i.test(tracking_number)) {
          return fail({
            error: "shippop_inter_api_error",
            environment: env,
            code: err.code,
            message: err.message,
            note: `${tracking_number} has no tracking yet — SHIPPOP Inter only tracks shipments after their order is paid. Check the order/payment status first.`,
          });
        }
        throw err;
      }
      const events = (res.tracking_data?.trackings ?? []).map((t) => ({
        occurred_at: t.occurred_date,
        status: t.tracking?.name,
        courier_message: t.tracking?.courier_message,
        location: t.value,
        pending: t.shipment_pending ?? undefined,
      }));
      return ok({ environment: env, tracking_number, latest_event: events[events.length - 1], events });
    }),
  );

  server.registerTool(
    "shippop_inter_delete_shipments",
    {
      title: "Crossborder: delete draft shipments",
      description: "Delete draft shipments that have not been ordered/paid, by INT tracking code.",
      inputSchema: { tracking_codes: z.array(z.string()).min(1) },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    interGuard(env, async ({ tracking_codes }) => {
      await client.request("DELETE", "/api/platform/shipment", { tracking_codes });
      return ok({ environment: env, deleted: tracking_codes });
    }),
  );
}
