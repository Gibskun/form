const http = require('http');

const testCombinedConditionalSections = (year, role) => {
  const postData = JSON.stringify({ selectedYear: year, selectedRole: role });
  
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/form/34e5ac90-642b-4dd9-b0f7-ada5fd87281c/combined-conditional-sections',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = http.request(options, (res) => {
    console.log(`\n=== Testing year: ${year}, role: ${role} ===`);
    console.log(`Status: ${res.statusCode}`);
    
    let body = '';
    res.on('data', (chunk) => {
      body += chunk;
    });
    
    res.on('end', () => {
      try {
        const data = JSON.parse(body);
        console.log('Response:', JSON.stringify(data, null, 2));
      } catch (error) {
        console.error('Error parsing response:', error);
        console.log('Raw response:', body);
      }
    });
  });

  req.on('error', (error) => {
    console.error(`Error with ${year}/${role} request:`, error);
  });

  req.write(postData);
  req.end();
};

// Test different combinations
console.log('Testing combined conditional sections...');

// Test case 1: year 2025, employee role (should show section 18)
testCombinedConditionalSections('2025', 'employee');

// Test case 2: year 2025, team_lead role (should show section 17)
setTimeout(() => testCombinedConditionalSections('2025', 'team_lead'), 500);

// Test case 3: year 2024, employee role (should show section 18) 
setTimeout(() => testCombinedConditionalSections('2024', 'employee'), 1000);

// Test case 4: year 2024, team_lead role (should show section 17)
setTimeout(() => testCombinedConditionalSections('2024', 'team_lead'), 1500);