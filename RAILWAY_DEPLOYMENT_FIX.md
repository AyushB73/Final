# Railway Deployment Fix - "Failed to Load Inventory" Error

## Problem
Your app on Railway (`final-production-4f72.up.railway.app`) shows "Failed to load inventory" because it cannot connect to the MySQL database.

## Solution

### Step 1: Check if MySQL Service is Running
1. Go to https://railway.app/
2. Open your project
3. Make sure you have a **MySQL service** added
4. If not, click **"+ New"** → **"Database"** → **"Add MySQL"**

### Step 2: Link MySQL to Your App
1. In Railway dashboard, click on your **web service** (the one running your app)
2. Go to **"Variables"** tab
3. Click **"+ New Variable"** → **"Add Reference"**
4. Select your MySQL service
5. This will automatically add these variables:
   - `MYSQLHOST`
   - `MYSQLUSER`
   - `MYSQLPASSWORD`
   - `MYSQLDATABASE`
   - `MYSQLPORT`

### Step 3: Verify Environment Variables
Make sure these variables are set in Railway (not in .env file):
- `MYSQLHOST` = `mysql.railway.internal` (or your MySQL host)
- `MYSQLUSER` = `root`
- `MYSQLPASSWORD` = (your MySQL password)
- `MYSQLDATABASE` = `railway`
- `MYSQLPORT` = `3306`

### Step 4: Redeploy
1. After setting variables, Railway will automatically redeploy
2. Or manually trigger: **Settings** → **"Redeploy"**

### Step 5: Check Deployment Logs
1. Click on your web service
2. Go to **"Deployments"** tab
3. Click on the latest deployment
4. Check logs for:
   - ✅ "Connected to MySQL Database" = SUCCESS
   - ❌ "MySQL connection error" = FAILED (check variables)

### Step 6: Test the Health Endpoint
Open in browser:
```
https://final-production-4f72.up.railway.app/api/health
```

Should return:
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2026-01-05T..."
}
```

## Common Issues

### Issue 1: "ENOTFOUND mysql.railway.internal"
**Cause:** MySQL service not linked or wrong host
**Fix:** Make sure MySQL service is added and linked (Step 2)

### Issue 2: "Access denied for user"
**Cause:** Wrong password or username
**Fix:** Check MYSQLUSER and MYSQLPASSWORD in Railway variables

### Issue 3: "Unknown database"
**Cause:** Database name doesn't exist
**Fix:** Set MYSQLDATABASE to `railway` (default Railway MySQL database)

## Local Development

For local development, create a `.env.local` file (don't commit this):
```env
MYSQLHOST=your-public-mysql-host.railway.app
MYSQLUSER=root
MYSQLPASSWORD=your-password
MYSQLDATABASE=railway
MYSQLPORT=3306
PORT=3000
```

Then run:
```bash
node server.js
```

## Need Help?

1. Check Railway logs for specific error messages
2. Test health endpoint: `/api/health`
3. Verify all environment variables are set correctly
4. Make sure MySQL service is running and linked
