const http = require('http');

const testCombinedAPI = (year, role) => {
  return new Promise((resolve, reject) => {
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
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          resolve({ 
            status: res.statusCode, 
            data,
            year,
            role
          });
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
};

async function runTests() {
  console.log('🧪 Testing Combined Conditional Logic API\n');

  const testCases = [
    { year: '2025', role: 'employee' },
    { year: '2025', role: 'team_lead' },
    { year: '2024', role: 'employee' },
    { year: '2024', role: 'team_lead' }
  ];

  for (const testCase of testCases) {
    try {
      console.log(`\n=== Test: Year ${testCase.year} + Role ${testCase.role} ===`);
      const result = await testCombinedAPI(testCase.year, testCase.role);
      
      if (result.status === 200) {
        console.log(`✅ Status: ${result.status}`);
        console.log(`📊 Sections found: ${result.data.sections?.length || 0}`);
        console.log(`❓ Questions found: ${result.data.questions?.length || 0}`);
        
        if (result.data.debug) {
          console.log(`🔍 Debug info:`);
          console.log(`   Year-based sections: [${result.data.debug.yearBasedSectionIds}]`);
          console.log(`   Role-based sections: [${result.data.debug.roleBasedSectionIds}]`);
          console.log(`   Final sections: [${result.data.debug.finalSectionIds}]`);
        }

        if (result.data.sections && result.data.sections.length > 0) {
          console.log(`📂 Sections:`);
          result.data.sections.forEach(section => {
            console.log(`   - ${section.section_name} (ID: ${section.id})`);
          });
        }

        if (result.data.questions && result.data.questions.length > 0) {
          console.log(`📝 Questions:`);
          result.data.questions.forEach(question => {
            console.log(`   - ${question.question_text} (Section: ${question.section_id})`);
          });
        }
      } else {
        console.log(`❌ Status: ${result.status}`);
        console.log(`Error:`, result.data);
      }
      
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }

  console.log('\n🎉 Testing completed!');
  process.exit();
}

runTests();