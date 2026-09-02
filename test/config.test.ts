import { describe, it, expect } from "vitest";
import { loadConfig, BASE_URLS } from "../src/config.js";

describe("loadConfig", () => {
  it("requires api key and email", () => {
    expect(() => loadConfig({})).toThrow(/SHIPPOP_API_KEY/);
    expect(() => loadConfig({ SHIPPOP_API_KEY: "k" })).toThrow(/SHIPPOP_EMAIL/);
  });
  it("defaults to the dev environment (ADR 0002)", () => {
    const c = loadConfig({ SHIPPOP_API_KEY: "k", SHIPPOP_EMAIL: "e" });
    expect(c.env).toBe("dev");
    expect(c.baseUrl).toBe(BASE_URLS.dev);
  });
  it("switches to production explicitly", () => {
    const c = loadConfig({ SHIPPOP_API_KEY: "k", SHIPPOP_EMAIL: "e", SHIPPOP_ENV: "production" });
    expect(c.baseUrl).toBe("https://mkpservice.shippop.com");
    expect(loadConfig({ SHIPPOP_API_KEY: "k", SHIPPOP_EMAIL: "e", SHIPPOP_ENV: "prod" }).env).toBe("production");
  });
  it("rejects unknown env values", () => {
    expect(() => loadConfig({ SHIPPOP_API_KEY: "k", SHIPPOP_EMAIL: "e", SHIPPOP_ENV: "staging" })).toThrow(/SHIPPOP_ENV/);
  });
  it("infers env from a known SHIPPOP_BASE_URL when SHIPPOP_ENV is unset, and rejects a mismatch", () => {
    expect(loadConfig({ SHIPPOP_API_KEY: "k", SHIPPOP_EMAIL: "e", SHIPPOP_BASE_URL: "https://mkpservice.shippop.com/" }).env).toBe("production");
    expect(() => loadConfig({ SHIPPOP_API_KEY: "k", SHIPPOP_EMAIL: "e", SHIPPOP_ENV: "dev", SHIPPOP_BASE_URL: "https://mkpservice.shippop.com" })).toThrow(/set SHIPPOP_ENV to match/);
  });
  it("honours SHIPPOP_BASE_URL override and strips trailing slash", () => {
    const c = loadConfig({ SHIPPOP_API_KEY: "k", SHIPPOP_EMAIL: "e", SHIPPOP_BASE_URL: "http://localhost:9999/" });
    expect(c.baseUrl).toBe("http://localhost:9999");
  });
});

describe("crossborder config", () => {
  it("is off unless both username and password are set", () => {
    expect(loadConfig({ SHIPPOP_API_KEY: "k", SHIPPOP_EMAIL: "e" }).inter).toBeUndefined();
    expect(() => loadConfig({ SHIPPOP_API_KEY: "k", SHIPPOP_EMAIL: "e", SHIPPOP_INTER_USERNAME: "u" })).toThrow(/together/);
  });
  it("follows SHIPPOP_ENV for the inter base URL", () => {
    const c = loadConfig({ SHIPPOP_API_KEY: "k", SHIPPOP_EMAIL: "e", SHIPPOP_INTER_USERNAME: "u", SHIPPOP_INTER_PASSWORD: "p", SHIPPOP_ENV: "production" });
    expect(c.inter?.baseUrl).toBe("https://inter.shippop.com");
    expect(loadConfig({ SHIPPOP_API_KEY: "k", SHIPPOP_EMAIL: "e", SHIPPOP_INTER_USERNAME: "u", SHIPPOP_INTER_PASSWORD: "p" }).inter?.baseUrl).toBe("https://inter.shippop.dev");
  });
});
