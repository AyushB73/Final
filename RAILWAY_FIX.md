# 🔧 Railway MySQL Connection Fix

## The Problem

Your app is trying to connect to `localhost` (::1:3306) instead of Railway's MySQL service.

## ✅ Solution Steps

### Step 1: Verify MySQL Service Exists

1. Go to Railway dashboard
2. Check left sidebar
3. You MUST see TWO services:
   - Your app (plastiwood-inventory)
   - MySQL (or database)

**If MySQL is missing:**
- Click "New" → "Database" → "Add MySQL"
- Wait 30 seconds

### Step 2: Get MySQL Connection Details

1. **Click on MySQL service** (in left sidebar)
2. **Go to "Variables" tab**
3. **You'll see variables like:**
   - `MYSQLHOST` or `MYSQL_HOST`
   - `MYSQLUSER` or `MYSQL_USER`
   - `MYSQLPASSWORD` or `MYSQL_PASSWORD`
   - `MYSQLDATABASE` or `MYSQL_DATABASE`

**Write down the EXACT names!**

### Step 3: Set Variables in Your App

1. **Click on your APP service** (plastiwood-inventory)
2. **Go to "Variables" tab**
3. **Delete ALL existing variables**
4. **Add new variables using EXACT names from MySQL:**

**If MySQL shows `MYSQLHOST` (no underscore):**
```
DB_HOST=${{MySQL.MYSQLHOST}}
DB_USER=${{MySQL.MYSQLUSER}}
DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}
DB_NAME=${{MySQL.MYSQLDATABASE}}
PORT=3000
JWT_SECRET=plastiwood-secret-key-2024
NODE_ENV=production
```

**If MySQL shows `MYSQL_HOST` (with underscore):**
```
DB_HOST=${{MySQL.MYSQL_HOST}}
DB_USER=${{MySQL.MYSQL_USER}}
DB_PASSWORD=${{MySQL.MYSQL_PASSWORD}}
DB_NAME=${{MySQL.MYSQL_DATABASE}}
PORT=3000
JWT_SECRET=plastiwood-secret-key-2024
NODE_ENV=production
```

**Replace "MySQL" with your actual service name if different!**

### Step 4: Alternative - Use Direct Values

If the above doesn't work:

1. **Click on MySQL service**
2. **Go to "Connect" tab**
3. **Copy the actual connection details**
4. **In your app's Variables, use real values:**

```
DB_HOST=containers-us-west-123.railway.app
DB_USER=root
DB_PASSWORD=actual-password-here
DB_NAME=railway
PORT=3000
JWT_SECRET=plastiwood-secret-key-2024
NODE_ENV=production
```

### Step 5: Push Updated Code

I've added debug logging to server.js. Now:

```bash
git add .
git commit -m "Add debug logging"
git push origin main
```

### Step 6: Redeploy on Railway

1. Railway auto-deploys on push
2. Or click "Deploy" button manually
3. Wait 2-3 minutes

### Step 7: Check Logs

After deployment, check logs. You should see:

```
🔍 Database Configuration:
DB_HOST: containers-us-west-123.railway.app
DB_USER: root
DB_NAME: railway
DB_PASSWORD: ***SET***
✅ Connected to MySQL Database
```

**If you see "localhost (default)" - variables aren't being read!**

---

## 🎯 Most Common Issues

### Issue 1: Service Not Linked

**Fix:** Use Railway's "Service Variables" feature:
1. App Settings → Service Variables
2. Add Service Variable → Select MySQL
3. Railway auto-links everything

### Issue 2: Wrong Variable Names

**Fix:** Check MySQL service variables tab for exact names

### Issue 3: Service Name Mismatch

**Fix:** If your MySQL service is named "database" not "MySQL":
```
DB_HOST=${{database.MYSQLHOST}}
```

---

## 🆘 Still Not Working?

**Tell me:**
1. What do you see in the logs after "🔍 Database Configuration:"?
2. Does it show "localhost (default)" or actual Railway host?
3. What's your MySQL service name in left sidebar?

With this info, I can give you the exact fix!
