import { describe, it, expect } from "vitest";
import { connect, ADDR_FROM, ADDR_TO, PARCEL } from "./helpers.js";

const PRICE_RESPONSE = {
  status: true,
  data: {
    "0": {
      FLE: { courier_code: "FLE", courier_name: "FlashExpress", price: "45", available: true, estimate_time: "1-2 วัน", err_code: "ERR_DEFAULT" },
      EMST: { courier_code: "EMST", courier_name: "EMS", price: "38", available: true, err_code: "ERR_DEFAULT" },
      LLM: { courier_code: "LLM", courier_name: "Lalamove", price: "0", available: false, err_code: "ERR_LAT_LNG" },
    },
  },
};

describe("shippop_check_price", () => {
  it("sends api_key + data and returns quotes sorted cheapest-first, available first", async () => {
    const t = await connect({ "/pricelist/": PRICE_RESPONSE });
    const { json, isError } = await t.call("shippop_check_price", {
      shipments: [{ from: ADDR_FROM, to: ADDR_TO, parcel: PARCEL }],
    });
    expect(isError).toBe(false);
    expect(t.calls[0].body.api_key).toBe("test-key");
    expect(t.calls[0].body.data["0"].showall).toBe(0);
    expect(t.calls[0].body.data["0"].parcel.weight).toBe(1000);
    const codes = json.shipments[0].quotes.map((q: any) => q.courier_code);
    expect(codes).toEqual(["EMST", "FLE", "LLM"]);
    expect(json.shipments[0].cheapest_available).toBe("EMST");
    expect(json.shipments[0].quotes[2].error_meaning).toMatch(/lat\/lng/);
    expect(json.environment).toBe("dev");
    await t.close();
  });

  it("surfaces SHIPPOP status:false as a structured error", async () => {
    const t = await connect({ "/pricelist/": { status: false, code: 400, message: "Incomplete request" } });
    const { json, isError } = await t.call("shippop_check_price", {
      shipments: [{ from: ADDR_FROM, to: ADDR_TO, parcel: PARCEL }],
    });
    expect(isError).toBe(true);
    expect(json.error).toBe("shippop_api_error");
    expect(json.message).toMatch(/Incomplete request/);
    await t.close();
  });
});

describe("shippop_list_couriers", () => {
  it("uses showall=1 on a sample route and enriches with static notes", async () => {
    const t = await connect({ "/pricelist/": PRICE_RESPONSE });
    const { json } = await t.call("shippop_list_couriers", {});
    expect(t.calls[0].body.data["0"].showall).toBe(1);
    expect(t.calls[0].body.data["0"].courier_code).toBeUndefined();
    const llm = json.couriers.find((c: any) => c.courier_code === "LLM");
    expect(llm.note).toMatch(/on-demand/i);
    expect(llm.available_for_sample_route).toBe(false);
    await t.close();
  });
});
