/**
 * Advanced ML Control System
 * Provides fine-grained control over ML behavior, training, and optimization
 */

import type { D1Database } from '@cloudflare/workers-types'
import type { MLState } from './ml-learning'
import * as mlLearning from './ml-learning'

// ML Configuration
export interface MLConfig {
  // Learning rate (how much weight to give new patterns)
  learningRate: number // 0.0 - 1.0, default: 0.1
  
  // Decay factor (older patterns weighted less)
  decayFactor: number // 0.0 - 1.0, default: 0.95
  
  // Minimum confidence threshold for using learned patterns
  minConfidence: number // 0.0 - 1.0, default: 0.1
  
  // Maximum pattern age (days) before they start decaying
  maxPatternAge: number // days, default: 30
  
  // Enable/disable specific learning types
  enableFrequencyLearning: boolean // default: true
  enablePositionalLearning: boolean // default: true
  enableCorrelationLearning: boolean // default: true
  
  // Strategy weights for hybrid mode
  hybridWeights: {
    frequency: number // default: 0.3
    positional: number // default: 0.4
    correlation: number // default: 0.3
  }
  
  // Auto-strategy switching thresholds
  autoSwitchThresholds: {
    minSuccessesForFrequency: number // default: 10
    minSuccessesForPositional: number // default: 50
    minSuccessesForHybrid: number // default: 100
  }
  
  // Performance metrics
  trackPerformance: boolean // default: true
  performanceWindow: number // sample size for metrics, default: 100
}

// Default configuration
export const DEFAULT_ML_CONFIG: MLConfig = {
  learningRate: 0.1,
  decayFactor: 0.95,
  minConfidence: 0.1,
  maxPatternAge: 30,
  enableFrequencyLearning: true,
  enablePositionalLearning: true,
  enableCorrelationLearning: true,
  hybridWeights: {
    frequency: 0.3,
    positional: 0.4,
    correlation: 0.3
  },
  autoSwitchThresholds: {
    minSuccessesForFrequency: 10,
    minSuccessesForPositional: 50,
    minSuccessesForHybrid: 100
  },
  trackPerformance: true,
  performanceWindow: 100
}

// Performance metrics
export interface PerformanceMetrics {
  strategyPerformance: Map<string, {
    attempts: number
    successes: number
    successRate: number
    avgTimeMs: number
  }>
  
  recentAttempts: Array<{
    timestamp: Date
    strategy: string
    success: boolean
    timeMs: number
  }>
  
  bestStrategy: string
  worstStrategy: string
  
  improvementRate: number // How much better than random
  confidence: number // Statistical confidence in patterns
}

/**
 * ML Controller - Central control for ML operations
 */
export class MLController {
  private config: MLConfig
  private db: D1Database
  private metrics: PerformanceMetrics | null = null
  
  constructor(db: D1Database, config: Partial<MLConfig> = {}) {
    this.db = db
    this.config = { ...DEFAULT_ML_CONFIG, ...config }
  }
  
  /**
   * Load ML configuration from database
   */
  async loadConfig(): Promise<MLConfig> {
    try {
      const result = await this.db.prepare(`
        SELECT config_data FROM ml_config WHERE id = 1
      `).first<{ config_data: string }>()
      
      if (result && result.config_data) {
        this.config = { ...DEFAULT_ML_CONFIG, ...JSON.parse(result.config_data) }
      }
    } catch (error) {
      console.log('[MLController] No config found, using defaults')
    }
    
    return this.config
  }
  
  /**
   * Save ML configuration to database
   */
  async saveConfig(config: Partial<MLConfig>): Promise<void> {
    this.config = { ...this.config, ...config }
    
    await this.db.prepare(`
      INSERT OR REPLACE INTO ml_config (id, config_data, updated_at)
      VALUES (1, ?, CURRENT_TIMESTAMP)
    `).bind(JSON.stringify(this.config)).run()
    
    console.log('[MLController] Configuration saved')
  }
  
  /**
   * Get current configuration
   */
  getConfig(): MLConfig {
    return { ...this.config }
  }
  
  /**
   * Update learning rate dynamically
   */
  async setLearningRate(rate: number): Promise<void> {
    if (rate < 0 || rate > 1) {
      throw new Error('Learning rate must be between 0 and 1')
    }
    await this.saveConfig({ learningRate: rate })
  }
  
  /**
   * Enable/disable specific learning types
   */
  async configureLearning(options: {
    frequency?: boolean
    positional?: boolean
    correlation?: boolean
  }): Promise<void> {
    await this.saveConfig({
      enableFrequencyLearning: options.frequency ?? this.config.enableFrequencyLearning,
      enablePositionalLearning: options.positional ?? this.config.enablePositionalLearning,
      enableCorrelationLearning: options.correlation ?? this.config.enableCorrelationLearning
    })
  }
  
  /**
   * Adjust hybrid strategy weights
   */
  async setHybridWeights(weights: {
    frequency?: number
    positional?: number
    correlation?: number
  }): Promise<void> {
    const newWeights = {
      ...this.config.hybridWeights,
      ...weights
    }
    
    // Validate weights sum to 1.0
    const sum = newWeights.frequency + newWeights.positional + newWeights.correlation
    if (Math.abs(sum - 1.0) > 0.01) {
      throw new Error('Hybrid weights must sum to 1.0')
    }
    
    await this.saveConfig({ hybridWeights: newWeights })
  }
  
  /**
   * Apply pattern decay based on age
   */
  async applyPatternDecay(state: MLState): Promise<MLState> {
    if (this.config.decayFactor >= 1.0) {
      return state // No decay
    }
    
    const now = new Date()
    const daysSinceUpdate = (now.getTime() - state.lastUpdated.getTime()) / (1000 * 60 * 60 * 24)
    
    if (daysSinceUpdate < this.config.maxPatternAge) {
      return state // No decay yet
    }
    
    // Apply exponential decay to all patterns
    const decayMultiplier = Math.pow(this.config.decayFactor, daysSinceUpdate - this.config.maxPatternAge)
    
    // Decay word frequencies
    state.wordFrequency.forEach((count, word) => {
      state.wordFrequency.set(word, Math.floor(count * decayMultiplier))
    })
    
    // Decay position preferences
    state.positionPreferences.forEach((posMap, position) => {
      posMap.forEach((count, word) => {
        posMap.set(word, Math.floor(count * decayMultiplier))
      })
    })
    
    // Decay word pairs
    state.wordPairs.forEach((pairMap, word1) => {
      pairMap.forEach((count, word2) => {
        pairMap.set(word2, Math.floor(count * decayMultiplier))
      })
    })
    
    console.log(`[MLController] Applied decay (${decayMultiplier.toFixed(3)}x) for ${daysSinceUpdate.toFixed(1)} days`)
    
    return state
  }
  
  /**
   * Track performance metrics
   */
  async trackAttempt(strategy: string, success: boolean, timeMs: number): Promise<void> {
    if (!this.config.trackPerformance) return
    
    // Load or initialize metrics
    if (!this.metrics) {
      this.metrics = await this.loadMetrics()
    }
    
    // Update strategy performance
    if (!this.metrics.strategyPerformance.has(strategy)) {
      this.metrics.strategyPerformance.set(strategy, {
        attempts: 0,
        successes: 0,
        successRate: 0,
        avgTimeMs: 0
      })
    }
    
    const strategyMetrics = this.metrics.strategyPerformance.get(strategy)!
    strategyMetrics.attempts++
    if (success) strategyMetrics.successes++
    strategyMetrics.successRate = strategyMetrics.successes / strategyMetrics.attempts
    strategyMetrics.avgTimeMs = (strategyMetrics.avgTimeMs * (strategyMetrics.attempts - 1) + timeMs) / strategyMetrics.attempts
    
    // Add to recent attempts
    this.metrics.recentAttempts.push({
      timestamp: new Date(),
      strategy,
      success,
      timeMs
    })
    
    // Keep only recent window
    if (this.metrics.recentAttempts.length > this.config.performanceWindow) {
      this.metrics.recentAttempts.shift()
    }
    
    // Update best/worst strategies
    this.updateBestWorstStrategies()
    
    // Save metrics
    await this.saveMetrics()
  }
  
  /**
   * Get performance metrics
   */
  async getMetrics(): Promise<PerformanceMetrics> {
    if (!this.metrics) {
      this.metrics = await this.loadMetrics()
    }
    return this.metrics
  }
  
  /**
   * Calculate improvement rate compared to random baseline
   */
  calculateImprovementRate(): number {
    if (!this.metrics) return 0
    
    const randomBaseline = this.metrics.strategyPerformance.get('random')
    if (!randomBaseline || randomBaseline.attempts === 0) return 0
    
    let bestRate = randomBaseline.successRate
    this.metrics.strategyPerformance.forEach((metrics, strategy) => {
      if (strategy !== 'random' && metrics.successRate > bestRate) {
        bestRate = metrics.successRate
      }
    })
    
    return randomBaseline.successRate > 0 
      ? (bestRate - randomBaseline.successRate) / randomBaseline.successRate 
      : 0
  }
  
  /**
   * Recommend best strategy based on metrics
   */
  recommendStrategy(): string {
    if (!this.metrics) return 'adaptive'
    
    return this.metrics.bestStrategy || 'adaptive'
  }
  
  /**
   * Export ML state and config for backup
   */
  async exportState(): Promise<{
    state: MLState
    config: MLConfig
    metrics: PerformanceMetrics
    exportedAt: string
  }> {
    const state = await mlLearning.initializeMLState(this.db)
    const metrics = await this.getMetrics()
    
    return {
      state,
      config: this.config,
      metrics,
      exportedAt: new Date().toISOString()
    }
  }
  
  /**
   * Import ML state and config from backup
   */
  async importState(data: {
    state: MLState
    config: MLConfig
    metrics?: PerformanceMetrics
  }): Promise<void> {
    // Save ML state
    await mlLearning.saveMLState(this.db, data.state)
    
    // Save config
    await this.saveConfig(data.config)
    
    // Save metrics if provided
    if (data.metrics) {
      this.metrics = data.metrics
      await this.saveMetrics()
    }
    
    console.log('[MLController] State imported successfully')
  }
  
  /**
   * Reset everything (state, config, metrics)
   */
  async resetAll(): Promise<void> {
    await mlLearning.resetMLState(this.db)
    await this.db.prepare(`DELETE FROM ml_config WHERE id = 1`).run()
    await this.db.prepare(`DELETE FROM ml_metrics WHERE id = 1`).run()
    
    this.config = { ...DEFAULT_ML_CONFIG }
    this.metrics = null
    
    console.log('[MLController] All ML data reset')
  }
  
  /**
   * Get ML health status
   */
  async getHealthStatus(): Promise<{
    healthy: boolean
    issues: string[]
    recommendations: string[]
    stats: {
      totalLearned: number
      dataQuality: number
      performanceScore: number
    }
  }> {
    const state = await mlLearning.initializeMLState(this.db)
    const stats = mlLearning.getMLStats(state)
    const metrics = await this.getMetrics()
    
    const issues: string[] = []
    const recommendations: string[] = []
    
    // Check data quality
    if (stats.totalSuccesses < 10) {
      issues.push('Insufficient learning data (< 10 successes)')
      recommendations.push('Run more scans to gather learning data')
    }
    
    if (stats.learnedWords < 50) {
      recommendations.push('More data needed to learn word patterns')
    }
    
    // Check performance
    const improvementRate = this.calculateImprovementRate()
    if (improvementRate < 0.1 && stats.totalAttempts > 1000) {
      issues.push('ML not showing significant improvement')
      recommendations.push('Consider adjusting learning rate or strategy weights')
    }
    
    // Calculate scores
    const dataQuality = Math.min(stats.learnedWords / 200, 1.0)
    const performanceScore = Math.min(improvementRate / 0.5, 1.0)
    
    return {
      healthy: issues.length === 0,
      issues,
      recommendations,
      stats: {
        totalLearned: stats.learnedWords + stats.learnedPairs,
        dataQuality,
        performanceScore
      }
    }
  }
  
  // Private helper methods
  
  private async loadMetrics(): Promise<PerformanceMetrics> {
    try {
      const result = await this.db.prepare(`
        SELECT metrics_data FROM ml_metrics WHERE id = 1
      `).first<{ metrics_data: string }>()
      
      if (result && result.metrics_data) {
        const data = JSON.parse(result.metrics_data)
        return {
          strategyPerformance: new Map(data.strategyPerformance),
          recentAttempts: data.recentAttempts.map((a: any) => ({
            ...a,
            timestamp: new Date(a.timestamp)
          })),
          bestStrategy: data.bestStrategy,
          worstStrategy: data.worstStrategy,
          improvementRate: data.improvementRate,
          confidence: data.confidence
        }
      }
    } catch (error) {
      console.log('[MLController] No metrics found, initializing new')
    }
    
    return {
      strategyPerformance: new Map(),
      recentAttempts: [],
      bestStrategy: 'random',
      worstStrategy: 'random',
      improvementRate: 0,
      confidence: 0
    }
  }
  
  private async saveMetrics(): Promise<void> {
    if (!this.metrics) return
    
    const data = {
      strategyPerformance: Array.from(this.metrics.strategyPerformance.entries()),
      recentAttempts: this.metrics.recentAttempts,
      bestStrategy: this.metrics.bestStrategy,
      worstStrategy: this.metrics.worstStrategy,
      improvementRate: this.metrics.improvementRate,
      confidence: this.metrics.confidence
    }
    
    await this.db.prepare(`
      INSERT OR REPLACE INTO ml_metrics (id, metrics_data, updated_at)
      VALUES (1, ?, CURRENT_TIMESTAMP)
    `).bind(JSON.stringify(data)).run()
  }
  
  private updateBestWorstStrategies(): void {
    if (!this.metrics || this.metrics.strategyPerformance.size === 0) return
    
    let bestRate = -1
    let worstRate = Infinity
    let best = 'random'
    let worst = 'random'
    
    this.metrics.strategyPerformance.forEach((metrics, strategy) => {
      if (metrics.attempts < 10) return // Need minimum attempts
      
      if (metrics.successRate > bestRate) {
        bestRate = metrics.successRate
        best = strategy
      }
      
      if (metrics.successRate < worstRate) {
        worstRate = metrics.successRate
        worst = strategy
      }
    })
    
    this.metrics.bestStrategy = best
    this.metrics.worstStrategy = worst
    this.metrics.improvementRate = this.calculateImprovementRate()
    
    // Calculate confidence (higher with more attempts)
    const totalAttempts = Array.from(this.metrics.strategyPerformance.values())
      .reduce((sum, m) => sum + m.attempts, 0)
    this.metrics.confidence = Math.min(totalAttempts / 1000, 1.0)
  }
}
