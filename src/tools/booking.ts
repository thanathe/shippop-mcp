import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ShippopApiError, ShippopClient, ShippopNetworkError, ShippopTimeoutError, toArray } from "../client.js";
import { BookingShipmentSchema } from "../schemas.js";
import { describeErrorCode, ORDER_STATUS } from "../errors.js";
import { guard, ok, fail } from "../result.js";

interface BookingItem {
  status: boolean;
  tracking_code?: string;
  courier_tracking_code?: string;
  courier_code?: string;
  price?: number | string;
  discount?: number | string;
  cod_amount?: number;
  cod_charge?: number;
  message?: string;
  code?: string;
  price_fuel_surcharge?: number;
  price_remote_area?: number;
  price_travel_area?: number;
  price_island_area?: number;
}

interface BookingResponse {
  status: boolean;
  code?: number | string;
  message?: string;
  purchase_id?: number;
  total_price?: number | string;
  total_cod_charge?: number | string;
  payment_url?: string;
  data?: unknown;
}

interface ConfirmItem {
  status: boolean;
  courier_code?: string;
  tracking_code?: string;
  courier_tracking_code?: string;
  message?: string;
}

interface ConfirmResponse {
  status: boolean;
  code?: number | string;
  message?: string;
  result?: unknown;
}

interface PurchaseItem {
  tracking_code?: string;
  courier_tracking_code?: string;
  courier_code?: string;
  status?: string;
  price?: string | number;
  discount?: string | number;
  weight?: number;
  parcel?: unknown;
  actual_parcel?: unknown;
  datetime_order?: string | null;
  datetime_shipping?: string | null;
  fuel_surcharge?: string | number;
  remote_surcharge?: string | number;
  travel_surcharge?: string | number;
  island_surcharge?: string | number;
  from?: { name?: string; postcode?: string };
  to?: { name?: string; postcode?: string };
}

interface PurchaseResponse {
  status: boolean;
  code?: number | string;
  message?: string;
  purchase_id?: number;
  purchase_status?: "paid" | "unpaid" | "cancel" | string;
  total_price?: string | number;
  total_discount?: string | number;
  data?: unknown;
}

export async function getPurchase(client: ShippopClient, purchaseId: number) {
  const res = await client.post<PurchaseResponse>(
    "/tracking_purchase/",
    { purchase_id: purchaseId, email: client.email },
    { format: "form" },
  );
  const items = toArray<PurchaseItem>(res.data);
  return {
    purchase_id: res.purchase_id ?? purchaseId,
    purchase_status: res.purchase_status,
    total_price: res.total_price !== undefined ? Number(res.total_price) : undefined,
    total_discount: res.total_discount !== undefined ? Number(res.total_discount) : undefined,
    shipments: items.map((it) => ({
      tracking_code: it.tracking_code,
      courier_code: it.courier_code,
      courier_tracking_code: it.courier_tracking_code || null,
      status: it.status,
      status_meaning: it.status ? ORDER_STATUS[it.status] : undefined,
      price: it.price !== undefined ? Number(it.price) : undefined,
      surcharges: {
        fuel: it.fuel_surcharge,
        remote_area: it.remote_surcharge,
        travel_area: it.travel_surcharge,
        island_area: it.island_surcharge,
      },
      booked_parcel: it.parcel,
      actual_parcel: it.actual_parcel,
      datetime_order: it.datetime_order,
      datetime_shipping: it.datetime_shipping,
      from: it.from ? { name: it.from.name, postcode: it.from.postcode } : undefined,
      to: it.to ? { name: it.to.name, postcode: it.to.postcode } : undefined,
    })),
  };
}

export function registerBookingTools(server: McpServer, client: ShippopClient) {
  server.registerTool(
    "shippop_create_booking",
    {
      title: "Create booking (draft, unpaid)",
      description:
        "Create a SHIPPOP booking for one or more shipments. This creates an UNPAID purchase only — nothing is sent to the courier and nothing is charged until shippop_confirm_purchase is called with the returned purchase_id. " +
        "Every shipment gets a SHIPPOP tracking code (SPxxxxxxxxx): KEEP IT — it is the durable handle for tracking, labels and reconciliation. " +
        "If this call times out with no purchase_id, nothing was created and it is safe to call again. Get courier_code from shippop_check_price first.",
      inputSchema: {
        shipments: z.array(BookingShipmentSchema).min(1).max(50),
        promo_code: z.string().optional().describe("SHIPPOP coupon code"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    guard(client.env, async ({ shipments, promo_code }) => {
      const data = shipments.map((s) => {
        const { products, ref_no_1, ref_no_2, ...rest } = s;
        const item: Record<string, unknown> = { ...rest };
        if (products?.length) item.product = products;
        if (ref_no_1 || ref_no_2) item.meta = { ref_no_1, ref_no_2 };
        return item;
      });
      const body: Record<string, unknown> = { email: client.email, data };
      if (promo_code) body.promo_code = promo_code;
      // Deliberately never send force_confirm — see docs/adr/0001-no-auto-confirm.md

      const res = await client.post<BookingResponse>("/booking/", body, { allowFailure: true });
      const items = toArray<BookingItem>(res.data);
      const mapped = items.map((it, i) => ({
        index: i,
        status: it.status === true,
        tracking_code: it.tracking_code ?? null,
        courier_code: it.courier_code ?? shipments[i]?.courier_code,
        courier_tracking_code: it.courier_tracking_code || null,
        price: it.price !== undefined ? Number(it.price) : undefined,
        discount: it.discount !== undefined ? Number(it.discount) : undefined,
        cod_amount: it.cod_amount,
        cod_charge: it.cod_charge,
        surcharges: {
          fuel: it.price_fuel_surcharge,
          remote_area: it.price_remote_area,
          travel_area: it.price_travel_area,
          island_area: it.price_island_area,
        },
        error_code: it.status ? undefined : it.code,
        error_meaning: it.status ? undefined : describeErrorCode(it.code),
        message: it.message,
      }));

      if (!res.status || !res.purchase_id) {
        return fail({
          error: "booking_failed",
          environment: client.env,
          code: res.code,
          message: res.message,
          shipments: mapped,
          note: "No purchase was created. Fix the reported problems and call shippop_create_booking again.",
        });
      }

      const failed = mapped.filter((m) => !m.status);
      return ok({
        environment: client.env,
        purchase_id: res.purchase_id,
        purchase_status: "unpaid",
        total_price: res.total_price !== undefined ? Number(res.total_price) : undefined,
        total_cod_charge: res.total_cod_charge !== undefined ? Number(res.total_cod_charge) : undefined,
        payment_url: res.payment_url,
        shipments: mapped,
        tracking_codes: mapped.map((m) => m.tracking_code).filter(Boolean),
        next_step:
          failed.length > 0
            ? `${failed.length} of ${mapped.length} shipment(s) failed to book. Review them before confirming; confirming pays for the successful ones only.`
            : `Show the user the price (${res.total_price} THB) and tracking codes, then call shippop_confirm_purchase with purchase_id ${res.purchase_id} ONLY after they agree to pay.`,
      });
    }),
  );

  server.registerTool(
    "shippop_confirm_purchase",
    {
      title: "Confirm purchase (PAYS and dispatches)",
      description:
        "Confirm an unpaid purchase: this CHARGES the SHIPPOP account and hands every shipment to its courier. Irreversible — after this, shipments cannot be edited and can only be cancelled courier-side via shippop_cancel_shipment. " +
        "Only call after the user has explicitly agreed to the price. " +
        "SHIPPOP's confirm endpoint is known to be slow/unreliable: this tool waits up to 60 s, and if the call times out or comes back without courier tracking codes it re-checks the purchase status once via tracking_purchase and reports `confirmation` = confirmed | not_confirmed | unknown. " +
        "It NEVER retries confirm by itself. Courier tracking codes may arrive later — fetch them with shippop_track_shipment using the SP tracking codes.",
      inputSchema: {
        purchase_id: z.number().int().positive().describe("purchase_id returned by shippop_create_booking"),
        tracking_codes: z
          .array(z.string().regex(/^SP\w+$/i, "must be a SHIPPOP tracking code starting with SP"))
          .optional()
          .describe("SHIPPOP tracking codes (SPxxxx) from the booking, so they are echoed back even if SHIPPOP does not respond"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    guard(client.env, async ({ purchase_id, tracking_codes }) => {
      let confirmCall: "ok" | "failed" | "timeout" | "network_error" | "http_error" = "ok";
      let confirmRes: ConfirmResponse | undefined;
      let confirmErrorMessage: string | undefined;
      try {
        confirmRes = await client.post<ConfirmResponse>(
          "/confirm/",
          { purchase_id },
          { format: "form", timeoutMs: client.confirmTimeoutMs, allowFailure: true },
        );
        if (!confirmRes.status) confirmCall = "failed";
      } catch (err) {
        // Anything where SHIPPOP gave no proper application answer is indeterminate: the confirm may have
        // gone through. Timeouts, network errors and gateway errors (5xx / HTML error pages) all reconcile below.
        if (err instanceof ShippopTimeoutError) confirmCall = "timeout";
        else if (err instanceof ShippopNetworkError) confirmCall = "network_error";
        else if (err instanceof ShippopApiError && err.isIndeterminate) confirmCall = "http_error";
        else throw err;
        confirmErrorMessage = (err as Error).message;
      }

      // Merge what confirm told us, keyed by SP tracking code.
      const byCode = new Map<
        string,
        { tracking_code: string; courier_code?: string; courier_tracking_code: string | null; confirm_status?: boolean; message?: string }
      >();
      for (const code of tracking_codes ?? []) byCode.set(code, { tracking_code: code, courier_tracking_code: null });
      for (const it of toArray<ConfirmItem>(confirmRes?.result)) {
        if (!it.tracking_code) continue;
        byCode.set(it.tracking_code, {
          tracking_code: it.tracking_code,
          courier_code: it.courier_code,
          courier_tracking_code: it.courier_tracking_code || null,
          confirm_status: it.status === true,
          message: it.message,
        });
      }

      const cleanAndComplete =
        confirmCall === "ok" &&
        byCode.size > 0 &&
        [...byCode.values()].every((s) => s.confirm_status === true && s.courier_tracking_code);

      // ADR 0003: reconcile exactly once via tracking_purchase whenever the confirm call was not clean and complete.
      let confirmation: "confirmed" | "not_confirmed" | "unknown";
      let purchaseStatus: string | undefined;
      let reconcileError: string | undefined;
      if (cleanAndComplete) {
        confirmation = "confirmed";
        purchaseStatus = "paid";
      } else {
        try {
          const p = await getPurchase(client, purchase_id);
          purchaseStatus = p.purchase_status;
          for (const s of p.shipments) {
            if (!s.tracking_code) continue;
            const existing = byCode.get(s.tracking_code) ?? { tracking_code: s.tracking_code, courier_tracking_code: null };
            existing.courier_code = existing.courier_code ?? s.courier_code;
            existing.courier_tracking_code = existing.courier_tracking_code ?? s.courier_tracking_code ?? null;
            byCode.set(s.tracking_code, existing);
          }
          if (purchaseStatus === "paid") confirmation = "confirmed";
          else if (purchaseStatus === "unpaid") confirmation = "not_confirmed";
          else confirmation = "unknown";
        } catch (err) {
          reconcileError = err instanceof Error ? err.message : String(err);
          confirmation = confirmCall === "failed" ? "not_confirmed" : "unknown";
        }
      }

      // A shipment the courier explicitly rejected (confirm_status false + message) is not "pending" — its
      // courier tracking code will never arrive. Only shipments without a verdict are pending.
      const shipments = [...byCode.values()].map((s) => ({
        ...s,
        courier_rejected: s.confirm_status === false,
        courier_tracking_pending: confirmation === "confirmed" && !s.courier_tracking_code && s.confirm_status !== false,
      }));
      const pending = shipments.filter((s) => s.courier_tracking_pending).map((s) => s.tracking_code);
      const failedItems = shipments.filter((s) => s.courier_rejected);

      let guidance: string;
      switch (confirmation) {
        case "confirmed":
          guidance =
            pending.length > 0
              ? `Purchase ${purchase_id} is PAID. Courier tracking codes are still pending for ${pending.join(", ")} — call shippop_track_shipment with those SP codes in a moment to get them. Do NOT confirm or book again.`
              : `Purchase ${purchase_id} is PAID and every shipment has a courier tracking code. Next: shippop_get_label to print labels.`;
          if (failedItems.length) {
            guidance += ` ${failedItems.length} shipment(s) were REJECTED by the courier and will not ship: ${failedItems
              .map((s) => `${s.tracking_code} (${s.message ?? "no reason given"})`)
              .join("; ")}. Fix the data and book those again as a new purchase.`;
          }
          break;
        case "not_confirmed":
          guidance = `Purchase ${purchase_id} is still UNPAID — the confirm did not go through. It is safe to call shippop_confirm_purchase again${confirmRes?.message ? ` after fixing: ${confirmRes.message}` : ""}.`;
          break;
        default:
          guidance = `Could not determine whether purchase ${purchase_id} was confirmed (confirm call: ${confirmCall}; status check: ${reconcileError ?? "no purchase_status"}). Do NOT retry confirm blindly — call shippop_get_purchase, or check the SHIPPOP console, and only re-confirm if purchase_status is unpaid.`;
      }

      const payload = {
        environment: client.env,
        purchase_id,
        confirmation,
        purchase_status: purchaseStatus,
        confirm_call: confirmCall,
        confirm_error: confirmErrorMessage ?? confirmRes?.message,
        reconcile_error: reconcileError,
        shipments,
        courier_tracking_pending: pending,
        courier_rejected: failedItems.map((s) => s.tracking_code),
        guidance,
      };
      return confirmation === "unknown" ? fail(payload) : ok(payload);
    }),
  );

  server.registerTool(
    "shippop_get_purchase",
    {
      title: "Get purchase status",
      description:
        "Read a purchase by purchase_id: purchase_status (unpaid = not yet confirmed, paid = confirmed, cancel), totals, and every shipment with its SP tracking code, courier tracking code, current status and actual weighed parcel. " +
        "Use this to reconcile after a confirm timeout before deciding whether to confirm again.",
      inputSchema: {
        purchase_id: z.number().int().positive(),
      },
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    },
    guard(client.env, async ({ purchase_id }) => {
      const p = await getPurchase(client, purchase_id);
      return ok({ environment: client.env, ...p });
    }),
  );
}
