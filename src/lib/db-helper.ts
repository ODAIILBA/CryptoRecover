/**
 * Database Helper Module
 * Handles scan history persistence and retrieval
 */

import type { D1Database } from '@cloudflare/workers-types'
import { encryptData, decryptData } from './crypto'

// Types
export interface ScanRecord {
  id?: number
  user_id: number
  mode: 'system_api' | 'custom_api' | 'batch_scan'
  input_type: 'wallet_address' | 'seed_phrase' | 'random_generation'
  input_value: string // encrypted
  wallet_type: 'ETH' | 'BTC' | 'SOL' | 'both' | 'all'
  word_count?: number
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'
  total_attempts: number
  success_count: number
  scan_speed: number
  use_real_api: boolean
  created_at?: string
  started_at?: string
  completed_at?: string
  updated_at?: string
}

export interface ScanResultRecord {
  id?: number
  scan_id: number
  wallet_address: string // encrypted
  wallet_type: 'ETH' | 'BTC' | 'SOL'
  balance: string // encrypted
  balance_usd: string // encrypted
  transaction_count: number
  encryption_iv: string
  discovered_at?: string
  created_at?: string
}

export interface SeedPhraseRecord {
  id?: number
  scan_id: number
  seed_phrase: string // encrypted
  word_count: number
  has_balance: boolean
  total_balance_usd: string
  encryption_iv: string
  created_at?: string
}

/**
 * Create a new scan record
 */
export async function createScan(
  db: D1Database,
  scan: Omit<ScanRecord, 'id' | 'created_at' | 'updated_at'>,
  encryptionKey: string
): Promise<number> {
  const encryptedValue = await encryptData(scan.input_value, encryptionKey)
  
  const result = await db.prepare(`
    INSERT INTO scans (
      user_id, mode, input_type, input_value, wallet_type, word_count,
      status, total_attempts, success_count, scan_speed, use_real_api,
      started_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).bind(
    scan.user_id,
    scan.mode,
    scan.input_type,
    encryptedValue,
    scan.wallet_type,
    scan.word_count || 12,
    scan.status,
    scan.total_attempts,
    scan.success_count,
    scan.scan_speed,
    scan.use_real_api ? 1 : 0
  ).run()
  
  return result.meta.last_row_id as number
}

/**
 * Update scan progress
 */
export async function updateScanProgress(
  db: D1Database,
  scanId: number,
  updates: {
    status?: ScanRecord['status']
    total_attempts?: number
    success_count?: number
    scan_speed?: number
    completed_at?: string
  }
): Promise<void> {
  const fields: string[] = []
  const values: any[] = []
  
  if (updates.status !== undefined) {
    fields.push('status = ?')
    values.push(updates.status)
  }
  if (updates.total_attempts !== undefined) {
    fields.push('total_attempts = ?')
    values.push(updates.total_attempts)
  }
  if (updates.success_count !== undefined) {
    fields.push('success_count = ?')
    values.push(updates.success_count)
  }
  if (updates.scan_speed !== undefined) {
    fields.push('scan_speed = ?')
    values.push(updates.scan_speed)
  }
  if (updates.completed_at !== undefined) {
    fields.push('completed_at = ?')
    values.push(updates.completed_at)
  }
  
  fields.push('updated_at = CURRENT_TIMESTAMP')
  
  await db.prepare(`
    UPDATE scans SET ${fields.join(', ')} WHERE id = ?
  `).bind(...values, scanId).run()
}

/**
 * Save scan result (found wallet)
 */
export async function saveScanResult(
  db: D1Database,
  result: Omit<ScanResultRecord, 'id' | 'created_at' | 'discovered_at'>,
  encryptionKey: string
): Promise<number> {
  const encryptedAddress = await encryptData(result.wallet_address, encryptionKey)
  const encryptedBalance = await encryptData(result.balance, encryptionKey)
  const encryptedBalanceUsd = await encryptData(result.balance_usd, encryptionKey)
  
  const dbResult = await db.prepare(`
    INSERT INTO scan_results (
      scan_id, wallet_address, wallet_type, balance, balance_usd,
      transaction_count, encryption_iv
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    result.scan_id,
    encryptedAddress,
    result.wallet_type,
    encryptedBalance,
    encryptedBalanceUsd,
    result.transaction_count,
    result.encryption_iv
  ).run()
  
  return dbResult.meta.last_row_id as number
}

/**
 * Save seed phrase (for tracking what was tested)
 */
export async function saveSeedPhrase(
  db: D1Database,
  phrase: Omit<SeedPhraseRecord, 'id' | 'created_at'>,
  encryptionKey: string
): Promise<number> {
  const encryptedPhrase = await encryptData(phrase.seed_phrase, encryptionKey)
  
  const result = await db.prepare(`
    INSERT INTO seed_phrases (
      scan_id, seed_phrase, word_count, has_balance,
      total_balance_usd, encryption_iv
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    phrase.scan_id,
    encryptedPhrase,
    phrase.word_count,
    phrase.has_balance ? 1 : 0,
    phrase.total_balance_usd,
    phrase.encryption_iv
  ).run()
  
  return result.meta.last_row_id as number
}

/**
 * Get scan history for a user
 */
export async function getScanHistory(
  db: D1Database,
  userId: number,
  limit: number = 50,
  offset: number = 0
): Promise<ScanRecord[]> {
  const result = await db.prepare(`
    SELECT 
      id, user_id, mode, input_type, wallet_type, word_count,
      status, total_attempts, success_count, scan_speed,
      use_real_api, created_at, started_at, completed_at
    FROM scans
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).bind(userId, limit, offset).all()
  
  return result.results.map(row => ({
    ...row,
    use_real_api: row.use_real_api === 1,
    input_value: '' // Don't return encrypted value
  })) as ScanRecord[]
}

/**
 * Get scan by ID
 */
export async function getScanById(
  db: D1Database,
  scanId: number
): Promise<ScanRecord | null> {
  const result = await db.prepare(`
    SELECT 
      id, user_id, mode, input_type, wallet_type, word_count,
      status, total_attempts, success_count, scan_speed,
      use_real_api, created_at, started_at, completed_at
    FROM scans
    WHERE id = ?
  `).bind(scanId).first()
  
  if (!result) return null
  
  return {
    ...result,
    use_real_api: result.use_real_api === 1,
    input_value: '' // Don't return encrypted value
  } as ScanRecord
}

/**
 * Get scan results (found wallets) for a scan
 */
export async function getScanResults(
  db: D1Database,
  scanId: number,
  encryptionKey: string
): Promise<Array<{
  wallet_address: string
  wallet_type: string
  balance: string
  balance_usd: string
  transaction_count: number
  discovered_at: string
}>> {
  const result = await db.prepare(`
    SELECT 
      wallet_address, wallet_type, balance, balance_usd,
      transaction_count, discovered_at
    FROM scan_results
    WHERE scan_id = ?
    ORDER BY discovered_at DESC
  `).bind(scanId).all()
  
  return result.results.map(row => ({
    wallet_address: decryptData(row.wallet_address as string, encryptionKey),
    wallet_type: row.wallet_type as string,
    balance: decryptData(row.balance as string, encryptionKey),
    balance_usd: decryptData(row.balance_usd as string, encryptionKey),
    transaction_count: row.transaction_count as number,
    discovered_at: row.discovered_at as string
  }))
}

/**
 * Get scan statistics
 */
export async function getScanStats(
  db: D1Database,
  userId: number
): Promise<{
  total_scans: number
  completed_scans: number
  total_attempts: number
  total_found: number
  success_rate: number
}> {
  const result = await db.prepare(`
    SELECT 
      COUNT(*) as total_scans,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_scans,
      SUM(total_attempts) as total_attempts,
      SUM(success_count) as total_found
    FROM scans
    WHERE user_id = ?
  `).bind(userId).first()
  
  if (!result) {
    return {
      total_scans: 0,
      completed_scans: 0,
      total_attempts: 0,
      total_found: 0,
      success_rate: 0
    }
  }
  
  const totalAttempts = Number(result.total_attempts) || 0
  const totalFound = Number(result.total_found) || 0
  
  return {
    total_scans: Number(result.total_scans) || 0,
    completed_scans: Number(result.completed_scans) || 0,
    total_attempts: totalAttempts,
    total_found: totalFound,
    success_rate: totalAttempts > 0 ? (totalFound / totalAttempts) * 100 : 0
  }
}

/**
 * Delete old scans (cleanup utility)
 */
export async function deleteOldScans(
  db: D1Database,
  daysOld: number = 30
): Promise<number> {
  const result = await db.prepare(`
    DELETE FROM scans
    WHERE created_at < datetime('now', '-' || ? || ' days')
  `).bind(daysOld).run()
  
  return result.meta.changes || 0
}
