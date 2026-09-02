import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ShippopClient } from "../client.js";
import { guard, ok, fail } from "../result.js";

export function registerCancelTools(server: McpServer, client: ShippopClient) {
  server.registerTool(
    "shippop_cancel_shipment",
    {
      title: "Cancel confirmed shipment",
      description:
        "Ask the courier to cancel a CONFIRMED shipment. Takes the COURIER tracking code (not the SP code) — get it from shippop_track_shipment or shippop_get_purchase. " +
        "Whether cancellation is accepted (and refunded) depends on the courier and shipment state. Unpaid purchases do not need cancelling — simply do not confirm them.",
      inputSchema: {
        courier_tracking_code: z.string().min(1).describe("Courier tracking code, e.g. EA823739216TH or a Flash/Kerry code — NOT the SPxxxx code"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    guard(client.env, async ({ courier_tracking_code }) => {
      if (/^SP\d+$/i.test(courier_tracking_code)) {
        return fail({
          error: "wrong_code_type",
          environment: client.env,
          message: `${courier_tracking_code} is a SHIPPOP tracking code. Cancel needs the courier tracking code — call shippop_track_shipment to look it up.`,
        });
      }
      const res = await client.post("/cancel/", { courier_tracking_code }, { allowFailure: true });
      if (!res.status) {
        return fail({ error: "cancel_rejected", environment: client.env, code: res.code, message: res.message, courier_tracking_code });
      }
      return ok({ environment: client.env, cancelled: true, courier_tracking_code });
    }),
  );
}
