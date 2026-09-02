# SHIPPOP MCP

An MCP server that exposes the SHIPPOP domestic (Thailand) shipping API as tools for AI agents. It exists so an agent can price, book, confirm, label, track and cancel parcel shipments on behalf of one SHIPPOP account.

## Language

### Shipping lifecycle

**Booking**:
A draft shipment created at SHIPPOP for a chosen **Courier**. Nothing is sent to the courier and nothing is charged until it is **Confirmed**. One Booking call produces one **Purchase** containing one or more **Shipments**.
_Avoid_: order, create order

**Purchase**:
SHIPPOP's grouping of the **Shipments** created by a single **Booking** call, identified by `purchase_id`. It is the unit that gets **Confirmed** and the unit a **Label** is usually printed for. Its `purchase_status` is `unpaid` → `paid` (or `cancel`).
_Avoid_: order, invoice, transaction

**Shipment**:
One parcel going from one sender to one receiver via one **Courier**. Identified by its **SHIPPOP Tracking Code**; after **Confirm** it also gains a **Courier Tracking Code**.
_Avoid_: order, item, parcel (see **Parcel**)

**Confirm**:
The irreversible step that pays for a **Purchase** and hands its **Shipments** to the **Courier**. After Confirm, Shipments cannot be edited and the Purchase cannot be cancelled through SHIPPOP (only the courier-side **Cancel** may still apply). This MCP always keeps Confirm as a separate explicit tool call — it never auto-confirms during **Booking**.
_Avoid_: pay, checkout, submit, auto-confirm, force_confirm

**Cancel**:
Asking the **Courier** to void a **Confirmed** **Shipment**, keyed by its **Courier Tracking Code**. Distinct from simply not confirming an `unpaid` **Purchase**.

**Check Price**:
A quote for one or more prospective **Shipments** across available **Couriers**, with no side effects. Always the first step before **Booking**.
_Avoid_: pricelist, estimate, rate

**Label**:
The printable cover sheet (ใบปะหน้า) for one or more **Shipments**, rendered by SHIPPOP as HTML, PDF (base64) or structured JSON, in a given paper/sticker size.
_Avoid_: waybill, airway bill, sticker (that is a size, not the thing)

**Label Sender Override**:
Replacing the sender block printed on a **Label** with a different **Address** than the one the **Shipment** was booked with. Used by **Parcel Shops**: the Shipment is booked from the shop's address (so the **Courier** collects there and the shop stays the account of record), but the receiver must see the shop's customer as the sender. Only the printed label changes — booking, pickup and tracking still use the shop address.
_Avoid_: replaceOrigin (SHIPPOP's field name), fake sender, drop-ship address

**Parcel Shop**:
A B2B SHIPPOP customer that ships parcels on behalf of walk-in customers from its own premises. It books every Shipment under its own address and account, and uses a **Label Sender Override** per Shipment to show the real sender.
_Avoid_: agent, reseller, franchise

**Tracking**:
The current `order_status` of a **Shipment** plus its ordered list of **Tracking Events**.

**Tracking Event**:
One timestamped status change reported by the **Courier** for a **Shipment** (status code, datetime, location, description).
_Avoid_: state (SHIPPOP's field name), checkpoint

**Pickup Request**:
A request for the **Courier** to come collect one or more **Confirmed** **Shipments** from the sender. Keyed by **Courier Tracking Code**, not SHIPPOP Tracking Code.
_Avoid_: call to pickup, notify pickup

### Identifiers

**SHIPPOP Tracking Code**:
The `SPxxxxxxxxx` identifier SHIPPOP assigns to a **Shipment** at **Booking**. Used for **Tracking** and **Label** calls.
_Avoid_: tracking number (ambiguous with Courier Tracking Code)

**Courier Tracking Code**:
The identifier the **Courier** assigns to a **Shipment** after **Confirm** (e.g. `EA823739216TH`). Used for **Cancel** and **Pickup Request**. It is *not* guaranteed to be present in the Confirm response — the courier may assign it later — so it must be looked up via **Tracking** using the **SHIPPOP Tracking Code**.
_Avoid_: tracking number, AWB

**Courier**:
A delivery company SHIPPOP can book with (Flash Express, Kerry, Thailand Post EMS, …). Identified by its **Courier Code** (`FLE`, `KRYS`, `EMST`, …). The set of Couriers differs per SHIPPOP account — see **Courier on Hand**.
_Avoid_: carrier, shipping company, provider

**Courier on Hand**:
A **Courier** enabled for the current SHIPPOP account. Only Couriers on Hand can be quoted or booked; a Courier on Hand may still be `unavailable` for a particular route or **Parcel**.
_Avoid_: registered courier, supported courier

### Objects

**Address**:
A Thai postal address as SHIPPOP requires it: name, address line, district (แขวง/ตำบล), state (เขต/อำเภอ), province, postcode, tel, optional lat/lng. Used for both sender (`from`) and receiver (`to`) of a **Shipment**.
_Avoid_: location, contact

**Parcel**:
The physical package dimensions of a **Shipment**: weight in grams, and width/length/height in cm.
_Avoid_: package, box (box is a SHIPPOP preset, out of scope for v1)

### Crossborder (SHIPPOP Inter)

SHIPPOP's international service is a separate system with its own vocabulary. Terms below apply only to `shippop_inter_*` tools.

**Inter Shipment**:
A draft international parcel (dimensions, English sender/receiver addresses, **Goods** lines) identified by an `INTxxxx` code. Free to create, edit and delete until it is placed in an **Inter Order**.
_Avoid_: shipment (unqualified, when the domestic meaning is possible), booking

**Goods**:
A customs declaration line inside an **Inter Shipment**: description, pieces, weight, declared value, country of manufacture, optional HS code.
_Avoid_: product, item

**Inter Order**:
One or more **Inter Shipments** committed to a single **Inter Courier** with an optional **Coverage**, identified by an order number. Creating it yields a payment URL; paying is what dispatches the shipments (or, on credit term, creation itself confirms).
_Avoid_: purchase, booking

**Inter Courier**:
An international carrier service identified by its **Courier Ref** (`CRARMPPX`, `CRTPEWP`, …). Not the same code space as domestic **Courier Codes**.

**Coverage**:
Optional insurance offered by an **Inter Courier**, identified by a coverage ref (`CVARMSTD`).
_Avoid_: insurance (domestic uses `insurance_code`), protection

**Declaration**:
The customs description of an **Inter Shipment**'s contents: its **Goods** lines as customs and the courier counter will read them. Acceptance at the counter depends on the wording as much as on the contents.
_Avoid_: manifest, invoice (the commercial invoice is generated from it), description

**Declaration Category**:
The generic English product wording plus 6-digit HS code used for a **Goods** line (`Cosmetics (eye make-up)` 330420, `Clothes` 620520). Chosen from the **Playbook**; never a brand name or an over-specific word.
_Avoid_: product name, item, SKU

**Playbook**:
The curated table mapping everyday Thai/English item words to a **Declaration Category** and its **Restriction Flags**, seeded from SHIPPOP's own drafts and real counter outcomes. It grows from real accepted/rejected cases.
_Avoid_: mapping, Excel, dictionary

**Restriction Flag**:
A property of a **Declaration Category** that makes an item risky or forbidden for air freight (flammable, aerosol, lithium battery, liquid, plant/animal, medicine, food, valuable, prohibited), each with a severity (`block` / `warn` / `info`) and what to do instead. Flags are surfaced, never hidden by re-wording.
_Avoid_: DG (jargon), prohibited list

**Chargeable Weight**:
The weight a **Courier** bills for: the greater of actual gross weight and **Volumetric Weight** (W×L×H cm ÷ 5000, in kg) for express couriers; Thai Post services bill actual weight.
_Avoid_: billable weight, dimensional weight (that is Volumetric Weight)

**Duty Payer**:
Who pays import duty and tax at destination: `receiver` (SHIPPOP default, DDU) or `sender` (DDP). SHIPPOP field `taxpayer`.
_Avoid_: incoterm, DDP/DDU (use as explanation only)

## Flagged ambiguities

- **"Order"** — SHIPPOP's docs use "order" for Booking, Purchase and Shipment interchangeably (`booking order`, `confirm order`, `order_status`, `tracking order`). We never use "order"; we say **Purchase** for the group and **Shipment** for the individual parcel.
- **"Tracking code"** — always qualify: **SHIPPOP Tracking Code** vs **Courier Tracking Code**. Tools that take one must say which.
- **"Weight"** — SHIPPOP takes grams (`weight: 18000` = 18 kg). Never expose kilograms.
- **"Tracking code" across products** — domestic uses `SPxxxx` (SHIPPOP) and courier codes; crossborder uses `INTxxxx`. Tools never accept one where the other is expected.
- **"Confirm succeeded"** — a Confirm call can time out or return without a **Courier Tracking Code** even though SHIPPOP accepted it. "Confirmed" means the **Purchase** is `paid` (per `get_purchase`), not that the HTTP call returned cleanly. The **SHIPPOP Tracking Code** from **Booking** is the durable handle; always keep it.

## Example dialogue

**Dev:** So the agent calls Check Price, then Booking. Is the parcel on its way after Booking?
**Expert:** No. Booking just creates a Purchase in `unpaid` state with one Shipment per parcel — each already has a SHIPPOP Tracking Code. Nothing reaches the Courier until you Confirm the Purchase.
**Dev:** And Confirm is per Shipment?
**Expert:** Per Purchase. One Confirm pays for everything in that Purchase and pushes every Shipment to its Courier. Each Shipment then gets a Courier Tracking Code — or an error message if that particular one failed.
**Dev:** If the user changes their mind after Confirm?
**Expert:** That's Cancel, keyed by the Courier Tracking Code, and it's up to the Courier whether it works. Before Confirm you just don't confirm — the unpaid Purchase expires on its own.
**Dev:** A parcel shop books from its own address, but the receiver shouldn't see the shop as sender?
**Expert:** Right — the booking stays on the shop address because the Courier collects there. When printing the Label you pass a Label Sender Override with the customer's name and address, keyed by SHIPPOP Tracking Code. Nothing else changes.
**Dev:** Which code do I print on the Label?
**Expert:** You ask for the Label by Purchase or by SHIPPOP Tracking Code; SHIPPOP renders both codes on it. Tracking also uses the SHIPPOP code. Only Cancel and Pickup Request use the Courier Tracking Code.
