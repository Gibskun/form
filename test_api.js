// Test the role-based sections API
const http = require('http');

const testRoleBasedSections = (role) => {
  const postData = JSON.stringify({ selectedRole: role });
  
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/form/ff658084-70ad-4b08-9aba-0feae4bab2b2/role-based-sections',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = http.request(options, (res) => {
    console.log(`\n=== Testing role: ${role} ===`);
    console.log(`Status: ${res.statusCode}`);
    
    let body = '';
    res.on('data', (chunk) => {
      body += chunk;
    });
    
    res.on('end', () => {
      try {
        const data = JSON.parse(body);
        console.log('Response:', JSON.stringify(data, null, 2));
        
        if (data.sections && data.questions) {
          console.log(`✅ Found ${data.sections.length} sections and ${data.questions.length} questions for role: ${role}`);
          data.sections.forEach(section => {
            console.log(`📂 Section: ${section.section_name} (ID: ${section.id})`);
          });
          data.questions.forEach(question => {
            console.log(`❓ Question: ${question.question_text} (Section ID: ${question.section_id})`);
          });
        } else {
          console.log(`⚠️ No sections/questions found for role: ${role}`);
        }
      } catch (error) {
        console.error('Error parsing response:', error);
        console.log('Raw response:', body);
      }
    });
  });

  req.on('error', (error) => {
    console.error(`Error with ${role} request:`, error);
  });

  req.write(postData);
  req.end();
};

// Test both roles
testRoleBasedSections('employee');
setTimeout(() => testRoleBasedSections('team_lead'), 1000);