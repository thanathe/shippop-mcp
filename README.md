# shippop-mcp

[![npm](https://img.shields.io/npm/v/shippop-mcp)](https://www.npmjs.com/package/shippop-mcp) [![license](https://img.shields.io/npm/l/shippop-mcp)](LICENSE)

MCP server for the [SHIPPOP](https://www.shippop.com) shipping API (Thailand) — domestic and crossborder.
Lets Claude Desktop, Claude Code, Cursor or any MCP client **check prices, book, confirm, print labels, track, cancel and request pickup** for parcels on your SHIPPOP account.

> MCP server สำหรับ SHIPPOP API (ขนส่งในประเทศ + ต่างประเทศ) — ให้ AI agent เช็คราคา สร้างรายการ ยืนยัน พิมพ์ใบปะหน้า ติดตาม ยกเลิก และเรียกขนส่งเข้ารับ ผ่านบัญชี SHIPPOP ของคุณ

## Official SHIPPOP API documentation

This server is a thin wrapper — field names, courier codes and error codes come straight from SHIPPOP's docs. When in doubt, the official docs win:

- **API reference (Postman)** — https://documenter.getpostman.com/view/10021496/Tzz8qwkE — Domestic APIs (sections 1–14) and Crossborder v2 APIs
- **Developer portal** — https://developers.shippop.com
- **Getting API access** — https://www.shippop.com/for-developers (contact SHIPPOP sales for a marketplace API key)

Base URLs: domestic `https://mkpservice.shippop.com` (prod) / `https://mkpservice.shippop.dev` (dev); crossborder `https://inter.shippop.com` / `https://inter.shippop.dev`.

## Quick start

Requires Node.js ≥ 22. You need a SHIPPOP **marketplace API key** and the email of the account that owns it (see "Getting API access" above). For crossborder tools you additionally need your SHIPPOP account login (email + password).

Add to your MCP client config (Claude Desktop: `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "shippop": {
      "command": "npx",
      "args": ["-y", "shippop-mcp"],
      "env": {
        "SHIPPOP_API_KEY": "your-api-key",
        "SHIPPOP_EMAIL": "you@example.com",
        "SHIPPOP_ENV": "dev"
      }
    }
  }
}
```

Claude Code:

```bash
claude mcp add shippop -e SHIPPOP_API_KEY=your-api-key -e SHIPPOP_EMAIL=you@example.com -e SHIPPOP_ENV=dev -- npx -y shippop-mcp
```

### Environment variables

Two independent credential sets — each unlocks its own group of tools:

**Domestic tools (`shippop_*`) — API key. Required.**

| Variable | Required | Default | Notes |
|---|---|---|---|
| `SHIPPOP_API_KEY` | **yes** | — | Marketplace API key issued by SHIPPOP |
| `SHIPPOP_EMAIL` | **yes** | — | Email of the SHIPPOP account that owns the key (sent with bookings) |
| `SHIPPOP_ENV` | no | **`dev`** | `dev` → `mkpservice.shippop.dev` (sandbox), `production` → `mkpservice.shippop.com` (**real money**). Also selects the crossborder host |
| `SHIPPOP_BASE_URL` | no | per env | Override the domestic base URL. A known SHIPPOP host also sets `SHIPPOP_ENV`; a contradicting `SHIPPOP_ENV` is rejected |

**Crossborder tools (`shippop_inter_*`) — account login. Required only if you want these tools; without them the server starts with domestic tools only.**

| Variable | Required | Default | Notes |
|---|---|---|---|
| `SHIPPOP_INTER_USERNAME` | **yes, for crossborder** | — | Your SHIPPOP account **login email** (not the API key) |
| `SHIPPOP_INTER_PASSWORD` | **yes, for crossborder** | — | Your SHIPPOP account **login password** — must be set together with the username |
| `SHIPPOP_INTER_BASE_URL` | no | per env | `inter.shippop.dev` / `inter.shippop.com` |

**Optional tuning**

| Variable | Default | Notes |
|---|---|---|
| `SHIPPOP_LABEL_DIR` | `~/Downloads/shippop-labels` | Where `shippop_get_label` writes PDF/HTML files. The tool may choose a sub-directory but can never write outside this root |
| `SHIPPOP_TIMEOUT_MS` | `20000` | Per-request timeout |
| `SHIPPOP_CONFIRM_TIMEOUT_MS` | `60000` | Timeout for the (slow) confirm call |

Full example with both credential sets:

```json
"env": {
  "SHIPPOP_API_KEY": "your-api-key",
  "SHIPPOP_EMAIL": "you@example.com",
  "SHIPPOP_ENV": "production",
  "SHIPPOP_INTER_USERNAME": "you@example.com",
  "SHIPPOP_INTER_PASSWORD": "your-shippop-password"
}
```

The default environment is the **sandbox** on purpose — set `SHIPPOP_ENV=production` when you are ready to ship for real. Every tool result includes the `environment` it ran against (`dev`, `production`, or `custom` for an unknown `SHIPPOP_BASE_URL`).

> **Dev and production keys are different.** A production API key is rejected by the dev host with `Invalid API key` (verified live). If SHIPPOP only gave you a production key, set `SHIPPOP_ENV=production` — and remember that `shippop_confirm_purchase` then spends real money.

> **Crossborder credentials are your account password.** `SHIPPOP_INTER_PASSWORD` sits in plain text in your MCP client config; only set it on a machine you trust, and prefer a dedicated SHIPPOP login if you can.

## Tools

| Tool | What it does | Side effects |
|---|---|---|
| `shippop_list_couriers` | Couriers enabled on your account, with codes and availability | none |
| `shippop_check_price` | Quote one or more shipments across couriers, cheapest first | none |
| `shippop_create_booking` | Create an **unpaid** purchase; returns `purchase_id` + `SPxxxx` tracking codes | creates draft |
| `shippop_confirm_purchase` | **Pays** and hands shipments to the courier — irreversible | 💸 charges account |
| `shippop_get_purchase` | Purchase status (`unpaid` / `paid`), shipments, courier tracking codes | none |
| `shippop_track_shipment` | Status + courier events for SP tracking codes | none |
| `shippop_get_label` | Render labels as PDF/HTML (written to disk, path returned) or JSON; supports a per-shipment sender override for parcel shops | writes a file |
| `shippop_cancel_shipment` | Ask the courier to cancel a confirmed shipment (courier tracking code) | courier-side cancel |
| `shippop_request_pickup` | Ask the courier to collect a confirmed shipment | creates pickup |
| `shippop_list_pickups` | List pickup requests (default: last 30 days) | none |
| `shippop_update_pickup` | Change a pickup request (Flash: assign staff) by `courier_pickup_id` | edits pickup |
| `shippop_cancel_pickup` | Cancel a pickup appointment (shipment stays confirmed) | cancels pickup |

### Crossborder tools (SHIPPOP Inter v2)

**Requires `SHIPPOP_INTER_USERNAME` + `SHIPPOP_INTER_PASSWORD`** (your SHIPPOP login — the domestic API key does not work here). Without them these tools are not registered at all. This is a separate SHIPPOP API (`inter.shippop.com`, JWT auth, English addresses, customs `goods` lines).

| Tool | What it does | Side effects |
|---|---|---|
| `shippop_inter_prepare_shipment` | **Contents in Thai/English → accepted customs declaration** (generic category + HS code), air-freight restriction flags, weight estimation, volumetric weight, courier fit + checklist from each courier's terms, address normalisation (≤50-char lines, phone with country code). Returns a ready `shipment` + `warnings` | none |
| `shippop_inter_list_countries` | Destination countries and ISO codes | none |
| `shippop_inter_check_price` | Quote by weight (g) + destination country; returns `courier_ref` | none |
| `shippop_inter_get_coverages` | Optional insurance for a courier | none |
| `shippop_inter_list_shipments` | Your crossborder shipments with status + goods/HS declaration (undocumented endpoint) | none |
| `shippop_inter_create_shipments` | Draft shipments with customs declaration → `INTxxxx` codes; supports `taxpayer` (sender/receiver) | creates drafts |
| `shippop_inter_update_shipment` | Edit a draft | — |
| `shippop_inter_calculate_order` | Exact total for drafts + courier | none |
| `shippop_inter_create_order` | Create the order → `payment_url` to pay (`credit_term` confirms immediately, business accounts only) | 💸 leads to payment |
| `shippop_inter_get_labels` | Download URL for labels / commercial invoice (valid 10 min) | none |
| `shippop_inter_track_shipment` | Tracking events | none |
| `shippop_inter_delete_shipments` | Delete unpaid drafts | deletes drafts |

Flow: `inter_prepare_shipment → inter_create_shipments → inter_calculate_order → user OK → inter_create_order → pay at payment_url → inter_get_labels`.

**Why `prepare_shipment` exists.** The hard part of shipping abroad from Thailand is not the API — it is the customs declaration. Counter staff refuse "eyeliner ×3" as "liquid, cannot fly" and accept the same parcel declared as "Cosmetics"; SHIPPOP's own drafts use generic categories plus 6-digit HS codes ("Clothes 620520", "Supplementary food 210690"). The tool carries that playbook (`src/inter/playbook.ts`, ~60 categories with Thai/English keywords) and applies **air-freight rules to every shipment** (all SHIPPOP Inter services fly, even to LA/MM/KH). It **flags** genuinely dangerous goods (alcohol perfume, aerosols, lithium batteries) and never re-words them into something that would slip through — that is a safety and account-ban issue. PRs adding real accepted/rejected cases to the playbook are welcome.

Verified against the live production API (2026-09-02): login, countries, price, create/calculate/delete shipments. Notes from that run: the sender address needs an `email` (undocumented — defaults to the account email); draft shipments have no tracking until paid; an account with an unpaid Inter invoice gets `order.unpaidInvoice` from create_order.

### The flow (domestic)

```
check_price ──▶ create_booking ──▶ (user says OK to the price) ──▶ confirm_purchase ──▶ get_label
                    │ returns SPxxxx codes — keep them                    │
                    ▼                                                      ▼
              get_purchase  ◀──────── reconcile after a timeout ────  track_shipment
```

Two kinds of tracking code:

- **SHIPPOP tracking code** `SPxxxxxxxxx` — assigned at booking. Use for `track_shipment`, `get_label`, reconciliation.
- **Courier tracking code** (e.g. `EA823739216TH`) — assigned by the courier *after* confirm, sometimes a little later. Use for `cancel_shipment`, `request_pickup`.

Weights are in **grams**; sizes in cm.

## Design notes

- **Confirm is always a separate step.** The server never uses SHIPPOP's `force_confirm`. A booking that times out created nothing and is safe to redo; a *forced* confirm that times out would leave a paid shipment you have no codes or label for. ([ADR 0001](docs/adr/0001-no-auto-confirm.md))
- **Sandbox by default.** ([ADR 0002](docs/adr/0002-default-environment-dev.md))
- **Confirm is treated as eventually consistent.** If `/confirm/` times out, fails at the HTTP layer (5xx / HTML gateway page), or comes back without courier tracking codes, the tool checks the purchase once via `tracking_purchase` and reports `confirmation: confirmed | not_confirmed | unknown`. Shipments the courier explicitly rejected are reported as `courier_rejected`, not pending. It never retries confirm on its own. ([ADR 0003](docs/adr/0003-confirm-is-eventually-consistent.md))

**Verification status (live production API, 2026-09-02):**

- Domestic — verified: `list_couriers`, `check_price`, `create_booking` (unpaid), `get_purchase` (form-urlencoded `/tracking_purchase/` works), `track_shipment`, `list_pickups` (1,800+ historical rows came back oldest-first in ~14 s, hence the default 30-day window). `get_label` correctly refuses an unpaid purchase ("Purchase unconfirmed"). **Not exercised: `confirm_purchase`, `cancel_shipment`, `request_pickup`, `update_pickup`, `cancel_pickup`** — they cost money or need a paid shipment; the confirm request format matches the verified `tracking_purchase` one.
- Crossborder — verified: login, countries, price, coverages, create/calculate/delete shipments. `create_order` blocked on the test account by `order.unpaidInvoice`; `get_labels`/tracking need a paid order.

Glossary of terms used in the code and tool descriptions: [CONTEXT.md](CONTEXT.md). [docs/shippop-api.md](docs/shippop-api.md) is an auto-scraped snapshot of the Postman collection kept for offline grep — the [official docs](#official-shippop-api-documentation) are authoritative.

## Scope

v1 covers the SHIPPOP **domestic** core flow plus the **Crossborder v2** order flow. Not included (yet): Courier Info API (needs a separate Basic Auth credential), reports (COD, billing), verify-account/KYC, rebate (own courier account), box presets, dropoff partner APIs, update-parcel (Flash only), the Flash-specific call-to-pickup variant, webhooks.

## Development

```bash
npm install
npm test          # vitest, all SHIPPOP calls mocked
npm run build     # tsup → dist/index.js
SHIPPOP_API_KEY=… SHIPPOP_EMAIL=… npm run dev

# live smoke test against your real account — nothing here pays:
#   (no flags)     domestic read-only calls
#   --book         + create an UNPAID domestic booking and read it back
#   --inter        + crossborder read-only calls
#   --inter-order  + crossborder draft → calculate → create order (prints payment_url, does NOT pay) → delete draft
cp .env.example .env   # fill in
npx tsx scripts/live-smoke.ts --book --inter
npx tsx scripts/live-readback.ts <purchase_id> <SPxxxx>   # read-only: get_purchase, track, label(json) of an existing purchase
npx tsx scripts/live-call.ts shippop_list_pickups '{}'     # call any single tool (refuses confirm_purchase)
```

Published on npm as [`shippop-mcp`](https://www.npmjs.com/package/shippop-mcp) — `npx -y shippop-mcp` always runs the latest release. Running from source instead: clone this repo, `npm install && npm run build`, and point your MCP config at `node /path/to/shippop-mcp/dist/index.js`.

## License

MIT
