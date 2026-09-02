import { describe, it, expect } from "vitest";
import { connect, ADDR_FROM, ADDR_TO, PARCEL, HANG } from "./helpers.js";

const shipment = { from: ADDR_FROM, to: ADDR_TO, parcel: PARCEL, courier_code: "EMST" };

const BOOKING_OK = {
  status: true,
  purchase_id: 452002,
  total_price: 25,
  data: { "0": { status: true, tracking_code: "SP452045855", courier_code: "EMST", price: 25, courier_tracking_code: "" } },
};

describe("shippop_create_booking", () => {
  it("creates an unpaid purchase and never sends force_confirm (ADR 0001)", async () => {
    const t = await connect({ "/booking/": BOOKING_OK });
    const { json, isError } = await t.call("shippop_create_booking", { shipments: [shipment] });
    expect(isError).toBe(false);
    const body = t.calls[0].body;
    expect(body.email).toBe("test@example.com");
    expect(body.api_key).toBe("test-key");
    expect(body).not.toHaveProperty("force_confirm");
    expect(Array.isArray(body.data)).toBe(true);
    expect(json.purchase_id).toBe(452002);
    expect(json.purchase_status).toBe("unpaid");
    expect(json.tracking_codes).toEqual(["SP452045855"]);
    expect(json.next_step).toMatch(/confirm_purchase/);
    await t.close();
  });

  it("maps products and meta refs into SHIPPOP's shape", async () => {
    const t = await connect({ "/booking/": BOOKING_OK });
    await t.call("shippop_create_booking", {
      shipments: [
        {
          ...shipment,
          ref_no_1: "ORD-1",
          products: [{ product_code: "A", name: "Widget", category: "misc", price: 100, amount: 2, weight: 500 }],
        },
      ],
    });
    const item = t.calls[0].body.data[0];
    expect(item.meta).toEqual({ ref_no_1: "ORD-1", ref_no_2: undefined });
    expect(item.product[0].product_code).toBe("A");
    expect(item.products).toBeUndefined();
    await t.close();
  });

  it("reports a failed booking as an error with no purchase", async () => {
    const t = await connect({ "/booking/": { status: false, code: 404, message: "ERR_OUT_OF_AREA" } });
    const { json, isError } = await t.call("shippop_create_booking", { shipments: [shipment] });
    expect(isError).toBe(true);
    expect(json.error).toBe("booking_failed");
    expect(json.note).toMatch(/No purchase was created/);
    await t.close();
  });
});

const PURCHASE = (purchase_status: string, courierCode = "EA1TH") => ({
  status: true,
  purchase_id: 452002,
  purchase_status,
  total_price: "25.00",
  data: { "0": { tracking_code: "SP452045855", courier_code: "EMST", courier_tracking_code: courierCode, status: "booking" } },
});

describe("shippop_confirm_purchase (ADR 0003)", () => {
  it("clean and complete → confirmed without reconciling", async () => {
    const t = await connect({
      "/confirm/": { status: true, result: { "0": { status: true, tracking_code: "SP452045855", courier_tracking_code: "EA1TH", courier_code: "EMST" } } },
      "/tracking_purchase/": PURCHASE("paid"),
    });
    const { json, isError } = await t.call("shippop_confirm_purchase", { purchase_id: 452002 });
    expect(isError).toBe(false);
    expect(json.confirmation).toBe("confirmed");
    expect(json.courier_tracking_pending).toEqual([]);
    expect(t.calls.map((c) => c.endpoint)).toEqual(["/confirm/"]);
    expect(t.calls[0].headers["Content-Type"]).toMatch(/x-www-form-urlencoded/);
    expect(t.calls[0].body).toEqual({ api_key: "test-key", purchase_id: "452002" });
    await t.close();
  });

  it("timeout + purchase paid → confirmed, courier codes filled from reconciliation, confirm called exactly once", async () => {
    const t = await connect({ "/confirm/": HANG, "/tracking_purchase/": PURCHASE("paid") });
    const { json, isError } = await t.call("shippop_confirm_purchase", { purchase_id: 452002, tracking_codes: ["SP452045855"] });
    expect(isError).toBe(false);
    expect(json.confirm_call).toBe("timeout");
    expect(json.confirmation).toBe("confirmed");
    expect(json.shipments[0].courier_tracking_code).toBe("EA1TH");
    expect(json.shipments[0].courier_tracking_pending).toBe(false);
    expect(t.calls.filter((c) => c.endpoint === "/confirm/")).toHaveLength(1);
    expect(t.calls.map((c) => c.endpoint)).toEqual(["/confirm/", "/tracking_purchase/"]);
    expect(t.calls[1].body.email).toBe("test@example.com");
    await t.close();
  });

  it("timeout + purchase unpaid → not_confirmed and safe to retry", async () => {
    const t = await connect({ "/confirm/": HANG, "/tracking_purchase/": PURCHASE("unpaid", "") });
    const { json, isError } = await t.call("shippop_confirm_purchase", { purchase_id: 452002, tracking_codes: ["SP452045855"] });
    expect(isError).toBe(false);
    expect(json.confirmation).toBe("not_confirmed");
    expect(json.guidance).toMatch(/safe to call shippop_confirm_purchase again/);
    await t.close();
  });

  it("timeout + reconciliation fails → unknown, flagged as error, told not to retry blindly", async () => {
    const t = await connect({ "/confirm/": HANG, "/tracking_purchase/": new Error("ECONNRESET") });
    const { json, isError } = await t.call("shippop_confirm_purchase", { purchase_id: 452002, tracking_codes: ["SP452045855"] });
    expect(isError).toBe(true);
    expect(json.confirmation).toBe("unknown");
    expect(json.shipments[0].tracking_code).toBe("SP452045855");
    expect(json.guidance).toMatch(/Do NOT retry confirm blindly/);
    await t.close();
  });

  it("ok response but empty courier code → reconciles once; still-missing codes reported as pending", async () => {
    const t = await connect({
      "/confirm/": { status: true, result: { "0": { status: true, tracking_code: "SP452045855", courier_tracking_code: "", courier_code: "EMST" } } },
      "/tracking_purchase/": PURCHASE("paid", ""),
    });
    const { json, isError } = await t.call("shippop_confirm_purchase", { purchase_id: 452002 });
    expect(isError).toBe(false);
    expect(json.confirmation).toBe("confirmed");
    expect(json.courier_tracking_pending).toEqual(["SP452045855"]);
    expect(json.guidance).toMatch(/shippop_track_shipment/);
    expect(t.calls.map((c) => c.endpoint)).toEqual(["/confirm/", "/tracking_purchase/"]);
    await t.close();
  });

  it("confirm rejected (status:false) and purchase unpaid → not_confirmed with SHIPPOP's message", async () => {
    const t = await connect({
      "/confirm/": { status: false, code: 400, message: "insufficient credit" },
      "/tracking_purchase/": PURCHASE("unpaid", ""),
    });
    const { json } = await t.call("shippop_confirm_purchase", { purchase_id: 452002 });
    expect(json.confirmation).toBe("not_confirmed");
    expect(json.confirm_call).toBe("failed");
    expect(json.guidance).toMatch(/insufficient credit/);
    await t.close();
  });
});

describe("shippop_get_purchase", () => {
  it("returns purchase status and shipments", async () => {
    const t = await connect({ "/tracking_purchase/": PURCHASE("paid") });
    const { json } = await t.call("shippop_get_purchase", { purchase_id: 452002 });
    expect(json.purchase_status).toBe("paid");
    expect(json.shipments[0].status_meaning).toMatch(/Confirmed/);
    await t.close();
  });
});
