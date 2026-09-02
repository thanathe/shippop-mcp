import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { connect } from "./helpers.js";

describe("shippop_track_shipment", () => {
  it("tracks without api_key and returns ordered events", async () => {
    const t = await connect({
      "/tracking/": {
        status: true,
        order_status: "shipping",
        courier_code: "KRYX",
        tracking_code: "SP529189074",
        courier_tracking_code: "SHIPBA3102971",
        state: {
          "0": { status: "010", datetime: "2023-10-17 17:29:47", location: "Bangkok", description: "picked up" },
          "1": { status: "102", datetime: "2023-10-17 19:46:33", location: "Bangkok", description: "at hub" },
        },
      },
    });
    const { json } = await t.call("shippop_track_shipment", { tracking_codes: ["SP529189074"] });
    expect(t.calls[0].body).toEqual({ tracking_code: "SP529189074" });
    const s = json.shipments[0];
    expect(s.order_status_meaning).toBe("In transit");
    expect(s.courier_tracking_code).toBe("SHIPBA3102971");
    expect(s.events).toHaveLength(2);
    expect(s.latest_event.description).toBe("at hub");
    await t.close();
  });

  it("isolates per-code failures", async () => {
    const t = await connect({
      "/tracking/": (req: any) => (req.body.tracking_code === "SPBAD" ? { status: false, code: 404, message: "Not found" } : { status: true, order_status: "wait" }),
    });
    const { json, isError } = await t.call("shippop_track_shipment", { tracking_codes: ["SPGOOD", "SPBAD"] });
    expect(isError).toBe(false);
    expect(json.shipments[0].order_status).toBe("wait");
    expect(json.shipments[1].error).toMatch(/Not found/);
    await t.close();
  });
});

describe("shippop_get_label", () => {
  it("writes a PDF to output_dir and returns the path", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "shippop-label-"));
    const t = await connect({ "/label/": { status: true, pdf: Buffer.from("%PDF-1.4 fake").toString("base64") } });
    const { json, isError } = await t.call("shippop_get_label", { purchase_id: 24744979, output_dir: dir });
    expect(isError).toBe(false);
    expect(t.calls[0].body).toMatchObject({ purchase_id: "24744979", type: "pdf", size: "sticker4x6", showproduct: 0 });
    expect(json.file.startsWith(dir)).toBe(true);
    expect(json.file).toMatch(/\.pdf$/);
    expect((await fs.readFile(json.file, "utf8")).startsWith("%PDF")).toBe(true);
    await t.close();
  });

  it("uses label_tracking_code for SP codes and returns json inline", async () => {
    const t = await connect({ "/label_tracking_code/": { status: true, json: { labels: [{ trackingCode: "SP1" }] } } });
    const { json } = await t.call("shippop_get_label", { tracking_codes: ["SP1", "SP2"], format: "json" });
    expect(t.calls[0].endpoint).toBe("/label_tracking_code/");
    expect(t.calls[0].body.tracking_code).toBe("SP1,SP2");
    expect(json.label.labels[0].trackingCode).toBe("SP1");
    await t.close();
  });

  it("rejects purchase-only sizes when printing by tracking code, and dates without codes", async () => {
    const t = await connect({});
    const a = await t.call("shippop_get_label", { tracking_codes: ["SP1"], size: "paperang" });
    expect(a.isError).toBe(true);
    expect(a.json.message).toMatch(/only available when printing by purchase_id/);
    const b = await t.call("shippop_get_label", { purchase_id: 1, order_date: "2026-09-02" });
    expect(b.isError).toBe(true);
    expect(b.json.message).toMatch(/pass tracking_codes/);
    expect(t.calls).toHaveLength(0);
    await t.close();
  });

  it("explains 'Purchase unconfirmed' from SHIPPOP", async () => {
    const t = await connect({ "/label/": { status: false, code: 404, message: "Error: Purchase unconfirmed" } });
    const { isError, json } = await t.call("shippop_get_label", { purchase_id: 43469596 });
    expect(isError).toBe(true);
    expect(json.message).toMatch(/only available after shippop_confirm_purchase/);
    await t.close();
  });

  it("errors when neither purchase_id nor tracking_codes given", async () => {
    const t = await connect({});
    const { isError, json } = await t.call("shippop_get_label", {});
    expect(isError).toBe(true);
    expect(json.message).toMatch(/purchase_id or tracking_codes/);
    await t.close();
  });
});

describe("shippop_cancel_shipment", () => {
  it("refuses an SP code", async () => {
    const t = await connect({});
    const { isError, json } = await t.call("shippop_cancel_shipment", { courier_tracking_code: "SP452045855" });
    expect(isError).toBe(true);
    expect(json.error).toBe("wrong_code_type");
    expect(t.calls).toHaveLength(0);
    await t.close();
  });
  it("cancels by courier tracking code", async () => {
    const t = await connect({ "/cancel/": { status: true } });
    const { json } = await t.call("shippop_cancel_shipment", { courier_tracking_code: "EA1TH" });
    expect(json.cancelled).toBe(true);
    expect(t.calls[0].body.courier_tracking_code).toBe("EA1TH");
    await t.close();
  });
});

describe("shippop_request_pickup / list_pickups", () => {
  it("flattens origin overrides to origin_* fields", async () => {
    const t = await connect({ "/calltopickup/": { status: true, courier_ticket_id: "T1", courier_pickup_id: 9 } });
    const { json } = await t.call("shippop_request_pickup", {
      courier_tracking_code: "EA1TH",
      datetime_pickup: "2026-09-03 09:00:00",
      origin: { name: "Shop", postcode: "10310" },
    });
    expect(t.calls[0].body).toMatchObject({ tracking_code: "EA1TH", num_of_parcel: 1, datetime_pickup: "2026-09-03 09:00:00", origin_name: "Shop", origin_postcode: "10310" });
    expect(json.courier_pickup_id).toBe(9);
    await t.close();
  });
  it("updates and cancels a pickup by courier_pickup_id", async () => {
    const t = await connect({ "/pickup/update/": { status: true }, "/pickup/cancel/": { status: false, code: 400, message: "already completed" } });
    const u = await t.call("shippop_update_pickup", { courier_pickup_id: 229, courier_staff_id: 63025 });
    expect(u.isError).toBe(false);
    expect(t.calls[0].body).toEqual({ api_key: "test-key", courier_pickup_id: 229, courier_staff_id: 63025 });
    const c = await t.call("shippop_cancel_pickup", { courier_pickup_id: 229 });
    expect(c.isError).toBe(true);
    expect(c.json.error).toBe("cancel_pickup_rejected");
    expect(c.json.message).toBe("already completed");
    await t.close();
  });

  it("defaults to a 30-day window when unfiltered", async () => {
    const t = await connect({ "/pickup/": { status: true, data: { items: [], pages: 0, page: 1, perpage: 25, total: "0" } } });
    const { json } = await t.call("shippop_list_pickups", {});
    const { start, end } = t.calls[0].body.created_at;
    expect(start).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(new Date(end.replace(" ", "T") + "+07:00").getTime() - new Date(start.replace(" ", "T") + "+07:00").getTime()).toBe(30 * 24 * 3600 * 1000);
    expect(json.created_at_filter).toEqual({ start, end });
    await t.close();
  });

  it("lists pickups with filters", async () => {
    const t = await connect({ "/pickup/": { status: true, data: { items: [{ id: 1 }], pages: 1, page: 1, perpage: 25, total: "1" } } });
    const { json } = await t.call("shippop_list_pickups", { created_from: "2026-09-01 00:00:00", created_to: "2026-09-01 23:59:59", courier_codes: ["FLE"] });
    expect(t.calls[0].body.created_at).toEqual({ start: "2026-09-01 00:00:00", end: "2026-09-01 23:59:59" });
    expect(json.total).toBe(1);
    expect(json.items).toHaveLength(1);
    await t.close();
  });
});

describe("timeouts on ordinary tools", () => {
  it("reports a timeout as a structured error with a caution note", async () => {
    const { HANG } = await import("./helpers.js");
    const t = await connect({ "/tracking_purchase/": HANG });
    const { isError, json } = await t.call("shippop_get_purchase", { purchase_id: 1 });
    expect(isError).toBe(true);
    expect(json.error).toBe("shippop_timeout");
    expect(json.note).toMatch(/may or may not/);
    await t.close();
  });
});
