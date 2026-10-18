/**
 * Sentinel Sovereign Ω - Standalone Stdio Model Context Protocol (MCP) Server
 * scripts/sentinel_mcp_server.ts
 *
 * Exposes Sentinel's 4-Pillar Reconnaissance Engine, Origin De-cloaking,
 * AST Constant-Folding Dredging, and Autonomous Pre-Assessment Agent directly
 * over standard Model Context Protocol (stdio).
 *
 * Compatible with Claude Desktop, Cursor, Windsurf, LangChain, OpenAI Swarm,
 * and any MCP-compliant autonomous agent.
 *
 * Configuration for claude_desktop_config.json:
 * {
 *   "mcpServers": {
 *     "sentinel": {
 *       "command": "npx",
 *       "args": ["tsx", "C:/Users/Legion 5 pro/Desktop/cyber sec/scripts/sentinel_mcp_server.ts"]
 *     }
 *   }
 * }
 */

import readline from 'readline';
import { sentinelAgentBridge } from '../src/services/contentDiscovery/SentinelAgentBridge';
import { autonomousPentestAgent } from '../src/services/ai/AutonomousPentestAgent';

// Send a JSON-RPC response strictly to stdout
export function sendResponse(response: any): void {
  const json = JSON.stringify(response);
  process.stdout.write(json + '\n');
}

// Log diagnostic and telemetry messages strictly to stderr (not interfering with stdio MCP framing)
export function logDebug(message: string): void {
  process.stderr.write(`[Sentinel-MCP] ${message}\n`);
}

/**
 * Returns all registered MCP tool definitions (15 SentinelAgentBridge tools + AutonomousPentestAgent)
 */
export function getMcpToolsList(): any[] {
  const rawTools = sentinelAgentBridge.getAgentToolDefinitions();
  const mcpTools = rawTools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.parameters,
  }));

  mcpTools.push({
    name: 'sentinel_run_autonomous_assessment',
    description:
      'Launches Sentinel’s autonomous 6-stage pre-assessment offensive agent loop. Correlates origin IP candidates, extracts Next.js Server Actions, detects high-entropy cloud secrets, extrapolates legacy routes, and returns an executive exploit dossier. (Zero API keys required).',
    inputSchema: {
      type: 'object',
      properties: {
        targetUrl: { type: 'string', description: 'Target root URL or hostname (e.g. https://example.com)' },
        objective: { type: 'string', description: 'Optional specific reconnaissance or assessment objective' },
      },
      required: ['targetUrl'],
    },
  });

  return mcpTools;
}

/**
 * Processes a parsed JSON-RPC 2.0 request object and returns the response object
 */
export async function handleJsonRpcRequest(request: any): Promise<any | null> {
  const { id, method, params } = request;

  // Handle notifications (no response required)
  if (id === undefined || id === null) {
    if (method === 'notifications/initialized') {
      logDebug('Client initialized notification received.');
    }
    return null;
  }

  const mcpTools = getMcpToolsList();

  switch (method) {
    case 'initialize': {
      logDebug(`Handshake from client: ${params?.clientInfo?.name || 'unknown'}`);
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
          },
          serverInfo: {
            name: 'sentinel-sovereign-recon',
            version: '6.0.0',
          },
        },
      };
    }

    case 'tools/list': {
      logDebug(`Listing ${mcpTools.length} reconnaissance tools.`);
      return {
        jsonrpc: '2.0',
        id,
        result: {
          tools: mcpTools,
        },
      };
    }

    case 'tools/call': {
      const toolName = params?.name;
      const toolArgs = params?.arguments || {};
      logDebug(`Invoking tool: ${toolName}`);

      let result: any;
      if (toolName === 'sentinel_run_autonomous_assessment') {
        result = await autonomousPentestAgent.runAssessment({
          targetUrl: String(toolArgs.targetUrl),
          objective: toolArgs.objective ? String(toolArgs.objective) : undefined,
        });
      } else {
        result = await sentinelAgentBridge.executeTool(toolName, toolArgs);
      }

      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
            },
          ],
          isError: false,
        },
      };
    }

    default: {
      logDebug(`Unknown method called: ${method}`);
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      };
    }
  }
}

/**
 * Processes a raw string line from stdin and returns a response object (or null for notifications/empty lines)
 */
export async function handleJsonRpcLine(line: string): Promise<any | null> {
  const trimmed = line.trim();
  if (!trimmed) return null;

  let request: any;
  try {
    request = JSON.parse(trimmed);
  } catch (e: any) {
    logDebug(`Failed to parse JSON-RPC line: ${e.message}`);
    return {
      jsonrpc: '2.0',
      id: null,
      error: { code: -32700, message: 'Parse error' },
    };
  }

  try {
    return await handleJsonRpcRequest(request);
  } catch (err: any) {
    logDebug(`Error executing ${request?.method}: ${err?.message || err}`);
    return {
      jsonrpc: '2.0',
      id: request?.id ?? null,
      result: {
        content: [
          {
            type: 'text',
            text: `Tool execution failed: ${err?.message || String(err)}`,
          },
        ],
        isError: true,
      },
    };
  }
}

export async function main(): Promise<void> {
  logDebug('Starting Sentinel Sovereign Ω Stdio MCP Server v6.0.0...');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  rl.on('line', async (line) => {
    const response = await handleJsonRpcLine(line);
    if (response) {
      sendResponse(response);
    }
  });

  logDebug('Sentinel Stdio MCP Server is live and listening on stdin.');
}

// Automatically start when executed directly
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('sentinel_mcp_server.ts')) {
  main().catch((err) => {
    logDebug(`Fatal server error: ${err.message}`);
    process.exit(1);
  });
}
