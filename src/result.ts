import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ShippopApiError, ShippopNetworkError, ShippopTimeoutError } from "./client.js";
import { describeErrorCode } from "./errors.js";

export function ok(payload: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
}

export function fail(payload: unknown): CallToolResult {
  return { isError: true, content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
}

/** Wrap a tool handler so SHIPPOP / network errors become structured `isError` results instead of protocol errors. */
export function guard<A>(env: string, fn: (args: A) => Promise<CallToolResult>): (args: A) => Promise<CallToolResult> {
  return async (args) => {
    try {
      return await fn(args);
    } catch (err) {
      if (err instanceof ShippopApiError) {
        const code = typeof err.code === "string" ? err.code : undefined;
        return fail({
          error: "shippop_api_error",
          environment: env,
          endpoint: err.endpoint,
          code: err.code,
          meaning: describeErrorCode(code),
          message: err.message,
          raw: err.raw,
        });
      }
      if (err instanceof ShippopTimeoutError || err instanceof ShippopNetworkError) {
        return fail({
          error: err instanceof ShippopTimeoutError ? "shippop_timeout" : "shippop_network_error",
          environment: env,
          endpoint: err.endpoint,
          message: err.message,
          note: "SHIPPOP may or may not have processed this request. Check state with a read-only tool before retrying anything that creates or pays.",
        });
      }
      return fail({ error: "internal_error", environment: env, message: err instanceof Error ? err.message : String(err) });
    }
  };
}
