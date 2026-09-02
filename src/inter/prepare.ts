import { CATEGORIES, DECLARATION_TIPS, FLAG_RULES, findCategories, type Category, type Flag, type Severity } from "./playbook.js";

export interface ItemInput {
  description: string;
  pieces?: number;
  weight_g?: number;
  value_thb?: number;
  country_of_origin?: string;
  category_id?: string;
}

export interface ParcelInput {
  width: number;
  length: number;
  height: number;
  total_weight_g: number;
}

export interface Warning {
  severity: Severity;
  item?: string;
  flag?: Flag;
  message: string;
  suggestion?: string;
}

export interface PreparedGood {
  name: string;
  pieces: number;
  weight: number;
  price: number;
  currency: "THB";
  hs_code: string;
  manufacturer_country_code: string;
  sku_number?: string;
  /** Provenance for the model — not sent to SHIPPOP. */
  _from: string;
  _category_id: string;
  _alternatives?: { category_id: string; name: string; hs_code: string }[];
}

const NET_WEIGHT_SHARE = 0.9; // packaging is assumed ~10% of total when line weights are unknown

export function classifyItems(items: ItemInput[], defaultOrigin: string, totalWeightG: number) {
  const goods: PreparedGood[] = [];
  const unclassified: { description: string; hint: string }[] = [];
  const warnings: Warning[] = [];
  const seenFlags = new Map<string, Flag[]>();

  for (const item of items) {
    const byId = item.category_id ? CATEGORIES.find((c) => c.id === item.category_id) : undefined;
    const matches = byId ? [byId] : findCategories(item.description);
    const cat = matches[0];
    if (!cat) {
      unclassified.push({ description: item.description, hint: "Pick a category_id from `categories` and call again, or describe the item with a more common word." });
      continue;
    }
    goods.push({
      name: cat.name,
      pieces: item.pieces ?? 1,
      weight: item.weight_g ?? 0,
      price: item.value_thb ?? 0,
      currency: "THB",
      hs_code: cat.hs_code,
      manufacturer_country_code: (item.country_of_origin ?? defaultOrigin).toUpperCase(),
      _from: item.description,
      _category_id: cat.id,
      _alternatives: matches.slice(1, 4).map((m) => ({ category_id: m.id, name: m.name, hs_code: m.hs_code })),
    });
    if (cat.note) warnings.push({ severity: "info", item: item.description, message: cat.note });
    for (const f of cat.flags ?? []) {
      const list = seenFlags.get(item.description) ?? [];
      if (!list.includes(f)) list.push(f);
      seenFlags.set(item.description, list);
    }
    if (item.value_thb === undefined) warnings.push({ severity: "warn", item: item.description, message: "No value given — customs requires a realistic value per line.", suggestion: "Set value_thb (what the recipient would pay for it)." });
  }

  for (const [item, flags] of seenFlags) {
    for (const f of flags) {
      const rule = FLAG_RULES[f];
      warnings.push({ severity: rule.severity, item, flag: f, message: rule.message, suggestion: rule.suggestion });
    }
  }

  // Distribute unknown weights over the net weight.
  const known = goods.filter((g) => g.weight > 0).reduce((s, g) => s + g.weight, 0);
  const unknown = goods.filter((g) => g.weight === 0);
  if (unknown.length) {
    const remaining = Math.max(totalWeightG * NET_WEIGHT_SHARE - known, 0);
    const pieces = unknown.reduce((s, g) => s + g.pieces, 0) || 1;
    for (const g of unknown) g.weight = Math.max(1, Math.round((remaining * g.pieces) / pieces));
    warnings.push({ severity: "info", message: `Line weights for ${unknown.length} item(s) were estimated from total_weight (net = ${NET_WEIGHT_SHARE * 100}% of gross). Replace with real weights if known.` });
  }
  const sum = goods.reduce((s, g) => s + g.weight, 0);
  if (sum > totalWeightG) {
    warnings.push({ severity: "block", message: `Declared line weights (${sum} g) exceed total_weight (${totalWeightG} g).`, suggestion: "Raise total_weight (it must include packaging) or correct the line weights." });
  }
  return { goods, unclassified, warnings };
}

export interface CourierCondition {
  max_weight?: number | null;
  max_width?: number | null;
  max_length?: number | null;
  max_height?: number | null;
  max_sum_wlh?: number | null;
}

export function volumetricWeightG(p: ParcelInput, divisor = 5000): number {
  return Math.round(((p.width * p.length * p.height) / divisor) * 1000);
}

export function checkFit(p: ParcelInput, c: CourierCondition | undefined) {
  const problems: string[] = [];
  if (!c) return { fits: true, problems };
  if (c.max_weight && p.total_weight_g > c.max_weight) problems.push(`weight ${p.total_weight_g} g > max ${c.max_weight} g`);
  if (c.max_width && p.width > c.max_width) problems.push(`width ${p.width} cm > max ${c.max_width}`);
  if (c.max_length && p.length > c.max_length) problems.push(`length ${p.length} cm > max ${c.max_length}`);
  if (c.max_height && p.height > c.max_height) problems.push(`height ${p.height} cm > max ${c.max_height}`);
  const sum = p.width + p.length + p.height;
  if (c.max_sum_wlh && sum > c.max_sum_wlh) problems.push(`W+L+H ${sum} cm > max ${c.max_sum_wlh}`);
  return { fits: problems.length === 0, problems };
}

/** Turn the courier's free-text `tos` into a checklist of short lines. */
export function tosToChecklist(tos: string | undefined): string[] {
  if (!tos) return [];
  return tos
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*\d+[.)]\s*/, "").trim())
    .filter((l) => l && !/^for more information/i.test(l) && !/^otherwise, shipments/i.test(l));
}

/** Split an address line into ≤max-char chunks at word boundaries (SHIPPOP Inter caps each line at 50). */
export function splitAddress(text: string, max = 50): { address: string; address2?: string; address3?: string; overflow?: string } {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length <= max) cur = (cur + " " + w).trim();
    else {
      if (cur) lines.push(cur);
      cur = w.length > max ? w.slice(0, max) : w;
    }
  }
  if (cur) lines.push(cur);
  return { address: lines[0] ?? "", address2: lines[1], address3: lines[2], overflow: lines.length > 3 ? lines.slice(3).join(" ") : undefined };
}

export function normalisePhone(phone: string, callingCode?: string): { phone: string; note?: string } {
  const trimmed = phone.trim();
  if (trimmed.startsWith("+")) {
    // "+81 90 1234 5678" / "+81-90-1234-5678": the first group is the country code.
    const grouped = /^\+(\d{1,3})[\s-]+([\d\s-]+)$/.exec(trimmed);
    if (grouped) return { phone: `+${grouped[1]}-${grouped[2].replace(/\D/g, "")}` };
    const digits = trimmed.replace(/\D/g, "");
    // "+819012345678": only split when we know the expected country code.
    if (callingCode && digits.startsWith(callingCode)) return { phone: `+${callingCode}-${digits.slice(callingCode.length)}` };
    return { phone: `+${digits}`, note: "Could not tell the country code apart from the number — write it as +<country>-<number>." };
  }
  const digits = trimmed.replace(/\D/g, "");
  if (callingCode) {
    const local = digits.replace(/^0/, "");
    return { phone: `+${callingCode}-${local}`, note: `Added country code +${callingCode} and dropped the leading 0.` };
  }
  return { phone: digits, note: "Phone has no country code — SHIPPOP expects +<country>-<number>." };
}

export const CATEGORY_LIST = CATEGORIES.map((c) => ({ category_id: c.id, name: c.name, hs_code: c.hs_code, flags: c.flags }));
export { DECLARATION_TIPS, type Category };
