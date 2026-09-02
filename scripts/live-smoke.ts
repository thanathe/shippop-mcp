/**
 * Live smoke test against a REAL SHIPPOP account. Safe subset only:
 *   read-only tools + create_booking (creates an UNPAID purchase — no money moves). Never confirms.
 *
 * Usage:  SHIPPOP_API_KEY=… SHIPPOP_EMAIL=… SHIPPOP_ENV=production npx tsx scripts/live-smoke.ts [--book] [--inter]
 *   (or put the variables in a .env file next to package.json — it is gitignored)
 *   --book   also create an unpaid booking (cheapest available courier) and read it back
 *   --inter  also run crossborder read-only calls (needs SHIPPOP_INTER_USERNAME/PASSWORD)
 *   --inter-order  crossborder draft → calculate → create order (cash) → prints payment_url — DOES NOT PAY.
 *                  The draft shipment is deleted afterwards if SHIPPOP allows it (it may be locked once ordered).
 */
import fs from "node:fs";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { loadConfig } from "../src/config.js";
import { createServer } from "../src/server.js";

const envFile = path.resolve(".env");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const args = new Set(process.argv.slice(2));
const config = loadConfig();
console.log(`env=${config.env} base=${config.baseUrl} inter=${config.inter?.baseUrl ?? "off"} email=${config.email}`);

const server = createServer(config);
const client = new Client({ name: "live-smoke", version: "0" });
const [ct, st] = InMemoryTransport.createLinkedPair();
await Promise.all([server.connect(st), client.connect(ct)]);

async function call(name: string, a: Record<string, unknown>) {
  const t0 = Date.now();
  const res = (await client.callTool({ name, arguments: a })) as CallToolResult;
  const text = res.content.find((c) => c.type === "text")?.text ?? "";
  const json = JSON.parse(text);
  console.log(`\n### ${name} (${Date.now() - t0} ms) ${res.isError ? "❌ ERROR" : "✅"}`);
  console.log(JSON.stringify(json, null, 2).slice(0, 2500));
  return { json, isError: res.isError === true };
}

const from = { name: "ทดสอบ ผู้ส่ง", address: "1/1 ถนนทดสอบ", district: "แขวงห้วยขวาง", state: "เขตห้วยขวาง", province: "กรุงเทพมหานคร", postcode: "10310", tel: "0800000000" };
const to = { name: "ทดสอบ ผู้รับ", address: "2/2 ถนนทดสอบ", district: "สีลม", state: "บางรัก", province: "กรุงเทพมหานคร", postcode: "10500", tel: "0800000001" };
const parcel = { name: "smoke test", weight: 500, width: 15, length: 20, height: 10 };

await call("shippop_list_couriers", {});
const price = await call("shippop_check_price", { shipments: [{ from, to, parcel }], showall: true });

if (args.has("--book")) {
  const courier = price.json?.shipments?.[0]?.cheapest_available;
  if (!courier) {
    console.log("\nno available courier for the sample route — skipping booking");
  } else {
    const booking = await call("shippop_create_booking", { shipments: [{ from, to, parcel, courier_code: courier, remark: "shippop-mcp live smoke — DO NOT CONFIRM" }] });
    if (!booking.isError) {
      await call("shippop_get_purchase", { purchase_id: booking.json.purchase_id });
      await call("shippop_track_shipment", { tracking_codes: booking.json.tracking_codes });
      console.log(`\nUnpaid purchase ${booking.json.purchase_id} left in place — it was NOT confirmed.`);
    }
  }
}

if (args.has("--inter") || args.has("--inter-order")) {
  if (!config.inter) console.log("\n--inter given but SHIPPOP_INTER_USERNAME/PASSWORD not set");
  else {
    await call("shippop_inter_list_countries", { search: "japan" });
    const price = await call("shippop_inter_check_price", { weight: 1000, country_code: "JP" });

    if (args.has("--inter-order")) {
      const courier = price.json?.couriers?.find((c: any) => c.available && c.courier_ref);
      if (!courier) {
        console.log("\nno available inter courier — skipping order");
      } else {
        const shipment = {
          type: "parcel",
          width: 20,
          length: 20,
          height: 10,
          total_weight: 1000,
          remark: "shippop-mcp live smoke — DO NOT PAY",
          require_coverage: false,
          origin_address: { name: "Smoke Test Sender", phone: "+66-800000000", address: "1/1 Test Road", state: "Huai Khwang", city: "Bangkok", postcode: "10310" },
          destination_address: { name: "Smoke Test Receiver", phone: "+81-9000000000", email: "receiver@example.com", address: "1-1 Test Street", address2: "Shibuya", state: "Tokyo", city: "Tokyo", postcode: "150-0001", country_code: "JP" },
          goods: [{ name: "T-shirt (test)", pieces: 1, weight: 900, price: 300, currency: "THB", manufacturer_country_code: "TH" }],
        };
        const created = await call("shippop_inter_create_shipments", { shipments: [shipment] });
        const codes: string[] = created.json?.tracking_codes ?? [];
        if (codes.length) {
          await call("shippop_inter_calculate_order", { tracking_codes: codes, courier_ref: courier.courier_ref });
          const order = await call("shippop_inter_create_order", { tracking_codes: codes, courier_ref: courier.courier_ref, payment_method: "cash" });
          if (!order.isError) {
            console.log(`\n>>> order_number=${order.json.order_number}\n>>> payment_url=${order.json.payment_url}\n>>> NOT PAID — open the URL only to look; close it without paying.`);
            await call("shippop_inter_get_labels", { order_number: order.json.order_number });
          }
          await call("shippop_inter_track_shipment", { tracking_number: codes[0] });
          const del = await call("shippop_inter_delete_shipments", { tracking_codes: codes });
          if (del.isError) console.log("\n(draft could not be deleted after ordering — leave it unpaid; it will expire, or remove it in the SHIPPOP Inter web console)");
        }
      }
    }
  }
}

await Promise.all([client.close(), server.close()]);
