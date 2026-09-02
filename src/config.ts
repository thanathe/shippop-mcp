import os from "node:os";
import path from "node:path";
import fs from "node:fs";

export type ShippopEnv = "dev" | "production";

export type EnvironmentLabel = ShippopEnv | "custom";

export interface ShippopConfig {
  apiKey: string;
  email: string;
  /** Which SHIPPOP host family the default URLs come from. */
  env: ShippopEnv;
  /** What tool results report: `dev` / `production` for known SHIPPOP hosts, `custom` for an arbitrary SHIPPOP_BASE_URL. */
  environment: EnvironmentLabel;
  baseUrl: string;
  labelDir: string;
  /** Default per-request timeout. */
  timeoutMs: number;
  /** Longer timeout for /confirm/, which is known to be slow. */
  confirmTimeoutMs: number;
  /** Crossborder (SHIPPOP Inter v2) — optional; tools are only registered when credentials are present. */
  inter?: {
    username: string;
    password: string;
    baseUrl: string;
  };
}

export const INTER_BASE_URLS: Record<ShippopEnv, string> = {
  dev: "https://inter.shippop.dev",
  production: "https://inter.shippop.com",
};

export const BASE_URLS: Record<ShippopEnv, string> = {
  dev: "https://mkpservice.shippop.dev",
  production: "https://mkpservice.shippop.com",
};

export class ConfigError extends Error {}

function defaultLabelDir(): string {
  const downloads = path.join(os.homedir(), "Downloads");
  const base = fs.existsSync(downloads) ? downloads : os.tmpdir();
  return path.join(base, "shippop-labels");
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ShippopConfig {
  const apiKey = env.SHIPPOP_API_KEY?.trim();
  const email = env.SHIPPOP_EMAIL?.trim();
  if (!apiKey) throw new ConfigError("SHIPPOP_API_KEY is required");
  if (!email) throw new ConfigError("SHIPPOP_EMAIL is required (the email of the SHIPPOP account that owns the API key)");

  const rawEnv = (env.SHIPPOP_ENV ?? "dev").trim().toLowerCase();
  let shippopEnv: ShippopEnv;
  if (rawEnv === "dev" || rawEnv === "development" || rawEnv === "test") shippopEnv = "dev";
  else if (rawEnv === "production" || rawEnv === "prod") shippopEnv = "production";
  else throw new ConfigError(`SHIPPOP_ENV must be "dev" or "production", got "${rawEnv}"`);

  const baseUrl = (env.SHIPPOP_BASE_URL?.trim() || BASE_URLS[shippopEnv]).replace(/\/+$/, "");
  // An explicit base URL that is one of the known SHIPPOP hosts wins over SHIPPOP_ENV, so the
  // environment label reported to the model is never "dev" while talking to production.
  if (env.SHIPPOP_BASE_URL && !env.SHIPPOP_ENV) {
    if (baseUrl === BASE_URLS.production) shippopEnv = "production";
    else if (baseUrl === BASE_URLS.dev) shippopEnv = "dev";
  } else if (env.SHIPPOP_BASE_URL && env.SHIPPOP_ENV) {
    const expected = BASE_URLS[shippopEnv];
    if (baseUrl !== expected && (baseUrl === BASE_URLS.production || baseUrl === BASE_URLS.dev)) {
      throw new ConfigError(
        `SHIPPOP_ENV=${shippopEnv} but SHIPPOP_BASE_URL=${baseUrl} is the ${baseUrl === BASE_URLS.production ? "production" : "dev"} host — set SHIPPOP_ENV to match, or drop SHIPPOP_BASE_URL`,
      );
    }
  }

  const interUser = env.SHIPPOP_INTER_USERNAME?.trim();
  const interPass = env.SHIPPOP_INTER_PASSWORD?.trim();
  if ((interUser && !interPass) || (!interUser && interPass)) {
    throw new ConfigError("SHIPPOP_INTER_USERNAME and SHIPPOP_INTER_PASSWORD must be set together");
  }
  const inter =
    interUser && interPass
      ? {
          username: interUser,
          password: interPass,
          baseUrl: (env.SHIPPOP_INTER_BASE_URL?.trim() || INTER_BASE_URLS[shippopEnv]).replace(/\/+$/, ""),
        }
      : undefined;

  const knownHost = baseUrl === BASE_URLS.production || baseUrl === BASE_URLS.dev;

  return {
    apiKey,
    email,
    inter,
    environment: knownHost ? shippopEnv : "custom",
    env: shippopEnv,
    baseUrl,
    labelDir: env.SHIPPOP_LABEL_DIR?.trim() || defaultLabelDir(),
    timeoutMs: Number(env.SHIPPOP_TIMEOUT_MS) || 20_000,
    confirmTimeoutMs: Number(env.SHIPPOP_CONFIRM_TIMEOUT_MS) || 60_000,
  };
}
