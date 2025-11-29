# API Integration Troubleshooting Guide

## Notion/Linear Connection Issues

### Common Problems & Solutions

#### 1. Authentication Errors (401/403)

**Problem**: API returns 401 Unauthorized or 403 Forbidden

**Solutions**:
- **Linear API Key**:
  - Check `.env.local` has `LINEAR_API_KEY=lin_api_...`
  - Verify it's not expired: Go to https://linear.app/settings/api
  - Current key format should be: `lin_api_k...` (starts with `lin_api_`)
  - Try regenerating the key in Linear settings

- **Notion API Key**:
  - Check `.env.local` has `NOTION_API_KEY=ntn_...`
  - Verify the integration is installed in your Notion workspace
  - Check if connection is still active in https://www.notion.so/my-integrations
  - Try regenerating the integration token

#### 2. Empty Results (200 OK but no data)

**Problem**: API returns success but no issues/pages

**Solutions**:
- **Linear**: Check if there are any issues in your workspace
  - Go to https://linear.app and verify you have active issues
  - Backend filters for first 25 issues - if you have none, it returns empty
  - Try creating test issues if none exist

- **Notion**: Check if databases/pages are shared with integration
  - In Notion, open your database/page
  - Click "..." → Connections → Add your integration
  - Verify the integration has access to the page

#### 3. Network Connectivity

**Problem**: ECONNREFUSED or timeout errors

**Solutions**:
- Verify you have internet connection
- Check if the API endpoints are reachable:
  ```bash
  curl -I https://api.linear.app/graphql
  curl -I https://api.notion.com/v1/search
  ```
- Backend might not be able to reach external APIs (proxy issues)

### Debugging Steps

1. **Check Backend Logs**:
   ```bash
   cd backend
   npm run dev  # Shows errors in real-time
   ```

2. **Test API Endpoints Directly**:
   ```bash
   # Linear test
   curl -X GET http://localhost:3002/api/linear/issues

   # Notion test
   curl -X GET http://localhost:3002/api/notion/search
   ```

3. **Verify Environment Variables**:
   ```bash
   # In backend directory
   echo $LINEAR_API_KEY
   echo $NOTION_API_KEY
   ```

4. **Check Briefing Endpoint**:
   ```bash
   curl -X GET http://localhost:3002/api/briefing/full
   ```
   Look at the `errors` field for detailed error messages

## Bulk Node Deletion Features

See `BULK_DELETE_GUIDE.md` for implementation and usage.

## Quick Reference

| Issue | Likely Cause | Fix |
|-------|--------------|-----|
| 401 Unauthorized | Bad API key | Regenerate key in service settings |
| 403 Forbidden | Integration not connected | Share database/workspace with integration |
| Empty results | No data in source | Create test data or check filters |
| Connection timeout | Network issue | Check internet, restart backend |
| Partial data | API rate limit | Wait or check API quota |

## Support Resources

- Linear API Docs: https://developers.linear.app/docs/graphql
- Notion API Docs: https://developers.notion.com/reference
- Alfie Architecture: `CLAUDE.md`
