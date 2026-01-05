# 🚀 Setup Guide

## Quick Railway Deployment (5 Minutes)

### Step 1: Push to GitHub

```bash
git add .
git commit -m "Initial commit"
git push origin main
```

### Step 2: Deploy to Railway

1. Go to: https://railway.app/
2. Login with GitHub
3. Click "New Project"
4. Click "Deploy from GitHub repo"
5. Select your repository

### Step 3: Add MySQL Database

1. In same project, click "New"
2. Click "Database"
3. Select "Add MySQL"
4. Wait 30 seconds

### Step 4: Add Environment Variables

1. Click on your app service (not MySQL)
2. Go to "Variables" tab
3. Add these variables:

```
DB_HOST=${{MySQL.MYSQL_HOST}}
DB_USER=${{MySQL.MYSQL_USER}}
DB_PASSWORD=${{MySQL.MYSQL_PASSWORD}}
DB_NAME=${{MySQL.MYSQL_DATABASE}}
PORT=3000
JWT_SECRET=plastiwood-secret-key-2024
NODE_ENV=production
```

**Important:** Use `${{MySQL.MYSQL_HOST}}` exactly as shown (with double curly braces)

### Step 5: Generate Domain

1. Click "Settings" tab
2. Click "Generate Domain"
3. Your app is live!

### Step 6: Check Logs

1. Click "Deployments" tab
2. Click latest deployment
3. Click "View Logs"
4. Should see: "✅ Connected to MySQL Database"

---

## Troubleshooting

### If you see "Not Found":

1. **Check logs** (Deployments → View Logs)
2. **Verify all 7 variables** are set
3. **Check MySQL service** exists in left sidebar
4. **Redeploy** (Deployments → Deploy button)

### Common Issues:

**Error: "ECONNREFUSED"**
- Fix: Check environment variables are correct
- Make sure MySQL service is running

**Error: "Cannot find module"**
- Fix: Make sure package.json is in root folder
- Redeploy

**Domain shows "Not Found"**
- Fix: Check logs for errors
- Verify all variables are set
- Wait 2-3 minutes after deployment

---

## Login Credentials

- **Owner:** username: `owner`, password: `owner123`
- **Staff:** username: `staff`, password: `staff123`

---

## What Gets Deployed

Essential files only:
- `server.js` - Backend server
- `package.json` - Dependencies
- `public/` - Frontend files
- `.env.example` - Environment template

**Note:** `.env` file is NOT uploaded (it's in .gitignore)

---

## Need Help?

Check Railway logs first - they show exactly what's wrong!

**Logs location:** Railway Dashboard → Your App → Deployments → Latest → View Logs
