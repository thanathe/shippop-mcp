import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig, ConfigError } from "./config.js";
import { createServer } from "./server.js";

async function main() {
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error(`shippop-mcp: ${err.message}`);
      console.error("Set SHIPPOP_API_KEY and SHIPPOP_EMAIL (and optionally SHIPPOP_ENV=production) in the MCP server config.");
      process.exit(1);
    }
    throw err;
  }
  const server = createServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`shippop-mcp ready — env=${config.environment} base=${config.baseUrl} labels=${config.labelDir} crossborder=${config.inter ? config.inter.baseUrl : "off"}`);
}

main().catch((err) => {
  console.error("shippop-mcp fatal:", err);
  process.exit(1);
});
