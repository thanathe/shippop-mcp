import { describe, it, expect } from "vitest";
import { connect } from "./helpers.js";

const TOKEN = { status: "success", payload: { jwtToken: "jwt-1" } };
const inter = { username: "u@example.com", password: "pw", baseUrl: "https://inter.shippop.dev" };

describe("crossborder tools", () => {
  it("are not registered without credentials", async () => {
    const t = await connect({});
    const names = (await t.client.listTools()).tools.map((x) => x.name);
    expect(names.some((n) => n.startsWith("shippop_inter_"))).toBe(false);
    expect(names).toHaveLength(12);
    await t.close();
  });

  it("logs in lazily with JWT, sends bearer, and reuses the token", async () => {
    const t = await connect(
      {
        "/authen/getJWTToken": TOKEN,
        "/api/public/courier/price": { couriers: [{ id: 2, name: "Aramex PPX", price: "609.00", ref: "CRARMPPX", code: "aramex_ppx", type: "pick_up", duration: 4, error_code: null }, { id: 5, name: "ePacket", price: "0", ref: "CRTPEP", error_code: "notSupport.weight" }] },
      },
      { inter },
    );
    const names = (await t.client.listTools()).tools.map((x) => x.name);
    expect(names).toHaveLength(24);
    const { json, isError } = await t.call("shippop_inter_check_price", { weight: 1500, country_code: "au" });
    expect(isError).toBe(false);
    expect(t.calls[0].endpoint).toBe("/authen/getJWTToken");
    expect(t.calls[0].body).toEqual({ username: "u@example.com", password: "pw" });
    expect(t.calls[1].headers.Authorization).toBe("Bearer jwt-1");
    expect(t.calls[1].body).toEqual({ weight: 1500, country_code: "AU", show_all: true });
    expect(json.couriers[0]).toMatchObject({ courier_ref: "CRARMPPX", price: 609, available: true });
    expect(json.couriers[1]).toMatchObject({ available: false, error_code: "notSupport.weight" });

    await t.call("shippop_inter_check_price", { weight: 500, country_code: "JP" });
    expect(t.calls.filter((c) => c.endpoint === "/authen/getJWTToken")).toHaveLength(1);
    await t.close();
  });

  it("shares one login between concurrent first calls", async () => {
    const t = await connect(
      {
        "/authen/getJWTToken": async () => {
          await new Promise((r) => setTimeout(r, 20));
          return TOKEN;
        },
        "/api/public/courier/price": { couriers: [] },
      },
      { inter },
    );
    await Promise.all([
      t.call("shippop_inter_check_price", { weight: 100, country_code: "JP" }),
      t.call("shippop_inter_check_price", { weight: 200, country_code: "JP" }),
      t.call("shippop_inter_check_price", { weight: 300, country_code: "JP" }),
    ]);
    expect(t.calls.filter((c) => c.endpoint === "/authen/getJWTToken")).toHaveLength(1);
    expect(t.calls.filter((c) => c.endpoint === "/api/public/courier/price")).toHaveLength(3);
    await t.close();
  });

  it("re-authenticates once on 401", async () => {
    let tokenNo = 0;
    const t = await connect(
      {
        "/authen/getJWTToken": () => ({ status: "success", payload: { jwtToken: `jwt-${++tokenNo}` } }),
        "/api/public/country": (req: any) => (req.headers.Authorization === "Bearer jwt-1" ? { __http: 401, message: "expired" } : { countries: [{ id: 1, text: "Japan", alpha_2_code: "JP", destination_supported: true }, { id: 2, text: "Narnia", alpha_2_code: "NA", destination_supported: false }] }),
      },
      { inter },
    );
    const { json, isError } = await t.call("shippop_inter_list_countries", {});
    expect(isError).toBe(false);
    expect(t.calls.map((c) => c.endpoint)).toEqual(["/authen/getJWTToken", "/api/public/country", "/authen/getJWTToken", "/api/public/country"]);
    expect(t.calls[3].headers.Authorization).toBe("Bearer jwt-2");
    expect(t.calls[1].method).toBe("GET");
    expect(json.countries).toEqual([{ country_code: "JP", name: "Japan", calling_code: undefined, destination_supported: true, manufacturer_supported: undefined }]);
    await t.close();
  });

  it("creates shipments → calculates → creates order with payment_url, and deletes via DELETE", async () => {
    const t = await connect(
      {
        "/authen/getJWTToken": TOKEN,
        "/api/platform/shipment/many": { shipments: [{ tracking_code: "INT00004528" }] },
        "/api/platform/order/calculate": { order: { total_price: "120", net_price: "120" } },
        "/api/platform/order": { order_number: "OSH1", payment_url: "https://inter.shippop.dev/payment/order/OSH1" },
        "/api/platform/shipment": {},
      },
      { inter },
    );
    const shipment = {
      width: 20, length: 30, height: 10, total_weight: 1500,
      origin_address: { name: "Bob", phone: "+66-800000000", address: "111 Road", state: "Laksi", city: "Bangkok", postcode: "10210" },
      destination_address: { name: "Karen", phone: "+1-000", address: "275 Rockaway", state: "SC", city: "Augusta", postcode: "29841", country_code: "US" },
      goods: [{ name: "candy", pieces: 1, weight: 500, price: 10.5, manufacturer_country_code: "TH" }],
    };
    const created = await t.call("shippop_inter_create_shipments", { shipments: [shipment] });
    expect(created.json.tracking_codes).toEqual(["INT00004528"]);
    const sent = t.calls.find((c) => c.endpoint === "/api/platform/shipment/many")!.body.shipments[0];
    expect(sent.type).toBe("parcel");
    expect(sent.origin_address.email).toBe("u@example.com");
    expect(sent.require_coverage).toBe(false);
    expect(sent.goods[0].currency).toBe("THB");

    const calc = await t.call("shippop_inter_calculate_order", { tracking_codes: ["INT00004528"], courier_ref: "CRARMPPX" });
    expect(calc.json.order.total_price).toBe("120");

    const order = await t.call("shippop_inter_create_order", { tracking_codes: ["INT00004528"], courier_ref: "CRARMPPX" });
    const orderBody = t.calls.find((c) => c.endpoint === "/api/platform/order")!.body;
    expect(orderBody.payment_method).toBe("cash");
    expect(orderBody.accept_term_and_policy_date).toMatch(/^\d{4}-/);
    expect(order.json.payment_url).toMatch(/payment\/order\/OSH1/);
    expect(order.json.next_step).toMatch(/payment_url/);

    const del = await t.call("shippop_inter_delete_shipments", { tracking_codes: ["INT00004528"] });
    expect(del.isError).toBe(false);
    expect(t.calls[t.calls.length - 1].method).toBe("DELETE");
    await t.close();
  });

  it("lists shipments with goods and passes taxpayer/is_residential through on create", async () => {
    const t = await connect(
      {
        "/authen/getJWTToken": TOKEN,
        "/api/platform/shipment": (req: any) =>
          req.method === "GET"
            ? { shipments: [{ tracking_code: "INT1", status: "waiting", type: "parcel", total_weight: 1500, width: 1, length: 2, height: 3, taxpayer: "receiver", destination_address: { name: "K", city: "Tokyo", postcode: "150", country_id: 110 }, goods: [{ name: "Clothes", pieces: 1, weight: 1000, price: 1000, currency: "THB", hs_code: "620520" }], order_item: null }], total_shipment_amount: 1 }
            : {},
        "/api/platform/shipment/many": { shipments: [{ tracking_code: "INT2" }] },
      },
      { inter },
    );
    const l = await t.call("shippop_inter_list_shipments", {});
    expect(l.json.total).toBe(1);
    expect(l.json.shipments[0].goods[0]).toMatchObject({ name: "Clothes", hs_code: "620520" });
    expect(t.calls[1].url).toContain("page=1");

    await t.call("shippop_inter_create_shipments", {
      shipments: [{
        width: 1, length: 1, height: 1, total_weight: 100, taxpayer: "sender",
        origin_address: { name: "a", phone: "+66", address: "x", state: "s", city: "c", postcode: "1" },
        destination_address: { name: "b", phone: "+81", address: "y", state: "s", city: "c", postcode: "2", country_code: "JP", is_residential: true },
        goods: [{ name: "Clothes", pieces: 1, weight: 100, price: 10, manufacturer_country_code: "TH", hs_code: "620520" }],
      }],
    });
    const sent = t.calls.find((c) => c.endpoint === "/api/platform/shipment/many")!.body.shipments[0];
    expect(sent.taxpayer).toBe("sender");
    expect(sent.destination_address.is_residential).toBe(true);
    await t.close();
  });

  it("surfaces Inter HTTP errors as structured results and login failures clearly", async () => {
    const t = await connect({ "/authen/getJWTToken": { __http: 401, status: "error", message: "Invalid credentials" } }, { inter });
    const { isError, json } = await t.call("shippop_inter_track_shipment", { tracking_number: "INT1" });
    expect(isError).toBe(true);
    expect(json.error).toBe("shippop_inter_api_error");
    expect(json.message).toMatch(/login failed.*Invalid credentials/);
    await t.close();
  });
});
