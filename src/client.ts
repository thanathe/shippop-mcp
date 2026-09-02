import type { ShippopConfig } from "./config.js";

export type FetchLike = typeof globalThis.fetch;

/** SHIPPOP answered with `status: false` (or non-2xx). */
export class ShippopApiError extends Error {
  constructor(
    message: string,
    public readonly endpoint: string,
    public readonly code?: string | number,
    public readonly raw?: unknown,
    /** HTTP status of the response, when the failure came from the HTTP layer (5xx, non-JSON body). */
    public readonly httpStatus?: number,
  ) {
    super(message);
    this.name = "ShippopApiError";
  }

  /** True when SHIPPOP did not give a proper application answer (gateway error, HTML error page, 5xx) — the request may still have been processed. */
  get isIndeterminate(): boolean {
    return this.httpStatus !== undefined && (this.httpStatus >= 500 || this.raw === undefined || typeof this.raw === "string");
  }
}

/** No response from SHIPPOP within the timeout — the request MAY still have been processed. */
export class ShippopTimeoutError extends Error {
  constructor(
    public readonly endpoint: string,
    public readonly timeoutMs: number,
  ) {
    super(`SHIPPOP did not respond to ${endpoint} within ${timeoutMs}ms`);
    this.name = "ShippopTimeoutError";
  }
}

/** Network-level failure (DNS, connection reset, …). Like a timeout, the request may or may not have arrived. */
export class ShippopNetworkError extends Error {
  constructor(
    public readonly endpoint: string,
    cause: unknown,
  ) {
    super(`Network error calling ${endpoint}: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = "ShippopNetworkError";
  }
}

export interface PostOptions {
  timeoutMs?: number;
  /** `json` (default) sends application/json; `form` sends application/x-www-form-urlencoded (what the docs show for /confirm/ and /tracking_purchase/). */
  format?: "json" | "form";
  /** Include `api_key` in the body (default true). /tracking/ is documented without it. */
  withApiKey?: boolean;
  /** Return the body even when `status` is false instead of throwing. */
  allowFailure?: boolean;
}

export interface ShippopEnvelope {
  status: boolean;
  code?: string | number;
  message?: string;
}

function toFormBody(obj: Record<string, unknown>, prefix = "", out = new URLSearchParams()): URLSearchParams {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object") toFormBody(v as Record<string, unknown>, key, out);
    else out.append(key, String(v));
  }
  return out;
}

export class ShippopClient {
  constructor(
    private readonly config: ShippopConfig,
    private readonly fetchImpl: FetchLike = globalThis.fetch,
  ) {}

  /** Environment label reported in every tool result (`dev` / `production` / `custom`). */
  get env() {
    return this.config.environment;
  }
  get email() {
    return this.config.email;
  }
  get confirmTimeoutMs() {
    return this.config.confirmTimeoutMs;
  }

  async post<T extends ShippopEnvelope = ShippopEnvelope>(
    endpoint: string,
    body: Record<string, unknown>,
    opts: PostOptions = {},
  ): Promise<T> {
    const url = `${this.config.baseUrl}/${endpoint.replace(/^\/+/, "")}`;
    const timeoutMs = opts.timeoutMs ?? this.config.timeoutMs;
    const payload = opts.withApiKey === false ? body : { api_key: this.config.apiKey, ...body };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method: "POST",
        headers:
          opts.format === "form"
            ? { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }
            : { "Content-Type": "application/json", Accept: "application/json" },
        body: opts.format === "form" ? toFormBody(payload).toString() : JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (err) {
      if (controller.signal.aborted) throw new ShippopTimeoutError(endpoint, timeoutMs);
      throw new ShippopNetworkError(endpoint, err);
    } finally {
      clearTimeout(timer);
    }

    const text = await res.text();
    let data: T;
    try {
      data = JSON.parse(text) as T;
    } catch {
      throw new ShippopApiError(
        `SHIPPOP returned non-JSON (HTTP ${res.status}) from ${endpoint}: ${text.slice(0, 200)}`,
        endpoint,
        res.status,
        text,
        res.status,
      );
    }

    if (!res.ok && data?.status !== true) {
      throw new ShippopApiError(
        `SHIPPOP ${endpoint} failed (HTTP ${res.status}): ${data?.message ?? text.slice(0, 200)}`,
        endpoint,
        data?.code ?? res.status,
        data,
        res.status,
      );
    }
    if (data?.status === false && !opts.allowFailure) {
      throw new ShippopApiError(
        `SHIPPOP ${endpoint} failed${data.code !== undefined ? ` (code ${data.code})` : ""}: ${data.message ?? "no message"}`,
        endpoint,
        data.code,
        data,
      );
    }
    return data;
  }
}

/** SHIPPOP returns "arrays" as either real arrays or objects keyed "0","1",… — normalise to an array. */
export function toArray<T>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (v && typeof v === "object") {
    return Object.keys(v as object)
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => (v as Record<string, T>)[k]);
  }
  return [];
}
