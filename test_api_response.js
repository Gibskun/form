const http = require('http');

const testAPI = async () => {
  const postData = JSON.stringify({ 
    selectedYear: '2025', 
    selectedRole: 'employee' 
  });
  
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/form/8147b6d7-e367-4cf5-90f5-91f543c8ef2f/combined-conditional-sections',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          console.log('🔍 API Response:');
          console.log('Status:', res.statusCode);
          console.log('Data:', JSON.stringify(data, null, 2));
          
          if (data.debug) {
            console.log('\n📊 Debug Info:');
            console.log('Year-based sections:', data.debug.yearBasedSectionIds);
            console.log('Role-based sections:', data.debug.roleBasedSectionIds);
            console.log('Final sections:', data.debug.finalSectionIds);
          }
          
          if (data.sections) {
            console.log('\n📂 Sections returned:');
            data.sections.forEach(section => {
              console.log(`- ${section.section_name} (ID: ${section.id})`);
            });
          }
          
          if (data.questions) {
            console.log('\n📝 Questions returned:');
            data.questions.forEach(question => {
              console.log(`- "${question.question_text}" (Section ID: ${question.section_id})`);
            });
          }
          
          resolve(data);
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

testAPI().then(() => {
  console.log('\n✅ Test completed');
  process.exit();
}).catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});