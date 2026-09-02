/**
 * Declaration playbook for SHIPPOP Inter (crossborder, air).
 *
 * Why this exists: customs/courier acceptance depends on how goods are *worded*. Counter staff reject
 * "eyeliner ×3" as "liquid, cannot fly" but accept the same parcel declared as "Cosmetics" (Thanat's
 * real case). SHIPPOP's own historical drafts use the same convention — a generic English category
 * plus a 6-digit HS code ("Clothes 620520", "Accessory 611780", "Necklace 711319",
 * "Supplementary food 210690"). This table maps everyday Thai/English item words to that convention
 * and flags items that are genuinely restricted for air freight. It never hides a dangerous good.
 */

export type Flag =
  | "flammable" // alcohol-based perfume, nail polish — forbidden in postal air mail
  | "aerosol" // pressurised cans — forbidden
  | "lithium_battery" // power banks, loose cells — forbidden by post; couriers need DG handling
  | "battery_in_device" // phones, watches — usually OK when installed, declare it
  | "liquid" // creams, sauces, shampoo — allowed when sealed; wording matters
  | "magnet"
  | "perishable"
  | "plant_animal" // seeds, plants, meat, dairy — phytosanitary / import bans
  | "medicine" // medicaments, supplements — destination permits
  | "food" // packaged food — many destinations restrict
  | "valuable" // jewellery, cash, gold — insurance / prohibited
  | "prohibited"; // cash, lighters, weapons

export type Severity = "block" | "warn" | "info";

export interface Category {
  /** Stable id used in results. */
  id: string;
  /** Wording to put in goods[].name — generic, the way customs and SHIPPOP drafts phrase it. */
  name: string;
  hs_code: string;
  keywords: string[];
  flags?: Flag[];
  note?: string;
}

export const FLAG_RULES: Record<Flag, { severity: Severity; message: string; suggestion: string }> = {
  flammable: {
    severity: "block",
    message: "Flammable liquid (alcohol-based) — not accepted in air mail by Thailand Post and most couriers.",
    suggestion: "Do not ship by post. Ask SHIPPOP crossborder support (cs_crossborder@shippop.com) whether a courier accepts it as dangerous goods; otherwise remove it from the parcel.",
  },
  aerosol: {
    severity: "block",
    message: "Pressurised aerosol — prohibited in air freight.",
    suggestion: "Remove from the parcel. Non-aerosol pump versions are usually fine (declare as the product category).",
  },
  lithium_battery: {
    severity: "block",
    message: "Loose lithium battery / power bank — prohibited in postal air mail and needs dangerous-goods handling with couriers.",
    suggestion: "Remove it, or contact SHIPPOP support for a courier that accepts UN3480/UN3481 with proper labelling.",
  },
  battery_in_device: {
    severity: "warn",
    message: "Device contains a battery — generally accepted when installed in the device, but must be declared honestly.",
    suggestion: "Declare the device category (e.g. 'Mobile phone'), keep it switched off, do not pack spare batteries.",
  },
  liquid: {
    severity: "warn",
    message: "Contains liquid/cream/gel — acceptable when sealed and leak-proof, but staff may refuse if the description sounds like 'liquid'.",
    suggestion: "Declare the product category (e.g. 'Cosmetics (skin care)'), seal caps with tape, bag each item, avoid the words 'liquid', 'water', 'spray'.",
  },
  magnet: { severity: "warn", message: "Magnetic material may need magnetism screening for air freight.", suggestion: "Keep it small and shielded; declare as the product category." },
  perishable: { severity: "warn", message: "Perishable goods — 3–24 day transit with no cold chain.", suggestion: "Only ship shelf-stable items; otherwise choose the fastest courier." },
  plant_animal: {
    severity: "block",
    message: "Plant / animal origin product — most destinations require phytosanitary or veterinary permits or ban it outright.",
    suggestion: "Check the destination's import rules first; processed/packaged items are sometimes allowed, fresh or seed items usually not.",
  },
  medicine: {
    severity: "warn",
    message: "Medicine / supplement — destination customs may require a permit, prescription, or limit quantity for personal use.",
    suggestion: "Ship personal-use quantities only, keep original packaging, declare the real product name and category.",
  },
  food: {
    severity: "warn",
    message: "Packaged food — several destinations (AU, NZ, JP, US) restrict or inspect food imports.",
    suggestion: "Only sealed, shelf-stable, commercially packaged food with ingredient labels; no meat, dairy, fresh produce.",
  },
  valuable: {
    severity: "warn",
    message: "High-value item — consider insurance coverage; some couriers cap declared value.",
    suggestion: "Set require_coverage=true and pick a coverage_ref from shippop_inter_get_coverages; declare the true value.",
  },
  prohibited: { severity: "block", message: "Prohibited item for international mail.", suggestion: "Remove from the parcel." },
};

// Keywords are matched case-insensitively as substrings (Thai has no word boundaries).
export const CATEGORIES: Category[] = [
  // --- cosmetics & personal care ---
  { id: "cosmetics_eye", name: "Cosmetics (eye make-up)", hs_code: "330420", keywords: ["eyeliner", "อายไลเนอร์", "mascara", "มาสคาร่า", "eyeshadow", "อายแชโดว์", "eyebrow", "ดินสอเขียนคิ้ว"], note: "Thanat's verified case: 'eyeliner' was refused as liquid by Thailand Post; 'Cosmetic' was accepted." },
  { id: "cosmetics_lip", name: "Cosmetics (lip make-up)", hs_code: "330410", keywords: ["lipstick", "ลิปสติก", "ลิป", "lip gloss", "lip tint", "ลิปทินต์"] },
  { id: "cosmetics_powder", name: "Cosmetics (face powder)", hs_code: "330491", keywords: ["แป้ง", "powder", "แป้งพัฟ", "blush", "บลัช", "ไฮไลท์", "highlighter"] },
  { id: "cosmetics_skincare", name: "Cosmetics (skin care)", hs_code: "330499", keywords: ["ครีม", "cream", "เซรั่ม", "serum", "โลชั่น", "lotion", "รองพื้น", "foundation", "กันแดด", "sunscreen", "toner", "โทนเนอร์", "มาส์ก", "mask", "skincare", "สกินแคร์", "essence"], flags: ["liquid"] },
  { id: "perfume", name: "Perfume", hs_code: "330300", keywords: ["น้ำหอม", "perfume", "eau de", "cologne", "โคโลญ"], flags: ["flammable"] },
  { id: "nail_polish", name: "Nail polish", hs_code: "330430", keywords: ["ยาทาเล็บ", "nail polish", "nail lacquer", "สีทาเล็บ"], flags: ["flammable"] },
  { id: "hair_spray", name: "Hair spray", hs_code: "330530", keywords: ["สเปรย์ผม", "hair spray", "hairspray"], flags: ["aerosol"] },
  { id: "aerosol", name: "Aerosol spray", hs_code: "330720", keywords: ["สเปรย์", "spray", "aerosol", "กระป๋องอัดแก๊ส"], flags: ["aerosol"] },
  { id: "shampoo", name: "Hair care (shampoo/conditioner)", hs_code: "330510", keywords: ["แชมพู", "shampoo", "ครีมนวด", "conditioner", "hair treatment"], flags: ["liquid"] },
  { id: "soap", name: "Soap", hs_code: "340111", keywords: ["สบู่", "soap", "body wash", "เจลอาบน้ำ"], flags: ["liquid"] },
  { id: "toothpaste", name: "Oral care (toothpaste)", hs_code: "330610", keywords: ["ยาสีฟัน", "toothpaste", "แปรงสีฟัน", "toothbrush"] },
  { id: "balm", name: "Herbal balm (medicated ointment)", hs_code: "300490", keywords: ["ยาหม่อง", "balm", "ยาดม", "inhaler", "น้ำมันเหลือง", "tiger balm", "ยานวด"], flags: ["medicine"] },

  // --- clothing & fashion ---
  { id: "clothes", name: "Clothes", hs_code: "620520", keywords: ["เสื้อ", "กางเกง", "เดรส", "dress", "shirt", "pants", "clothes", "clothing", "ชุด", "แจ็คเก็ต", "jacket", "กระโปรง", "skirt", "ผ้าถุง", "ชุดนอน"] },
  { id: "tshirt", name: "T-shirt (cotton)", hs_code: "610910", keywords: ["เสื้อยืด", "t-shirt", "tshirt", "tee"] },
  { id: "underwear", name: "Underwear", hs_code: "610821", keywords: ["ชุดชั้นใน", "underwear", "กางเกงใน", "bra", "บรา"] },
  { id: "shoes", name: "Footwear", hs_code: "640399", keywords: ["รองเท้า", "shoes", "sneaker", "sandals", "รองเท้าแตะ", "boots"] },
  { id: "bag", name: "Bag", hs_code: "420292", keywords: ["กระเป๋า", "bag", "backpack", "เป้", "wallet", "กระเป๋าสตางค์", "pouch"] },
  { id: "accessory", name: "Accessory", hs_code: "611780", keywords: ["accessory", "แอคเซสซอรี่", "หมวก", "hat", "cap", "ผ้าพันคอ", "scarf", "ถุงเท้า", "socks", "ถุงมือ", "gloves", "เข็มขัด", "belt", "ยางรัดผม", "hair tie", "ที่คาดผม"] },
  { id: "fabric", name: "Fabric (textile)", hs_code: "520812", keywords: ["ผ้า", "fabric", "textile", "ผ้าไหม", "silk"] },
  { id: "jewelry", name: "Necklace (jewellery)", hs_code: "711319", keywords: ["สร้อย", "necklace", "แหวน", "ring", "ต่างหู", "earring", "กำไล", "bracelet", "jewel", "เครื่องประดับ"], flags: ["valuable"], note: "Use 'Imitation jewellery' (711719) for fashion/non-precious pieces." },
  { id: "imitation_jewelry", name: "Imitation jewellery", hs_code: "711719", keywords: ["เครื่องประดับแฟชั่น", "imitation", "fashion jewelry", "costume jewelry", "สร้อยแฟชั่น"] },
  { id: "watch", name: "Wrist watch", hs_code: "910211", keywords: ["นาฬิกา", "watch", "smartwatch"], flags: ["battery_in_device", "valuable"] },
  { id: "glasses", name: "Eyeglasses / sunglasses", hs_code: "900410", keywords: ["แว่น", "glasses", "sunglasses", "แว่นกันแดด"] },

  // --- food & supplements ---
  { id: "supplement", name: "Supplementary food", hs_code: "210690", keywords: ["อาหารเสริม", "supplement", "วิตามิน", "vitamin", "คอลลาเจน", "collagen", "โปรตีน", "protein powder"], flags: ["medicine"] },
  { id: "medicine", name: "Medicaments", hs_code: "300490", keywords: ["ยา ", "ยาแก้", "medicine", "medication", "drug", "tablet", "ยาเม็ด", "แคปซูล", "capsule"], flags: ["medicine"] },
  { id: "snack", name: "Snack (packaged food)", hs_code: "190590", keywords: ["ขนม", "snack", "biscuit", "cookie", "คุกกี้", "ขนมปัง", "cracker", "ช็อกโกแลต", "chocolate", "ลูกอม", "candy", "เลย์", "chips", "สาหร่าย", "seaweed"], flags: ["food"] },
  { id: "instant_noodle", name: "Instant noodles", hs_code: "190230", keywords: ["มาม่า", "บะหมี่", "noodle", "instant noodle", "ไวไว", "ยำยำ"], flags: ["food"] },
  { id: "dried_fruit", name: "Dried fruit", hs_code: "081340", keywords: ["ผลไม้อบแห้ง", "dried fruit", "มะม่วงอบแห้ง", "ทุเรียนอบกรอบ", "dried mango"], flags: ["food"] },
  { id: "fresh_produce", name: "Fresh fruit / vegetables", hs_code: "081090", keywords: ["ผลไม้สด", "fresh fruit", "ผัก", "vegetable", "ทุเรียนสด", "มะม่วงสด"], flags: ["plant_animal", "perishable"] },
  { id: "meat", name: "Processed meat", hs_code: "160249", keywords: ["หมูแผ่น", "หมูหยอง", "เนื้อ", "meat", "pork", "beef", "ไก่", "chicken", "แหนม", "ไส้กรอก", "sausage", "กุนเชียง", "ปลาหมึกอบ", "dried squid"], flags: ["plant_animal", "food"] },
  { id: "seasoning", name: "Seasoning / sauce", hs_code: "210390", keywords: ["น้ำปลา", "fish sauce", "ซอส", "sauce", "น้ำจิ้ม", "พริกแกง", "curry paste", "เครื่องปรุง", "seasoning", "น้ำพริก", "chili paste", "ซีอิ๊ว"], flags: ["food", "liquid"] },
  { id: "rice", name: "Rice", hs_code: "100630", keywords: ["ข้าวสาร", "ข้าวหอมมะลิ", "rice", "jasmine rice"], flags: ["food"] },
  { id: "coffee_tea", name: "Coffee / tea", hs_code: "090121", keywords: ["กาแฟ", "coffee", "ชา", "tea", "ชาไทย", "matcha", "โกโก้", "cocoa"], flags: ["food"] },
  { id: "beverage", name: "Non-alcoholic beverage", hs_code: "220299", keywords: ["น้ำดื่ม", "เครื่องดื่ม", "drink", "juice", "น้ำผลไม้", "soda"], flags: ["liquid", "food"] },
  { id: "alcohol", name: "Alcoholic beverage", hs_code: "220830", keywords: ["เหล้า", "เบียร์", "beer", "ไวน์", "wine", "whisky", "วิสกี้", "สุรา", "alcohol"], flags: ["flammable", "prohibited"] },
  { id: "seeds_plants", name: "Seeds / plants", hs_code: "120999", keywords: ["เมล็ด", "seed", "ต้นไม้", "plant", "กล้วยไม้", "orchid", "ดอกไม้", "flower"], flags: ["plant_animal"] },
  { id: "herbs", name: "Herbal product", hs_code: "121190", keywords: ["สมุนไพร", "herb", "ขมิ้น", "turmeric", "ฟ้าทะลายโจร", "ยาสมุนไพร"], flags: ["medicine", "plant_animal"] },

  // --- electronics ---
  { id: "phone", name: "Mobile phone", hs_code: "851713", keywords: ["โทรศัพท์", "มือถือ", "phone", "iphone", "smartphone"], flags: ["battery_in_device", "valuable"] },
  { id: "power_bank", name: "Power bank (lithium battery)", hs_code: "850760", keywords: ["power bank", "พาวเวอร์แบงค์", "แบตสำรอง", "แบตเตอรี่", "battery", "ถ่าน"], flags: ["lithium_battery"] },
  { id: "headphones", name: "Headphones / earphones", hs_code: "851830", keywords: ["หูฟัง", "headphone", "earphone", "earbuds", "airpods"], flags: ["battery_in_device"] },
  { id: "electronics", name: "Electronic accessory", hs_code: "854442", keywords: ["สายชาร์จ", "charger", "cable", "อะแดปเตอร์", "adapter", "usb", "gadget", "อุปกรณ์อิเล็กทรอนิกส์"] },
  { id: "phone_case", name: "Phone case (plastic)", hs_code: "392690", keywords: ["เคส", "phone case", "case มือถือ", "เคสโทรศัพท์"] },
  { id: "laptop", name: "Laptop computer", hs_code: "847130", keywords: ["โน้ตบุ๊ค", "laptop", "notebook computer", "macbook", "แท็บเล็ต", "tablet", "ipad"], flags: ["battery_in_device", "valuable"] },
  { id: "speaker", name: "Speaker", hs_code: "851821", keywords: ["ลำโพง", "speaker"], flags: ["battery_in_device", "magnet"] },

  // --- home, hobby, paper ---
  { id: "toy", name: "Toys", hs_code: "950300", keywords: ["ของเล่น", "toy", "ตุ๊กตา", "doll", "plush", "figure", "ฟิกเกอร์", "โมเดล", "model kit", "lego", "เลโก้", "art toy"] },
  { id: "book", name: "Books (printed)", hs_code: "490199", keywords: ["หนังสือ", "book", "นิตยสาร", "magazine", "การ์ตูน", "comic", "manga"] },
  { id: "document", name: "Documents", hs_code: "490110", keywords: ["เอกสาร", "document", "paper", "ใบรับรอง", "certificate", "สัญญา", "contract"], note: "Use shipment type 'document' and a document service (EMS World Document / Aramex PDX)." },
  { id: "stationery", name: "Stationery", hs_code: "482010", keywords: ["สมุด", "notebook", "ปากกา", "pen", "สติ๊กเกอร์", "sticker", "เครื่องเขียน", "stationery", "โปสการ์ด", "postcard", "การ์ด"] },
  { id: "handicraft", name: "Handicraft (souvenir)", hs_code: "442090", keywords: ["ของที่ระลึก", "souvenir", "งานฝีมือ", "handicraft", "handmade", "จักสาน", "แกะสลัก", "ของฝาก", "พวงกุญแจ", "keychain", "พระเครื่อง", "amulet", "เครื่องราง"] },
  { id: "ceramic", name: "Ceramic tableware", hs_code: "691200", keywords: ["เซรามิก", "ceramic", "จาน", "ชาม", "แก้ว", "mug", "แก้วกาแฟ", "ถ้วย"] },
  { id: "kitchenware", name: "Kitchenware", hs_code: "732393", keywords: ["ครัว", "kitchen", "หม้อ", "pot", "กระทะ", "pan", "ช้อน", "spoon", "ตะเกียบ", "chopsticks"] },
  { id: "home_decor", name: "Home decoration", hs_code: "392640", keywords: ["ของแต่งบ้าน", "decor", "decoration", "กรอบรูป", "frame", "เทียน", "candle", "แจกัน", "vase"] },
  { id: "textile_home", name: "Home textiles", hs_code: "630221", keywords: ["ผ้าปูที่นอน", "bed sheet", "ผ้าห่ม", "blanket", "หมอน", "pillow", "ผ้าขนหนู", "towel", "ผ้าม่าน", "curtain"] },
  { id: "sport", name: "Sports equipment", hs_code: "950699", keywords: ["อุปกรณ์กีฬา", "sport", "ลูกบอล", "ball", "ไม้แบด", "racket", "เสื่อโยคะ", "yoga mat", "ดัมเบล", "dumbbell"] },
  { id: "pet", name: "Pet supplies", hs_code: "420100", keywords: ["สัตว์เลี้ยง", "pet", "ปลอกคอ", "collar", "อาหารสัตว์", "pet food", "ขนมหมา", "ขนมแมว"], flags: ["plant_animal"] },
  { id: "car_parts", name: "Vehicle parts", hs_code: "870899", keywords: ["อะไหล่", "parts", "spare part", "อะไหล่รถ", "car part", "มอเตอร์ไซค์"] },
  { id: "tools", name: "Hand tools", hs_code: "820559", keywords: ["เครื่องมือ", "tool", "ประแจ", "wrench", "ไขควง", "screwdriver"] },
  { id: "cash", name: "Cash / gold bullion", hs_code: "710812", keywords: ["เงินสด", "cash", "ธนบัตร", "banknote", "ทองคำ", "gold bar", "ทองแท่ง"], flags: ["prohibited", "valuable"] },
  { id: "lighter", name: "Lighter / matches", hs_code: "961310", keywords: ["ไฟแช็ก", "lighter", "ไม้ขีด", "matches"], flags: ["prohibited", "flammable"] },
  { id: "knife", name: "Knife (kitchen)", hs_code: "821192", keywords: ["มีด", "knife", "ดาบ", "sword"], flags: ["prohibited"], note: "Kitchen knives are accepted by some couriers as cutlery; weapons never. Ask support before shipping." },
];

/** General wording rules that apply to every declaration (shown to the model as tips). */
export const DECLARATION_TIPS = [
  "Declare each line as a generic product category in English (e.g. 'Cosmetics', 'Clothes', 'Toys') plus a 6-digit HS code — this is how SHIPPOP's own drafts and customs forms phrase it. Brand names and over-specific words ('eyeliner', 'serum liquid') invite counter staff to refuse the parcel as 'liquid' or misread it.",
  "Every line needs pieces, weight in grams, a realistic value in THB and the country of manufacture. 'Gift' or 'sample' is not a category — still declare what it is and a value.",
  "Line weights must add up to no more than total_weight (packaging included in total_weight).",
  "Never mislabel a genuinely dangerous good (alcohol perfume, aerosol, lithium battery) — it is a safety and legal issue and can get the SHIPPOP account suspended. Remove it or ask SHIPPOP crossborder support (02-096-6629 / cs_crossborder@shippop.com).",
  "All SHIPPOP Inter services move by air — apply air-freight rules even for neighbouring countries (LA, MM, KH, VN).",
  "taxpayer: 'receiver' (default) means the recipient pays import duty on arrival (DDU); 'sender' means you prepay it (DDP). Tell the recipient which one applies.",
];

export function findCategories(description: string): Category[] {
  const text = description.toLowerCase();
  const hits = CATEGORIES.filter((c) => c.keywords.some((k) => text.includes(k.toLowerCase())));
  // Prefer more specific categories: longer matching keyword first.
  return hits.sort((a, b) => {
    const la = Math.max(...a.keywords.filter((k) => text.includes(k.toLowerCase())).map((k) => k.length));
    const lb = Math.max(...b.keywords.filter((k) => text.includes(k.toLowerCase())).map((k) => k.length));
    return lb - la;
  });
}
