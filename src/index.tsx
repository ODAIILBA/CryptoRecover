import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import * as crypto from './lib/crypto'
import * as bip39 from './lib/bip39'
import * as walletGen from './lib/wallet-generator'
import * as dbHelper from './lib/db-helper'

type Bindings = {
  DB: D1Database
  ENCRYPTION_KEY?: string
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

// ===== WALLET GENERATION & TESTING ENDPOINTS =====

// Generate random seed phrases
app.post('/api/wallet/generate', async (c) => {
  try {
    const { count = 1, wordCount = 12 } = await c.req.json()
    
    if (count < 1 || count > 100) {
      return c.json({ error: 'Count must be between 1 and 100' }, 400)
    }
    
    if (wordCount !== 12 && wordCount !== 24) {
      return c.json({ error: 'Word count must be 12 or 24' }, 400)
    }
    
    const seedPhrases = walletGen.generateBatchSeedPhrases(count, wordCount)
    
    return c.json({
      success: true,
      count: seedPhrases.length,
      seedPhrases,
      wordCount
    })
  } catch (error) {
    console.error('[API] Generate error:', error)
    return c.json({ error: 'Failed to generate seed phrases' }, 500)
  }
})

// Test a single seed phrase (derive addresses and check balances)
app.post('/api/wallet/test', async (c) => {
  try {
    const { seedPhrase, walletType = 'both', useRealAPI = false, apiKey } = await c.req.json()
    
    if (!seedPhrase) {
      return c.json({ error: 'Seed phrase is required' }, 400)
    }
    
    const result = await walletGen.scanSeedPhrase(seedPhrase, walletType, useRealAPI, apiKey)
    
    return c.json({
      success: true,
      seedPhrase: result.seedPhrase,
      results: result.results,
      mode: useRealAPI ? 'real' : 'simulation'
    })
  } catch (error) {
    console.error('[API] Test error:', error)
    return c.json({ error: 'Failed to test seed phrase' }, 500)
  }
})

// Batch scan (generate and test multiple seed phrases)
app.post('/api/wallet/batch-scan', async (c) => {
  let scanId: number | null = null
  
  try {
    const { count = 10, wordCount = 12, walletType = 'both', useRealAPI = false, apiKey, userId = 1, saveToDb = true } = await c.req.json()
    
    console.log('[API] Batch scan started:', { count, wordCount, walletType, useRealAPI, saveToDb })
    
    if (count < 1 || count > 1000) {
      return c.json({ error: 'Count must be between 1 and 1000' }, 400)
    }
    
    if (wordCount !== 12 && wordCount !== 24) {
      return c.json({ error: 'Word count must be 12 or 24' }, 400)
    }
    
    // Limit real API calls to prevent abuse
    if (useRealAPI && count > 100) {
      return c.json({ error: 'Real API mode limited to 100 wallets per batch' }, 400)
    }
    
    // Get DB and encryption key
    const db = c.env.DB
    const encryptionKey = c.env.ENCRYPTION_KEY || 'default-dev-key-change-in-production'
    
    console.log('[API] DB available:', !!db)
    
    // Create scan record (if DB persistence enabled)
    if (saveToDb && db) {
      try {
        console.log('[API] Creating scan record...')
        scanId = await dbHelper.createScan(db, {
          user_id: userId,
          mode: 'batch_scan',
          input_type: 'random_generation',
          input_value: `Batch scan: ${count} wallets, ${wordCount} words, ${walletType}`,
          wallet_type: walletType as any,
          word_count: wordCount,
          status: 'running',
          total_attempts: 0,
          success_count: 0,
          scan_speed: 0,
          use_real_api: useRealAPI
        }, encryptionKey)
        console.log('[API] Scan record created:', scanId)
      } catch (dbError: any) {
        console.error('[API] DB error (continuing without persistence):', dbError?.message || dbError)
        scanId = null
      }
    }
    
    const startTime = Date.now()
    const result = await walletGen.batchScan(count, wordCount, walletType, useRealAPI, apiKey)
    const stats = walletGen.calculateScanStats(startTime, result.totalScanned, result.totalFound)
    
    console.log('[API] Scan completed:', { totalScanned: result.totalScanned, totalFound: result.totalFound })
    
    // Update scan with results (if DB persistence enabled)
    if (saveToDb && db && scanId) {
      try {
        await dbHelper.updateScanProgress(db, scanId, {
          status: 'completed',
          total_attempts: result.totalScanned,
          success_count: result.totalFound,
          scan_speed: stats.scannedPerSecond,
          completed_at: new Date().toISOString()
        })
        
        console.log('[API] Scan progress updated')
        
        // Save found wallets
        for (const wallet of result.foundWallets) {
          await dbHelper.saveScanResult(db, {
            scan_id: scanId,
            wallet_address: wallet.address,
            wallet_type: wallet.type,
            balance: wallet.balance,
            balance_usd: wallet.balanceUSD,
            transaction_count: wallet.transactionCount,
            encryption_iv: crypto.generateIV()
          }, encryptionKey)
        }
        console.log('[API] Results saved to database')
      } catch (dbError) {
        console.error('[API] DB update error:', dbError)
      }
    }
    
    return c.json({
      success: true,
      scanId, // Return scan ID for history tracking
      totalScanned: result.totalScanned,
      totalFound: result.totalFound,
      foundWallets: result.foundWallets,
      scannedAt: result.scannedAt,
      mode: useRealAPI ? 'real' : 'simulation',
      stats: {
        scannedPerSecond: stats.scannedPerSecond,
        elapsedTime: stats.elapsedTime,
        successRate: stats.successRate
      }
    })
  } catch (error) {
    console.error('[API] Batch scan error:', error)
    return c.json({ error: 'Failed to perform batch scan' }, 500)
  }
})

// Get scan history
app.get('/api/scans/history', async (c) => {
  try {
    const { userId = '1', limit = '50', offset = '0' } = c.req.query()
    const db = c.env.DB
    
    const history = await dbHelper.getScanHistory(
      db,
      parseInt(userId),
      parseInt(limit),
      parseInt(offset)
    )
    
    return c.json({
      success: true,
      scans: history,
      count: history.length
    })
  } catch (error) {
    console.error('[API] Get history error:', error)
    return c.json({ error: 'Failed to retrieve scan history' }, 500)
  }
})

// Get scan statistics (MUST be before :scanId route)
app.get('/api/scans/stats', async (c) => {
  try {
    const { userId = '1' } = c.req.query()
    const db = c.env.DB
    
    const stats = await dbHelper.getScanStats(db, parseInt(userId))
    
    return c.json({
      success: true,
      stats
    })
  } catch (error) {
    console.error('[API] Get stats error:', error)
    return c.json({ error: 'Failed to retrieve scan statistics' }, 500)
  }
})

// Get scan by ID
app.get('/api/scans/:scanId', async (c) => {
  try {
    const scanId = parseInt(c.req.param('scanId'))
    const db = c.env.DB
    
    const scan = await dbHelper.getScanById(db, scanId)
    
    if (!scan) {
      return c.json({ error: 'Scan not found' }, 404)
    }
    
    return c.json({
      success: true,
      scan
    })
  } catch (error) {
    console.error('[API] Get scan error:', error)
    return c.json({ error: 'Failed to retrieve scan' }, 500)
  }
})

// Get scan results (found wallets)
app.get('/api/scans/:scanId/results', async (c) => {
  try {
    const scanId = parseInt(c.req.param('scanId'))
    const db = c.env.DB
    const encryptionKey = c.env.ENCRYPTION_KEY || 'default-dev-key-change-in-production'
    
    const results = await dbHelper.getScanResults(db, scanId, encryptionKey)
    
    return c.json({
      success: true,
      scanId,
      results,
      count: results.length
    })
  } catch (error) {
    console.error('[API] Get scan results error:', error)
    return c.json({ error: 'Failed to retrieve scan results' }, 500)
  }
})

// Health check for blockchain APIs
app.get('/api/blockchain/health', async (c) => {
  try {
    const { apiKey } = c.req.query()
    const { healthCheck } = await import('./lib/blockchain-api')
    const health = await healthCheck(apiKey)
    
    return c.json({
      success: true,
      services: health,
      allHealthy: health.etherscan && health.blockchain && health.coingecko && health.solana
    })
  } catch (error) {
    console.error('[API] Health check error:', error)
    return c.json({ error: 'Failed to perform health check' }, 500)
  }
})

// Get current crypto prices
app.get('/api/blockchain/prices', async (c) => {
  try {
    const { getCryptoPrices } = await import('./lib/blockchain-api')
    const prices = await getCryptoPrices()
    
    return c.json({
      success: true,
      prices,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('[API] Prices error:', error)
    return c.json({ error: 'Failed to fetch prices' }, 500)
  }
})

// ===== WALLET SCANNER PAGE =====
app.get('/scanner', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Wallet Scanner - CryptoRecover</title>
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
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
          .animate-pulse {
            animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
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
                    <a href="/" class="text-slate-300 hover:text-white px-3 py-2 rounded transition">Home</a>
                    <a href="/scanner" class="bg-amber-500 text-black px-4 py-2 rounded font-semibold">
                        Scanner
                    </a>
                </div>
            </div>
        </nav>

        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div class="text-center mb-12">
                <h1 class="text-4xl md:text-5xl font-bold text-white mb-4">
                    <i class="fas fa-radar text-amber-500 mr-2"></i>
                    Automated Wallet Scanner
                </h1>
                <p class="text-xl text-slate-400 max-w-3xl mx-auto">
                    Generate random seed phrases and automatically test them for wallet balances
                </p>
            </div>

            <!-- Scanner Controls -->
            <div class="max-w-4xl mx-auto mb-8">
                <div class="bg-slate-900/50 border border-slate-800 rounded-xl p-8">
                    <h2 class="text-2xl font-bold text-white mb-6">Scanner Configuration</h2>
                    
                    <div class="grid md:grid-cols-2 gap-6 mb-6">
                        <div>
                            <label class="block text-sm font-medium text-slate-300 mb-2">
                                Number of Wallets to Scan
                            </label>
                            <input 
                                type="number" 
                                id="scanCount" 
                                value="100"
                                min="1"
                                max="1000"
                                class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-amber-500 focus:outline-none transition"
                            />
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-slate-300 mb-2">
                                Seed Phrase Length
                            </label>
                            <select 
                                id="wordCount"
                                class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-amber-500 focus:outline-none transition"
                            >
                                <option value="12" selected>12 words (faster)</option>
                                <option value="24">24 words (more secure)</option>
                            </select>
                        </div>
                    </div>

                    <div class="mb-6">
                        <label class="block text-sm font-medium text-slate-300 mb-2">
                            Wallet Type
                        </label>
                        <select 
                            id="walletType"
                            class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-amber-500 focus:outline-none transition"
                        >
                            <option value="all" selected>All (ETH, BTC & SOL)</option>
                            <option value="both">ETH & BTC</option>
                            <option value="ETH">Ethereum Only</option>
                            <option value="BTC">Bitcoin Only</option>
                            <option value="SOL">Solana Only</option>
                        </select>
                    </div>

                    <!-- Real API Mode Toggle -->
                    <div class="mb-6 p-4 bg-slate-800 rounded-lg border border-slate-700">
                        <div class="flex items-center justify-between mb-3">
                            <label class="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    id="useRealAPI"
                                    class="w-5 h-5 rounded bg-slate-700 border-slate-600 text-amber-500 focus:ring-amber-500"
                                />
                                <span class="text-sm font-medium text-slate-300">
                                    Use Real Blockchain APIs 🔥
                                </span>
                            </label>
                            <span id="apiStatus" class="text-xs px-2 py-1 rounded bg-slate-700 text-slate-400">
                                Simulation Mode
                            </span>
                        </div>
                        
                        <div id="apiKeySection" class="hidden">
                            <label class="block text-xs text-slate-400 mb-2">
                                Etherscan API Key (Optional - required for ETH)
                            </label>
                            <input 
                                type="password" 
                                id="apiKey" 
                                placeholder="Enter your Etherscan API key"
                                class="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-amber-500 focus:outline-none"
                            />
                            <p class="text-xs text-slate-500 mt-1">
                                Get your free API key at <a href="https://etherscan.io/apis" target="_blank" class="text-amber-500 hover:underline">etherscan.io/apis</a>
                            </p>
                        </div>
                        
                        <div class="mt-3 text-xs text-slate-400">
                            <i class="fas fa-info-circle mr-1"></i>
                            <span id="modeDescription">
                                Simulation: Fast testing with random results (for demo)
                            </span>
                        </div>
                    </div>
                    
                    <button 
                        id="startScan"
                        class="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold py-4 px-6 rounded-lg transition flex items-center justify-center gap-2"
                    >
                        <i class="fas fa-play"></i>
                        Start Scanning
                    </button>

                    <button 
                        id="stopScan"
                        class="hidden w-full bg-red-500 hover:bg-red-600 text-white font-bold py-4 px-6 rounded-lg transition flex items-center justify-center gap-2 mt-4"
                    >
                        <i class="fas fa-stop"></i>
                        Stop Scanning
                    </button>
                </div>
            </div>

            <!-- Scan Progress -->
            <div id="scanProgress" class="hidden max-w-4xl mx-auto mb-8">
                <div class="bg-slate-900/50 border border-slate-800 rounded-xl p-8">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-xl font-bold text-white">
                            <span class="animate-pulse">🔍</span> Scanning in Progress...
                        </h3>
                        <span id="scanStatus" class="text-green-500 font-semibold">ACTIVE</span>
                    </div>
                    
                    <div class="grid md:grid-cols-4 gap-4 mb-6">
                        <div class="bg-slate-800 rounded-lg p-4">
                            <div class="text-slate-400 text-sm mb-1">Scanned</div>
                            <div id="scannedCount" class="text-2xl font-bold text-white">0</div>
                        </div>
                        <div class="bg-slate-800 rounded-lg p-4">
                            <div class="text-slate-400 text-sm mb-1">Found</div>
                            <div id="foundCount" class="text-2xl font-bold text-green-500">0</div>
                        </div>
                        <div class="bg-slate-800 rounded-lg p-4">
                            <div class="text-slate-400 text-sm mb-1">Speed</div>
                            <div id="scanSpeed" class="text-2xl font-bold text-amber-500">0/s</div>
                        </div>
                        <div class="bg-slate-800 rounded-lg p-4">
                            <div class="text-slate-400 text-sm mb-1">Elapsed</div>
                            <div id="elapsedTime" class="text-2xl font-bold text-blue-500">0s</div>
                        </div>
                    </div>
                    
                    <div class="bg-slate-800 rounded-lg p-4">
                        <div class="flex justify-between text-sm mb-2">
                            <span class="text-slate-400">Progress</span>
                            <span id="progressPercent" class="text-white">0%</span>
                        </div>
                        <div class="w-full bg-slate-700 rounded-full h-2">
                            <div id="progressBar" class="bg-amber-500 h-2 rounded-full transition-all duration-300" style="width: 0%"></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Found Wallets -->
            <div id="foundWallets" class="hidden max-w-4xl mx-auto">
                <div class="bg-slate-900/50 border border-slate-800 rounded-xl p-8">
                    <h3 class="text-2xl font-bold text-white mb-6">
                        <i class="fas fa-trophy text-amber-500 mr-2"></i>
                        Found Wallets
                    </h3>
                    <div id="walletsList" class="space-y-4"></div>
                </div>
            </div>

            <!-- Results Summary -->
            <div id="resultsSummary" class="hidden max-w-4xl mx-auto mt-8">
                <div class="bg-slate-900/50 border border-slate-800 rounded-xl p-8">
                    <h3 class="text-2xl font-bold text-white mb-6">Scan Complete</h3>
                    <div id="summaryContent"></div>
                </div>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
          let isScanning = false;
          let scanStartTime = 0;
          let totalScanned = 0;
          let totalFound = 0;
          let foundWallets = [];

          const startBtn = document.getElementById('startScan');
          const stopBtn = document.getElementById('stopScan');
          const progressDiv = document.getElementById('scanProgress');
          const foundDiv = document.getElementById('foundWallets');
          const summaryDiv = document.getElementById('resultsSummary');
          const useRealAPICheckbox = document.getElementById('useRealAPI');
          const apiKeySection = document.getElementById('apiKeySection');
          const apiStatus = document.getElementById('apiStatus');
          const modeDescription = document.getElementById('modeDescription');

          // Toggle API key input visibility
          useRealAPICheckbox.addEventListener('change', (e) => {
            if (e.target.checked) {
              apiKeySection.classList.remove('hidden');
              apiStatus.textContent = 'Real API Mode';
              apiStatus.className = 'text-xs px-2 py-1 rounded bg-green-500/20 text-green-400';
              modeDescription.textContent = 'Real API: Checks actual blockchain balances using Etherscan & Blockchain.com APIs';
              
              // Limit count to 100 for real API
              const countInput = document.getElementById('scanCount');
              if (parseInt(countInput.value) > 100) {
                countInput.value = '100';
              }
              countInput.max = '100';
            } else {
              apiKeySection.classList.add('hidden');
              apiStatus.textContent = 'Simulation Mode';
              apiStatus.className = 'text-xs px-2 py-1 rounded bg-slate-700 text-slate-400';
              modeDescription.textContent = 'Simulation: Fast testing with random results (for demo)';
              
              // Restore max count
              const countInput = document.getElementById('scanCount');
              countInput.max = '1000';
            }
          });

          startBtn.addEventListener('click', async () => {
            const count = parseInt(document.getElementById('scanCount').value);
            const wordCount = parseInt(document.getElementById('wordCount').value);
            const walletType = document.getElementById('walletType').value;
            const useRealAPI = useRealAPICheckbox.checked;
            const apiKey = document.getElementById('apiKey').value;

            if (count < 1 || count > 1000) {
              alert('Please enter a count between 1 and 1000');
              return;
            }

            if (useRealAPI && count > 100) {
              alert('Real API mode is limited to 100 wallets per batch');
              return;
            }

            if (useRealAPI && !apiKey && walletType !== 'BTC') {
              const proceed = confirm('No API key provided. ETH balance checks may fail or be rate-limited. Continue anyway?');
              if (!proceed) return;
            }

            isScanning = true;
            scanStartTime = Date.now();
            totalScanned = 0;
            totalFound = 0;
            foundWallets = [];

            startBtn.classList.add('hidden');
            stopBtn.classList.remove('hidden');
            progressDiv.classList.remove('hidden');
            foundDiv.classList.add('hidden');
            summaryDiv.classList.add('hidden');

            document.getElementById('scanStatus').textContent = 'ACTIVE';
            document.getElementById('scanStatus').className = 'text-green-500 font-semibold';

            try {
              const requestBody = {
                count,
                wordCount,
                walletType,
                useRealAPI
              };

              if (useRealAPI && apiKey) {
                requestBody.apiKey = apiKey;
              }

              const response = await axios.post('/api/wallet/batch-scan', requestBody);

              totalScanned = response.data.totalScanned;
              totalFound = response.data.totalFound;
              foundWallets = response.data.foundWallets;

              // Update progress
              document.getElementById('scannedCount').textContent = totalScanned;
              document.getElementById('foundCount').textContent = totalFound;
              document.getElementById('scanSpeed').textContent = response.data.stats.scannedPerSecond.toFixed(2) + '/s';
              document.getElementById('elapsedTime').textContent = response.data.stats.elapsedTime.toFixed(1) + 's';
              document.getElementById('progressPercent').textContent = '100%';
              document.getElementById('progressBar').style.width = '100%';

              // Show found wallets
              if (foundWallets.length > 0) {
                foundDiv.classList.remove('hidden');
                displayFoundWallets(foundWallets);
              }

              // Show summary
              showSummary(response.data);

              document.getElementById('scanStatus').textContent = 'COMPLETE';
              document.getElementById('scanStatus').className = 'text-blue-500 font-semibold';

            } catch (error) {
              console.error('Scan error:', error);
              alert('Scan failed: ' + (error.response?.data?.error || error.message));
              document.getElementById('scanStatus').textContent = 'ERROR';
              document.getElementById('scanStatus').className = 'text-red-500 font-semibold';
            } finally {
              isScanning = false;
              startBtn.classList.remove('hidden');
              stopBtn.classList.add('hidden');
            }
          });

          function displayFoundWallets(wallets) {
            const list = document.getElementById('walletsList');
            list.innerHTML = '';

            wallets.forEach((wallet, index) => {
              const walletDiv = document.createElement('div');
              walletDiv.className = 'bg-green-900/20 border border-green-500/30 rounded-lg p-6';
              walletDiv.innerHTML = \`
                <div class="flex items-start justify-between mb-4">
                  <h4 class="text-lg font-bold text-green-500">
                    <i class="fas fa-wallet mr-2"></i>
                    Wallet #\${index + 1} (\${wallet.type})
                  </h4>
                  <span class="bg-green-500 text-black px-3 py-1 rounded-full text-sm font-semibold">
                    $\${wallet.balanceUSD}
                  </span>
                </div>
                <div class="space-y-2 text-sm">
                  <div>
                    <span class="text-slate-400">Address:</span>
                    <code class="text-white ml-2 bg-slate-800 px-2 py-1 rounded">\${wallet.address}</code>
                  </div>
                  <div>
                    <span class="text-slate-400">Balance:</span>
                    <span class="text-white ml-2">\${wallet.balance} \${wallet.type}</span>
                  </div>
                  <div>
                    <span class="text-slate-400">Transactions:</span>
                    <span class="text-white ml-2">\${wallet.transactionCount}</span>
                  </div>
                  <div class="pt-2 border-t border-green-500/30">
                    <span class="text-slate-400">Seed Phrase:</span>
                    <code class="text-amber-500 ml-2 block mt-1 bg-slate-800 px-2 py-1 rounded break-all">\${wallet.seedPhrase}</code>
                  </div>
                </div>
              \`;
              list.appendChild(walletDiv);
            });
          }

          function showSummary(data) {
            summaryDiv.classList.remove('hidden');
            const content = document.getElementById('summaryContent');
            
            const modeText = data.mode === 'real' 
              ? '<span class="text-green-400">Real Blockchain APIs</span>' 
              : '<span class="text-slate-400">Simulation Mode</span>';
            
            content.innerHTML = \`
              <div class="mb-4 p-3 bg-slate-800 rounded-lg">
                <span class="text-slate-400 text-sm">Scan Mode:</span>
                <span class="ml-2 font-semibold">\${modeText}</span>
              </div>
              <div class="grid md:grid-cols-2 gap-6">
                <div class="space-y-4">
                  <div class="bg-slate-800 rounded-lg p-4">
                    <div class="text-slate-400 text-sm mb-1">Total Scanned</div>
                    <div class="text-3xl font-bold text-white">\${data.totalScanned}</div>
                  </div>
                  <div class="bg-slate-800 rounded-lg p-4">
                    <div class="text-slate-400 text-sm mb-1">Total Found</div>
                    <div class="text-3xl font-bold text-green-500">\${data.totalFound}</div>
                  </div>
                </div>
                <div class="space-y-4">
                  <div class="bg-slate-800 rounded-lg p-4">
                    <div class="text-slate-400 text-sm mb-1">Scan Speed</div>
                    <div class="text-3xl font-bold text-amber-500">\${data.stats.scannedPerSecond.toFixed(2)}/s</div>
                  </div>
                  <div class="bg-slate-800 rounded-lg p-4">
                    <div class="text-slate-400 text-sm mb-1">Success Rate</div>
                    <div class="text-3xl font-bold text-blue-500">\${(data.stats.successRate * 100).toFixed(6)}%</div>
                  </div>
                </div>
              </div>
              <div class="mt-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <p class="text-sm text-slate-300">
                  <i class="fas fa-info-circle text-amber-500 mr-2"></i>
                  <strong>Note:</strong> \${data.mode === 'real' 
                    ? 'Real blockchain API mode checks actual wallet balances on Ethereum and Bitcoin networks.' 
                    : 'This is a simulation for educational purposes. In production, this would connect to real blockchain APIs to check actual wallet balances.'}
                </p>
              </div>
            \`;
          }

          // Update timer
          setInterval(() => {
            if (isScanning && scanStartTime > 0) {
              const elapsed = (Date.now() - scanStartTime) / 1000;
              document.getElementById('elapsedTime').textContent = elapsed.toFixed(1) + 's';
            }
          }, 100);
        </script>
    </body>
    </html>
  `)
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
                    <a href="#analyzer" class="text-slate-300 hover:text-white px-3 py-2 rounded transition">Analyzer</a>
                    <a href="/scanner" class="bg-amber-500 hover:bg-amber-600 text-black px-4 py-2 rounded font-semibold transition">
                        Auto Scanner
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
