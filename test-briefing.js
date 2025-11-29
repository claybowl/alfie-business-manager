// Test script to verify briefing endpoint
console.log('Testing briefing endpoint...\n');

async function testBriefingEndpoint() {
  try {
    const response = await fetch('http://localhost:8001/api/briefing/full');

    console.log('Status:', response.status);
    console.log('Status Text:', response.statusText);
    console.log('Content-Type:', response.headers.get('content-type'));

    if (!response.ok) {
      console.error('❌ Failed to fetch briefing data');
      return;
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('❌ Expected JSON, got:', contentType);
      console.error('❌ Response preview (first 500 chars):');
      console.error(text.substring(0, 500));
      return;
    }

    const data = await response.json();
    console.log('✅ Successfully fetched briefing data');
    console.log('📊 Data sources:');
    console.log('  - Pieces:', data.pieces ? '✓' : '✗');
    console.log('  - Linear:', data.linear ? '✓' : '✗');
    console.log('  - Notion:', data.notion ? '✓' : '✗');
    console.log('  - Errors:', data.errors?.length || 0);

  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.log('\n💡 Make sure the backend server is running on port 8001');
    console.log('   Run: npm run dev:backend');
  }
}

testBriefingEndpoint();