const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// MySQL Connection Pool
let pool;

async function initializeDatabase() {
  try {
    // Support both Railway variables and custom variables
    const dbHost = process.env.MYSQLHOST || process.env.DB_HOST || 'localhost';
    const dbUser = process.env.MYSQLUSER || process.env.DB_USER || 'root';
    const dbPassword = process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '';
    const dbName = process.env.MYSQLDATABASE || process.env.DB_NAME || 'plastiwood_inventory';
    const dbPort = process.env.MYSQLPORT || process.env.DB_PORT || 3306;
    
    // Debug: Log environment variables (hide password)
    console.log('🔍 Database Configuration:');
    console.log('Host:', dbHost);
    console.log('User:', dbUser);
    console.log('Database:', dbName);
    console.log('Port:', dbPort);
    console.log('Password:', dbPassword ? '***SET***' : 'EMPTY');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    
    // Validate required environment variables
    if (!dbHost || !dbUser || !dbName) {
      throw new Error('Missing required database environment variables. Please check Railway environment variables.');
    }
    
    pool = mysql.createPool({
      host: dbHost,
      user: dbUser,
      password: dbPassword,
      database: dbName,
      port: dbPort,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      connectTimeout: 10000 // 10 seconds timeout
    });

    // Test connection
    console.log('🔄 Testing database connection...');
    const connection = await pool.getConnection();
    console.log('✅ Connected to MySQL Database');
    connection.release();

    // Create tables if they don't exist
    await createTables();
  } catch (error) {
    console.error('❌ MySQL connection error:', error);
    console.error('Error details:', error.message);
    console.error('Please check:');
    console.error('1. Railway MySQL service is running');
    console.error('2. Environment variables are set correctly in Railway dashboard');
    console.error('3. MySQL service is linked to this deployment');
    throw error; // Re-throw to prevent server from starting with bad DB connection
  }
}

// Create database tables
async function createTables() {
  const connection = await pool.getConnection();
  
  try {
    // Inventory table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS inventory (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        hsn VARCHAR(50),
        size VARCHAR(100),
        colour VARCHAR(100),
        unit VARCHAR(50),
        quantity INT DEFAULT 0,
        minStock INT DEFAULT 0,
        price DECIMAL(10, 2) DEFAULT 0,
        gst DECIMAL(5, 2) DEFAULT 0,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Bills table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS bills (
        id INT PRIMARY KEY AUTO_INCREMENT,
        customerName VARCHAR(255),
        customerPhone VARCHAR(50),
        customerGst VARCHAR(50),
        customerAddress TEXT,
        customerState VARCHAR(50),
        items JSON,
        subtotal DECIMAL(10, 2),
        gstBreakdown JSON,
        totalGST DECIMAL(10, 2),
        total DECIMAL(10, 2),
        paymentStatus VARCHAR(50),
        paymentTracking JSON,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Purchases table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS purchases (
        id INT PRIMARY KEY AUTO_INCREMENT,
        supplierName VARCHAR(255),
        supplierPhone VARCHAR(50),
        supplierGst VARCHAR(50),
        invoiceNo VARCHAR(100),
        purchaseDate DATE,
        items JSON,
        subtotal DECIMAL(10, 2),
        totalGST DECIMAL(10, 2),
        total DECIMAL(10, 2),
        paymentStatus VARCHAR(50),
        paymentTracking JSON,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Customers table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        gst VARCHAR(50),
        address TEXT,
        state VARCHAR(50),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        lastBillDate TIMESTAMP NULL
      )
    `);

    // Suppliers table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        gst VARCHAR(50),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Database tables created/verified');
  } catch (error) {
    console.error('❌ Error creating tables:', error);
    throw error;
  } finally {
    connection.release();
  }
}

// Helper functions for database operations
async function query(sql, params) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

// API Routes

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    // Test database connection
    const connection = await pool.getConnection();
    connection.release();
    
    res.json({ 
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Inventory Routes
app.get('/api/inventory', async (req, res) => {
  try {
    const inventory = await query('SELECT * FROM inventory ORDER BY id ASC');
    
    // Ensure numeric fields are numbers, not strings
    const formattedInventory = inventory.map(item => ({
      ...item,
      quantity: parseInt(item.quantity) || 0,
      minStock: parseInt(item.minStock) || 0,
      price: parseFloat(item.price) || 0,
      gst: parseFloat(item.gst) || 0
    }));
    
    res.json(formattedInventory);
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/inventory', async (req, res) => {
  try {
    const { name, description, hsn, size, colour, unit, quantity, minStock, price, gst } = req.body;
    
    const result = await query(
      `INSERT INTO inventory (name, description, hsn, size, colour, unit, quantity, minStock, price, gst) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, description, hsn, size, colour, unit, quantity || 0, minStock || 0, price, gst]
    );
    
    const item = {
      id: result.insertId,
      name, description, hsn, size, colour, unit,
      quantity: quantity || 0,
      minStock: minStock || 0,
      price, gst,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Emit real-time update to all connected clients
    io.emit('inventory:updated', { action: 'add', item });
    
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/inventory/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    // Get current item first
    const [currentItem] = await query('SELECT * FROM inventory WHERE id=?', [id]);
    
    if (!currentItem) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    // Merge with new data (only update provided fields)
    const { name, description, hsn, size, colour, unit, quantity, minStock, price, gst } = req.body;
    
    const updatedData = {
      name: name !== undefined ? name : currentItem.name,
      description: description !== undefined ? description : currentItem.description,
      hsn: hsn !== undefined ? hsn : currentItem.hsn,
      size: size !== undefined ? size : currentItem.size,
      colour: colour !== undefined ? colour : currentItem.colour,
      unit: unit !== undefined ? unit : currentItem.unit,
      quantity: quantity !== undefined ? quantity : currentItem.quantity,
      minStock: minStock !== undefined ? minStock : currentItem.minStock,
      price: price !== undefined ? price : currentItem.price,
      gst: gst !== undefined ? gst : currentItem.gst
    };
    
    await query(
      `UPDATE inventory SET name=?, description=?, hsn=?, size=?, colour=?, unit=?, 
       quantity=?, minStock=?, price=?, gst=?, updatedAt=NOW() WHERE id=?`,
      [
        updatedData.name,
        updatedData.description,
        updatedData.hsn,
        updatedData.size,
        updatedData.colour,
        updatedData.unit,
        updatedData.quantity,
        updatedData.minStock,
        updatedData.price,
        updatedData.gst,
        id
      ]
    );
    
    const [item] = await query('SELECT * FROM inventory WHERE id=?', [id]);
    
    // Emit real-time update to all connected clients
    io.emit('inventory:updated', { action: 'update', item });
    
    res.json(item);
  } catch (error) {
    console.error('❌ Error updating inventory:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/inventory/:id', async (req, res) => {
  try {
    const itemId = parseInt(req.params.id);
    await query('DELETE FROM inventory WHERE id=?', [itemId]);
    
    // Emit real-time update to all connected clients
    io.emit('inventory:updated', { action: 'delete', itemId });
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bills Routes
app.get('/api/bills', async (req, res) => {
  try {
    const bills = await query('SELECT * FROM bills ORDER BY id DESC');
    // Parse JSON fields
    const parsedBills = bills.map(bill => ({
      ...bill,
      items: JSON.parse(bill.items || '[]'),
      gstBreakdown: JSON.parse(bill.gstBreakdown || '{}'),
      paymentTracking: JSON.parse(bill.paymentTracking || '{}'),
      customer: {
        name: bill.customerName,
        phone: bill.customerPhone,
        gst: bill.customerGst,
        address: bill.customerAddress,
        state: bill.customerState
      }
    }));
    res.json(parsedBills);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/bills', async (req, res) => {
  try {
    const { customer, items, subtotal, gstBreakdown, totalGST, total, paymentStatus, paymentTracking } = req.body;
    
    // Ensure all values are defined (use null instead of undefined)
    const customerName = customer?.name || null;
    const customerPhone = customer?.phone || null;
    const customerGst = customer?.gst || null;
    const customerAddress = customer?.address || null;
    const customerState = customer?.state || null;
    
    const result = await query(
      `INSERT INTO bills (customerName, customerPhone, customerGst, customerAddress, customerState, 
       items, subtotal, gstBreakdown, totalGST, total, paymentStatus, paymentTracking) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customerName,
        customerPhone,
        customerGst,
        customerAddress,
        customerState,
        JSON.stringify(items),
        subtotal || 0,
        JSON.stringify(gstBreakdown || {}),
        totalGST || 0,
        total || 0,
        paymentStatus || 'pending',
        JSON.stringify(paymentTracking || {})
      ]
    );
    
    const bill = {
      id: result.insertId,
      customer, items, subtotal, gstBreakdown, totalGST, total, paymentStatus, paymentTracking,
      createdAt: new Date()
    };
    
    // Emit real-time update to all connected clients (for owner to see sales)
    io.emit('bill:created', { bill });
    
    // Also emit inventory update since stock changed
    const updatedInventory = await query('SELECT * FROM inventory ORDER BY id ASC');
    io.emit('inventory:refresh', { inventory: updatedInventory });
    
    res.json(bill);
  } catch (error) {
    console.error('❌ Error adding bill:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/bills/:id', async (req, res) => {
  try {
    const { customer, items, subtotal, gstBreakdown, totalGST, total, paymentStatus, paymentTracking } = req.body;
    const id = parseInt(req.params.id);
    
    await query(
      `UPDATE bills SET customerName=?, customerPhone=?, customerGst=?, customerAddress=?, customerState=?,
       items=?, subtotal=?, gstBreakdown=?, totalGST=?, total=?, paymentStatus=?, paymentTracking=? WHERE id=?`,
      [
        customer.name, customer.phone, customer.gst, customer.address, customer.state,
        JSON.stringify(items), subtotal, JSON.stringify(gstBreakdown), totalGST, total,
        paymentStatus, JSON.stringify(paymentTracking || {}), id
      ]
    );
    
    const [bill] = await query('SELECT * FROM bills WHERE id=?', [id]);
    res.json(bill);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/bills/:id', async (req, res) => {
  try {
    await query('DELETE FROM bills WHERE id=?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Purchases Routes
app.get('/api/purchases', async (req, res) => {
  try {
    const purchases = await query('SELECT * FROM purchases ORDER BY id DESC');
    console.log(`📦 Fetched ${purchases.length} purchases from database`);
    
    const parsedPurchases = purchases.map((purchase, index) => {
      try {
        return {
          ...purchase,
          items: JSON.parse(purchase.items || '[]'),
          paymentTracking: JSON.parse(purchase.paymentTracking || '{}'),
          subtotal: parseFloat(purchase.subtotal) || 0,
          totalGST: parseFloat(purchase.totalGST) || 0,
          total: parseFloat(purchase.total) || 0,
          supplier: {
            name: purchase.supplierName,
            phone: purchase.supplierPhone,
            gst: purchase.supplierGst
          }
        };
      } catch (parseError) {
        console.error(`❌ Error parsing purchase #${purchase.id}:`, parseError.message);
        // Return purchase with safe defaults if parsing fails
        return {
          ...purchase,
          items: [],
          paymentTracking: {},
          subtotal: parseFloat(purchase.subtotal) || 0,
          totalGST: parseFloat(purchase.totalGST) || 0,
          total: parseFloat(purchase.total) || 0,
          supplier: {
            name: purchase.supplierName || 'Unknown',
            phone: purchase.supplierPhone || null,
            gst: purchase.supplierGst || null
          }
        };
      }
    });
    
    res.json(parsedPurchases);
  } catch (error) {
    console.error('❌ Error fetching purchases:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/purchases', async (req, res) => {
  try {
    const { supplier, invoiceNo, purchaseDate, items, subtotal, totalGST, total, paymentStatus, paymentTracking } = req.body;
    
    console.log('📦 Raw request body:', JSON.stringify(req.body, null, 2));
    
    // Validate required fields
    if (!supplier || !supplier.name || !invoiceNo || !purchaseDate || !items || items.length === 0) {
      const missingFields = [];
      if (!supplier || !supplier.name) missingFields.push('supplier.name');
      if (!invoiceNo) missingFields.push('invoiceNo');
      if (!purchaseDate) missingFields.push('purchaseDate');
      if (!items || items.length === 0) missingFields.push('items');
      
      console.error('❌ Missing fields:', missingFields);
      throw new Error('Missing required fields: ' + missingFields.join(', '));
    }
    
    // Ensure all values are defined (use null instead of undefined or empty string)
    const supplierName = supplier.name || null;
    const supplierPhone = (supplier.phone && supplier.phone.trim() !== '') ? supplier.phone.trim() : null;
    const supplierGst = (supplier.gst && supplier.gst.trim() !== '') ? supplier.gst.trim() : null;
    const paymentTrackingData = paymentTracking || {};
    
    // Prepare parameters array
    const params = [
      supplierName,
      supplierPhone,
      supplierGst,
      invoiceNo,
      purchaseDate,
      JSON.stringify(items),
      subtotal || 0,
      totalGST || 0,
      total || 0,
      paymentStatus || 'pending',
      JSON.stringify(paymentTrackingData)
    ];
    
    // Check for undefined values
    const undefinedIndexes = [];
    params.forEach((param, index) => {
      if (param === undefined) {
        undefinedIndexes.push(index);
      }
    });
    
    if (undefinedIndexes.length > 0) {
      const fieldNames = ['supplierName', 'supplierPhone', 'supplierGst', 'invoiceNo', 'purchaseDate', 'items', 'subtotal', 'totalGST', 'total', 'paymentStatus', 'paymentTracking'];
      console.error('❌ Undefined parameters at indexes:', undefinedIndexes);
      console.error('❌ Undefined fields:', undefinedIndexes.map(i => fieldNames[i]));
      throw new Error('Undefined parameters: ' + undefinedIndexes.map(i => fieldNames[i]).join(', '));
    }
    
    console.log('✅ All parameters valid:', params.map((p, i) => typeof p));
    
    const result = await query(
      `INSERT INTO purchases (supplierName, supplierPhone, supplierGst, invoiceNo, purchaseDate,
       items, subtotal, totalGST, total, paymentStatus, paymentTracking) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params
    );
    
    const purchase = {
      id: result.insertId,
      supplier, invoiceNo, purchaseDate, items, subtotal, totalGST, total, paymentStatus, paymentTracking,
      createdAt: new Date()
    };
    
    console.log('✅ Purchase added successfully:', purchase.id);
    res.json(purchase);
  } catch (error) {
    console.error('❌ Error adding purchase:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/purchases/:id', async (req, res) => {
  try {
    const { supplier, invoiceNo, purchaseDate, items, subtotal, totalGST, total, paymentStatus, paymentTracking } = req.body;
    const id = parseInt(req.params.id);
    
    // Ensure all values are defined (use null instead of undefined)
    const supplierName = supplier?.name || null;
    const supplierPhone = supplier?.phone || null;
    const supplierGst = supplier?.gst || null;
    const paymentTrackingData = paymentTracking || null;
    
    await query(
      `UPDATE purchases SET supplierName=?, supplierPhone=?, supplierGst=?, invoiceNo=?, purchaseDate=?,
       items=?, subtotal=?, totalGST=?, total=?, paymentStatus=?, paymentTracking=? WHERE id=?`,
      [
        supplierName,
        supplierPhone,
        supplierGst,
        invoiceNo,
        purchaseDate,
        JSON.stringify(items),
        subtotal || 0,
        totalGST || 0,
        total || 0,
        paymentStatus || 'pending',
        JSON.stringify(paymentTrackingData || {}),
        id
      ]
    );
    
    const [purchase] = await query('SELECT * FROM purchases WHERE id=?', [id]);
    res.json(purchase);
  } catch (error) {
    console.error('❌ Error updating purchase:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/purchases/:id', async (req, res) => {
  try {
    await query('DELETE FROM purchases WHERE id=?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Customers Routes
app.get('/api/customers', async (req, res) => {
  try {
    const customers = await query('SELECT * FROM customers ORDER BY id ASC');
    res.json(customers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/customers', async (req, res) => {
  try {
    const { name, phone, gst, address, state } = req.body;
    
    const result = await query(
      'INSERT INTO customers (name, phone, gst, address, state) VALUES (?, ?, ?, ?, ?)',
      [name, phone, gst, address, state]
    );
    
    const customer = {
      id: result.insertId,
      name, phone, gst, address, state,
      createdAt: new Date()
    };
    
    res.json(customer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/customers/:id', async (req, res) => {
  try {
    const { name, phone, gst, address, state, lastBillDate } = req.body;
    const id = parseInt(req.params.id);
    
    await query(
      'UPDATE customers SET name=?, phone=?, gst=?, address=?, state=?, lastBillDate=? WHERE id=?',
      [name, phone, gst, address, state, lastBillDate, id]
    );
    
    const [customer] = await query('SELECT * FROM customers WHERE id=?', [id]);
    res.json(customer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Suppliers Routes
app.get('/api/suppliers', async (req, res) => {
  try {
    const suppliers = await query('SELECT * FROM suppliers ORDER BY id ASC');
    res.json(suppliers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/suppliers', async (req, res) => {
  try {
    const { name, phone, gst } = req.body;
    
    const result = await query(
      'INSERT INTO suppliers (name, phone, gst) VALUES (?, ?, ?)',
      [name, phone, gst]
    );
    
    const supplier = {
      id: result.insertId,
      name, phone, gst,
      createdAt: new Date()
    };
    
    res.json(supplier);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/suppliers/:id', async (req, res) => {
  try {
    const { name, phone, gst } = req.body;
    const id = parseInt(req.params.id);
    
    await query(
      'UPDATE suppliers SET name=?, phone=?, gst=? WHERE id=?',
      [name, phone, gst, id]
    );
    
    const [supplier] = await query('SELECT * FROM suppliers WHERE id=?', [id]);
    res.json(supplier);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/suppliers/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await query('DELETE FROM suppliers WHERE id=?', [id]);
    res.json({ success: true, message: 'Supplier deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting supplier:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Initialize sample data
app.post('/api/initialize', async (req, res) => {
  try {
    const [rows] = await query('SELECT COUNT(*) as count FROM inventory');
    
    if (rows[0].count === 0) {
      const sampleInventory = [
        { name: 'Steel Rebar', description: 'TMT Steel Rebar', hsn: '72142000', size: '12mm', colour: 'Silver', unit: 'kg', quantity: 1000, minStock: 500, price: 65.00, gst: 18 },
        { name: 'Portland Cement', description: 'OPC 53 Grade Cement', hsn: '25232900', size: '50kg', colour: 'Grey', unit: 'bag', quantity: 500, minStock: 200, price: 350.00, gst: 28 },
        { name: 'Plywood', description: 'Commercial Plywood', hsn: '44121300', size: '18mm', colour: 'Brown', unit: 'pcs', quantity: 100, minStock: 50, price: 1800.00, gst: 18 },
        { name: 'Concrete Mix', description: 'Ready Mix Concrete', hsn: '38244090', size: 'M25', colour: 'Grey', unit: 'm3', quantity: 50, minStock: 20, price: 4500.00, gst: 18 },
        { name: 'Plastiwood Deck Board', description: 'Premium composite deck board', hsn: '39259000', size: '6ft', colour: 'Brown', unit: 'pcs', quantity: 150, minStock: 50, price: 2500.00, gst: 18 }
      ];
      
      for (const item of sampleInventory) {
        await query(
          `INSERT INTO inventory (name, description, hsn, size, colour, unit, quantity, minStock, price, gst) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [item.name, item.description, item.hsn, item.size, item.colour, item.unit, item.quantity, item.minStock, item.price, item.gst]
        );
      }
    }
    
    res.json({ success: true, message: 'Database initialized' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Serve main app
app.get('/app', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('� User coennected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('👤 User disconnected:', socket.id);
  });
  
  socket.on('user:register', (data) => {
    socket.userRole = data.role;
    socket.userName = data.name;
    console.log(`👤 ${data.name} (${data.role}) registered`);
  });
});

// Initialize database and start server
initializeDatabase().then(() => {
  server.listen(PORT, () => {
    console.log(`�a Plastiwood Inventory System running on http://localhost:${PORT}`);
    console.log(`📊 Database: MySQL`);
    console.log(`⚡ Real-time updates enabled via Socket.IO`);
  });
}).catch(error => {
  console.error('Failed to initialize database:', error);
  process.exit(1);
});
