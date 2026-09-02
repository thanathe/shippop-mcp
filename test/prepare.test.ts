import { describe, it, expect } from "vitest";
import { connect } from "./helpers.js";
import { classifyItems, splitAddress, normalisePhone, volumetricWeightG, checkFit, tosToChecklist } from "../src/inter/prepare.js";
import { findCategories } from "../src/inter/playbook.js";

describe("playbook", () => {
  it("declares eyeliner as Cosmetics (Thanat's counter case)", () => {
    expect(findCategories("อายไลเนอร์ 3 แท่ง")[0]).toMatchObject({ id: "cosmetics_eye", name: "Cosmetics (eye make-up)", hs_code: "330420" });
    expect(findCategories("eyeliner")[0].id).toBe("cosmetics_eye");
  });
  it("prefers the more specific keyword", () => {
    expect(findCategories("เสื้อยืด")[0].id).toBe("tshirt");
    expect(findCategories("สเปรย์ผม")[0].id).toBe("hair_spray");
  });
  it("uses SHIPPOP's own draft conventions", () => {
    expect(findCategories("clothes")[0]).toMatchObject({ name: "Clothes", hs_code: "620520" });
    expect(findCategories("อาหารเสริม")[0]).toMatchObject({ name: "Supplementary food", hs_code: "210690" });
  });
});

describe("classifyItems", () => {
  it("blocks perfume and power banks, warns on liquids, and estimates weights", () => {
    const r = classifyItems(
      [{ description: "น้ำหอม" }, { description: "power bank", value_thb: 900 }, { description: "ครีมบำรุง", pieces: 2, value_thb: 500 }],
      "TH",
      1000,
    );
    expect(r.goods.map((g) => g.name)).toEqual(["Perfume", "Power bank (lithium battery)", "Cosmetics (skin care)"]);
    expect(r.warnings.find((w) => w.flag === "flammable")?.severity).toBe("block");
    expect(r.warnings.find((w) => w.flag === "lithium_battery")?.severity).toBe("block");
    expect(r.warnings.find((w) => w.flag === "liquid")?.severity).toBe("warn");
    expect(r.goods.reduce((s, g) => s + g.weight, 0)).toBeLessThanOrEqual(900);
    expect(r.goods[2].weight).toBeGreaterThan(r.goods[0].weight); // 2 pieces get more of the estimate
    expect(r.warnings.some((w) => /No value given/.test(w.message) && w.item === "น้ำหอม")).toBe(true);
  });
  it("reports unclassified items and blocks over-weight declarations", () => {
    const r = classifyItems([{ description: "xyzzy widget", weight_g: 2000 }, { description: "หนังสือ", weight_g: 1200 }], "TH", 1000);
    expect(r.unclassified).toHaveLength(1);
    expect(r.goods).toHaveLength(1);
    expect(r.warnings.some((w) => w.severity === "block" && /exceed total_weight/.test(w.message))).toBe(true);
  });
  it("honours a forced category_id", () => {
    const r = classifyItems([{ description: "สร้อยแฟชั่นไม่ใช่ทอง", category_id: "imitation_jewelry" }], "TH", 200);
    expect(r.goods[0].hs_code).toBe("711719");
  });
});

describe("helpers", () => {
  it("volumetric weight uses W×L×H/5000 kg", () => {
    expect(volumetricWeightG({ width: 20, length: 30, height: 10, total_weight_g: 1 })).toBe(1200);
  });
  it("checkFit reports each violated limit", () => {
    const r = checkFit({ width: 70, length: 20, height: 20, total_weight_g: 2500 }, { max_weight: 2000, max_width: 60, max_sum_wlh: 90 });
    expect(r.fits).toBe(false);
    expect(r.problems).toHaveLength(3);
  });
  it("splits long addresses into 50-char lines", () => {
    const r = splitAddress("6F., No. 189, Wuxing Street, Xinyi District, some very long building name tower B floor 12");
    expect(r.address.length).toBeLessThanOrEqual(50);
    expect(r.address2!.length).toBeLessThanOrEqual(50);
    expect(r.address + " " + r.address2 + (r.address3 ? " " + r.address3 : "")).toContain("Xinyi District");
  });
  it("normalises phones to +cc-number", () => {
    expect(normalisePhone("081-234-5678", "66").phone).toBe("+66-812345678");
    expect(normalisePhone("+81 90 1234 5678").phone).toBe("+81-9012345678");
    expect(normalisePhone("+819012345678", "81").phone).toBe("+81-9012345678");
    expect(normalisePhone("+819012345678").note).toMatch(/country code/);
    expect(normalisePhone("0901234567").note).toMatch(/no country code/);
  });
  it("turns tos into a checklist without boilerplate", () => {
    const list = tosToChecklist("1. Print 4 Airway Bills and attach to the parcel\n2. Maximum weight: 5 kilograms\nOtherwise, shipments will be delivered on the next business day.\nFor more information, please call 02");
    expect(list).toEqual(["Print 4 Airway Bills and attach to the parcel", "Maximum weight: 5 kilograms"]);
  });
});

describe("shippop_inter_prepare_shipment (tool)", () => {
  const inter = { username: "u@example.com", password: "pw", baseUrl: "https://inter.shippop.dev" };
  const routes = {
    "/authen/getJWTToken": { status: "success", payload: { jwtToken: "jwt" } },
    "/api/public/country": { countries: [{ id: 1, text: "Japan", alpha_2_code: "JP", calling_code: "81", destination_supported: true }] },
    "/api/public/courier/price": {
      couriers: [
        { id: 5, name: "Thai Post - ePacket", ref: "CRTPEP", price: "678", duration: "3 - 24", type: "pick_up_drop_off", condition: { max_weight: 2000, max_sum_wlh: 90 }, tos: "1. Print 1 Airway Bill\n2. Maximum weight: 2 kilograms", error_code: null },
        { id: 8, name: "UPS Expedited", ref: "CRUPS08", price: "930", duration: "3 - 5", type: "pick_up", condition: {}, tos: "1. Print 1 label\n5. Width x length x height / 5000, calculated by the higher", error_code: null },
      ],
    },
  };

  it("produces a ready shipment with declaration, couriers, checklist and normalised addresses", async () => {
    const t = await connect(routes, { inter });
    const { json, isError } = await t.call("shippop_inter_prepare_shipment", {
      items: [{ description: "อายไลเนอร์", pieces: 3, weight_g: 60, value_thb: 600 }, { description: "เสื้อยืด", pieces: 2, weight_g: 400, value_thb: 800 }],
      parcel: { width: 20, length: 30, height: 10, total_weight_g: 700 },
      destination_country_code: "jp",
      origin: { name: "Somchai", phone: "0812345678", address_text: "99/1 Sukhumvit 71, Phra Khanong Nuea", state: "Watthana", city: "Bangkok", postcode: "10110" },
      destination: { name: "Karen Tanaka", phone: "090 1234 5678", address_text: "1-2-3 Shibuya, Shibuya-ku, some long apartment building name room 1203", state: "Tokyo", city: "Shibuya", postcode: "150-0002", is_residential: true },
    });
    expect(isError).toBe(false);
    expect(json.ready_to_create).toBe(true);
    expect(json.shipment.goods).toEqual([
      { name: "Cosmetics (eye make-up)", pieces: 3, weight: 60, price: 600, currency: "THB", hs_code: "330420", manufacturer_country_code: "TH" },
      { name: "T-shirt (cotton)", pieces: 2, weight: 400, price: 800, currency: "THB", hs_code: "610910", manufacturer_country_code: "TH" },
    ]);
    expect(json.shipment.origin_address.phone).toBe("+66-812345678");
    expect(json.shipment.origin_address.email).toBe("u@example.com");
    expect(json.shipment.destination_address).toMatchObject({ phone: "+81-9012345678", country_code: "JP", is_residential: true });
    expect(json.shipment.destination_address.address.length).toBeLessThanOrEqual(50);
    expect(json.shipment.taxpayer).toBe("receiver");
    expect(json.volumetric_weight_g).toBe(1200);
    const ups = json.couriers.find((c: any) => c.courier_ref === "CRUPS08");
    expect(ups.chargeable_weight_g).toBe(1200);
    const epacket = json.couriers.find((c: any) => c.courier_ref === "CRTPEP");
    expect(epacket.available).toBe(true);
    expect(epacket.checklist).toEqual(["Print 1 Airway Bill", "Maximum weight: 2 kilograms"]);
    expect(json.warnings.some((w: any) => w.severity === "block")).toBe(false);
    expect(t.calls.filter((c) => c.endpoint.includes("shipment"))).toHaveLength(0); // nothing created
    await t.close();
  });

  it("flags blocks, unfit couriers, unsupported country and unclassified items", async () => {
    const t = await connect(
      { ...routes, "/api/public/country": { countries: [{ id: 2, text: "Narnia", alpha_2_code: "NA", calling_code: "1", destination_supported: false }] } },
      { inter },
    );
    const { json } = await t.call("shippop_inter_prepare_shipment", {
      items: [{ description: "น้ำหอม", value_thb: 2000 }, { description: "gizmo unknown" }],
      parcel: { width: 60, length: 60, height: 60, total_weight_g: 2500 },
      destination_country_code: "NA",
    });
    expect(json.ready_to_create).toBe(false);
    expect(json.unclassified).toHaveLength(1);
    expect(json.categories.length).toBeGreaterThan(30);
    const blocks = json.warnings.filter((w: any) => w.severity === "block").map((w: any) => w.message);
    expect(blocks.some((m: string) => /Flammable/.test(m))).toBe(true);
    expect(blocks.some((m: string) => /not a supported destination/.test(m))).toBe(true);
    const epacket = json.couriers.find((c: any) => c.courier_ref === "CRTPEP");
    expect(epacket.available).toBe(false);
    expect(epacket.not_available_because).toMatch(/weight 2500 g > max 2000 g/);
    expect(json.warnings[0].severity).toBe("block"); // sorted
    await t.close();
  });
});
