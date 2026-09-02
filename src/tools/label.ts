import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ShippopClient } from "../client.js";
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
        output_dir: z.string().optional().describe("Directory to write pdf/html into (default: SHIPPOP_LABEL_DIR or ~/Downloads/shippop-labels)"),
        show_products: z.boolean().default(false).describe("Print product lines on the label (sticker4x6 only)"),
        hide_receiver_info: z.boolean().default(false),
        separate_pages: z.boolean().default(false).describe("One label per page"),
        logo_url: z.string().url().optional().describe("Your logo URL to print on the label"),
        replace_origin: z
          .record(z.string(), AddressSchema.partial())
          .optional()
          .describe("Override the sender shown on the label, keyed by SP tracking code"),
        order_date: z.string().optional().describe("Order date printed on label, e.g. 2026-09-02"),
        print_date: z.string().optional().describe("Print date printed on label, e.g. 2026-09-02"),
      },
      // Not read-only: writes the label file to disk (but never changes anything at SHIPPOP).
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    guard(client.env, async (args) => {
      if (!args.purchase_id && !args.tracking_codes) {
        throw new Error("Provide purchase_id or tracking_codes");
      }
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

      const res = await client.post<LabelResponse>(endpoint, body);

      if (args.format === "json") {
        return ok({ environment: client.env, label: res.json });
      }

      const dir = args.output_dir ?? config.labelDir;
      await fs.mkdir(dir, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const file = path.join(dir, `shippop-label-${safeName(stem)}-${args.size}-${stamp}.${args.format}`);
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
