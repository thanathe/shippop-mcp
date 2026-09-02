// Read-only discovery: GET a list of plausible SHIPPOP Inter paths and print status + snippet. Never writes.
import fs from "node:fs";
for (const line of fs.readFileSync(".env", "utf8").split("\n")) { const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
const base = "https://inter.shippop.com";
const login = await fetch(`${base}/authen/getJWTToken`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: process.env.SHIPPOP_INTER_USERNAME, password: process.env.SHIPPOP_INTER_PASSWORD }) });
const token = (await login.json()).payload?.jwtToken;
const paths = process.argv.slice(2);
for (const p of paths) {
  const r = await fetch(`${base}${p}`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
  const t = (await r.text()).replace(/\s+/g, " ");
  console.log(`${r.status}  ${p}\n      ${t.slice(0, 220)}`);
}
