# shippop-mcp

MCP server for the [SHIPPOP](https://www.shippop.com) domestic shipping API (Thailand).
Lets Claude Desktop, Claude Code, Cursor or any MCP client **check prices, book, confirm, print labels, track, cancel and request pickup** for parcels on your SHIPPOP account.

> MCP server สำหรับ SHIPPOP API (ขนส่งในประเทศ) — ให้ AI agent เช็คราคา สร้างรายการ ยืนยัน พิมพ์ใบปะหน้า ติดตาม ยกเลิก และเรียกขนส่งเข้ารับ ผ่านบัญชี SHIPPOP ของคุณ

## Quick start

You need a SHIPPOP API key and the email of the account that owns it (ask SHIPPOP sales: https://www.shippop.com/for-developers).

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

| Variable | Required | Default | Notes |
|---|---|---|---|
| `SHIPPOP_API_KEY` | yes | — | Marketplace API key |
| `SHIPPOP_EMAIL` | yes | — | Email of the SHIPPOP account (sent with bookings) |
| `SHIPPOP_ENV` | no | **`dev`** | `dev` → `mkpservice.shippop.dev` (sandbox), `production` → `mkpservice.shippop.com` (**real money**) |
| `SHIPPOP_BASE_URL` | no | per env | Override the base URL entirely |
| `SHIPPOP_LABEL_DIR` | no | `~/Downloads/shippop-labels` | Where `shippop_get_label` writes PDF/HTML files |
| `SHIPPOP_INTER_USERNAME` | no | — | SHIPPOP account **login email** — enables the crossborder `shippop_inter_*` tools |
| `SHIPPOP_INTER_PASSWORD` | no | — | SHIPPOP account **login password** (set together with the username) |
| `SHIPPOP_INTER_BASE_URL` | no | per env | `inter.shippop.dev` / `inter.shippop.com` |
| `SHIPPOP_TIMEOUT_MS` | no | `20000` | Per-request timeout |
| `SHIPPOP_CONFIRM_TIMEOUT_MS` | no | `60000` | Timeout for the (slow) confirm call |

The default environment is the **sandbox** on purpose — set `SHIPPOP_ENV=production` when you are ready to ship for real. Every tool result includes the `environment` it ran against.

## Tools

| Tool | What it does | Side effects |
|---|---|---|
| `shippop_list_couriers` | Couriers enabled on your account, with codes and availability | none |
| `shippop_check_price` | Quote one or more shipments across couriers, cheapest first | none |
| `shippop_create_booking` | Create an **unpaid** purchase; returns `purchase_id` + `SPxxxx` tracking codes | creates draft |
| `shippop_confirm_purchase` | **Pays** and hands shipments to the courier — irreversible | 💸 charges account |
| `shippop_get_purchase` | Purchase status (`unpaid` / `paid`), shipments, courier tracking codes | none |
| `shippop_track_shipment` | Status + courier events for SP tracking codes | none |
| `shippop_get_label` | Render labels as PDF/HTML (written to disk, path returned) or JSON | writes a file |
| `shippop_cancel_shipment` | Ask the courier to cancel a confirmed shipment (courier tracking code) | courier-side cancel |
| `shippop_request_pickup` | Ask the courier to collect a confirmed shipment | creates pickup |
| `shippop_list_pickups` | List pickup requests | none |

### Crossborder tools (SHIPPOP Inter v2)

Enabled only when `SHIPPOP_INTER_USERNAME` / `SHIPPOP_INTER_PASSWORD` are set. This is a separate SHIPPOP API (`inter.shippop.com`, JWT auth, English addresses, customs `goods` lines).

| Tool | What it does | Side effects |
|---|---|---|
| `shippop_inter_list_countries` | Destination countries and ISO codes | none |
| `shippop_inter_check_price` | Quote by weight (g) + destination country; returns `courier_ref` | none |
| `shippop_inter_get_coverages` | Optional insurance for a courier | none |
| `shippop_inter_create_shipments` | Draft shipments with customs declaration → `INTxxxx` codes | creates drafts |
| `shippop_inter_update_shipment` | Edit a draft | — |
| `shippop_inter_calculate_order` | Exact total for drafts + courier | none |
| `shippop_inter_create_order` | Create the order → `payment_url` to pay (`credit_term` confirms immediately, business accounts only) | 💸 leads to payment |
| `shippop_inter_get_labels` | Download URL for labels / commercial invoice (valid 10 min) | none |
| `shippop_inter_track_shipment` | Tracking events | none |
| `shippop_inter_delete_shipments` | Delete unpaid drafts | deletes drafts |

Flow: `inter_check_price → inter_create_shipments → inter_calculate_order → user OK → inter_create_order → pay at payment_url → inter_get_labels`.

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
- **Confirm is treated as eventually consistent.** If `/confirm/` times out or comes back without courier tracking codes, the tool checks the purchase once via `tracking_purchase` and reports `confirmation: confirmed | not_confirmed | unknown`. It never retries confirm on its own. ([ADR 0003](docs/adr/0003-confirm-is-eventually-consistent.md))

Glossary of terms used in the code and tool descriptions: [CONTEXT.md](CONTEXT.md). Condensed API reference: [docs/shippop-api.md](docs/shippop-api.md).

## Scope

v1 covers the SHIPPOP **domestic** core flow plus the **Crossborder v2** order flow. Not included (yet): reports (COD, billing), verify-account/KYC, rebate (own courier account), box presets, dropoff partner APIs, webhooks.

## Development

```bash
npm install
npm test          # vitest, all SHIPPOP calls mocked
npm run build     # tsup → dist/index.js
SHIPPOP_API_KEY=… SHIPPOP_EMAIL=… npm run dev

# live smoke test against your real account (read-only; --book adds an UNPAID booking; --inter adds crossborder reads)
cp .env.example .env   # fill in
npx tsx scripts/live-smoke.ts --book --inter
```

## License

MIT
