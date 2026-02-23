/**
 * Wallet Generator - Create random seed phrases and derive wallet addresses
 * IMPORTANT: This is for educational/recovery purposes only
 * Now with ML-powered generation for improved success rates
 */

import { BIP39_WORDLIST } from './bip39'
import type { MLState, GenerationStrategy } from './ml-learning'
import type { AdvancedMLState } from './ml-advanced'

/**
 * Generate a random seed phrase (12 or 24 words)
 * Can optionally use ML state for smarter generation
 */
export async function generateRandomSeedPhrase(
  wordCount: 12 | 24 = 12,
  mlState?: MLState,
  strategy?: GenerationStrategy
): Promise<string> {
  // If ML state provided, use smart generation
  if (mlState && strategy) {
    const { generateSmartSeedPhrase } = await import('./ml-learning')
    return generateSmartSeedPhrase(mlState, wordCount, strategy)
  }
  
  // Otherwise use pure random (baseline)
  const words: string[] = []
  
  for (let i = 0; i < wordCount; i++) {
    const randomIndex = Math.floor(Math.random() * BIP39_WORDLIST.length)
    words.push(BIP39_WORDLIST[randomIndex])
  }
  
  return words.join(' ')
}

/**
 * Generate multiple random seed phrases
 */
export function generateBatchSeedPhrases(count: number, wordCount: 12 | 24 = 12): string[] {
  const phrases: string[] = []
  
  for (let i = 0; i < count; i++) {
    phrases.push(generateRandomSeedPhrase(wordCount))
  }
  
  return phrases
}

/**
 * Simulate wallet address derivation from seed phrase
 * NOTE: In production, use proper BIP32/BIP44 derivation with crypto libraries
 * For Cloudflare Workers, we simulate since full crypto libs aren't available
 */
export async function deriveWalletAddress(seedPhrase: string, type: 'ETH' | 'BTC' | 'SOL'): Promise<string> {
  // Create a deterministic "address" from seed phrase hash
  const encoder = new TextEncoder()
  const data = encoder.encode(seedPhrase + type)
  const hash = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hash))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  
  if (type === 'ETH') {
    // Ethereum address format: 0x + 40 hex chars
    return '0x' + hashHex.slice(0, 40)
  } else if (type === 'BTC') {
    // Bitcoin address format: 1 + base58-like chars (simulated)
    // In production, use proper base58 encoding
    const base58Chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
    let address = '1'
    for (let i = 0; i < 33; i++) {
      const index = parseInt(hashHex.slice(i * 2, i * 2 + 2), 16) % base58Chars.length
      address += base58Chars[index]
    }
    return address
  } else if (type === 'SOL') {
    // Solana address format: base58-encoded 32-byte public key
    // Simulated base58 encoding (44 chars typical)
    const base58Chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
    let address = ''
    for (let i = 0; i < 44; i++) {
      const index = parseInt(hashHex.slice(i * 2 % hashHex.length, (i * 2 + 2) % hashHex.length) || '00', 16) % base58Chars.length
      address += base58Chars[index]
    }
    return address
  }
  
  return ''
}

/**
 * Check wallet balance using blockchain API
 * Now uses REAL APIs: Etherscan for ETH, Blockchain.com for BTC
 */
export async function checkWalletBalance(
  address: string, 
  type: 'ETH' | 'BTC',
  useRealAPI = false,
  apiKey?: string
): Promise<{
  address: string
  balance: string
  balanceUSD: string
  transactionCount: number
  hasBalance: boolean
}> {
  if (useRealAPI) {
    // Import blockchain API module
    const { checkWalletBalanceWithRetry } = await import('./blockchain-api')
    return await checkWalletBalanceWithRetry(address, type, apiKey)
  }
  
  // Fallback to simulation for testing
  await new Promise(resolve => setTimeout(resolve, 100))
  
  const hasBalance = Math.random() < 0.00001 // Very rare
  
  if (hasBalance) {
    const balance = type === 'ETH' 
      ? (Math.random() * 0.1).toFixed(8)
      : (Math.random() * 0.01).toFixed(8)
    
    const balanceUSD = type === 'ETH'
      ? (parseFloat(balance) * 2000).toFixed(2)
      : (parseFloat(balance) * 45000).toFixed(2)
    
    return {
      address,
      balance,
      balanceUSD,
      transactionCount: Math.floor(Math.random() * 10) + 1,
      hasBalance: true
    }
  }
  
  return {
    address,
    balance: '0',
    balanceUSD: '0',
    transactionCount: 0,
    hasBalance: false
  }
}

/**
 * Scan a single seed phrase (generate addresses and check balances)
 */
export async function scanSeedPhrase(
  seedPhrase: string, 
  walletType: 'ETH' | 'BTC' | 'SOL' | 'both' | 'all',
  useRealAPI = false,
  apiKey?: string
): Promise<{
  seedPhrase: string
  results: Array<{
    type: 'ETH' | 'BTC' | 'SOL'
    address: string
    balance: string
    balanceUSD: string
    transactionCount: number
    hasBalance: boolean
  }>
}> {
  const results: Array<{
    type: 'ETH' | 'BTC' | 'SOL'
    address: string
    balance: string
    balanceUSD: string
    transactionCount: number
    hasBalance: boolean
  }> = []
  
  let typesToCheck: string[] = []
  if (walletType === 'all') {
    typesToCheck = ['ETH', 'BTC', 'SOL']
  } else if (walletType === 'both') {
    typesToCheck = ['ETH', 'BTC']
  } else {
    typesToCheck = [walletType]
  }
  
  for (const type of typesToCheck) {
    const address = await deriveWalletAddress(seedPhrase, type as 'ETH' | 'BTC' | 'SOL')
    const balanceInfo = await checkWalletBalance(address, type as 'ETH' | 'BTC' | 'SOL', useRealAPI, apiKey)
    results.push({
      type: type as 'ETH' | 'BTC' | 'SOL',
      ...balanceInfo
    })
  }
  
  return {
    seedPhrase,
    results
  }
}

/**
 * Batch scanner - scan multiple seed phrases
 * Now supports ML-powered generation
 */
export async function batchScan(
  count: number,
  wordCount: 12 | 24,
  walletType: 'ETH' | 'BTC' | 'SOL' | 'both' | 'all',
  useRealAPI = false,
  apiKey?: string,
  onProgress?: (current: number, total: number, found: number) => void,
  mlState?: MLState,
  strategy?: GenerationStrategy,
  advancedMLState?: AdvancedMLState,
  useAdvancedML?: boolean
): Promise<{
  totalScanned: number
  totalFound: number
  foundWallets: Array<{
    seedPhrase: string
    type: 'ETH' | 'BTC' | 'SOL'
    address: string
    balance: string
    balanceUSD: string
    transactionCount: number
  }>
  scannedAt: string
  strategyUsed?: GenerationStrategy
}> {
  const foundWallets: Array<{
    seedPhrase: string
    type: 'ETH' | 'BTC' | 'SOL'
    address: string
    balance: string
    balanceUSD: string
    transactionCount: number
  }> = []
  
  const actualStrategy = strategy || 'random'
  
  for (let i = 0; i < count; i++) {
    // Generate seed phrase - use advanced ML if available and enabled
    let seedPhrase: string
    
    if (useAdvancedML && advancedMLState && advancedMLState.bigrams.size > 0) {
      // Use advanced N-gram generation
      const mlAdvanced = await import('./ml-advanced')
      seedPhrase = mlAdvanced.generateWithNGrams(advancedMLState, wordCount, 'adaptive')
    } else {
      // Use basic ML or random generation
      seedPhrase = await generateRandomSeedPhrase(wordCount, mlState, actualStrategy)
    }
    
    const scanResult = await scanSeedPhrase(seedPhrase, walletType, useRealAPI, apiKey)
    
    // Check if any wallet has balance
    for (const result of scanResult.results) {
      if (result.hasBalance) {
        foundWallets.push({
          seedPhrase,
          type: result.type,
          address: result.address,
          balance: result.balance,
          balanceUSD: result.balanceUSD,
          transactionCount: result.transactionCount
        })
      }
    }
    
    // Report progress
    if (onProgress) {
      onProgress(i + 1, count, foundWallets.length)
    }
  }
  
  return {
    totalScanned: count,
    totalFound: foundWallets.length,
    foundWallets,
    scannedAt: new Date().toISOString(),
    strategyUsed: actualStrategy
  }
}

/**
 * Calculate scan statistics
 */
export function calculateScanStats(startTime: number, scanned: number, found: number): {
  scannedPerSecond: number
  elapsedTime: number
  successRate: number
} {
  const elapsed = (Date.now() - startTime) / 1000 // seconds
  const scannedPerSecond = scanned / elapsed
  const successRate = found / scanned
  
  return {
    scannedPerSecond: Math.round(scannedPerSecond * 100) / 100,
    elapsedTime: Math.round(elapsed * 100) / 100,
    successRate: Math.round(successRate * 100000000) / 100000000 // 8 decimals
  }
}
