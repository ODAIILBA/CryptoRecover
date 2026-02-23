// Test D1 database connection
import { unstable_dev } from 'wrangler'

const worker = await unstable_dev('dist/_worker.js', {
  experimental: { disableExperimentalWarning: true }
})

try {
  // Test health check
  const resp = await worker.fetch('http://localhost/api/blockchain/health')
  console.log('Health check:', await resp.json())
  
  await worker.stop()
} catch (error) {
  console.error('Error:', error)
  await worker.stop()
}
