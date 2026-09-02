/**
 * Read-only readback of an existing domestic purchase: get_purchase, track_shipment, label (json).
 * Usage: npx tsx scripts/live-readback.ts <purchase_id> <SP tracking code>
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
const [purchaseIdArg, sp] = process.argv.slice(2);
if (!purchaseIdArg || !sp) {
  console.error("usage: npx tsx scripts/live-readback.ts <purchase_id> <SP tracking code>");
  process.exit(1);
}
const server = createServer(loadConfig());
const client = new Client({ name: "live-readback", version: "0" });
const [ct, st] = InMemoryTransport.createLinkedPair();
await Promise.all([server.connect(st), client.connect(ct)]);
const calls: [string, Record<string, unknown>][] = [
  ["shippop_get_purchase", { purchase_id: Number(purchaseIdArg) }],
  ["shippop_track_shipment", { tracking_codes: [sp] }],
  ["shippop_get_label", { purchase_id: Number(purchaseIdArg), format: "json" }],
];
for (const [name, args] of calls) {
  const r = (await client.callTool({ name, arguments: args })) as CallToolResult;
  const text = r.content.find((c) => c.type === "text")?.text ?? "";
  console.log(`\n### ${name} ${r.isError ? "❌" : "✅"}\n${text.slice(0, 2000)}`);
}
await Promise.all([client.close(), server.close()]);
