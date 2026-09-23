// vite.config.js
import { defineConfig } from 'vite'

export default defineConfig(({ command, mode }) => {
  // Check if '--host' was passed to the CLI arguments, or via mode/env
  const hasHostFlag = process.argv.includes('--host') ||
                      process.argv.includes('-h') ||
                      mode === 'hosted' ||
                      process.env.IS_HOSTED === 'true' ||
                      process.env.VITE_HOSTED === 'true';

  return {
    // Inject the variable into the client-side code
    define: {
      __IS_HOSTED__: JSON.stringify(Boolean(hasHostFlag))
    }
  }
})
