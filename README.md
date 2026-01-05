# 🏢 Plastiwood Inventory Management System

Real-time inventory and billing management system with MySQL database.

## ✨ Features

- 📦 **Real-Time Inventory** - Instant sync across all devices
- 💰 **GST Billing** - Compliant invoices with PDF generation
- 🛒 **Purchase Tracking** - Supplier management
- 👥 **Multi-User** - Owner and Staff roles
- 📊 **Dashboard** - Business analytics
- 🔄 **Live Sync** - WebSocket-powered updates
- 📱 **Mobile PWA** - Install as app

## 🚀 Quick Deploy (5 Minutes)

**See [SETUP.md](SETUP.md) for complete instructions**

1. Push to GitHub
2. Deploy to Railway
3. Add MySQL database
4. Set environment variables
5. Generate domain

## 🔐 Default Login

- **Owner:** `owner` / `owner123`
- **Staff:** `staff` / `staff123`

## 🛠️ Tech Stack

- **Backend:** Node.js + Express
- **Database:** MySQL
- **Real-Time:** Socket.IO
- **Frontend:** Vanilla JavaScript

## 📁 Project Structure

```
├── server.js              # Backend server
├── package.json           # Dependencies
├── public/
│   ├── index.html        # Main app
│   ├── login.html        # Login page
│   ├── app.js            # App logic
│   ├── auth.js           # Authentication
│   ├── api-service.js    # API calls
│   ├── realtime-sync.js  # Real-time sync
│   └── styles.css        # Styling
└── SETUP.md              # Setup guide
```

## 🗄️ Database

**MySQL tables (created automatically):**
- `inventory` - Products and stock
- `bills` - Sales records
- `purchases` - Purchase orders
- `customers` - Customer database
- `suppliers` - Supplier database

## 🌍 Deployment

**Supported platforms:**
- Railway (recommended)
- Render
- Vercel
- Netlify
- Heroku

**See [SETUP.md](SETUP.md) for deployment instructions**

## 📞 Support

Check [SETUP.md](SETUP.md) for:
- Deployment steps
- Troubleshooting
- Environment variables
- Common issues

---

**Version:** 3.0.0 | **Database:** MySQL | **Status:** Production Ready
