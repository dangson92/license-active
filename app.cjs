// Startup file for cPanel "Setup Node.js App" (Phusion Passenger).
// Passenger loads the startup file with require(), which cannot load an ESM
// entry directly — this CommonJS shim hands off to the real ESM server.
import('./server/index.js').catch((err) => {
  console.error('❌ Failed to start server:', err)
  process.exit(1)
})
