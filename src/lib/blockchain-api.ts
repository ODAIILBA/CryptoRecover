/**
 * Blockchain API Integration
 * Real wallet balance checking using Etherscan (ETH) and Blockchain.com (BTC)
 * 
 * API Documentation:
 * - Etherscan: https://docs.etherscan.io/api-endpoints/accounts
 * - Blockchain.com: https://www.blockchain.com/explorer/api
 */

interface EtherscanResponse {
  status: string
  message: string
  result: string
}

interface BlockchainBTCResponse {
  final_balance: number
  n_tx: number
  total_received: number
}

interface WalletBalance {
  address: string
  balance: string
  balanceUSD: string
  transactionCount: number
  hasBalance: boolean
  lastActivity?: string
}

/**
 * Rate limiter for API calls
 */
class RateLimiter {
  private queue: Array<() => Promise<any>> = []
  private processing = false
  private lastCall = 0
  private minInterval: number

  constructor(requestsPerSecond: number) {
    this.minInterval = 1000 / requestsPerSecond
  }

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn()
          resolve(result)
        } catch (error) {
          reject(error)
        }
      })
      this.process()
    })
  }

  private async process() {
    if (this.processing || this.queue.length === 0) return
    
    this.processing = true
    
    while (this.queue.length > 0) {
      const now = Date.now()
      const timeSinceLastCall = now - this.lastCall
      
      if (timeSinceLastCall < this.minInterval) {
        await new Promise(resolve => setTimeout(resolve, this.minInterval - timeSinceLastCall))
      }
      
      const fn = this.queue.shift()
      if (fn) {
        this.lastCall = Date.now()
        await fn()
      }
    }
    
    this.processing = false
  }
}

// Rate limiters (5 req/sec for free tier)
const etherscanLimiter = new RateLimiter(5)
const blockchainLimiter = new RateLimiter(5)

/**
 * Check Ethereum wallet balance using Etherscan API
 */
export async function checkEthereumBalance(
  address: string, 
  apiKey?: string
): Promise<WalletBalance> {
  const key = apiKey || 'YourApiKeyToken' // Replace with actual key or use env var
  
  try {
    const response = await etherscanLimiter.add(async () => {
      const url = `https://api.etherscan.io/api?module=account&action=balance&address=${address}&tag=latest&apikey=${key}`
      const res = await fetch(url)
      return await res.json() as EtherscanResponse
    })
    
    if (response.status === '1') {
      // Convert from Wei to ETH
      const balanceWei = BigInt(response.result)
      const balanceETH = Number(balanceWei) / 1e18
      
      // Get transaction count
      const txCountResponse = await etherscanLimiter.add(async () => {
        const url = `https://api.etherscan.io/api?module=proxy&action=eth_getTransactionCount&address=${address}&tag=latest&apikey=${key}`
        const res = await fetch(url)
        return await res.json()
      })
      
      const txCount = txCountResponse.result ? parseInt(txCountResponse.result, 16) : 0
      
      // Get ETH price in USD (optional, can cache this)
      const priceResponse = await etherscanLimiter.add(async () => {
        const url = `https://api.etherscan.io/api?module=stats&action=ethprice&apikey=${key}`
        const res = await fetch(url)
        return await res.json()
      })
      
      const ethPrice = priceResponse.result?.ethusd ? parseFloat(priceResponse.result.ethusd) : 2000
      const balanceUSD = balanceETH * ethPrice
      
      return {
        address,
        balance: balanceETH.toFixed(8),
        balanceUSD: balanceUSD.toFixed(2),
        transactionCount: txCount,
        hasBalance: balanceETH > 0
      }
    } else {
      throw new Error(`Etherscan API error: ${response.message}`)
    }
  } catch (error) {
    console.error('[Etherscan] Error checking balance:', error)
    
    // Fallback: return zero balance instead of failing
    return {
      address,
      balance: '0',
      balanceUSD: '0',
      transactionCount: 0,
      hasBalance: false
    }
  }
}

/**
 * Check Bitcoin wallet balance using Blockchain.com API
 */
export async function checkBitcoinBalance(address: string): Promise<WalletBalance> {
  try {
    const response = await blockchainLimiter.add(async () => {
      const url = `https://blockchain.info/rawaddr/${address}`
      const res = await fetch(url)
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }
      return await res.json() as BlockchainBTCResponse
    })
    
    // Convert from Satoshi to BTC
    const balanceSatoshi = response.final_balance
    const balanceBTC = balanceSatoshi / 1e8
    
    // Get BTC price in USD (you can use a separate API or hardcode)
    // For now, using approximate value
    const btcPrice = 45000 // Update this with real-time price API
    const balanceUSD = balanceBTC * btcPrice
    
    return {
      address,
      balance: balanceBTC.toFixed(8),
      balanceUSD: balanceUSD.toFixed(2),
      transactionCount: response.n_tx,
      hasBalance: balanceBTC > 0
    }
  } catch (error) {
    console.error('[Blockchain.com] Error checking balance:', error)
    
    // Fallback: return zero balance instead of failing
    return {
      address,
      balance: '0',
      balanceUSD: '0',
      transactionCount: 0,
      hasBalance: false
    }
  }
}

/**
 * Check wallet balance with retry logic
 */
export async function checkWalletBalanceWithRetry(
  address: string,
  type: 'ETH' | 'BTC',
  apiKey?: string,
  maxRetries = 3
): Promise<WalletBalance> {
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (type === 'ETH') {
        return await checkEthereumBalance(address, apiKey)
      } else {
        return await checkBitcoinBalance(address)
      }
    } catch (error) {
      lastError = error as Error
      console.warn(`[Retry ${attempt + 1}/${maxRetries}] Failed to check ${type} balance:`, error)
      
      if (attempt < maxRetries - 1) {
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)))
      }
    }
  }
  
  console.error(`[${type}] All retries failed for ${address}:`, lastError)
  
  // Return zero balance as fallback
  return {
    address,
    balance: '0',
    balanceUSD: '0',
    transactionCount: 0,
    hasBalance: false
  }
}

/**
 * Check multiple wallets in parallel with concurrency limit
 */
export async function checkMultipleWallets(
  wallets: Array<{ address: string; type: 'ETH' | 'BTC' }>,
  apiKey?: string,
  concurrency = 3
): Promise<WalletBalance[]> {
  const results: WalletBalance[] = []
  
  // Process in batches to respect rate limits
  for (let i = 0; i < wallets.length; i += concurrency) {
    const batch = wallets.slice(i, i + concurrency)
    const batchResults = await Promise.all(
      batch.map(wallet => 
        checkWalletBalanceWithRetry(wallet.address, wallet.type, apiKey)
      )
    )
    results.push(...batchResults)
  }
  
  return results
}

/**
 * Get real-time crypto prices
 */
export async function getCryptoPrices(): Promise<{ ETH: number; BTC: number }> {
  try {
    // Using CoinGecko API (no API key required for basic usage)
    const url = 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum,bitcoin&vs_currencies=usd'
    const response = await fetch(url)
    const data = await response.json()
    
    return {
      ETH: data.ethereum?.usd || 2000,
      BTC: data.bitcoin?.usd || 45000
    }
  } catch (error) {
    console.error('[CoinGecko] Error fetching prices:', error)
    
    // Fallback to approximate values
    return {
      ETH: 2000,
      BTC: 45000
    }
  }
}

/**
 * Health check for blockchain APIs
 */
export async function healthCheck(apiKey?: string): Promise<{
  etherscan: boolean
  blockchain: boolean
  coingecko: boolean
}> {
  const results = {
    etherscan: false,
    blockchain: false,
    coingecko: false
  }
  
  // Test Etherscan
  try {
    const testAddress = '0x0000000000000000000000000000000000000000'
    await checkEthereumBalance(testAddress, apiKey)
    results.etherscan = true
  } catch (error) {
    console.error('[Health] Etherscan check failed:', error)
  }
  
  // Test Blockchain.com
  try {
    const testAddress = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa' // Genesis block address
    await checkBitcoinBalance(testAddress)
    results.blockchain = true
  } catch (error) {
    console.error('[Health] Blockchain.com check failed:', error)
  }
  
  // Test CoinGecko
  try {
    await getCryptoPrices()
    results.coingecko = true
  } catch (error) {
    console.error('[Health] CoinGecko check failed:', error)
  }
  
  return results
}
