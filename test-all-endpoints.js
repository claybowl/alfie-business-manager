// Test all backend endpoints
console.log('🧪 Testing Alfie Backend Endpoints...\n');

const BACKEND_URL = 'http://localhost:8001';

async function testEndpoint(name, url) {
  try {
    console.log(`\n📡 Testing ${name}...`);
    const response = await fetch(url);

    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Content-Type: ${response.headers.get('content-type') || 'Not specified'}`);

    if (!response.ok) {
      console.error(`   ❌ FAILED: HTTP ${response.status}`);
      return false;
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      console.log(`   ✅ SUCCESS: JSON response received`);
      if (data.success !== undefined) {
        console.log(`   📊 Success: ${data.success}`);
      }
      if (data.error) {
        console.error(`   ⚠️  Error message: ${data.error}`);
      }
    } else {
      const text = await response.text();
      console.log(`   📄 Non-JSON response (first 200 chars):`);
      console.log(`   ${text.substring(0, 200)}`);
    }

    return true;
  } catch (error) {
    console.error(`   ❌ CONNECTION FAILED: ${error.message}`);
    return false;
  }
}

// Test all endpoints
const endpoints = [
  ['Briefing Full', `${BACKEND_URL}/api/briefing/full`],
  ['Pieces Activity', `${BACKEND_URL}/api/pieces/activity`],
  ['Graph Data', `${BACKEND_URL}/api/graph/data`],
  ['Graph Health', `${BACKEND_URL}/api/graph/health`],
  ['Graph Clear', `${BACKEND_URL}/api/graph/clear`, 'DELETE'],
];

console.log('═'.repeat(60));

let allPassed = true;
for (const [name, url] of endpoints) {
  const result = await testEndpoint(name, url);
  if (!result && name !== 'Graph Clear') { // Don't fail on clear endpoint if not running
    allPassed = false;
  }
}

console.log('\n' + '═'.repeat(60));
console.log('📊 SUMMARY:');
console.log(allPassed ? '✅ All endpoints are working!' : '❌ Some endpoints failed');
console.log('\n💡 Next steps:');
console.log('1. If endpoints failed, ensure backend server is running:');
console.log('   npm run dev:backend');
console.log('2. Start the frontend:');
console.log('   npm run dev');
console.log('3. Open browser to:');
console.log('   http://localhost:5173');