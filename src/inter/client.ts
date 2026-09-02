import { ShippopNetworkError, ShippopTimeoutError, type FetchLike } from "../client.js";

/** SHIPPOP Inter (crossborder v2) answered with a non-2xx status. */
export class InterApiError extends Error {
  constructor(
    message: string,
    public readonly endpoint: string,
    public readonly httpStatus: number,
    public readonly code?: string,
    public readonly raw?: unknown,
  ) {
    super(message);
    this.name = "InterApiError";
  }
}

export interface InterConfig {
  username: string;
  password: string;
  baseUrl: string;
  timeoutMs: number;
}

interface TokenResponse {
  status?: string;
  code?: string | null;
  message?: string;
  payload?: { jwtToken?: string };
}

/**
 * Client for https://inter.shippop.com — a completely separate API from the domestic one:
 * JSON in/out, JWT bearer auth obtained from the account's username/password, REST-style paths and methods.
 */
export class InterClient {
  private token: string | undefined;

  constructor(
    private readonly config: InterConfig,
    private readonly fetchImpl: FetchLike = globalThis.fetch,
  ) {}

  get baseUrl() {
    return this.config.baseUrl;
  }

  private async fetchToken(): Promise<string> {
    const res = await this.raw("POST", "/authen/getJWTToken", { username: this.config.username, password: this.config.password }, undefined);
    const body = res.body as TokenResponse;
    const token = body?.payload?.jwtToken;
    if (!res.ok || !token) {
      throw new InterApiError(
        `SHIPPOP Inter login failed (HTTP ${res.status}): ${body?.message ?? "no token in response"}`,
        "/authen/getJWTToken",
        res.status,
        body?.code ?? undefined,
        body,
      );
    }
    this.token = token;
    return token;
  }

  private async raw(method: string, endpoint: string, body: unknown, token: string | undefined, query?: Record<string, string | number | undefined>) {
    const url = new URL(`${this.config.baseUrl}/${endpoint.replace(/^\/+/, "")}`);
    for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined) url.searchParams.set(k, String(v));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    let res: Response;
    try {
      res = await this.fetchImpl(url.toString(), {
        method,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      if (controller.signal.aborted) throw new ShippopTimeoutError(endpoint, this.config.timeoutMs);
      throw new ShippopNetworkError(endpoint, err);
    } finally {
      clearTimeout(timer);
    }
    const text = await res.text();
    let parsed: unknown = text;
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      /* keep text */
    }
    return { ok: res.ok, status: res.status, body: parsed };
  }

  /** Authenticated request; logs in lazily and retries once on 401 with a fresh token. */
  async request<T = unknown>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    endpoint: string,
    body?: unknown,
    query?: Record<string, string | number | undefined>,
  ): Promise<T> {
    let token = this.token ?? (await this.fetchToken());
    let res = await this.raw(method, endpoint, body, token, query);
    if (res.status === 401) {
      token = await this.fetchToken();
      res = await this.raw(method, endpoint, body, token, query);
    }
    if (!res.ok) {
      const b = res.body as { code?: string; message?: string; error?: string } | string;
      const msg = typeof b === "string" ? b.slice(0, 300) : (b?.message ?? b?.error ?? JSON.stringify(b).slice(0, 300));
      throw new InterApiError(`SHIPPOP Inter ${method} ${endpoint} failed (HTTP ${res.status}): ${msg}`, endpoint, res.status, typeof b === "object" ? b?.code : undefined, res.body);
    }
    return res.body as T;
  }
}
