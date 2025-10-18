const { killPortProcesses } = require('./utils/portManager');

async function killPorts() {
  try {
    console.log('🔍 Checking for processes on port 3008...');
    await killPortProcesses(3008);
    console.log('✅ Port 3008 cleared successfully!');
    
    // Also check other common ports
    const commonPorts = [3000, 3001, 3002, 3003, 3004, 3005, 3006, 3007, 3009, 3010];
    
    for (const port of commonPorts) {
      try {
        await killPortProcesses(port);
        console.log(`✅ Port ${port} cleared`);
      } catch (error) {
        // Port was already free, that's fine
      }
    }
    
    console.log('🎉 All common ports cleared!');
    console.log('💡 You can now start your server without port conflicts.');
    
  } catch (error) {
    console.error('❌ Error clearing ports:', error.message);
  }
}

killPorts();
