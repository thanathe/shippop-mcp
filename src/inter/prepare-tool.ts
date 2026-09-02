import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InterClient } from "./client.js";
import { InterDestinationAddressSchema, InterOriginAddressSchema } from "./schemas.js";
import { CATEGORY_LIST, DECLARATION_TIPS, checkFit, classifyItems, normalisePhone, splitAddress, tosToChecklist, volumetricWeightG, type Warning } from "./prepare.js";
import { ok } from "../result.js";
import { interGuard } from "./tools.js";

const ItemSchema = z.object({
  description: z.string().min(1).describe("What the item is, in Thai or English, e.g. 'อายไลเนอร์', 'เสื้อยืดผ้าฝ้าย', 'power bank'"),
  pieces: z.number().int().positive().default(1),
  weight_g: z.number().positive().optional().describe("Weight of this line in grams (all pieces). Estimated from total_weight if omitted."),
  value_thb: z.number().nonnegative().optional().describe("Declared customs value in THB for this line (all pieces)"),
  country_of_origin: z.string().length(2).optional().describe("Country of manufacture, ISO alpha-2 (default: TH)"),
  category_id: z.string().optional().describe("Force a playbook category (from `categories` in a previous result) when auto-matching picked the wrong one"),
});

const LooseAddressSchema = z.object({
  name: z.string().min(1),
  company: z.string().optional(),
  phone: z.string().min(1).describe("Any format; will be normalised to +<country>-<number>"),
  email: z.string().optional(),
  address_text: z.string().min(1).describe("Full street address on one line (building, street, district) — split into ≤50-char lines automatically. Do NOT include city/state/postcode/country here."),
  state: z.string().min(1).describe("State / prefecture / district"),
  city: z.string().min(1),
  postcode: z.string().min(1),
  taxpayer_id: z.string().optional(),
  is_residential: z.boolean().optional(),
});

export function registerPrepareTool(server: McpServer, client: InterClient, env: string, accountEmail: string) {
  server.registerTool(
    "shippop_inter_prepare_shipment",
    {
      title: "Crossborder: prepare declaration + checks (no side effects)",
      description:
        "Turn a plain-language list of parcel contents into a customs declaration SHIPPOP/couriers accept, and pre-check the parcel before shippop_inter_create_shipments. " +
        "Maps each item (Thai or English) to a generic category + 6-digit HS code the way SHIPPOP drafts phrase it (e.g. 'eyeliner' → 'Cosmetics (eye make-up)' 330420 — the wording that gets accepted at the counter), " +
        "flags items that are genuinely restricted for air freight (perfume, aerosol, lithium batteries, food, plants, medicine) with what to do instead, estimates missing line weights, " +
        "computes volumetric weight, checks the parcel against every courier's size/weight limits and quotes them, turns each courier's terms into a checklist, and normalises addresses (≤50-char lines, phone with country code). " +
        "Returns a ready `shipment` object plus `warnings` — show block/warn items to the user before creating. Nothing is created or charged.",
      inputSchema: {
        items: z.array(ItemSchema).min(1).max(50),
        parcel: z.object({
          width: z.number().positive().describe("cm"),
          length: z.number().positive().describe("cm"),
          height: z.number().positive().describe("cm"),
          total_weight_g: z.number().positive().describe("Gross weight incl. packaging, grams"),
        }),
        destination_country_code: z.string().length(2),
        shipment_type: z.enum(["parcel", "document"]).default("parcel"),
        taxpayer: z.enum(["receiver", "sender"]).default("receiver").describe("receiver = recipient pays import duty on arrival (DDU, SHIPPOP default); sender = you prepay (DDP)"),
        require_coverage: z.boolean().default(false),
        remark: z.string().optional(),
        origin: LooseAddressSchema.optional().describe("Sender in Thailand (English). Omit to fill in later."),
        destination: LooseAddressSchema.optional().describe("Receiver abroad (English). Omit to fill in later."),
      },
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    },
    interGuard(env, async (args) => {
      const country = args.destination_country_code.toUpperCase();
      const warnings: Warning[] = [];

      // --- 1. declaration ---
      const { goods, unclassified, warnings: w1 } = classifyItems(args.items, "TH", args.parcel.total_weight_g);
      warnings.push(...w1);
      if (args.shipment_type === "document" && goods.some((g) => g._category_id !== "document")) {
        warnings.push({ severity: "warn", message: "shipment_type is 'document' but the contents include non-document items — couriers will treat it as a parcel.", suggestion: "Use shipment_type 'parcel' unless it is paper only." });
      }

      // --- 2. destination + phone country codes (public data; failures degrade to warnings) ---
      let callingCode: string | undefined;
      let destSupported: boolean | undefined;
      try {
        const res = await client.request<{ countries?: { alpha_2_code: string; calling_code?: string; destination_supported?: boolean; text: string }[] }>("GET", "/api/public/country");
        const c = (res.countries ?? []).find((x) => x.alpha_2_code === country);
        if (!c) warnings.push({ severity: "block", message: `Country code ${country} is not known to SHIPPOP Inter.`, suggestion: "Check shippop_inter_list_countries." });
        else {
          destSupported = c.destination_supported;
          callingCode = c.calling_code;
          if (c.destination_supported === false) warnings.push({ severity: "block", message: `${c.text} (${country}) is not a supported destination.`, suggestion: "Check shippop_inter_list_countries for supported countries." });
        }
      } catch (err) {
        warnings.push({ severity: "info", message: `Could not verify the destination country online (${(err as Error).message}).` });
      }

      // --- 3. couriers: fit, price, checklist ---
      const p = { width: args.parcel.width, length: args.parcel.length, height: args.parcel.height, total_weight_g: args.parcel.total_weight_g };
      const volumetric = volumetricWeightG(p);
      let couriers: unknown[] = [];
      try {
        const res = await client.request<{ couriers?: any[] }>("POST", "/api/public/courier/price", { weight: p.total_weight_g, country_code: country, show_all: true });
        couriers = (res.couriers ?? [])
          .map((c) => {
            const fit = checkFit(p, c.condition);
            const usesVolumetric = /\/\s*5,?000/.test(c.tos ?? "");
            return {
              courier_ref: c.ref,
              name: c.name,
              price_thb: c.price !== undefined && c.price !== null ? Number(c.price) : undefined,
              duration_days: c.duration,
              handover: c.type,
              available: !c.error_code && fit.fits,
              not_available_because: c.error_code ?? (fit.fits ? undefined : fit.problems.join("; ")),
              chargeable_weight_g: usesVolumetric ? Math.max(p.total_weight_g, volumetric) : p.total_weight_g,
              price_note:
                usesVolumetric && volumetric > p.total_weight_g
                  ? `Quoted for ${p.total_weight_g} g; this courier bills the volumetric ${volumetric} g — re-quote with shippop_inter_check_price weight=${volumetric} for the real price.`
                  : undefined,
              limits: c.condition,
              checklist: tosToChecklist(c.tos),
            };
          })
          .sort((a: any, b: any) => (a.available === b.available ? (a.price_thb ?? Infinity) - (b.price_thb ?? Infinity) : a.available ? -1 : 1));
        if (!couriers.some((c: any) => c.available)) warnings.push({ severity: "block", message: "No courier accepts this parcel (size/weight or destination).", suggestion: "Split the parcel or reduce dimensions; see not_available_because per courier." });
      } catch (err) {
        warnings.push({ severity: "warn", message: `Could not fetch courier prices (${(err as Error).message}); size/weight limits not checked.` });
      }
      if (volumetric > p.total_weight_g * 1.5) {
        warnings.push({ severity: "info", message: `Volumetric weight (${volumetric} g) is well above actual (${p.total_weight_g} g) — express couriers charge the higher one.`, suggestion: "Use a smaller box, or prefer Thai Post services that price by actual weight." });
      }

      // --- 4. addresses ---
      const buildAddress = (a: z.infer<typeof LooseAddressSchema> | undefined, role: "origin" | "destination") => {
        if (!a) return undefined;
        const lines = splitAddress(a.address_text);
        if (lines.overflow) warnings.push({ severity: "warn", item: role, message: `Address is too long even for three 50-char lines; dropped: "${lines.overflow}"`, suggestion: "Shorten the address or move district info into state/city." });
        const ph = normalisePhone(a.phone, role === "origin" ? "66" : callingCode);
        if (ph.note) warnings.push({ severity: "info", item: role, message: `phone: ${ph.note}` });
        const out: Record<string, unknown> = {
          name: a.name.slice(0, 50),
          company: a.company,
          phone: ph.phone,
          email: a.email ?? (role === "origin" ? accountEmail : undefined),
          address: lines.address,
          address2: lines.address2,
          address3: lines.address3,
          state: a.state,
          city: a.city,
          postcode: a.postcode,
          taxpayer_id: a.taxpayer_id,
        };
        if (role === "destination") {
          out.country_code = country;
          if (a.is_residential !== undefined) out.is_residential = a.is_residential;
        }
        if (a.name.length > 50) warnings.push({ severity: "warn", item: role, message: "Name longer than 50 chars was truncated." });
        return out;
      };
      const origin_address = buildAddress(args.origin, "origin");
      const destination_address = buildAddress(args.destination, "destination");

      // Validate against the real schemas so the model gets the same errors create_shipments would give.
      for (const [role, schema, value] of [
        ["origin", InterOriginAddressSchema, origin_address],
        ["destination", InterDestinationAddressSchema, destination_address],
      ] as const) {
        if (!value) continue;
        const r = schema.safeParse(value);
        if (!r.success) warnings.push({ severity: "block", item: role, message: `Address invalid: ${r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}` });
      }

      const shipment = {
        type: args.shipment_type,
        width: Math.ceil(p.width),
        length: Math.ceil(p.length),
        height: Math.ceil(p.height),
        total_weight: Math.round(p.total_weight_g),
        remark: args.remark,
        require_coverage: args.require_coverage,
        taxpayer: args.taxpayer,
        origin_address,
        destination_address,
        goods: goods.map(({ _from, _category_id, _alternatives, ...g }) => g),
      };

      const order: Record<string, number> = { block: 0, warn: 1, info: 2 };
      warnings.sort((a, b) => order[a.severity] - order[b.severity]);
      const blocked = warnings.some((w) => w.severity === "block");

      return ok({
        environment: env,
        ready_to_create: !blocked && unclassified.length === 0 && !!origin_address && !!destination_address,
        destination: { country_code: country, supported: destSupported },
        volumetric_weight_g: volumetric,
        goods_explained: goods.map((g) => ({ from: g._from, declared_as: g.name, hs_code: g.hs_code, category_id: g._category_id, alternatives: g._alternatives })),
        unclassified,
        categories: unclassified.length ? CATEGORY_LIST : undefined,
        warnings,
        couriers,
        shipment,
        declaration_tips: DECLARATION_TIPS,
        next_step: blocked
          ? "Resolve the block warnings with the user before creating anything."
          : unclassified.length
            ? "Classify the unclassified items (pick a category_id) and call this tool again."
            : !origin_address || !destination_address
              ? "Collect the missing address(es), call again with origin/destination, then shippop_inter_create_shipments with `shipment`."
              : "Show the user the declaration, warnings and courier options; on their OK call shippop_inter_create_shipments with `shipment`, then shippop_inter_calculate_order with the chosen courier_ref.",
      });
    }),
  );
}
