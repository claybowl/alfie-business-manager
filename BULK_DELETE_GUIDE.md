# Bulk Node Deletion Guide

## Overview

Alfie now supports multiple strategies for bulk deleting nodes from the knowledge graph. This is useful for:
- Clearing old data to free up storage
- Removing data from specific sources (Linear, Notion, etc.)
- Maintaining a clean graph with only recent data
- Resetting specific categories of nodes

## Available Deletion Methods

### 1. Clear Entire Graph (Nuclear Option)

Deletes ALL nodes and edges. Use with extreme caution.

**UI Method**:
- Go to Settings tab
- Find "Graph Management" section
- Click "CLEAR ALL NODES" button
- Confirm in modal

**API Method**:
```bash
curl -X DELETE http://localhost:3002/api/graph/clear
```

### 2. Delete Nodes by Date Range

Remove nodes created before/after specific dates.

**Use Cases**:
- Delete all nodes older than 30 days
- Clean up data from specific date range
- Archive old conversations

**API Method**:
```bash
# Delete nodes created before 2025-11-01
curl -X DELETE "http://localhost:3002/api/graph/nodes/by-date?beforeDate=2025-11-01"

# Delete nodes created between two dates
curl -X DELETE "http://localhost:3002/api/graph/nodes/by-date?beforeDate=2025-11-01&afterDate=2025-10-01"
```

**Parameters**:
- `beforeDate` (required): ISO 8601 date string - delete nodes created before this date
- `afterDate` (optional): ISO 8601 date string - delete nodes created after this date

### 3. Delete Nodes by Type/Source

Remove nodes from specific integrations.

**Available Types**:
- `linear` - Linear issue nodes
- `notion` - Notion page/database nodes
- `pieces` - Pieces activity/snippet nodes
- `conversation` - Chat conversation nodes
- `decision` - Decision/discussion nodes

**Use Cases**:
- Remove all Linear issue nodes
- Clear old Notion page references
- Delete Pieces activity without touching other data

**API Method**:
```bash
# Delete all Linear nodes
curl -X DELETE "http://localhost:3002/api/graph/nodes/by-type?type=linear"

# Delete all Notion nodes
curl -X DELETE "http://localhost:3002/api/graph/nodes/by-type?type=notion"

# Delete all Pieces activity nodes
curl -X DELETE "http://localhost:3002/api/graph/nodes/by-type?type=pieces"
```

**Parameters**:
- `type` (required): Type of nodes to delete (linear, notion, pieces, conversation, decision)

### 4. Delete Nodes by Label/Category

Remove nodes with specific labels (custom categories).

**Use Cases**:
- Delete nodes tagged with specific project
- Remove nodes from specific team
- Clear archived items

**API Method**:
```bash
# Delete all nodes with label "archived"
curl -X DELETE "http://localhost:3002/api/graph/nodes/by-label?label=archived"

# Delete all nodes for specific project
curl -X DELETE "http://localhost:3002/api/graph/nodes/by-label?label=ProjectName"
```

**Parameters**:
- `label` (required): Label/category of nodes to delete

## Preview Deletion Stats (Safe!)

Before performing any deletion, preview what will be deleted:

**API Method**:
```bash
# Get stats for deletion by date
curl "http://localhost:3002/api/graph/deletion-stats?beforeDate=2025-11-01"

# Get stats for deletion by type
curl "http://localhost:3002/api/graph/deletion-stats?type=linear"

# Get stats for deletion by label
curl "http://localhost:3002/api/graph/deletion-stats?label=archived"
```

**Response Example**:
```json
{
  "totalNodes": 1543,
  "toDelete": 127,
  "byDateRange": 127,
  "byType": 0,
  "byLabel": 0,
  "preview": [
    {
      "id": "node-123",
      "name": "Old Conversation",
      "type": "conversation",
      "createdAt": "2025-10-15T10:30:00Z"
    }
  ]
}
```

## Safe Deletion Workflow

### Step 1: Preview
```bash
curl "http://localhost:3002/api/graph/deletion-stats?beforeDate=2025-11-01"
```
Review the response to see how many nodes would be deleted.

### Step 2: Verify
Make sure the number matches what you expect. If it's much higher or lower than expected, check your parameters.

### Step 3: Delete
```bash
curl -X DELETE "http://localhost:3002/api/graph/nodes/by-date?beforeDate=2025-11-01"
```

### Step 4: Confirm
Check the response or refresh your graph visualization to see the results.

## UI Implementation (Settings Tab)

The Settings tab now includes a "Graph Management" section with:

1. **Total Nodes Counter**: Shows current node count
2. **Quick Actions**:
   - "Clear All" - Complete graph reset
   - "Clear By Date" - Modal with date picker
   - "Clear By Type" - Dropdown to select source (Linear/Notion/Pieces)
   - "Clear By Label" - Text input for custom labels

3. **Preview Stats**: Shows how many nodes would be deleted
4. **Confirmation Modal**: Double-check before destructive operations

## Common Recipes

### Clean Up Old Data (Keep Last 30 Days)
```bash
# Calculate date 30 days ago
DATE=$(date -d '30 days ago' '+%Y-%m-%d')

# Preview
curl "http://localhost:3002/api/graph/deletion-stats?beforeDate=$DATE"

# Delete
curl -X DELETE "http://localhost:3002/api/graph/nodes/by-date?beforeDate=$DATE"
```

### Remove All Linear Data
```bash
# Preview
curl "http://localhost:3002/api/graph/deletion-stats?type=linear"

# Delete
curl -X DELETE "http://localhost:3002/api/graph/nodes/by-type?type=linear"
```

### Archive Complete Projects
```bash
# First, label nodes with "archived" when marking project complete
# Then delete them:
curl -X DELETE "http://localhost:3002/api/graph/nodes/by-label?label=archived"
```

### Monthly Graph Cleanup
```bash
# Keep only last 60 days
DATE=$(date -d '60 days ago' '+%Y-%m-%d')
curl -X DELETE "http://localhost:3002/api/graph/nodes/by-date?beforeDate=$DATE"
```

## Best Practices

✅ **DO**:
- Use preview stats first to understand impact
- Delete in small batches (by date range or type)
- Keep backups or use Supabase cloud sync
- Document deletions for audit trail
- Test in development before production

❌ **DON'T**:
- Use "Clear All" without extreme caution
- Delete nodes you're still using in active projects
- Delete without previewing first
- Perform multiple deletions without verifying results

## Troubleshooting

### "No nodes deleted" response
- Check if your filter parameters are correct
- Verify nodes exist with that criteria using deletion-stats
- Try different date format or type name

### Error: "beforeDate parameter required"
- Include the `beforeDate` parameter in query string
- Use ISO 8601 format: YYYY-MM-DD

### Nodes not deleted despite confirmation
- Graphiti service might be unavailable - check health
- Nodes might be protected (still in use by active conversations)
- Try deleting specific type instead

### Need to recover deleted nodes
- Restore from Supabase using Supabase snapshot recovery
- Re-sync data sources (Linear, Notion, Pieces)
- Check if nodes are in sync_metadata table

## API Reference

| Endpoint | Method | Purpose | Parameters |
|----------|--------|---------|------------|
| `/api/graph/clear` | DELETE | Delete all nodes | None |
| `/api/graph/nodes/by-date` | DELETE | Delete by date range | beforeDate, afterDate |
| `/api/graph/nodes/by-type` | DELETE | Delete by source type | type |
| `/api/graph/nodes/by-label` | DELETE | Delete by label | label |
| `/api/graph/deletion-stats` | GET | Preview deletion (safe) | beforeDate, afterDate, type, label |

## Related Documentation

- API Troubleshooting: `API_TROUBLESHOOTING.md`
- Supabase Integration: `SUPABASE_INTEGRATION.md`
- Project Architecture: `CLAUDE.md`
