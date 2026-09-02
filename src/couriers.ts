/**
 * Static courier code table from the SHIPPOP docs ("Courier Code - รายการขนส่ง").
 * Which of these an account can actually use ("couriers on hand") is account-specific —
 * `shippop_list_couriers` asks the API; this table only adds human-readable notes.
 */
export interface CourierInfo {
  code: string;
  name: string;
  note?: string;
}

export const COURIERS: CourierInfo[] = [
  { code: "SHF", name: "SHIPPOP Fruit" },
  { code: "EMST", name: "Thailand Post EMS" },
  { code: "EMSXP", name: "Thailand Post SPRESS (pickup)", note: "Seen live 2026-09; not in the published courier table" },
  { code: "ECP", name: "Thailand Post eCo-post" },
  { code: "DHL", name: "DHL Eco", note: "Courier tracking code is assigned already at booking (before confirm)" },
  { code: "FLE", name: "Flash Express" },
  { code: "FLEB", name: "Flash Express Bulky", note: "Large parcels" },
  { code: "FLEF", name: "Flash Express Fruit", note: "Fruit and vegetables" },
  { code: "FLEDS", name: "Flash Express Dropoff", note: "Dropoff offline — only for accounts with a physical shop branch" },
  { code: "BEST", name: "Best Express" },
  { code: "ARM", name: "Aramex" },
  { code: "KRYX", name: "KEX Exclusive (Kerry)" },
  { code: "KRYS", name: "KEX Offline (Kerry)", note: "Dropoff offline — only for accounts with a physical shop branch" },
  { code: "KRYDS", name: "KEX Dropoff (Kerry)", note: "Dropoff offline — only for accounts with a physical shop branch" },
  { code: "JNTP", name: "J&T Express (Pickup)", note: "Only for accounts with a physical shop branch" },
  { code: "JNTD", name: "J&T Express (Dropoff)", note: "Dropoff offline — only for accounts with a physical shop branch" },
  { code: "LZDS", name: "Lazada Dropoff", note: "Dropoff offline — only for accounts with a physical shop branch" },
  { code: "MSE", name: "Makesend" },
  { code: "MSEC", name: "Makesend Chilled", note: "Chilled goods" },
  { code: "MSEF", name: "Makesend Frozen", note: "Frozen goods" },
  { code: "SPX", name: "SPX Express (Shopee)" },
  { code: "LLM", name: "Lalamove", note: "On-demand — requires lat/lng on both addresses" },
  { code: "SKT", name: "Skootar", note: "On-demand — requires lat/lng on both addresses; supports starttime/finishtime" },
];

export const COURIER_BY_CODE: Record<string, CourierInfo> = Object.fromEntries(COURIERS.map((c) => [c.code, c]));
