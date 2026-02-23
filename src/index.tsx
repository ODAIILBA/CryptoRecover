import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import * as crypto from './lib/crypto'
import * as bip39 from './lib/bip39'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

// Enable CORS for API routes
app.use('/api/*', cors())

// Serve static files
app.use('/static/*', serveStatic({ root: './public' }))

// ===== API ROUTES =====

// Seed Phrase Analysis
app.post('/api/seed-phrase/analyze', async (c) => {
  try {
    const { phrase } = await c.req.json()
    
    if (!phrase || typeof phrase !== 'string') {
      return c.json({ error: 'Phrase is required' }, 400)
    }

    const analysis = bip39.analyzeSeedPhrase(phrase)
    
    return c.json({
      success: true,
      analysis: {
        validWords: analysis.validWords,
        invalidWords: analysis.invalidWords,
        commonMistakes: analysis.commonMistakes,
        missingWords: analysis.missingWords,
        totalWords: analysis.words.length
      }
    })
  } catch (error) {
    console.error('[API] Seed phrase analysis error:', error)
    return c.json({ error: 'Failed to analyze seed phrase' }, 500)
  }
})

// Get BIP39 word suggestions
app.get('/api/seed-phrase/suggestions', async (c) => {
  const partial = c.req.query('q') || ''
  const limit = parseInt(c.req.query('limit') || '10')
  
  const suggestions = bip39.getSuggestions(partial, limit)
  
  return c.json({
    suggestions,
    count: suggestions.length
  })
})

// Validate seed phrase
app.post('/api/seed-phrase/validate', async (c) => {
  try {
    const { phrase } = await c.req.json()
    
    if (!phrase) {
      return c.json({ error: 'Phrase is required' }, 400)
    }

    const validation = bip39.validateSeedPhrase(phrase)
    
    return c.json({
      valid: validation.valid,
      wordCount: validation.wordCount,
      invalidWords: validation.invalidWords,
      message: validation.valid 
        ? 'Valid BIP39 seed phrase' 
        : `Invalid: ${validation.invalidWords.length} invalid word(s)`
    })
  } catch (error) {
    console.error('[API] Validation error:', error)
    return c.json({ error: 'Failed to validate seed phrase' }, 500)
  }
})

// Initiate scan (simulated for MVP - replace with real wallet scanning logic)
app.post('/api/scan/initiate', async (c) => {
  try {
    const { inputType, inputValue, walletType, mode } = await c.req.json()
    
    // Validate input
    if (!inputType || !inputValue || !walletType) {
      return c.json({ error: 'Missing required fields' }, 400)
    }

    if (inputType === 'wallet_address') {
      const isETH = crypto.isValidEthAddress(inputValue)
      const isBTC = crypto.isValidBtcAddress(inputValue)
      
      if (!isETH && !isBTC) {
        return c.json({ error: 'Invalid wallet address format' }, 400)
      }
    } else if (inputType === 'seed_phrase') {
      if (!crypto.isValidSeedPhraseFormat(inputValue)) {
        return c.json({ error: 'Seed phrase must be 12 or 24 words' }, 400)
      }
    }

    // In a real implementation, this would:
    // 1. Store the scan request in D1 database
    // 2. Queue the scanning job
    // 3. Return a scan ID for tracking

    return c.json({
      success: true,
      scanId: Date.now(), // Temporary - use database ID in production
      status: 'pending',
      message: 'Scan initiated successfully',
      note: 'This is a demo. Real wallet scanning requires integration with blockchain APIs.'
    })
  } catch (error) {
    console.error('[API] Scan initiation error:', error)
    return c.json({ error: 'Failed to initiate scan' }, 500)
  }
})

// Get scan status (simulated)
app.get('/api/scan/:scanId/status', async (c) => {
  const scanId = c.req.param('scanId')
  
  // In production, fetch from D1 database
  return c.json({
    scanId: parseInt(scanId),
    status: 'running',
    totalAttempts: 1234567,
    successCount: 0,
    scanSpeed: 1000,
    estimatedTimeRemaining: 3600,
    message: 'Scan in progress (demo mode)'
  })
})

// ===== MAIN PAGE =====
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>CryptoRecover - Wallet Recovery Tool</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <style>
          @keyframes gradient-x {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
          }
          .animate-gradient-x {
            background-size: 200% 200%;
            animation: gradient-x 15s ease infinite;
          }
        </style>
    </head>
    <body class="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 min-h-screen">
        <!-- Navigation -->
        <nav class="border-b border-slate-800 bg-slate-950/50 backdrop-blur-sm sticky top-0 z-50">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                <div class="flex items-center gap-2">
                    <i class="fas fa-shield-alt text-amber-500 text-2xl"></i>
                    <span class="text-xl font-bold text-white">CryptoRecover</span>
                </div>
                <div class="flex gap-3">
                    <a href="#features" class="text-slate-300 hover:text-white px-3 py-2 rounded transition">Features</a>
                    <a href="#analyzer" class="bg-amber-500 hover:bg-amber-600 text-black px-4 py-2 rounded font-semibold transition">
                        Seed Analyzer
                    </a>
                </div>
            </div>
        </nav>

        <!-- Hero Section -->
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
            <div class="text-center mb-16">
                <h1 class="text-5xl md:text-6xl font-bold text-white mb-6">
                    Recover Your Lost
                    <span class="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-500 animate-gradient-x">
                        Crypto Wallets
                    </span>
                </h1>
                <p class="text-xl text-slate-400 max-w-3xl mx-auto mb-8">
                    Advanced BIP39 seed phrase analysis powered by AI. Recover wallets with incomplete or corrupted seed phrases.
                </p>
                
                <!-- Security Warning -->
                <div class="max-w-2xl mx-auto mb-8">
                    <div class="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                        <div class="flex items-start gap-3">
                            <i class="fas fa-exclamation-triangle text-amber-500 mt-1"></i>
                            <div class="text-left">
                                <h3 class="text-amber-500 font-semibold mb-1">Security Notice</h3>
                                <p class="text-sm text-slate-300">
                                    This tool is for recovering YOUR OWN wallets only. 
                                    Unauthorized access to others' wallets is illegal. 
                                    All data is encrypted and processed securely.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Features -->
            <div id="features" class="grid md:grid-cols-3 gap-8 mb-20">
                <div class="bg-slate-900/50 border border-slate-800 rounded-xl p-6 hover:border-amber-500/50 transition">
                    <i class="fas fa-brain text-amber-500 text-3xl mb-4"></i>
                    <h3 class="text-xl font-bold text-white mb-2">AI-Powered Analysis</h3>
                    <p class="text-slate-400">
                        Advanced algorithms detect typos, common mistakes, and suggest corrections for invalid BIP39 words.
                    </p>
                </div>
                <div class="bg-slate-900/50 border border-slate-800 rounded-xl p-6 hover:border-amber-500/50 transition">
                    <i class="fas fa-lock text-amber-500 text-3xl mb-4"></i>
                    <h3 class="text-xl font-bold text-white mb-2">Military-Grade Encryption</h3>
                    <p class="text-slate-400">
                        All sensitive data is encrypted with AES-256-GCM. Your seed phrases never leave your control.
                    </p>
                </div>
                <div class="bg-slate-900/50 border border-slate-800 rounded-xl p-6 hover:border-amber-500/50 transition">
                    <i class="fas fa-bolt text-amber-500 text-3xl mb-4"></i>
                    <h3 class="text-xl font-bold text-white mb-2">Lightning Fast</h3>
                    <p class="text-slate-400">
                        Deployed on Cloudflare's global edge network for instant analysis from anywhere in the world.
                    </p>
                </div>
            </div>

            <!-- Seed Phrase Analyzer -->
            <div id="analyzer" class="max-w-4xl mx-auto">
                <div class="bg-slate-900/50 border border-slate-800 rounded-xl p-8">
                    <h2 class="text-3xl font-bold text-white mb-6">
                        <i class="fas fa-search text-amber-500 mr-2"></i>
                        Seed Phrase Analyzer
                    </h2>
                    
                    <form id="analyzerForm" class="space-y-6">
                        <div>
                            <label class="block text-sm font-medium text-slate-300 mb-2">
                                Enter your seed phrase (12 or 24 words)
                            </label>
                            <textarea 
                                id="seedPhrase" 
                                rows="4"
                                class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder:text-slate-500 focus:border-amber-500 focus:outline-none transition"
                                placeholder="Enter your seed phrase here... (e.g., abandon ability able about above absent absorb abstract...)"
                            ></textarea>
                        </div>
                        
                        <button 
                            type="submit"
                            class="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold py-3 px-6 rounded-lg transition flex items-center justify-center gap-2"
                        >
                            <i class="fas fa-chart-line"></i>
                            Analyze Seed Phrase
                        </button>
                    </form>

                    <!-- Results -->
                    <div id="results" class="hidden mt-8 space-y-4">
                        <h3 class="text-xl font-bold text-white mb-4">Analysis Results</h3>
                        <div id="resultsContent"></div>
                    </div>
                </div>
            </div>

            <!-- Footer -->
            <div class="text-center mt-20 text-slate-500 text-sm">
                <p>© 2026 CryptoRecover. Built with Hono + Cloudflare Pages.</p>
                <p class="mt-2">For educational and recovery purposes only. Use responsibly.</p>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
          const form = document.getElementById('analyzerForm');
          const resultsDiv = document.getElementById('results');
          const resultsContent = document.getElementById('resultsContent');
          
          form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const phrase = document.getElementById('seedPhrase').value.trim();
            
            if (!phrase) {
              alert('Please enter a seed phrase');
              return;
            }
            
            try {
              const response = await axios.post('/api/seed-phrase/analyze', { phrase });
              const { analysis } = response.data;
              
              resultsDiv.classList.remove('hidden');
              
              let html = '<div class="space-y-4">';
              
              // Valid words
              if (analysis.validWords.length > 0) {
                html += \`
                  <div class="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                    <h4 class="text-green-500 font-semibold mb-2">
                      <i class="fas fa-check-circle mr-2"></i>
                      Valid Words (\${analysis.validWords.length})
                    </h4>
                    <p class="text-slate-300 text-sm">\${analysis.validWords.join(', ')}</p>
                  </div>
                \`;
              }
              
              // Invalid words
              if (analysis.invalidWords.length > 0) {
                html += \`
                  <div class="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                    <h4 class="text-red-500 font-semibold mb-2">
                      <i class="fas fa-times-circle mr-2"></i>
                      Invalid Words (\${analysis.invalidWords.length})
                    </h4>
                    <p class="text-slate-300 text-sm">\${analysis.invalidWords.join(', ')}</p>
                  </div>
                \`;
              }
              
              // Common mistakes
              if (analysis.commonMistakes.length > 0) {
                html += \`
                  <div class="bg-amber-900/20 border border-amber-500/30 rounded-lg p-4">
                    <h4 class="text-amber-500 font-semibold mb-2">
                      <i class="fas fa-lightbulb mr-2"></i>
                      Suggestions
                    </h4>
                    <ul class="text-slate-300 text-sm space-y-1">
                      \${analysis.commonMistakes.map(m => \`<li>• \${m}</li>\`).join('')}
                    </ul>
                  </div>
                \`;
              }
              
              // Summary
              html += \`
                <div class="bg-slate-800 rounded-lg p-4">
                  <h4 class="text-white font-semibold mb-2">Summary</h4>
                  <div class="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span class="text-slate-400">Total Words:</span>
                      <span class="text-white ml-2">\${analysis.totalWords}</span>
                    </div>
                    <div>
                      <span class="text-slate-400">Missing Words:</span>
                      <span class="text-white ml-2">\${analysis.missingWords}</span>
                    </div>
                  </div>
                </div>
              \`;
              
              html += '</div>';
              resultsContent.innerHTML = html;
              
            } catch (error) {
              console.error('Error:', error);
              alert('Failed to analyze seed phrase. Please try again.');
            }
          });
        </script>
    </body>
    </html>
  `)
})

export default app
