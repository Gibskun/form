const axios = require('axios');

async function testEditFormRoute() {
  try {
    console.log('🧪 Testing edit form functionality...\n');
    
    // First, let's get a list of forms to see what's available
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwidXNlcm5hbWUiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTczMDQ5NDAyMiwiZXhwIjoxNzMwNTgwNDIyfQ.vuL7N7RTMxCCPBJTFS4TH8cQlAHggzhrGWrGDkqfNn8'; // You'll need to get a valid token
    
    // Test getting forms list
    const formsResponse = await axios.get('http://localhost:5000/api/admin/forms', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('✅ Successfully fetched forms list');
    console.log(`📊 Found ${formsResponse.data.length} forms`);
    
    if (formsResponse.data.length > 0) {
      const testForm = formsResponse.data[0];
      console.log(`\n🎯 Testing with form: "${testForm.title}" (ID: ${testForm.id})`);
      
      // Test getting a single form for editing
      const singleFormResponse = await axios.get(`http://localhost:5000/api/admin/forms/${testForm.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('✅ Successfully fetched single form for editing');
      console.log(`📋 Form details:`);
      console.log(`  - Title: "${singleFormResponse.data.title}"`);
      console.log(`  - Type: ${singleFormResponse.data.form_type}`);
      console.log(`  - Questions: ${singleFormResponse.data.questions?.length || 0}`);
      console.log(`  - Conditional Questions: ${singleFormResponse.data.conditional_questions?.length || 0}`);
      
      console.log('\n🎉 Backend API is working correctly for edit functionality!');
      console.log('The issue is likely in the frontend routing or component rendering.');
      
    } else {
      console.log('⚠️  No forms available to test with');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    if (error.response?.status === 401) {
      console.log('🔐 Authentication failed - you need to login first to get a valid token');
    }
  }
}

testEditFormRoute();