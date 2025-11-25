import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import EventSource from 'eventsource';

global.EventSource = EventSource;

const PIECES_SSE_URL = 'http://localhost:39300/model_context_protocol/2024-11-05/sse';

async function debug() {
  try {
    console.log('Connecting...');
    const transport = new SSEClientTransport(new URL(PIECES_SSE_URL));
    const client = new Client({ name: "debug", version: "1.0.0" }, { capabilities: {} });
    await client.connect(transport);
    console.log('Connected.');

    const tools = await client.listTools();
    console.log('Tools:', JSON.stringify(tools, null, 2));

    console.log('Calling ask_pieces_ltm...');
    const result = await client.callTool({
        name: "ask_pieces_ltm",
        arguments: {
            query: "What did I work on today? List specific file names and activities."
        }
    });
    console.log('Result:', JSON.stringify(result, null, 2));

    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

debug();

