# Quick Start: Troubleshooting & Bulk Deletion

## 🔴 Your Issues & Solutions

### Issue #1: Not Pulling from Notion/Linear Correctly

**Problem**: Connection/Auth errors (401/403)

**Quick Fixes**:

1. **Verify API Keys**
   ```bash
   # Check your .env.local file
   echo "LINEAR_API_KEY=$LINEAR_API_KEY"
   echo "NOTION_API_KEY=$NOTION_API_KEY"
   ```

2. **Regenerate Keys If Needed**
   - Linear: https://linear.app/settings/api → Regenerate API Key
   - Notion: https://www.notion.so/my-integrations → Regenerate secret

3. **Ensure Integration Access**
   - For Notion: Open your database → "..." → Connections → Add your integration
   - For Linear: Check workspace settings that integration has access

4. **Test Connection**
   ```bash
   # Linear test
   curl -X GET http://localhost:3002/api/linear/issues

   # Notion test
   curl -X GET http://localhost:3002/api/notion/search
   ```

**More Help**: See `API_TROUBLESHOOTING.md`

---

### Issue #2: Need to Delete Large Amounts of Nodes

**Problem**: Too many nodes in graph, performance issues, or need to clean up

**Solutions Available**:

#### Quick Delete All
```bash
curl -X DELETE http://localhost:3002/api/graph/clear
```
⚠️ **WARNING**: This deletes EVERYTHING. Back up first!

#### Delete Old Data (Safe & Recommended)
```bash
# Delete nodes older than 30 days
curl -X DELETE "http://localhost:3002/api/graph/nodes/by-date?beforeDate=$(date -d '30 days ago' '+%Y-%m-%d')"
```

#### Delete Specific Source
```bash
# Delete all Linear nodes only
curl -X DELETE "http://localhost:3002/api/graph/nodes/by-type?type=linear"

# Delete all Notion nodes only
curl -X DELETE "http://localhost:3002/api/graph/nodes/by-type?type=notion"

# Delete all Pieces activity
curl -X DELETE "http://localhost:3002/api/graph/nodes/by-type?type=pieces"
```

#### Preview Before Deleting (Always Do This!)
```bash
# See what will be deleted before executing
curl "http://localhost:3002/api/graph/deletion-stats?beforeDate=$(date -d '30 days ago' '+%Y-%m-%d')"
```

**More Help**: See `BULK_DELETE_GUIDE.md`

---

## 📋 Deletion Methods Comparison

| Method | What Gets Deleted | Use Case | Safety |
|--------|------------------|----------|--------|
| Clear All | Everything | Complete reset | ⚠️ Dangerous |
| By Date | Nodes created before X | Clean old data | ✅ Safe |
| By Type | Specific source (Linear/Notion) | Remove one integration | ✅ Safe |
| By Label | Custom labeled nodes | Archive projects | ✅ Safe |

---

## 🔍 Testing Your Setup

### Test Backend Connection
```bash
curl http://localhost:3002/health
```

### Test Graphiti Service
```bash
curl http://localhost:8000/health
```

### Test Data Endpoints
```bash
# Get briefing data (includes Linear + Notion)
curl http://localhost:3002/api/briefing/full
```

### Test Deletion Stats (Safe!)
```bash
# See current graph size
curl "http://localhost:3002/api/graph/deletion-stats"
```

---

## 📚 Complete Documentation

| Document | Purpose |
|----------|---------|
| `API_TROUBLESHOOTING.md` | Detailed API debugging guide |
| `BULK_DELETE_GUIDE.md` | Complete deletion strategies & recipes |
| `SUPABASE_INTEGRATION.md` | Cloud backup setup |
| `CLAUDE.md` | Project architecture overview |

---

## 🚀 Common Workflows

### Workflow 1: Clean Up & Reindex
```bash
# 1. Preview what will be deleted
curl "http://localhost:3002/api/graph/deletion-stats?beforeDate=$(date -d '30 days ago' '+%Y-%m-%d')"

# 2. Confirm the number looks right
# 3. Delete old data
curl -X DELETE "http://localhost:3002/api/graph/nodes/by-date?beforeDate=$(date -d '30 days ago' '+%Y-%m-%d')"

# 4. Refresh briefing to rebuild from sources
# (Restart backend or refresh frontend)
```

### Workflow 2: Remove One Data Source
```bash
# Example: Remove all Linear data
curl -X DELETE "http://localhost:3002/api/graph/nodes/by-type?type=linear"

# Then you can re-sync Linear fresh if needed
```

### Workflow 3: Complete Fresh Start
```bash
# 1. Back up to Supabase first:
# Go to Briefing → Click "UPLOAD ☁️" button

# 2. Clear everything:
curl -X DELETE http://localhost:3002/api/graph/clear

# 3. Restart backend to rebuild from fresh data
```

---

## ⚠️ Important Notes

### Before Bulk Deletion
- ✅ Always run preview stats first
- ✅ Back up to Supabase (click "UPLOAD ☁️" in Briefing)
- ✅ Verify the deletion count is what you expect
- ✅ Have Graphiti service running

### After Bulk Deletion
- Refresh the frontend to see updated graph
- You might see fewer nodes in visualization
- Re-syncing sources will repopulate data
- Check deletion-stats again to verify it worked

### If Something Goes Wrong
- Check backend logs: `npm run dev` in backend directory
- Verify Graphiti service is running: `curl http://localhost:8000/health`
- Try one more time or restart services
- Restore from Supabase backup if available

---

## 💡 Pro Tips

1. **Use Dates for Regular Cleanup**
   ```bash
   # Run weekly cleanup to keep last 60 days
   DATE=$(date -d '60 days ago' '+%Y-%m-%d')
   curl -X DELETE "http://localhost:3002/api/graph/nodes/by-date?beforeDate=$DATE"
   ```

2. **Keep Supabase Sync Fresh**
   - Click "UPLOAD ☁️" after major changes
   - Your briefing snapshots are backed up to cloud

3. **Monitor Graph Size**
   ```bash
   # Check total nodes regularly
   curl "http://localhost:3002/api/graph/deletion-stats" | grep totalNodes
   ```

4. **Archive Instead of Delete**
   - Label nodes with `archived` label
   - Delete them later: `curl -X DELETE ".../by-label?label=archived"`

---

## 🆘 Stuck? Try This

1. **Linear not pulling?**
   - Generate new API key at https://linear.app/settings/api
   - Update `.env.local` with new key
   - Restart backend

2. **Notion not pulling?**
   - Go to https://www.notion.so/my-integrations
   - Make sure integration is installed
   - Share the page/database with the integration
   - Regenerate token if needed

3. **Too many nodes slowing things down?**
   ```bash
   # Delete anything older than 7 days
   curl -X DELETE "http://localhost:3002/api/graph/nodes/by-date?beforeDate=$(date -d '7 days ago' '+%Y-%m-%d')"
   ```

4. **Want a complete fresh start?**
   ```bash
   # 1. Backup first
   # Click "UPLOAD ☁️" in Briefing tab

   # 2. Clear everything
   curl -X DELETE http://localhost:3002/api/graph/clear

   # 3. Restart backend
   # Ctrl+C in backend terminal, then: npm run dev
   ```

---

## 📞 Next Steps

- **To fix API issues**: Read `API_TROUBLESHOOTING.md`
- **For deletion details**: Read `BULK_DELETE_GUIDE.md`
- **To back up data**: See `SUPABASE_INTEGRATION.md`
- **For architecture**: Check `CLAUDE.md`
