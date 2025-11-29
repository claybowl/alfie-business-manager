/**
 * Workstream Migration Utility
 * Migrate historical Pieces data to new structured workstream_summaries schema
 */

// ============================================================================
// TYPES
// ============================================================================

export interface MigrationStatus {
  totalSummaries: number;
  latestDate: string | null;
  oldestDate: string | null;
  ready: boolean;
}

export interface MigrationResult {
  success: boolean;
  message: string;
  migrated: number;
  skipped: number;
  total: number;
  samples?: any[];
  error?: string;
}

// ============================================================================
// MIGRATION OPERATIONS
// ============================================================================

/**
 * Check current migration status (how many summaries are already migrated?)
 */
export async function checkMigrationStatus(): Promise<MigrationStatus | null> {
  try {
    const response = await fetch('http://localhost:3002/api/workstream-summaries/migration/status');
    if (!response.ok) {
      console.error('Migration status check failed:', response.status);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error('Error checking migration status:', error);
    return null;
  }
}

/**
 * Trigger migration of historical Pieces data (last N days)
 */
export async function migrateHistoricalData(days: number = 14): Promise<MigrationResult> {
  try {
    const response = await fetch('http://localhost:3002/api/workstream-summaries/migrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days })
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        message: error.error || 'Migration failed',
        migrated: 0,
        skipped: 0,
        total: 0,
        error: error.error
      };
    }

    return await response.json();
  } catch (error) {
    console.error('Error during migration:', error);
    return {
      success: false,
      message: (error as Error).message || 'Migration failed',
      migrated: 0,
      skipped: 0,
      total: 0,
      error: (error as Error).message
    };
  }
}

/**
 * User-friendly migration with progress logging
 */
export async function performMigrationWithFeedback(
  days: number = 14,
  onProgress?: (message: string) => void
): Promise<MigrationResult> {
  const log = (message: string) => {
    console.log(`[Migration] ${message}`);
    onProgress?.(message);
  };

  log(`Starting migration of last ${days} days of workstream data...`);

  // Check current status
  log('Checking current migration status...');
  const status = await checkMigrationStatus();

  if (status) {
    log(`Currently have ${status.totalSummaries} summaries stored (${status.oldestDate} to ${status.latestDate})`);
  }

  // Perform migration
  log('Fetching and parsing Pieces data...');
  const result = await migrateHistoricalData(days);

  if (result.success) {
    log(`✓ Migration complete!`);
    log(`  - Migrated: ${result.migrated}`);
    log(`  - Already existing: ${result.skipped}`);
    log(`  - Total processed: ${result.total}`);
  } else {
    log(`✗ Migration failed: ${result.message}`);
  }

  return result;
}

/**
 * Format migration results for display
 */
export function formatMigrationResults(result: MigrationResult): string {
  if (!result.success) {
    return `Migration Failed\n\nError: ${result.error || result.message}`;
  }

  let output = `✅ Migration Complete\n\n`;
  output += `${result.message}\n\n`;
  output += `Summary:\n`;
  output += `  • Newly Migrated: ${result.migrated}\n`;
  output += `  • Already Existed: ${result.skipped}\n`;
  output += `  • Total Processed: ${result.total}\n`;

  if (result.migrated === 0 && result.skipped > 0) {
    output += `\nℹ All workstream summaries from the last ${14} days are already in the database!`;
  }

  return output;
}
