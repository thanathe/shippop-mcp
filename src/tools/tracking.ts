import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ShippopClient, ShippopApiError, ShippopNetworkError, ShippopTimeoutError, toArray } from "../client.js";
import { ORDER_STATUS } from "../errors.js";
import { guard, ok } from "../result.js";

interface TrackingState {
  status?: string;
  datetime?: string;
  location?: string;
  description?: string;
  latlong?: string;
}

interface TrackingResponse {
  status: boolean;
  code?: number | string;
  message?: string;
  order_status?: string;
  order_cancel_detail?: string;
  courier_code?: string;
  tracking_code?: string;
  courier_tracking_code?: string;
  state?: unknown;
  states?: unknown;
  price?: number | string;
  fuel_surcharge?: number | string;
  remote_surcharge?: number | string;
  travel_surcharge?: number | string;
  sms_surcharge?: number | string;
}

export async function trackShipment(client: ShippopClient, trackingCode: string) {
  const res = await client.post<TrackingResponse>("/tracking/", { tracking_code: trackingCode }, { withApiKey: false });
  const events = toArray<TrackingState>(res.state ?? res.states).map((e) => ({
    status_code: e.status,
    datetime: e.datetime,
    location: e.location,
    description: e.description,
    latlong: e.latlong,
  }));
  return {
    tracking_code: res.tracking_code ?? trackingCode,
    courier_code: res.courier_code,
    courier_tracking_code: res.courier_tracking_code || null,
    order_status: res.order_status,
    order_status_meaning: res.order_status ? ORDER_STATUS[res.order_status] : undefined,
    order_cancel_detail: res.order_cancel_detail || undefined,
    price: res.price !== undefined ? Number(res.price) : undefined,
    surcharges: {
      fuel: res.fuel_surcharge,
      remote_area: res.remote_surcharge,
      travel_area: res.travel_surcharge,
      sms: res.sms_surcharge,
    },
    latest_event: events[events.length - 1],
    events,
  };
}

export function registerTrackingTools(server: McpServer, client: ShippopClient) {
  server.registerTool(
    "shippop_track_shipment",
    {
      title: "Track shipment",
      description:
        "Track one or more shipments by SHIPPOP tracking code (SPxxxxxxxxx). Returns order_status, the courier tracking code (once the courier has assigned it), and the ordered list of courier tracking events. " +
        "Use this after confirm to obtain courier tracking codes that were still pending.",
      inputSchema: {
        tracking_codes: z.array(z.string().regex(/^SP\w+$/i, "must be a SHIPPOP tracking code starting with SP")).min(1).max(20),
      },
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    },
    guard(client.env, async ({ tracking_codes }) => {
      const results = await Promise.all(
        tracking_codes.map(async (code) => {
          try {
            return await trackShipment(client, code);
          } catch (err) {
            if (err instanceof ShippopApiError || err instanceof ShippopTimeoutError || err instanceof ShippopNetworkError) {
              return { tracking_code: code, error: err.message };
            }
            throw err;
          }
        }),
      );
      return ok({ environment: client.env, shipments: results });
    }),
  );
}
