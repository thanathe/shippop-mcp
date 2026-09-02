import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { loadConfig, type ShippopConfig } from "../src/config.js";
import { createServer } from "../src/server.js";

export interface RecordedRequest {
  url: string;
  endpoint: string;
  headers: Record<string, string>;
  body: any;
  rawBody: string;
  method: string;
}

export type Responder = (req: RecordedRequest, signal: AbortSignal) => Promise<unknown> | unknown;

export const HANG = Symbol("hang");

/** Build a fetch mock keyed by endpoint path ("/confirm/"). A responder may return HANG to never resolve (until abort). */
export function mockFetch(routes: Record<string, Responder | unknown>) {
  const calls: RecordedRequest[] = [];
  const fetchImpl = (async (input: any, init: any) => {
    const url = String(input);
    const endpoint = new URL(url).pathname;
    const rawBody = String(init?.body ?? "");
    const headers = init?.headers ?? {};
    const body = !rawBody ? {} : headers["Content-Type"]?.includes("json") ? JSON.parse(rawBody) : Object.fromEntries(new URLSearchParams(rawBody));
    const req: RecordedRequest = { url, endpoint, headers, body, rawBody, method: init?.method ?? "GET" };
    calls.push(req);
    const route = routes[endpoint];
    if (route === undefined) throw new Error(`no mock for ${endpoint}`);
    const signal: AbortSignal = init.signal;
    const out = typeof route === "function" ? await (route as Responder)(req, signal) : route;
    if (out === HANG) {
      await new Promise<never>((_, reject) => {
        signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
      });
    }
    if (out instanceof Error) throw out;
    const status = (out as any)?.__http ?? 200;
    const { __http, ...payload } = (out && typeof out === "object" ? out : {}) as any;
    const isText = typeof out === "string";
    return new Response(isText ? out : JSON.stringify(typeof out === "object" ? payload : out), {
      status: isText && out.startsWith("<") ? 502 : status,
      headers: { "Content-Type": isText ? "text/html" : "application/json" },
    });
  }) as typeof fetch;
  return { fetchImpl, calls };
}

export function testConfig(overrides: Partial<ShippopConfig> = {}): ShippopConfig {
  return {
    ...loadConfig({ SHIPPOP_API_KEY: "test-key", SHIPPOP_EMAIL: "test@example.com" }),
    timeoutMs: 200,
    confirmTimeoutMs: 100,
    ...overrides,
  };
}

export async function connect(routes: Record<string, Responder | unknown>, overrides: Partial<ShippopConfig> = {}) {
  const { fetchImpl, calls } = mockFetch(routes);
  const server = createServer(testConfig(overrides), fetchImpl);
  const client = new Client({ name: "test", version: "0.0.0" });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(st), client.connect(ct)]);
  const call = async (name: string, args: Record<string, unknown>) => {
    const res = (await client.callTool({ name, arguments: args })) as CallToolResult;
    const text = res.content.find((c) => c.type === "text")?.text ?? "";
    return { res, isError: res.isError === true, json: JSON.parse(text) as any };
  };
  return { client, server, calls, call, close: () => Promise.all([client.close(), server.close()]) };
}

export const ADDR_FROM = {
  name: "ผู้ส่ง",
  address: "1/1",
  district: "แขวงห้วยขวาง",
  state: "เขตห้วยขวาง",
  province: "กรุงเทพมหานคร",
  postcode: "10310",
  tel: "0800000000",
};
export const ADDR_TO = { ...ADDR_FROM, name: "ผู้รับ", district: "สีลม", state: "บางรัก", postcode: "10500" };
export const PARCEL = { name: "-", weight: 1000, width: 10, length: 10, height: 10 };
