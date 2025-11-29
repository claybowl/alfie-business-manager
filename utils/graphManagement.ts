/**
 * Graph Management Utilities
 * Handles bulk node deletion and graph maintenance operations
 */

const BACKEND_URL = 'http://localhost:3002';

export interface DeletionStats {
  totalNodes: number;
  toDelete: number;
  byDateRange: number;
  byType: number;
  byLabel: number;
  preview: Array<{
    id: string;
    name: string;
    type: string;
    createdAt: string;
  }>;
}

/**
 * Get statistics for what would be deleted (safe preview)
 */
export async function getDeletionStats(filters: {
  beforeDate?: string;
  afterDate?: string;
  type?: string;
  label?: string;
}): Promise<DeletionStats | null> {
  try {
    const params = new URLSearchParams();
    if (filters.beforeDate) params.append('beforeDate', filters.beforeDate);
    if (filters.afterDate) params.append('afterDate', filters.afterDate);
    if (filters.type) params.append('type', filters.type);
    if (filters.label) params.append('label', filters.label);

    const response = await fetch(`${BACKEND_URL}/api/graph/deletion-stats?${params}`, {
      method: 'GET'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to get deletion stats:', error);
    return null;
  }
}

/**
 * Clear entire graph (dangerous!)
 */
export async function clearAllNodes(): Promise<boolean> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/graph/clear`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    console.log('✓ Graph cleared');
    return true;
  } catch (error) {
    console.error('Failed to clear graph:', error);
    return false;
  }
}

/**
 * Delete nodes by date range
 */
export async function deleteNodesByDate(
  beforeDate: string,
  afterDate?: string
): Promise<boolean> {
  try {
    const params = new URLSearchParams();
    params.append('beforeDate', beforeDate);
    if (afterDate) params.append('afterDate', afterDate);

    const response = await fetch(`${BACKEND_URL}/api/graph/nodes/by-date?${params}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    console.log(`✓ Nodes deleted (before: ${beforeDate})`);
    return true;
  } catch (error) {
    console.error('Failed to delete nodes by date:', error);
    return false;
  }
}

/**
 * Delete nodes by type/source
 */
export async function deleteNodesByType(type: string): Promise<boolean> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/graph/nodes/by-type?type=${encodeURIComponent(type)}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    console.log(`✓ Nodes deleted (type: ${type})`);
    return true;
  } catch (error) {
    console.error('Failed to delete nodes by type:', error);
    return false;
  }
}

/**
 * Delete nodes by label/category
 */
export async function deleteNodesByLabel(label: string): Promise<boolean> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/graph/nodes/by-label?label=${encodeURIComponent(label)}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    console.log(`✓ Nodes deleted (label: ${label})`);
    return true;
  } catch (error) {
    console.error('Failed to delete nodes by label:', error);
    return false;
  }
}

/**
 * Format date for API (YYYY-MM-DD)
 */
export function formatDateForAPI(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Get date X days ago
 */
export function getDateDaysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

/**
 * Get node type options
 */
export const NODE_TYPES = [
  { value: 'linear', label: 'Linear Issues' },
  { value: 'notion', label: 'Notion Pages' },
  { value: 'pieces', label: 'Pieces Activity' },
  { value: 'conversation', label: 'Conversations' },
  { value: 'decision', label: 'Decisions' }
];

/**
 * Calculate safe deletion recommendations
 */
export function getRecommendedCleanupDate(daysToKeep: number = 30): string {
  return formatDateForAPI(getDateDaysAgo(daysToKeep));
}

/**
 * Common deletion presets
 */
export const DELETION_PRESETS = [
  {
    name: 'Keep Last 7 Days',
    daysToKeep: 7,
    description: 'Delete nodes older than 7 days'
  },
  {
    name: 'Keep Last 30 Days',
    daysToKeep: 30,
    description: 'Delete nodes older than 30 days'
  },
  {
    name: 'Keep Last 90 Days',
    daysToKeep: 90,
    description: 'Delete nodes older than 90 days'
  }
];
