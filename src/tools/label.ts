import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ShippopApiError, ShippopClient } from "../client.js";
import type { ShippopConfig } from "../config.js";
import { AddressSchema, LabelSizeSchema } from "../schemas.js";
import { guard, ok } from "../result.js";

interface LabelResponse {
  status: boolean;
  code?: number | string;
  message?: string;
  html?: string;
  pdf?: string;
  json?: unknown;
}

const TRACKING_CODE_LABEL_SIZES = new Set(["A4", "A5", "A6", "letter", "letter4x6", "sticker", "sticker4x6"]);

/** Labels are always written under the configured label directory; the model may pick a sub-directory but not escape it. */
export function resolveOutputDir(labelDir: string, requested: string | undefined): string {
  const root = path.resolve(labelDir);
  if (!requested) return root;
  const target = path.resolve(root, requested);
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new Error(`output_dir must be inside the label directory ${root} (got ${requested}). Set SHIPPOP_LABEL_DIR to change the root.`);
  }
  return target;
}

function safeName(s: string) {
  return s.replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 80);
}

export function registerLabelTools(server: McpServer, client: ShippopClient, config: Pick<ShippopConfig, "labelDir">) {
  server.registerTool(
    "shippop_get_label",
    {
      title: "Get shipping label",
      description:
        "Render the shipping label(s) (ใบปะหน้า) for a confirmed purchase or specific SP tracking codes. " +
        "format=pdf (default) or html writes the file to output_dir and returns its path for the user to print; format=json returns the label data as structured JSON. " +
        "Give either purchase_id (all shipments in it) or tracking_codes (specific SP codes).",
      inputSchema: {
        purchase_id: z.number().int().positive().optional(),
        tracking_codes: z.array(z.string()).min(1).max(100).optional().describe("SHIPPOP tracking codes (SPxxxx)"),
        format: z.enum(["pdf", "html", "json"]).default("pdf"),
        size: LabelSizeSchema.default("sticker4x6").describe("Paper/sticker size. sticker4x6 is the common thermal label."),
        output_dir: z
          .string()
          .optional()
          .describe("Sub-directory (relative) inside the label directory (SHIPPOP_LABEL_DIR or ~/Downloads/shippop-labels) to write into, e.g. \"2026-09\". Absolute paths are only accepted if they are inside that directory."),
        show_products: z.boolean().default(false).describe("Print product lines on the label (sticker4x6 only)"),
        hide_receiver_info: z.boolean().default(false),
        separate_pages: z.boolean().default(false).describe("One label per page"),
        logo_url: z.string().url().optional().describe("Your logo URL to print on the label"),
        replace_origin: z
          .record(z.string(), AddressSchema.partial())
          .optional()
          .describe(
            "Label sender override, keyed by SP tracking code. For parcel shops (B2B) that book shipments from the shop's own address: the courier still collects at the shop, but the label shows the shop's customer as the sender so the receiver knows who sent it. Only the printed label changes.",
          ),
        order_date: z.string().optional().describe("Order date printed on label, e.g. 2026-09-02"),
        print_date: z.string().optional().describe("Print date printed on label, e.g. 2026-09-02"),
      },
      // Not read-only: writes a new timestamped label file to disk on every call (never changes anything at SHIPPOP).
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    guard(client.env, async (args) => {
      if (!args.purchase_id && !args.tracking_codes) {
        throw new Error("Provide purchase_id or tracking_codes");
      }
      // Per the docs, /label_tracking_code/ (no purchase_id) supports a smaller size list than /label/.
      if (!args.purchase_id && !TRACKING_CODE_LABEL_SIZES.has(args.size)) {
        throw new Error(`size "${args.size}" is only available when printing by purchase_id; with tracking_codes use one of ${[...TRACKING_CODE_LABEL_SIZES].join(", ")}`);
      }
      // options[] is keyed by SP tracking code, so per-shipment dates need the codes.
      if ((args.order_date || args.print_date) && !args.replace_origin && !args.tracking_codes?.length) {
        throw new Error("order_date / print_date are applied per SP tracking code — pass tracking_codes (optionally together with purchase_id)");
      }
      // Validate the destination before spending a SHIPPOP call.
      const dir = args.format === "json" ? undefined : resolveOutputDir(config.labelDir, args.output_dir);
      const body: Record<string, unknown> = {
        type: args.format,
        size: args.size,
        showproduct: args.show_products ? 1 : 0,
        hide_information: args.hide_receiver_info ? 1 : 0,
        each: args.separate_pages ? 1 : 0,
      };
      if (args.logo_url) {
        body.logo = args.logo_url;
        body.schema = args.logo_url.startsWith("https") ? "https" : "http";
      }
      if (args.replace_origin || args.order_date || args.print_date) {
        const options: Record<string, unknown> = {};
        const codes = Object.keys(args.replace_origin ?? {});
        for (const code of codes.length ? codes : (args.tracking_codes ?? [])) {
          options[code] = {
            replaceOrigin: args.replace_origin?.[code],
            orderDate: args.order_date,
            printDate: args.print_date,
          };
        }
        body.options = options;
      }

      let endpoint: string;
      let stem: string;
      if (args.purchase_id) {
        endpoint = "/label/";
        body.purchase_id = String(args.purchase_id);
        if (args.tracking_codes) body.tracking_code = args.tracking_codes.join(",");
        stem = `purchase-${args.purchase_id}`;
      } else {
        endpoint = "/label_tracking_code/";
        body.tracking_code = args.tracking_codes!.join(",");
        stem = args.tracking_codes!.length === 1 ? args.tracking_codes![0] : `${args.tracking_codes![0]}+${args.tracking_codes!.length - 1}`;
      }

      let res: LabelResponse;
      try {
        res = await client.post<LabelResponse>(endpoint, body);
      } catch (err) {
        // Verified live: SHIPPOP answers 404 "Purchase unconfirmed" for labels of an unpaid purchase.
        if (err instanceof ShippopApiError && /unconfirmed/i.test(err.message)) {
          throw new Error(
            `${err.message} — labels are only available after shippop_confirm_purchase (the purchase is still unpaid). Confirm first, with the user's approval.`,
          );
        }
        throw err;
      }

      if (args.format === "json") {
        return ok({ environment: client.env, label: res.json });
      }

      await fs.mkdir(dir!, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const file = path.join(dir!, `shippop-label-${safeName(stem)}-${args.size}-${stamp}.${args.format}`);
      const content = args.format === "pdf" ? Buffer.from(res.pdf ?? "", "base64") : Buffer.from(res.html ?? "", "utf8");
      if (content.length === 0) throw new Error(`SHIPPOP returned an empty ${args.format} label`);
      await fs.writeFile(file, content);

      return ok({
        environment: client.env,
        format: args.format,
        size: args.size,
        file,
        bytes: content.length,
        note: args.format === "pdf" ? "Open the PDF and print at 100% scale." : "Open in a browser and print; the page is pre-sized for the chosen label size.",
      });
    }),
  );
}
