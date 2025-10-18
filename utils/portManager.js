const net = require('net');

/**
 * Find an available port starting from the given port
 * @param {number} startPort - The port to start checking from
 * @param {number} maxAttempts - Maximum number of ports to check
 * @returns {Promise<number>} - Available port number
 */
async function findAvailablePort(startPort = 3008, maxAttempts = 10) {
  return new Promise((resolve, reject) => {
    let currentPort = startPort;
    let attempts = 0;

    const checkPort = (port) => {
      const server = net.createServer();
      
      server.listen(port, (err) => {
        if (err) {
          // Port is in use, try next port
          attempts++;
          if (attempts >= maxAttempts) {
            reject(new Error(`No available ports found after ${maxAttempts} attempts`));
            return;
          }
          checkPort(port + 1);
        } else {
          // Port is available
          server.close(() => {
            resolve(port);
          });
        }
      });

      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          // Port is in use, try next port
          attempts++;
          if (attempts >= maxAttempts) {
            reject(new Error(`No available ports found after ${maxAttempts} attempts`));
            return;
          }
          checkPort(port + 1);
        } else {
          reject(err);
        }
      });
    };

    checkPort(currentPort);
  });
}

/**
 * Kill all processes using a specific port
 * @param {number} port - Port number to free
 * @returns {Promise<void>}
 */
async function killPortProcesses(port) {
  return new Promise((resolve, reject) => {
    const { exec } = require('child_process');
    
    // For Windows
    exec(`netstat -ano | findstr ":${port}"`, (error, stdout, stderr) => {
      if (error) {
        resolve(); // No processes found or command failed
        return;
      }
      
      const lines = stdout.trim().split('\n');
      const pids = new Set();
      
      lines.forEach(line => {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 5) {
          const pid = parts[parts.length - 1];
          if (pid && pid !== '0') {
            pids.add(pid);
          }
        }
      });
      
      if (pids.size === 0) {
        resolve();
        return;
      }
      
      // Kill all processes
      const killPromises = Array.from(pids).map(pid => {
        return new Promise((resolveKill) => {
          exec(`taskkill /F /PID ${pid}`, (killError) => {
            if (killError) {
              console.log(`Could not kill process ${pid}: ${killError.message}`);
            } else {
              console.log(`✅ Killed process ${pid} on port ${port}`);
            }
            resolveKill();
          });
        });
      });
      
      Promise.all(killPromises).then(() => {
        console.log(`✅ Freed port ${port}`);
        resolve();
      }).catch(reject);
    });
  });
}

/**
 * Start server with automatic port management
 * @param {Function} startServer - Function to start the server
 * @param {number} preferredPort - Preferred port number
 * @returns {Promise<number>} - Actual port the server started on
 */
async function startServerWithPortManagement(startServer, preferredPort = 3008) {
  try {
    // First, try to kill any existing processes on the preferred port
    console.log(`🔍 Checking port ${preferredPort}...`);
    await killPortProcesses(preferredPort);
    
    // Wait a moment for processes to be killed
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Try to find an available port
    const availablePort = await findAvailablePort(preferredPort);
    console.log(`✅ Found available port: ${availablePort}`);
    
    // Start the server on the available port
    await startServer(availablePort);
    
    return availablePort;
  } catch (error) {
    console.error('❌ Error in port management:', error.message);
    throw error;
  }
}

module.exports = {
  findAvailablePort,
  killPortProcesses,
  startServerWithPortManagement
};
