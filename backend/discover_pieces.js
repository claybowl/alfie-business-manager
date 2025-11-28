import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import EventSource from 'eventsource';

global.EventSource = EventSource;

const PIECES_SSE_URL = 'http://localhost:39300/model_context_protocol/2024-11-05/sse';

async function discover() {
  try {
    console.log('🔌 Connecting to Pieces MCP...');
    const transport = new SSEClientTransport(new URL(PIECES_SSE_URL));
    const client = new Client(
      { name: "discovery", version: "1.0.0" },
      { capabilities: { tools: {}, resources: {}, prompts: {} } }
    );
    await client.connect(transport);
    console.log('✓ Connected\n');

    // Discover all capabilities
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 AVAILABLE TOOLS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const tools = await client.listTools();
    tools.tools.forEach(tool => {
      console.log(`\n🔧 ${tool.name}`);
      console.log(`   Description: ${tool.description || 'N/A'}`);
      if (tool.inputSchema) {
        console.log(`   Parameters: ${JSON.stringify(tool.inputSchema, null, 6)}`);
      }
    });

    console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📚 AVAILABLE RESOURCES:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    try {
      const resources = await client.listResources();
      if (resources.resources && resources.resources.length > 0) {
        resources.resources.forEach(resource => {
          console.log(`\n📄 ${resource.uri}`);
          console.log(`   Name: ${resource.name || 'N/A'}`);
          console.log(`   Description: ${resource.description || 'N/A'}`);
          console.log(`   MIME Type: ${resource.mimeType || 'N/A'}`);
        });
      } else {
        console.log('No resources available');
      }
    } catch (e) {
      console.log('Resources not supported or error:', e.message);
    }

    console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💬 AVAILABLE PROMPTS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    try {
      const prompts = await client.listPrompts();
      if (prompts.prompts && prompts.prompts.length > 0) {
        prompts.prompts.forEach(prompt => {
          console.log(`\n💭 ${prompt.name}`);
          console.log(`   Description: ${prompt.description || 'N/A'}`);
          if (prompt.arguments) {
            console.log(`   Arguments: ${JSON.stringify(prompt.arguments, null, 6)}`);
          }
        });
      } else {
        console.log('No prompts available');
      }
    } catch (e) {
      console.log('Prompts not supported or error:', e.message);
    }

    // Now try some test queries to see what kind of data we can get
    console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🧪 TESTING DATA RETRIEVAL:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const testQueries = [
      "What tasks and projects am I currently working on? Include file names and details.",
      "What key decisions or discussions have I documented recently?",
      "What documents and code files have I reviewed or modified recently?",
      "What are my next steps or TODO items?",
      "Provide a detailed summary of my recent work activities with specific examples."
    ];

    for (const query of testQueries) {
      console.log(`\n\n📝 Query: "${query}"`);
      console.log('─'.repeat(80));
      try {
        const result = await client.callTool({
          name: "ask_pieces_ltm",
          arguments: {
            question: query,
            chat_llm: "gemini-2.0-flash-exp",
            connected_client: "Alfie"
          }
        });
        
        const content = result.content?.[0]?.text || 'No response';
        console.log(content.substring(0, 500) + (content.length > 500 ? '...' : ''));
      } catch (e) {
        console.log('Error:', e.message);
      }
    }

    await client.close();
    process.exit(0);
  } catch (e) {
    console.error('❌ Error:', e);
    process.exit(1);
  }
}

discover();

