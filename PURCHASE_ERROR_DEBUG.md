# Purchase Error Debugging Guide

## Current Error
**"Bind parameters must not contain undefined. To pass SQL NULL specify JS null"**

This error means one of the values being sent to MySQL is `undefined` instead of `null` or a valid value.

## What I Fixed (Latest Push)

### 1. Frontend Validation (app.js)
- Added validation to check required fields before submitting
- Ensures Invoice Number and Purchase Date are filled
- Converts empty strings to `null` for optional fields
- Added default values for all product fields

### 2. Backend Handling (server.js)
- Converts empty strings to `null`
- Trims whitespace before checking
- Added detailed logging to see exact values being sent

### 3. Explicit Null Values
- Set `paymentTracking` explicitly to `null`
- Added fallback values for all product properties

## How to Test After Railway Redeploys

### Step 1: Wait for Deployment
1. Go to https://railway.app/
2. Click your project
3. Click web service
4. Go to "Deployments" tab
5. Wait for latest deployment to show **"Success" ✅** (takes 2-3 minutes)

### Step 2: Check Server Logs
1. In Railway, click on your web service
2. Go to "Logs" tab
3. Try adding a purchase
4. Look for these logs:
   - `📦 Adding purchase:` - Shows what data was received
   - `Processed values:` - Shows converted values
   - `✅ Purchase added successfully` - Success!
   - `❌ Error adding purchase:` - Shows the error

### Step 3: Check Browser Console
1. Open your app: https://final-production-4f72.up.railway.app
2. Press F12 to open Developer Tools
3. Go to "Console" tab
4. Try adding a purchase
5. Look for:
   - `Sending purchase data:` - Shows what's being sent
   - Any error messages

## Common Causes of This Error

### 1. Missing Invoice Number or Date
**Solution:** Make sure you fill in:
- Invoice Number field
- Purchase Date field (click the calendar icon)

### 2. Empty Product Fields
**Solution:** The code now handles this automatically

### 3. Railway Not Redeployed
**Solution:** Wait 2-3 minutes after pushing to GitHub

### 4. Browser Cache
**Solution:** Hard refresh the page:
- Windows: Ctrl + Shift + R
- Mac: Cmd + Shift + R

## If Error Persists

### Check These Values in Browser Console:
```javascript
// After clicking "Save Purchase", check console for:
Sending purchase data: {
  "supplier": {
    "name": "Rajshree Plastiwood",  // ✅ Should have value
    "phone": "9635678955",           // ✅ Can be null
    "gst": "GST123456"               // ✅ Can be null
  },
  "invoiceNo": "???",                // ❌ Check if this is undefined
  "purchaseDate": "???",             // ❌ Check if this is undefined
  "items": [...],
  "subtotal": 15000,
  "totalGST": 2700,
  "total": 17700,
  "paymentStatus": "paid",
  "paymentTracking": null
}
```

### Check Railway Logs:
Look for the exact parameter that's undefined:
```
❌ Error adding purchase: Bind parameters must not contain undefined
```

## Manual Fix (If Needed)

If the error still happens, you can manually check which field is undefined:

1. Open browser console (F12)
2. Before clicking "Save Purchase", run:
```javascript
console.log('Invoice:', document.getElementById('purchase-invoice').value);
console.log('Date:', document.getElementById('purchase-date').value);
console.log('Payment:', document.getElementById('purchase-payment-status').value);
```

3. If any shows `undefined` or empty, that's the problem field!

## Contact Info
If the error persists after Railway redeploys:
1. Check Railway logs for the exact error
2. Check browser console for the data being sent
3. Take a screenshot of both and we can debug further
