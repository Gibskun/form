const axios = require('axios');

const checkHealth = async () => {
  try {
    console.log('🔍 Checking backend health...');
    const response = await axios.get('http://localhost:5000/api/health');
    console.log('✅ Backend is healthy:', response.data);
    return true;
  } catch (error) {
    console.log('❌ Backend health check failed:', error.message);
    return false;
  }
};

const waitForBackend = async (maxRetries = 30) => {
  for (let i = 0; i < maxRetries; i++) {
    const isHealthy = await checkHealth();
    if (isHealthy) {
      return true;
    }
    console.log(`⏳ Waiting for backend... (${i + 1}/${maxRetries})`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  return false;
};

if (require.main === module) {
  waitForBackend().then(success => {
    if (success) {
      console.log('🎉 Backend is ready!');
      process.exit(0);
    } else {
      console.log('💥 Backend failed to start properly');
      process.exit(1);
    }
  });
}

module.exports = { checkHealth, waitForBackend };