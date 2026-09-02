import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ShippopClient, type FetchLike } from "./client.js";
import type { ShippopConfig } from "./config.js";
import { registerPricingTools } from "./tools/pricing.js";
import { registerBookingTools } from "./tools/booking.js";
import { registerTrackingTools } from "./tools/tracking.js";
import { registerLabelTools } from "./tools/label.js";
import { registerCancelTools } from "./tools/cancel.js";
import { registerPickupTools } from "./tools/pickup.js";
import { InterClient } from "./inter/client.js";
import { registerInterTools } from "./inter/tools.js";

export const SERVER_NAME = "shippop-mcp";
export const SERVER_VERSION = "0.1.0";

export function createServer(config: ShippopConfig, fetchImpl?: FetchLike): McpServer {
  const client = new ShippopClient(config, fetchImpl);
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      instructions:
        `SHIPPOP domestic shipping (Thailand). Environment: ${config.env.toUpperCase()}${config.env === "dev" ? " (sandbox — no real money)" : " (REAL money)"}. ` +
        "Flow: shippop_check_price → shippop_create_booking (unpaid draft, returns SP tracking codes — keep them) → get the user's explicit OK → shippop_confirm_purchase (pays + dispatches) → shippop_get_label → shippop_track_shipment. " +
        "Two kinds of tracking code: SHIPPOP code (SPxxxx, from booking; used for tracking/labels) and courier tracking code (assigned after confirm, may arrive late; used for cancel/pickup). " +
        "Weights are in grams. Never confirm without the user agreeing to the price, and never re-confirm a purchase without checking shippop_get_purchase first." +
        (config.inter
          ? " Crossborder (international) shipping uses the separate shippop_inter_* tools: inter_check_price → inter_create_shipments (INTxxxx drafts) → inter_calculate_order → user OK → inter_create_order (returns payment_url to pay) → inter_get_labels → inter_track_shipment."
          : " Crossborder tools are not enabled (no SHIPPOP_INTER_USERNAME/PASSWORD)."),
    },
  );

  registerPricingTools(server, client);
  registerBookingTools(server, client);
  registerTrackingTools(server, client);
  registerLabelTools(server, client, config);
  registerCancelTools(server, client);
  registerPickupTools(server, client);
  if (config.inter) {
    const inter = new InterClient({ ...config.inter, timeoutMs: config.timeoutMs }, fetchImpl);
    registerInterTools(server, inter, config.env, config.inter.username);
  }
  return server;
}
