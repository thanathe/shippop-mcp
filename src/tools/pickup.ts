import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ShippopClient } from "../client.js";
import { guard, ok, fail } from "../result.js";

interface PickupResponse {
  status: boolean;
  code?: number | string;
  message?: string;
  courier_ticket_id?: string | number;
  courier_pickup_id?: number;
  data?: unknown;
}

interface PickupListResponse {
  status: boolean;
  code?: number | string;
  message?: string;
  data?: {
    items?: unknown[];
    pages?: number;
    page?: number;
    perpage?: number;
    total?: number | string;
  };
}

/** "YYYY-MM-DD HH:mm:ss" in Asia/Bangkok, the format SHIPPOP's created_at filter expects. */
function formatBangkok(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

export function registerPickupTools(server: McpServer, client: ShippopClient) {
  server.registerTool(
    "shippop_request_pickup",
    {
      title: "Request courier pickup",
      description:
        "Ask the courier to come and collect a CONFIRMED shipment from the sender's address. Takes the COURIER tracking code. " +
        "Thailand Post EMS requires datetime_pickup (before 11:00 → same day 13:00; after 11:00 → next day 09:00). Flash Express accepts an optional staff_info_id. " +
        "Origin overrides default to the address used at booking.",
      inputSchema: {
        courier_tracking_code: z.string().min(1).describe("Courier tracking code — NOT the SPxxxx code"),
        num_of_parcel: z.number().int().positive().default(1).describe("How many parcels to collect"),
        datetime_pickup: z.string().optional().describe("Appointment time for Thailand Post, e.g. 2026-09-03 09:00:00"),
        staff_info_id: z.string().optional().describe("Flash Express: preferred courier staff id"),
        origin: z
          .object({
            name: z.string().optional(),
            phone: z.string().optional(),
            address: z.string().optional(),
            district: z.string().optional().describe("แขวง/ตำบล"),
            city: z.string().optional().describe("เขต/อำเภอ"),
            province: z.string().optional(),
            postcode: z.string().optional(),
          })
          .optional()
          .describe("Override the pickup address (defaults to the booking's sender address)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    guard(client.env, async ({ courier_tracking_code, num_of_parcel, datetime_pickup, staff_info_id, origin }) => {
      if (/^SP\d+$/i.test(courier_tracking_code)) {
        return fail({
          error: "wrong_code_type",
          environment: client.env,
          message: `${courier_tracking_code} is a SHIPPOP tracking code. Pickup needs the courier tracking code — call shippop_track_shipment to look it up.`,
        });
      }
      const body: Record<string, unknown> = { tracking_code: courier_tracking_code, num_of_parcel };
      if (datetime_pickup) body.datetime_pickup = datetime_pickup;
      if (staff_info_id) body.staff_info_id = staff_info_id;
      if (origin) {
        for (const [k, v] of Object.entries(origin)) if (v) body[`origin_${k}`] = v;
      }
      const res = await client.post<PickupResponse>("/calltopickup/", body);
      return ok({
        environment: client.env,
        courier_tracking_code,
        courier_ticket_id: res.courier_ticket_id,
        courier_pickup_id: res.courier_pickup_id,
        courier_response: res.data,
      });
    }),
  );

  server.registerTool(
    "shippop_list_pickups",
    {
      title: "List pickup requests",
      description:
        "List pickup requests made for this account, with courier staff details and state. Filter by date range, courier, origin or pickup ids. " +
        "SHIPPOP returns oldest-first with no sort option, so when no filter is given this defaults to the last 30 days; pass created_from/created_to for other ranges.",
      inputSchema: {
        page: z.number().int().positive().default(1),
        perpage: z.number().int().positive().max(100).default(25),
        created_from: z.string().optional().describe("Start datetime, e.g. 2026-09-01 00:00:00"),
        created_to: z.string().optional().describe("End datetime, e.g. 2026-09-01 23:59:59"),
        courier_codes: z.array(z.string()).optional(),
        origin_ids: z.array(z.number().int()).optional().describe("origin_id values from booking responses"),
        courier_pickup_ids: z.array(z.number().int()).optional(),
        courier_ticket_pickup_ids: z.array(z.number().int()).optional(),
      },
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    },
    guard(client.env, async ({ page, perpage, created_from, created_to, courier_codes, origin_ids, courier_pickup_ids, courier_ticket_pickup_ids }) => {
      const body: Record<string, unknown> = { page, perpage };
      const hasFilter = created_from || created_to || courier_codes?.length || origin_ids?.length || courier_pickup_ids?.length || courier_ticket_pickup_ids?.length;
      let window: { start?: string; end?: string } | undefined;
      if (created_from || created_to) window = { start: created_from, end: created_to };
      else if (!hasFilter) {
        // Verified live: an unfiltered call walks the whole history oldest-first (1,800+ rows, ~14 s) — not useful to an agent.
        const end = new Date();
        const start = new Date(end.getTime() - 30 * 24 * 3600 * 1000);
        window = { start: formatBangkok(start), end: formatBangkok(end) };
      }
      if (window) body.created_at = window;
      if (courier_codes?.length) body.courier_codes = courier_codes;
      if (origin_ids?.length) body.origin_ids = origin_ids;
      if (courier_pickup_ids?.length) body.courier_pickup_ids = courier_pickup_ids;
      if (courier_ticket_pickup_ids?.length) body.courier_ticket_pickup_ids = courier_ticket_pickup_ids;
      const res = await client.post<PickupListResponse>("/pickup/", body, { timeoutMs: 45_000 });
      return ok({
        environment: client.env,
        created_at_filter: window,
        page: res.data?.page ?? page,
        pages: res.data?.pages,
        total: res.data?.total !== undefined ? Number(res.data.total) : undefined,
        items: res.data?.items ?? [],
      });
    }),
  );
}
