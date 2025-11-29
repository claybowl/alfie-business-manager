import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import EventSource from 'eventsource';

global.EventSource = EventSource;

const PIECES_SSE_URL = 'http://localhost:39300/model_context_protocol/2024-11-05/sse';

async function testDataRetrieval() {
  try {
    console.log('🔌 Connecting to Pieces MCP...');
    const transport = new SSEClientTransport(new URL(PIECES_SSE_URL));
    const client = new Client(
      { name: "test", version: "1.0.0" },
      { capabilities: { tools: {}, resources: {}, prompts: {} } }
    );
    await client.connect(transport);
    console.log('✓ Connected\n');

    // Test 1: Ask for very specific detailed information
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TEST 1: Detailed Activity Query');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const result1 = await client.callTool({
      name: "ask_pieces_ltm",
      arguments: {
        question: "What specific files, code, and projects did I work on today? Include exact file paths, file names, code snippets, function names, and technical details. List every file I touched.",
        topics: ["files", "code", "development", "projects", "cursor", "programming"],
        application_sources: ["Cursor", "Cursor.exe"],
        chat_llm: "gemini-2.0-flash-exp",
        connected_client: "Alfie"
      }
    });
    console.log('\nResponse 1:');
    console.log(result1.content?.[0]?.text || 'No content');

    // Test 2: Try to get the raw JSON structure
    console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TEST 2: Raw Activity Data');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const result2 = await client.callTool({
      name: "ask_pieces_ltm",
      arguments: {
        question: "Give me the complete raw activity log for today in JSON format. Include all applications, files opened, code edits, conversations, and timestamps. Be extremely detailed.",
        chat_llm: "gemini-2.0-flash-exp",
        connected_client: "Alfie"
      }
    });
    console.log('\nResponse 2:');
    const response2 = result2.content?.[0]?.text || 'No content';
    console.log(response2.substring(0, 1000));
    
    // Check if it's JSON
    if (response2.startsWith('{') || response2.startsWith('[')) {
      console.log('\n📋 Detected JSON response, parsing...');
      try {
        const parsed = JSON.parse(response2);
        console.log('Parsed structure keys:', Object.keys(parsed));
        if (parsed.summaries) console.log('Has summaries:', parsed.summaries.length);
        if (parsed.events) console.log('Has events:', parsed.events.length);
      } catch (e) {
        console.log('Failed to parse JSON:', e.message);
      }
    }

    // Test 3: Ask about specific applications
    console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TEST 3: Application-Specific Query');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const result3 = await client.callTool({
      name: "ask_pieces_ltm",
      arguments: {
        question: "What did I do in Cursor today? List every file I opened, every change I made, and every conversation.",
        topics: ["cursor", "ide", "development"],
        application_sources: ["Cursor", "Cursor.exe"],
        chat_llm: "gemini-2.0-flash-exp",
        connected_client: "Alfie"
      }
    });
    console.log('\nResponse 3:');
    console.log(result3.content?.[0]?.text || 'No content');

    await client.close();
    process.exit(0);
  } catch (e) {
    console.error('❌ Error:', e);
    process.exit(1);
  }
}

testDataRetrieval();

