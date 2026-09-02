/**
 * Call one tool against the live account. Usage:
 *   npx tsx scripts/live-call.ts <tool_name> '<json args>'
 * e.g. npx tsx scripts/live-call.ts shippop_list_pickups '{}'
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
const [name, argsJson = "{}"] = process.argv.slice(2);
if (!name) {
  console.error("usage: npx tsx scripts/live-call.ts <tool_name> '<json args>'");
  process.exit(1);
}
if (name === "shippop_confirm_purchase" && !process.env.I_REALLY_WANT_TO_PAY) {
  console.error("refusing to call shippop_confirm_purchase from the CLI — it charges the account. Set I_REALLY_WANT_TO_PAY=1 if you mean it.");
  process.exit(1);
}
const server = createServer(loadConfig());
const client = new Client({ name: "live-call", version: "0" });
const [ct, st] = InMemoryTransport.createLinkedPair();
await Promise.all([server.connect(st), client.connect(ct)]);
const t0 = Date.now();
const r = (await client.callTool({ name, arguments: JSON.parse(argsJson) })) as CallToolResult;
console.log(`### ${name} (${Date.now() - t0} ms) ${r.isError ? "❌" : "✅"}`);
console.log(r.content.find((c) => c.type === "text")?.text ?? "");
await Promise.all([client.close(), server.close()]);
