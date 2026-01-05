// State management with MySQL Database via API
let inventory = [];
let bills = [];
let currentBillItems = [];
let customers = [];
let purchases = [];
let suppliers = [];

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    const currentUser = requireAuth();
    if (!currentUser) return;
    
    // Display user info
    document.getElementById('user-name').textContent = currentUser.name;
    
    // Apply role-based restrictions
    applyRoleRestrictions(currentUser.role);
    
    // Initialize database with sample data if needed
    try {
        await APIService.initializeDatabase();
    } catch (error) {
        console.error('Database initialization error:', error);
    }
    
    // Load all data from database
    await loadInventory();
    await loadBills();
    await loadCustomers();
    await loadPurchases();
    await loadSuppliers();
    setupNavigation();
    
    // Initialize sales view if bills exist
    if (bills.length > 0) {
        renderSales();
    }
    
    // Setup customer search
    setupCustomerSearch();
});

// Navigation
function setupNavigation() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.dataset.view;
            switchView(view);
            toggleMenu(); // Close menu after selection
        });
    });
}

function switchView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    document.getElementById(`${viewName}-view`).classList.add('active');
    document.querySelectorAll(`[data-view="${viewName}"]`).forEach(btn => btn.classList.add('active'));
    
    if (viewName === 'dashboard') {
        renderDashboard();
    } else if (viewName === 'sales') {
        renderSales();
    } else if (viewName === 'purchases') {
        renderPurchases();
    }
}

// Toggle hamburger menu
function toggleMenu() {
    console.log('=== toggleMenu called ===');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    
    console.log('Sidebar element:', sidebar);
    console.log('Overlay element:', overlay);
    
    if (!sidebar || !overlay) {
        console.error('Elements not found!', { sidebar, overlay });
        alert('Error: Sidebar elements not found! Please refresh the page.');
        return;
    }
    
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
    
    const isActive = sidebar.classList.contains('active');
    console.log('Sidebar is now:', isActive ? 'OPEN' : 'CLOSED');
    console.log('Sidebar classes:', sidebar.className);
    console.log('Sidebar computed left:', window.getComputedStyle(sidebar).left);
}

// Make toggleMenu available globally
window.toggleMenu = toggleMenu;

// Role-based access control
function applyRoleRestrictions(role) {
    if (role === 'staff') {
        // Hide add item button
        const addItemBtn = document.getElementById('add-item-btn');
        if (addItemBtn) addItemBtn.style.display = 'none';
        
        // Hide actions column header
        const actionsHeader = document.getElementById('actions-header');
        if (actionsHeader) actionsHeader.style.display = 'none';
        
        // Hide purchases tab for staff (sidebar)
        const purchasesNavSidebar = document.getElementById('purchases-nav-sidebar');
        if (purchasesNavSidebar) purchasesNavSidebar.style.display = 'none';
        
        // Hide dashboard tab for staff (sidebar)
        const dashboardNavSidebar = document.getElementById('dashboard-nav-sidebar');
        if (dashboardNavSidebar) dashboardNavSidebar.style.display = 'none';
    }
}

function checkOwnerPermission() {
    if (!isOwner()) {
        alert('Access Denied: Only the Owner can perform this action.');
        return false;
    }
    return true;
}

// Initialize sample data if first time
// Database initialization is now handled by the backend

// Inventory Management
async function loadInventory() {
    try {
        inventory = await APIService.getInventory();
        renderInventory();
        updateProductSelect();
    } catch (error) {
        console.error('Error loading inventory:', error);
        alert('Failed to load inventory. Please refresh the page.');
    }
}

function renderInventory() {
    const tbody = document.getElementById('inventory-tbody');
    tbody.innerHTML = '';
    const userRole = getCurrentUser()?.role;
    
    inventory.forEach((item) => {
        const row = document.createElement('tr');
        const stockStatus = item.quantity < 5 ? 'badge-danger' : item.quantity < 20 ? 'badge-warning' : 'badge-success';
        
        // Calculate taxed price (price + GST)
        const taxedPrice = item.price + (item.price * item.gst / 100);
        
        // Show actions only for owner
        const actionsHtml = userRole === 'owner' ? `
            <td>
                <button class="action-btn" onclick="showAddStockModal(${item.id})">+ Stock</button>
                <button class="action-btn" onclick="editItem(${item.id})">Edit</button>
                <button class="action-btn delete" onclick="deleteItem(${item.id})">Delete</button>
            </td>
        ` : '<td style="display: none;"></td>';
        
        row.innerHTML = `
            <td>${item.id}</td>
            <td><strong>${item.name}</strong></td>
            <td>${item.description || '-'}</td>
            <td>${item.hsn || '-'}</td>
            <td>${item.size}</td>
            <td>${item.unit}</td>
            <td>${item.colour || '-'}</td>
            <td><span class="badge ${stockStatus}">${item.quantity}</span></td>
            <td>₹${item.price.toFixed(2)}</td>
            <td>${item.gst}%</td>
            <td><strong>₹${taxedPrice.toFixed(2)}</strong></td>
            ${actionsHtml}
        `;
        tbody.appendChild(row);
    });
    
    // Check for low stock items and alert owner
    checkLowStock();
}

function filterInventory() {
    const search = document.getElementById('search-inventory').value.toLowerCase();
    const rows = document.querySelectorAll('#inventory-tbody tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(search) ? '' : 'none';
    });
}

function showAddItemModal() {
    if (!checkOwnerPermission()) return;
    document.getElementById('add-item-modal').classList.add('active');
}

function closeModal() {
    document.getElementById('add-item-modal').classList.remove('active');
    document.getElementById('add-item-form').reset();
}

// Stock Management
function showAddStockModal(itemId) {
    if (!checkOwnerPermission()) return;
    
    const item = inventory.find(i => i.id === itemId);
    if (!item) return;
    
    document.getElementById('stock-item-id').value = itemId;
    document.getElementById('stock-item-name').textContent = `${item.name} (${item.size} ${item.unit})`;
    document.getElementById('stock-item-current').textContent = item.quantity;
    document.getElementById('add-stock-modal').classList.add('active');
}

function closeStockModal() {
    document.getElementById('add-stock-modal').classList.remove('active');
    document.getElementById('add-stock-form').reset();
}

async function addStock(event) {
    event.preventDefault();
    
    const itemId = parseInt(document.getElementById('stock-item-id').value);
    const quantityToAdd = parseInt(document.getElementById('stock-quantity').value);
    
    const item = inventory.find(i => i.id === itemId);
    if (!item) return;
    
    try {
        // Update quantity
        item.quantity += quantityToAdd;
        
        // Save to database
        await APIService.updateInventoryItem(itemId, item);
        
        // Update local state
        await loadInventory();
        
        closeStockModal();
        alert(`Successfully added ${quantityToAdd} units to ${item.name}. New stock: ${item.quantity}`);
    } catch (error) {
        console.error('Error adding stock:', error);
        alert('Failed to add stock. Please try again.');
    }
}

function checkLowStock() {
    if (!isOwner()) return; // Only alert owner
    
    const lowStockItems = inventory.filter(item => item.quantity < 5 && item.quantity > 0);
    const outOfStockItems = inventory.filter(item => item.quantity === 0);
    
    if (lowStockItems.length > 0 || outOfStockItems.length > 0) {
        let message = '';
        
        if (outOfStockItems.length > 0) {
            message += '⚠️ OUT OF STOCK:\n';
            outOfStockItems.forEach(item => {
                message += `- ${item.name} (${item.size} ${item.unit})\n`;
            });
            message += '\n';
        }
        
        if (lowStockItems.length > 0) {
            message += '⚠️ LOW STOCK (Less than 5 units):\n';
            lowStockItems.forEach(item => {
                message += `- ${item.name}: ${item.quantity} ${item.unit} remaining\n`;
            });
        }
        
        // Show alert only once per session
        const alertKey = 'low_stock_alert_shown';
        const lastAlert = sessionStorage.getItem(alertKey);
        const currentItems = JSON.stringify([...lowStockItems.map(i => i.id), ...outOfStockItems.map(i => i.id)]);
        
        if (lastAlert !== currentItems) {
            setTimeout(() => {
                alert(message);
                sessionStorage.setItem(alertKey, currentItems);
            }, 500);
        }
    }
}

function closeModal() {
    document.getElementById('add-item-modal').classList.remove('active');
    document.getElementById('add-item-form').reset();
}

async function addInventoryItem(event) {
    event.preventDefault();
    
    if (!checkOwnerPermission()) {
        closeModal();
        return;
    }
    
    const item = {
        name: document.getElementById('product-name').value,
        description: document.getElementById('product-description').value,
        hsn: document.getElementById('product-hsn').value,
        size: document.getElementById('product-size').value,
        colour: document.getElementById('product-colour').value,
        unit: document.getElementById('product-unit').value,
        quantity: 0,
        minStock: 0,
        price: parseFloat(document.getElementById('product-price').value),
        gst: parseFloat(document.getElementById('product-gst').value)
    };
    
    try {
        await APIService.addInventoryItem(item);
        await loadInventory();
        closeModal();
        alert('Product added successfully!');
    } catch (error) {
        console.error('Error adding item:', error);
        alert('Failed to add product. Please try again.');
    }
}

async function deleteItem(id) {
    if (!checkOwnerPermission()) return;
    if (!confirm('Are you sure you want to delete this item?')) return;
    
    try {
        await APIService.deleteInventoryItem(id);
        await loadInventory();
        alert('Product deleted successfully!');
    } catch (error) {
        console.error('Error deleting item:', error);
        alert('Failed to delete product. Please try again.');
    }
}

function editItem(id) {
    if (!checkOwnerPermission()) return;
    
    const item = inventory.find(i => i.id === id);
    if (!item) return;
    
    document.getElementById('product-name').value = item.name;
    document.getElementById('product-description').value = item.description || '';
    document.getElementById('product-hsn').value = item.hsn || '';
    document.getElementById('product-size').value = item.size || '';
    document.getElementById('product-colour').value = item.colour || '';
    document.getElementById('product-unit').value = item.unit || '';
    document.getElementById('product-price').value = item.price;
    document.getElementById('product-gst').value = item.gst || 18;
    
    showAddItemModal();
}

// Billing
function updateProductSelect() {
    const select = document.getElementById('product-select');
    select.innerHTML = '<option value="">Select Product</option>';
    
    inventory.forEach(item => {
        if (item.quantity > 0) {
            const option = document.createElement('option');
            const displayText = `${item.name} - ${item.size} ${item.unit}${item.colour ? ' (' + item.colour + ')' : ''} (Stock: ${item.quantity})`;
            option.value = item.id;
            option.textContent = displayText;
            select.appendChild(option);
        }
    });
}

// Auto-fill rate when product is selected
document.addEventListener('DOMContentLoaded', () => {
    const productSelect = document.getElementById('product-select');
    if (productSelect) {
        productSelect.addEventListener('change', function() {
            const productId = parseInt(this.value);
            if (productId) {
                const product = inventory.find(p => p.id === productId);
                if (product) {
                    document.getElementById('item-rate').value = product.price.toFixed(2);
                }
            } else {
                document.getElementById('item-rate').value = '';
            }
        });
    }
});

function addBillItem() {
    const productId = parseInt(document.getElementById('product-select').value);
    const quantity = parseInt(document.getElementById('item-quantity').value);
    const customRate = parseFloat(document.getElementById('item-rate').value);
    
    if (!productId || !quantity || !customRate) {
        alert('Please select a product, enter quantity, and enter rate');
        return;
    }
    
    const product = inventory.find(p => p.id === productId);
    if (!product) return;
    
    if (quantity > product.quantity) {
        alert(`Only ${product.quantity} units available in stock`);
        return;
    }
    
    const existingItem = currentBillItems.find(item => item.id === productId && item.price === customRate);
    if (existingItem) {
        existingItem.quantity += quantity;
    } else {
        currentBillItems.push({
            id: productId,
            name: product.name,
            size: product.size,
            unit: product.unit,
            price: customRate,
            gst: product.gst,
            quantity: quantity
        });
    }
    
    renderBillItems();
    document.getElementById('product-select').value = '';
    document.getElementById('item-quantity').value = '';
    document.getElementById('item-rate').value = '';
}

function renderBillItems() {
    const tbody = document.getElementById('bill-items-tbody');
    tbody.innerHTML = '';
    
    const customerState = document.getElementById('customer-state').value;
    let subtotal = 0;
    let totalGST = 0;
    
    currentBillItems.forEach((item, index) => {
        const amount = item.price * item.quantity;
        const gstAmount = (amount * item.gst) / 100;
        const itemTotal = amount + gstAmount;
        
        subtotal += amount;
        totalGST += gstAmount;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${item.name}</td>
            <td>${item.size} ${item.unit}</td>
            <td>${item.quantity}</td>
            <td>₹${item.price.toFixed(2)}</td>
            <td>₹${amount.toFixed(2)}</td>
            <td>${item.gst}%</td>
            <td>₹${gstAmount.toFixed(2)}</td>
            <td>₹${itemTotal.toFixed(2)}</td>
            <td>
                <button class="action-btn delete" onclick="removeBillItem(${index})">×</button>
            </td>
        `;
        tbody.appendChild(row);
    });
    
    const total = subtotal + totalGST;
    
    document.getElementById('subtotal').textContent = `₹${subtotal.toFixed(2)}`;
    document.getElementById('total').textContent = `₹${total.toFixed(2)}`;
    
    // Show/hide GST breakdown based on customer state
    if (customerState === 'same') {
        const sgst = totalGST / 2;
        const cgst = totalGST / 2;
        document.getElementById('sgst-row').style.display = 'flex';
        document.getElementById('cgst-row').style.display = 'flex';
        document.getElementById('igst-row').style.display = 'none';
        document.getElementById('sgst').textContent = `₹${sgst.toFixed(2)}`;
        document.getElementById('cgst').textContent = `₹${cgst.toFixed(2)}`;
    } else if (customerState === 'other') {
        document.getElementById('sgst-row').style.display = 'none';
        document.getElementById('cgst-row').style.display = 'none';
        document.getElementById('igst-row').style.display = 'flex';
        document.getElementById('igst').textContent = `₹${totalGST.toFixed(2)}`;
    } else {
        document.getElementById('sgst-row').style.display = 'none';
        document.getElementById('cgst-row').style.display = 'none';
        document.getElementById('igst-row').style.display = 'none';
    }
}

// Update bill items when customer state changes
document.addEventListener('DOMContentLoaded', () => {
    const stateSelect = document.getElementById('customer-state');
    if (stateSelect) {
        stateSelect.addEventListener('change', renderBillItems);
    }
});

function removeBillItem(index) {
    currentBillItems.splice(index, 1);
    renderBillItems();
}

async function generateBill() {
    const customerName = document.getElementById('customer-name').value;
    const customerPhone = document.getElementById('customer-phone').value;
    const customerGst = document.getElementById('customer-gst').value;
    const customerAddress = document.getElementById('customer-address').value;
    const customerState = document.getElementById('customer-state').value;
    const paymentStatus = document.getElementById('customer-payment-status').value;
    
    if (!customerName || !customerState || !paymentStatus || currentBillItems.length === 0) {
        alert('Please enter customer details, select state, payment status, and add items to the bill');
        return;
    }
    
    // Calculate totals
    let subtotal = 0;
    let totalGST = 0;
    
    const itemsWithGST = currentBillItems.map(item => {
        const amount = item.price * item.quantity;
        const gstAmount = (amount * item.gst) / 100;
        subtotal += amount;
        totalGST += gstAmount;
        
        return {
            ...item,
            amount,
            gstAmount,
            total: amount + gstAmount
        };
    });
    
    const total = subtotal + totalGST;
    
    // Determine GST breakdown
    let gstBreakdown = {};
    if (customerState === 'same') {
        gstBreakdown = {
            type: 'SGST+CGST',
            sgst: totalGST / 2,
            cgst: totalGST / 2
        };
    } else {
        gstBreakdown = {
            type: 'IGST',
            igst: totalGST
        };
    }
    
    // Save or update customer
    const customerData = {
        name: customerName,
        phone: customerPhone,
        gst: customerGst,
        address: customerAddress,
        state: customerState
    };
    await saveOrUpdateCustomer(customerData);
    
    const bill = {
        customer: customerData,
        items: itemsWithGST,
        subtotal,
        gstBreakdown,
        totalGST,
        total,
        paymentStatus: paymentStatus
    };
    
    try {
        // Update inventory quantities in database
        for (const billItem of currentBillItems) {
            const invItem = inventory.find(i => i.id === billItem.id);
            if (invItem) {
                invItem.quantity -= billItem.quantity;
                await APIService.updateInventoryItem(invItem.id, invItem);
            }
        }
        
        // Save bill to database
        const savedBill = await APIService.addBill(bill);
        
        // Reload data
        await loadInventory();
        await loadBills();
        
        // Generate PDF
        generateBillPDF(savedBill);
        
        // Check for low stock after sale
        const lowStockWarnings = [];
        currentBillItems.forEach(billItem => {
            const invItem = inventory.find(i => i.id === billItem.id);
            if (invItem && invItem.quantity < 5) {
                lowStockWarnings.push(`${invItem.name}: ${invItem.quantity} ${invItem.unit} remaining`);
            }
        });
        
        let alertMessage = `Bill #${savedBill.id} generated successfully!\nTotal Amount: ₹${total.toFixed(2)}\nPayment Status: ${paymentStatus.toUpperCase()}\n\nPDF invoice has been downloaded!`;
        
        if (lowStockWarnings.length > 0 && isOwner()) {
            alertMessage += '\n\n⚠️ LOW STOCK ALERT:\n' + lowStockWarnings.join('\n');
        }
        
        alert(alertMessage);
        
        // Reset form
        document.getElementById('customer-search').value = '';
        document.getElementById('customer-name').value = '';
        document.getElementById('customer-phone').value = '';
        document.getElementById('customer-gst').value = '';
        document.getElementById('customer-address').value = '';
        document.getElementById('customer-state').value = '';
        document.getElementById('customer-payment-status').value = '';
        currentBillItems = [];
        renderBillItems();
        
        // Switch to sales view to show the new bill
        switchView('sales');
    } catch (error) {
        console.error('Error generating bill:', error);
        alert('Failed to generate bill. Please try again.');
    }
}

// Bill IDs are now auto-generated by the database

// Customer Management
async function loadCustomers() {
    try {
        customers = await APIService.getCustomers();
        updateCustomerDatalist();
    } catch (error) {
        console.error('Error loading customers:', error);
    }
}

async function saveOrUpdateCustomer(customerData) {
    try {
        // Check if customer exists by phone or name
        let existingCustomer = customers.find(c => 
            (customerData.phone && c.phone === customerData.phone) ||
            (customerData.name && c.name.toLowerCase() === customerData.name.toLowerCase())
        );
        
        if (existingCustomer) {
            // Update existing customer
            await APIService.updateCustomer(existingCustomer.id, {
                ...customerData,
                lastBillDate: new Date().toISOString()
            });
        } else {
            // Add new customer
            await APIService.addCustomer({
                ...customerData,
                createdAt: new Date().toISOString(),
                lastBillDate: new Date().toISOString()
            });
        }
        
        await loadCustomers();
    } catch (error) {
        console.error('Error saving customer:', error);
    }
}

function updateCustomerDatalist() {
    const datalist = document.getElementById('customer-list');
    if (!datalist) return;
    
    datalist.innerHTML = '';
    customers.forEach(customer => {
        const option = document.createElement('option');
        option.value = `${customer.name} - ${customer.phone || 'No Phone'}`;
        option.dataset.customerId = customer.id;
        datalist.appendChild(option);
    });
}

function setupCustomerSearch() {
    const searchInput = document.getElementById('customer-search');
    if (!searchInput) return;
    
    searchInput.addEventListener('input', function() {
        const searchValue = this.value.toLowerCase();
        
        // Find customer by name or phone
        const customer = customers.find(c => 
            c.name.toLowerCase().includes(searchValue) || 
            (c.phone && c.phone.includes(searchValue))
        );
        
        if (customer) {
            fillCustomerDetails(customer);
        }
    });
    
    searchInput.addEventListener('change', function() {
        const searchValue = this.value;
        const customer = customers.find(c => 
            searchValue.includes(c.name) || 
            (c.phone && searchValue.includes(c.phone))
        );
        
        if (customer) {
            fillCustomerDetails(customer);
        }
    });
}

function fillCustomerDetails(customer) {
    document.getElementById('customer-name').value = customer.name;
    document.getElementById('customer-phone').value = customer.phone || '';
    document.getElementById('customer-gst').value = customer.gst || '';
    document.getElementById('customer-address').value = customer.address || '';
    document.getElementById('customer-state').value = customer.state || '';
}

// This duplicate function is removed - using the async version above

// Purchase Management
async function loadPurchases() {
    try {
        purchases = await APIService.getPurchases();
    } catch (error) {
        console.error('Error loading purchases:', error);
    }
}

async function loadSuppliers() {
    try {
        suppliers = await APIService.getSuppliers();
        updateSupplierDatalist();
    } catch (error) {
        console.error('Error loading suppliers:', error);
    }
}

async function saveOrUpdateSupplier(supplierData) {
    try {
        let existingSupplier = suppliers.find(s =>
            (supplierData.phone && s.phone === supplierData.phone) ||
            (supplierData.name && s.name.toLowerCase() === supplierData.name.toLowerCase())
        );
        
        if (existingSupplier) {
            await APIService.updateSupplier(existingSupplier.id, supplierData);
        } else {
            await APIService.addSupplier({
                ...supplierData,
                createdAt: new Date().toISOString()
            });
        }
        
        await loadSuppliers();
    } catch (error) {
        console.error('Error saving supplier:', error);
    }
}

function updateSupplierDatalist() {
    const datalist = document.getElementById('supplier-list');
    if (!datalist) return;
    
    datalist.innerHTML = '';
    suppliers.forEach(supplier => {
        const option = document.createElement('option');
        option.value = `${supplier.name} - ${supplier.phone || 'No Phone'}`;
        datalist.appendChild(option);
    });
}

function showAddPurchaseModal() {
    updatePurchaseProductSelects();
    document.getElementById('purchase-date').valueAsDate = new Date();
    document.getElementById('add-purchase-modal').classList.add('active');
    
    // Setup supplier search with proper event listeners
    setTimeout(() => {
        const searchInput = document.getElementById('purchase-supplier-search');
        if (searchInput) {
            // Remove any existing listeners
            const newSearchInput = searchInput.cloneNode(true);
            searchInput.parentNode.replaceChild(newSearchInput, searchInput);
            
            // Add input event for real-time search
            newSearchInput.addEventListener('input', function() {
                const searchValue = this.value.toLowerCase().trim();
                if (searchValue.length < 2) return;
                
                const supplier = suppliers.find(s => 
                    s.name.toLowerCase().includes(searchValue) || 
                    (s.phone && s.phone.includes(searchValue))
                );
                
                if (supplier) {
                    fillSupplierDetails(supplier);
                }
            });
            
            // Add change event for datalist selection
            newSearchInput.addEventListener('change', function() {
                const searchValue = this.value;
                const supplier = suppliers.find(s => 
                    searchValue.includes(s.name) || 
                    (s.phone && searchValue.includes(s.phone))
                );
                
                if (supplier) {
                    fillSupplierDetails(supplier);
                }
            });
        }
    }, 100);
}

function fillSupplierDetails(supplier) {
    document.getElementById('purchase-supplier-name').value = supplier.name;
    document.getElementById('purchase-supplier-phone').value = supplier.phone || '';
    document.getElementById('purchase-supplier-gst').value = supplier.gst || '';
}

function closePurchaseModal() {
    document.getElementById('add-purchase-modal').classList.remove('active');
    document.getElementById('add-purchase-form').reset();
    // Reset to single item row
    document.getElementById('purchase-items-container').innerHTML = `
        <div class="purchase-item-row">
            <select class="purchase-product" required>
                <option value="">Select Product</option>
            </select>
            <input type="number" class="purchase-qty" placeholder="Quantity" min="1" required>
            <input type="number" class="purchase-rate" placeholder="Rate (₹)" step="0.01" min="0" required>
            <button type="button" class="btn btn-primary" onclick="addPurchaseItemRow()">+</button>
        </div>
    `;
    updatePurchaseProductSelects();
}

function updatePurchaseProductSelects() {
    const selects = document.querySelectorAll('.purchase-product');
    selects.forEach(select => {
        select.innerHTML = '<option value="">Select Product</option>';
        inventory.forEach(item => {
            const option = document.createElement('option');
            option.value = item.id;
            option.textContent = `${item.name} - ${item.size} ${item.unit}`;
            select.appendChild(option);
        });
    });
}

function addPurchaseItemRow() {
    const container = document.getElementById('purchase-items-container');
    const newRow = document.createElement('div');
    newRow.className = 'purchase-item-row';
    newRow.innerHTML = `
        <select class="purchase-product" required>
            <option value="">Select Product</option>
        </select>
        <input type="number" class="purchase-qty" placeholder="Quantity" min="1" required>
        <input type="number" class="purchase-rate" placeholder="Rate (₹)" step="0.01" min="0" required>
        <button type="button" class="btn btn-secondary" onclick="removePurchaseItemRow(this)">−</button>
    `;
    container.appendChild(newRow);
    updatePurchaseProductSelects();
}

function removePurchaseItemRow(button) {
    button.parentElement.remove();
}

async function addPurchase(event) {
    event.preventDefault();
    
    const supplierName = document.getElementById('purchase-supplier-name').value;
    const supplierPhone = document.getElementById('purchase-supplier-phone').value;
    const supplierGst = document.getElementById('purchase-supplier-gst').value;
    const invoiceNo = document.getElementById('purchase-invoice').value;
    const purchaseDate = document.getElementById('purchase-date').value;
    const paymentStatus = document.getElementById('purchase-payment-status').value;
    
    // Collect purchase items
    const itemRows = document.querySelectorAll('.purchase-item-row');
    const items = [];
    let subtotal = 0;
    let totalGST = 0;
    const stockUpdates = []; // Track stock updates
    
    itemRows.forEach(row => {
        const productId = parseInt(row.querySelector('.purchase-product').value);
        const quantity = parseInt(row.querySelector('.purchase-qty').value);
        const rate = parseFloat(row.querySelector('.purchase-rate').value);
        
        if (productId && quantity && rate) {
            const product = inventory.find(p => p.id === productId);
            if (product) {
                const amount = quantity * rate;
                const gstAmount = (amount * product.gst) / 100;
                
                items.push({
                    id: productId,
                    name: product.name,
                    size: product.size,
                    unit: product.unit,
                    quantity: quantity,
                    rate: rate,
                    amount: amount,
                    gst: product.gst,
                    gstAmount: gstAmount,
                    total: amount + gstAmount
                });
                
                subtotal += amount;
                totalGST += gstAmount;
                
                // Update inventory stock
                const oldQuantity = product.quantity;
                product.quantity += quantity;
                const newQuantity = product.quantity;
                
                // Track stock update for notification
                stockUpdates.push({
                    name: product.name,
                    added: quantity,
                    oldStock: oldQuantity,
                    newStock: newQuantity,
                    unit: product.unit
                });
            }
        }
    });
    
    if (items.length === 0) {
        alert('Please add at least one item');
        return;
    }
    
    const total = subtotal + totalGST;
    
    // Save or update supplier
    await saveOrUpdateSupplier({
        name: supplierName,
        phone: supplierPhone,
        gst: supplierGst
    });
    
    try {
        // Create purchase via API (ID will be auto-generated by database)
        const purchaseData = {
            supplier: {
                name: supplierName,
                phone: supplierPhone,
                gst: supplierGst
            },
            invoiceNo: invoiceNo,
            purchaseDate: purchaseDate,
            items: items,
            subtotal: subtotal,
            totalGST: totalGST,
            total: total,
            paymentStatus: paymentStatus
        };
        
        const newPurchase = await APIService.addPurchase(purchaseData);
        
        // Update inventory for each item
        for (const item of items) {
            const product = inventory.find(p => p.id === item.id);
            if (product) {
                product.quantity += item.quantity;
                await APIService.updateInventoryItem(product.id, { quantity: product.quantity });
            }
        }
        
        // Reload purchases and inventory
        await loadPurchases();
        await loadInventory();
        
        // Build stock update message
        let stockMessage = '';
        if (stockUpdates.length > 0) {
            stockMessage = '\n\n📦 STOCK UPDATED:\n';
            stockUpdates.forEach(update => {
                stockMessage += `\n✅ ${update.name}:\n   Added: ${update.added} ${update.unit}\n   Stock: ${update.oldStock} → ${update.newStock} ${update.unit}`;
            });
        }
        
        alert(`Purchase #${newPurchase.id} added successfully!\nTotal: ₹${total.toFixed(2)}${stockMessage}`);
        
        closePurchaseModal();
        renderPurchases();
        renderInventory();
        updateProductSelect();
    } catch (error) {
        console.error('Error adding purchase:', error);
        alert('Failed to add purchase. Please try again.');
    }
}

// This duplicate function is removed - using the async version above

function renderPurchases() {
    const tbody = document.getElementById('purchases-tbody');
    tbody.innerHTML = '';
    
    if (purchases.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 2rem; color: var(--text-secondary);">📦 No purchase records found. Click "Add Purchase" to get started!</td></tr>';
        return;
    }
    
    purchases.slice().reverse().forEach(purchase => {
        const row = document.createElement('tr');
        const date = new Date(purchase.purchaseDate).toLocaleDateString('en-IN');
        const itemCount = purchase.items.length;
        
        let statusBadge = '';
        if (purchase.paymentStatus === 'paid') {
            statusBadge = '<span class="badge badge-success">✅ Paid</span>';
        } else if (purchase.paymentStatus === 'pending') {
            statusBadge = '<span class="badge badge-danger">⏳ Pending</span>';
        } else {
            statusBadge = '<span class="badge badge-warning">💰 Partial</span>';
        }
        
        row.innerHTML = `
            <td><strong>#${purchase.id}</strong></td>
            <td>${date}</td>
            <td>${purchase.supplier.name}</td>
            <td>${purchase.invoiceNo}</td>
            <td>${itemCount} item${itemCount > 1 ? 's' : ''}</td>
            <td>₹${purchase.subtotal.toFixed(2)}</td>
            <td>₹${purchase.totalGST.toFixed(2)}</td>
            <td><strong>₹${purchase.total.toFixed(2)}</strong></td>
            <td>${statusBadge}</td>
            <td>
                <button class="action-btn" onclick="viewPurchaseDetails(${purchase.id})">View</button>
                <button class="action-btn delete" onclick="deletePurchase(${purchase.id})">Delete</button>
            </td>
        `;
        tbody.appendChild(row);
    });
    
    updatePurchasesSummary();
}

function filterPurchases() {
    const search = document.getElementById('search-purchases').value.toLowerCase().trim();
    const rows = document.querySelectorAll('#purchases-tbody tr');
    
    if (!search) {
        // Show all rows if search is empty
        rows.forEach(row => {
            row.style.display = '';
        });
        return;
    }
    
    let visibleCount = 0;
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        const isVisible = text.includes(search);
        row.style.display = isVisible ? '' : 'none';
        if (isVisible) visibleCount++;
    });
    
    // Show message if no results
    if (visibleCount === 0 && rows.length > 0) {
        const tbody = document.getElementById('purchases-tbody');
        const messageRow = document.createElement('tr');
        messageRow.id = 'no-results-message';
        messageRow.innerHTML = '<td colspan="10" style="text-align: center; padding: 2rem; color: var(--text-secondary);">🔍 No purchases found matching "' + search + '"</td>';
        tbody.appendChild(messageRow);
    } else {
        // Remove no results message if it exists
        const messageRow = document.getElementById('no-results-message');
        if (messageRow) messageRow.remove();
    }
}

function updatePurchasesSummary() {
    const totalPurchases = purchases.reduce((sum, p) => sum + p.total, 0);
    const totalCount = purchases.length;
    
    // Calculate actual pending amount using payment tracking
    let pendingPayments = 0;
    purchases.forEach(purchase => {
        if (purchase.paymentStatus === 'pending') {
            pendingPayments += purchase.total;
        } else if (purchase.paymentStatus === 'partial' && purchase.paymentTracking) {
            pendingPayments += purchase.paymentTracking.amountPending;
        }
    });
    
    const suppliersCount = suppliers.length;
    
    document.getElementById('purchases-total').textContent = `₹${totalPurchases.toFixed(2)}`;
    document.getElementById('purchases-count').textContent = totalCount;
    document.getElementById('purchases-pending').textContent = `₹${pendingPayments.toFixed(2)}`;
    document.getElementById('suppliers-count').textContent = suppliersCount;
}

function viewPurchaseDetails(purchaseId) {
    const purchase = purchases.find(p => p.id === purchaseId);
    if (!purchase) return;
    
    const date = new Date(purchase.purchaseDate).toLocaleDateString('en-IN');
    const time = new Date(purchase.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    
    let paymentStatusBadge = '';
    if (purchase.paymentStatus === 'paid') {
        paymentStatusBadge = '<span class="badge badge-success">✅ Paid</span>';
    } else if (purchase.paymentStatus === 'pending') {
        paymentStatusBadge = '<span class="badge badge-danger">⏳ Pending</span>';
    } else {
        paymentStatusBadge = '<span class="badge badge-warning">💰 Partial</span>';
    }
    
    // Generate items table HTML
    let itemsHtml = purchase.items.map((item, idx) => `
        <tr>
            <td>${idx + 1}</td>
            <td>${item.name}</td>
            <td>${item.size} ${item.unit}</td>
            <td>${item.quantity}</td>
            <td>₹${item.rate.toFixed(2)}</td>
            <td>₹${item.amount.toFixed(2)}</td>
            <td>${item.gst}%</td>
            <td>₹${item.gstAmount.toFixed(2)}</td>
            <td>₹${item.total.toFixed(2)}</td>
        </tr>
    `).join('');
    
    const content = `
        <div class="purchase-details-card">
            <!-- Purchase Info Section -->
            <div class="supplier-info-section">
                <h3>📋 Purchase Information</h3>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">Purchase #:</span>
                        <span class="info-value">#${purchase.id}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Invoice No:</span>
                        <span class="info-value">${purchase.invoiceNo}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Purchase Date:</span>
                        <span class="info-value">${date}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Created At:</span>
                        <span class="info-value">${new Date(purchase.createdAt).toLocaleDateString('en-IN')} ${time}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Payment Status:</span>
                        <span class="info-value">${paymentStatusBadge}</span>
                    </div>
                </div>
            </div>
            
            <!-- Supplier Info Section -->
            <div class="supplier-info-section">
                <h3>🏢 Supplier Information</h3>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">Name:</span>
                        <span class="info-value">${purchase.supplier.name}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Phone:</span>
                        <span class="info-value">${purchase.supplier.phone || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">GST Number:</span>
                        <span class="info-value">${purchase.supplier.gst || 'N/A'}</span>
                    </div>
                </div>
            </div>
            
            <!-- Items Section -->
            <div class="purchase-history-section">
                <h3>🛒 Purchased Items</h3>
                <div class="table-container">
                    <table class="bill-details-table">
                        <thead>
                            <tr>
                                <th>S.No</th>
                                <th>Item Name</th>
                                <th>Size</th>
                                <th>Qty</th>
                                <th>Rate (₹)</th>
                                <th>Amount (₹)</th>
                                <th>GST %</th>
                                <th>GST (₹)</th>
                                <th>Total (₹)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsHtml}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <!-- Summary Section -->
            <div class="bill-summary-box">
                <div class="summary-row">
                    <span>Subtotal (Before Tax):</span>
                    <span>₹${purchase.subtotal.toFixed(2)}</span>
                </div>
                <div class="summary-row">
                    <span>Total GST:</span>
                    <span>₹${purchase.totalGST.toFixed(2)}</span>
                </div>
                <div class="summary-row total">
                    <span>Total Amount:</span>
                    <span>₹${purchase.total.toFixed(2)}</span>
                </div>
            </div>
            
            <!-- Update Payment Button -->
            <div style="margin-top: 1.5rem; text-align: center;">
                <button class="btn btn-primary" onclick="updatePurchasePaymentStatus(${purchase.id})">
                    💳 Update Payment Status
                </button>
            </div>
        </div>
    `;
    
    document.getElementById('purchase-details-content').innerHTML = content;
    document.getElementById('purchase-details-modal').classList.add('active');
}

function closePurchaseDetailsModal() {
    document.getElementById('purchase-details-modal').classList.remove('active');
}

// Update Purchase Payment Status
function updatePurchasePaymentStatus(purchaseId) {
    const purchase = purchases.find(p => p.id === purchaseId);
    if (!purchase) return;
    
    const currentStatus = purchase.paymentStatus || 'paid';
    const statusLabels = {
        'paid': '✅ Paid',
        'pending': '⏳ Pending',
        'partial': '💰 Partial'
    };
    
    // Store the purchase ID for later use
    window.currentPurchaseIdForUpdate = purchaseId;
    
    // Populate modal
    document.getElementById('update-purchase-id').textContent = purchaseId;
    document.getElementById('update-purchase-current-status').innerHTML = `<span class="badge badge-${currentStatus === 'paid' ? 'success' : currentStatus === 'pending' ? 'danger' : 'warning'}">${statusLabels[currentStatus]}</span>`;
    
    // Close purchase details modal and show payment update modal
    closePurchaseDetailsModal();
    document.getElementById('update-purchase-payment-modal').classList.add('active');
}

function closeUpdatePurchasePaymentModal() {
    document.getElementById('update-purchase-payment-modal').classList.remove('active');
    window.currentPurchaseIdForUpdate = null;
    
    // Reset form
    document.getElementById('partial-purchase-payment-input').style.display = 'none';
    document.querySelectorAll('#update-purchase-payment-modal .payment-status-options')[0].style.display = 'flex';
    document.getElementById('partial-purchase-amount-input').value = '';
}

async function selectPurchasePaymentStatus(newStatus) {
    const purchaseId = window.currentPurchaseIdForUpdate;
    if (!purchaseId) return;
    
    const purchase = purchases.find(p => p.id === purchaseId);
    if (!purchase) return;
    
    // If partial payment, show input form
    if (newStatus === 'partial') {
        // Hide payment options
        document.querySelectorAll('#update-purchase-payment-modal .payment-status-options')[0].style.display = 'none';
        
        // Show partial payment input
        const partialInput = document.getElementById('partial-purchase-payment-input');
        partialInput.style.display = 'block';
        
        // Initialize payment tracking if not exists
        if (!purchase.paymentTracking) {
            purchase.paymentTracking = {
                totalAmount: purchase.total,
                amountPaid: 0,
                amountPending: purchase.total,
                payments: []
            };
        }
        
        // Display amounts
        document.getElementById('purchase-total-amount').textContent = `₹${purchase.paymentTracking.totalAmount.toFixed(2)}`;
        document.getElementById('purchase-already-paid').textContent = `₹${purchase.paymentTracking.amountPaid.toFixed(2)}`;
        document.getElementById('purchase-remaining-pending').textContent = `₹${purchase.paymentTracking.amountPending.toFixed(2)}`;
        document.getElementById('partial-purchase-amount-input').value = '';
        document.getElementById('partial-purchase-amount-input').max = purchase.paymentTracking.amountPending;
        
        return;
    }
    
    const statusLabels = {
        'paid': '✅ Paid',
        'pending': '⏳ Pending'
    };
    
    // For paid status, mark as fully paid
    if (newStatus === 'paid') {
        if (!purchase.paymentTracking) {
            purchase.paymentTracking = {
                totalAmount: purchase.total,
                amountPaid: purchase.total,
                amountPending: 0,
                payments: [{
                    amount: purchase.total,
                    date: new Date().toISOString(),
                    note: 'Marked as paid'
                }]
            };
        } else {
            purchase.paymentTracking.amountPaid = purchase.paymentTracking.totalAmount;
            purchase.paymentTracking.amountPending = 0;
        }
    }
    
    // For pending status, reset payments
    if (newStatus === 'pending') {
        purchase.paymentTracking = {
            totalAmount: purchase.total,
            amountPaid: 0,
            amountPending: purchase.total,
            payments: []
        };
    }
    
    purchase.paymentStatus = newStatus;
    
    try {
        await APIService.updatePurchase(purchase.id, { 
            paymentStatus: newStatus,
            paymentTracking: purchase.paymentTracking 
        });
        renderPurchases();
        closeUpdatePurchasePaymentModal();
        alert(`Purchase payment status updated to: ${statusLabels[newStatus]}`);
    } catch (error) {
        console.error('Error updating purchase payment status:', error);
        alert('Failed to update payment status. Please try again.');
    }
}

function calculatePurchasePending() {
    const purchaseId = window.currentPurchaseIdForUpdate;
    if (!purchaseId) return;
    
    const purchase = purchases.find(p => p.id === purchaseId);
    if (!purchase) return;
    
    const amountPaid = parseFloat(document.getElementById('partial-purchase-amount-input').value) || 0;
    const newPending = purchase.paymentTracking.amountPending - amountPaid;
    
    document.getElementById('purchase-remaining-pending').textContent = `₹${Math.max(0, newPending).toFixed(2)}`;
}

async function confirmPartialPurchasePayment() {
    const purchaseId = window.currentPurchaseIdForUpdate;
    if (!purchaseId) return;
    
    const purchase = purchases.find(p => p.id === purchaseId);
    if (!purchase) return;
    
    const amountPaid = parseFloat(document.getElementById('partial-purchase-amount-input').value);
    
    if (!amountPaid || amountPaid <= 0) {
        alert('Please enter a valid amount paid');
        return;
    }
    
    if (amountPaid > purchase.paymentTracking.amountPending) {
        alert('Amount paid cannot be more than pending amount');
        return;
    }
    
    // Update payment tracking
    purchase.paymentTracking.amountPaid += amountPaid;
    purchase.paymentTracking.amountPending -= amountPaid;
    purchase.paymentTracking.payments.push({
        amount: amountPaid,
        date: new Date().toISOString(),
        note: 'Partial payment made'
    });
    
    // Check if fully paid now
    if (purchase.paymentTracking.amountPending <= 0.01) {
        purchase.paymentStatus = 'paid';
        alert(`Payment completed! Total paid: ₹${purchase.paymentTracking.amountPaid.toFixed(2)}`);
    } else {
        purchase.paymentStatus = 'partial';
        alert(`Partial payment recorded!\nPaid: ₹${amountPaid.toFixed(2)}\nRemaining: ₹${purchase.paymentTracking.amountPending.toFixed(2)}`);
    }
    
    try {
        await APIService.updatePurchase(purchase.id, { 
            paymentStatus: purchase.paymentStatus,
            paymentTracking: purchase.paymentTracking 
        });
        renderPurchases();
        closeUpdatePurchasePaymentModal();
    } catch (error) {
        console.error('Error updating purchase payment:', error);
        alert('Failed to update payment. Please try again.');
    }
}

function cancelPartialPurchasePayment() {
    // Hide partial input and show payment options again
    document.getElementById('partial-purchase-payment-input').style.display = 'none';
    document.querySelectorAll('#update-purchase-payment-modal .payment-status-options')[0].style.display = 'flex';
    document.getElementById('partial-purchase-amount-input').value = '';
}

async function deletePurchase(purchaseId) {
    if (!confirm('Are you sure you want to delete this purchase record?')) return;
    
    try {
        await APIService.deletePurchase(purchaseId);
        purchases = purchases.filter(p => p.id !== purchaseId);
        renderPurchases();
    } catch (error) {
        console.error('Error deleting purchase:', error);
        alert('Failed to delete purchase. Please try again.');
    }
}

// Supplier Reports
function showSupplierReports() {
    document.getElementById('supplier-reports-modal').classList.add('active');
    renderSupplierReports();
}

function closeSupplierReportsModal() {
    document.getElementById('supplier-reports-modal').classList.remove('active');
}

function filterSupplierReports() {
    const search = document.getElementById('search-supplier-reports').value.toLowerCase();
    const rows = document.querySelectorAll('#supplier-reports-tbody tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(search) ? '' : 'none';
    });
}

function renderSupplierReports() {
    const tbody = document.getElementById('supplier-reports-tbody');
    tbody.innerHTML = '';
    
    if (suppliers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-secondary);">📊 No supplier data available</td></tr>';
        return;
    }
    
    // Calculate data for each supplier
    const supplierData = suppliers.map(supplier => {
        const supplierPurchases = purchases.filter(p => 
            p.supplier.name.toLowerCase() === supplier.name.toLowerCase() ||
            (p.supplier.phone && supplier.phone && p.supplier.phone === supplier.phone)
        );
        
        const totalPurchases = supplierPurchases.length;
        const totalAmount = supplierPurchases.reduce((sum, p) => sum + p.total, 0);
        const paidAmount = supplierPurchases
            .filter(p => p.paymentStatus === 'paid')
            .reduce((sum, p) => sum + p.total, 0);
        const pendingAmount = supplierPurchases
            .filter(p => p.paymentStatus === 'pending')
            .reduce((sum, p) => sum + p.total, 0);
        const partialAmount = supplierPurchases
            .filter(p => p.paymentStatus === 'partial')
            .reduce((sum, p) => sum + p.total, 0);
        
        const lastPurchase = supplierPurchases.length > 0 
            ? new Date(Math.max(...supplierPurchases.map(p => new Date(p.createdAt)))).toLocaleDateString('en-IN')
            : 'N/A';
        
        return {
            supplier,
            totalPurchases,
            totalAmount,
            paidAmount,
            pendingAmount,
            partialAmount,
            lastPurchase,
            outstandingAmount: pendingAmount + partialAmount
        };
    });
    
    // Sort by total amount (highest first)
    supplierData.sort((a, b) => b.totalAmount - a.totalAmount);
    
    supplierData.forEach(data => {
        const row = document.createElement('tr');
        
        let paymentStatus = '';
        if (data.outstandingAmount === 0) {
            paymentStatus = '<span class="badge badge-success">✅ Clear</span>';
        } else if (data.pendingAmount > 0) {
            paymentStatus = '<span class="badge badge-danger">⏳ Pending</span>';
        } else {
            paymentStatus = '<span class="badge badge-warning">💰 Partial</span>';
        }
        
        row.innerHTML = `
            <td onclick="viewSupplierDetails('${data.supplier.name.replace(/'/g, "\\'")}')"><strong>${data.supplier.name}</strong></td>
            <td>${data.supplier.phone || '-'}</td>
            <td>${data.supplier.gst || '-'}</td>
            <td>${data.totalPurchases}</td>
            <td>₹${data.totalAmount.toFixed(2)}</td>
            <td>₹${data.paidAmount.toFixed(2)}</td>
            <td>₹${data.outstandingAmount.toFixed(2)}</td>
            <td>${paymentStatus}</td>
            <td>${data.lastPurchase}</td>
            <td>
                <button class="action-btn" onclick="viewSupplierDetails('${data.supplier.name.replace(/'/g, "\\'")}')">View Details</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function viewSupplierDetails(supplierName) {
    const supplier = suppliers.find(s => s.name === supplierName);
    if (!supplier) return;
    
    const supplierPurchases = purchases.filter(p => 
        p.supplier.name.toLowerCase() === supplier.name.toLowerCase() ||
        (p.supplier.phone && supplier.phone && p.supplier.phone === supplier.phone)
    );
    
    const totalPurchases = supplierPurchases.length;
    const totalAmount = supplierPurchases.reduce((sum, p) => sum + p.total, 0);
    const paidAmount = supplierPurchases.filter(p => p.paymentStatus === 'paid').reduce((sum, p) => sum + p.total, 0);
    const pendingAmount = supplierPurchases.filter(p => p.paymentStatus === 'pending').reduce((sum, p) => sum + p.total, 0);
    const partialAmount = supplierPurchases.filter(p => p.paymentStatus === 'partial').reduce((sum, p) => sum + p.total, 0);
    const outstandingAmount = pendingAmount + partialAmount;
    
    // Generate purchase history HTML
    let purchasesHtml = '';
    if (supplierPurchases.length > 0) {
        purchasesHtml = supplierPurchases.map(p => {
            const date = new Date(p.purchaseDate).toLocaleDateString('en-IN');
            let statusBadge = '';
            if (p.paymentStatus === 'paid') {
                statusBadge = '<span class="badge badge-success">✅ Paid</span>';
            } else if (p.paymentStatus === 'pending') {
                statusBadge = '<span class="badge badge-danger">⏳ Pending</span>';
            } else {
                statusBadge = '<span class="badge badge-warning">💰 Partial</span>';
            }
            
            return `
                <tr>
                    <td><strong>#${p.id}</strong></td>
                    <td>${date}</td>
                    <td>${p.invoiceNo}</td>
                    <td>${p.items.length} items</td>
                    <td>₹${p.total.toFixed(2)}</td>
                    <td>${statusBadge}</td>
                    <td>
                        <button class="action-btn" onclick="viewPurchaseDetails(${p.id})">View</button>
                    </td>
                </tr>
            `;
        }).join('');
    } else {
        purchasesHtml = '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-secondary);">No purchases yet</td></tr>';
    }
    
    const content = `
        <div class="supplier-details-card">
            <div class="supplier-info-section">
                <h3>👤 Supplier Information</h3>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">Name:</span>
                        <span class="info-value">${supplier.name}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Phone:</span>
                        <span class="info-value">${supplier.phone || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">GST Number:</span>
                        <span class="info-value">${supplier.gst || 'N/A'}</span>
                    </div>
                </div>
            </div>
            
            <div class="supplier-stats-grid">
                <div class="supplier-stat-card">
                    <div class="stat-icon">📦</div>
                    <div class="stat-info">
                        <div class="stat-label">Total Orders</div>
                        <div class="stat-number">${totalPurchases}</div>
                    </div>
                </div>
                <div class="supplier-stat-card">
                    <div class="stat-icon">💰</div>
                    <div class="stat-info">
                        <div class="stat-label">Total Amount</div>
                        <div class="stat-number">₹${totalAmount.toFixed(2)}</div>
                    </div>
                </div>
                <div class="supplier-stat-card success">
                    <div class="stat-icon">✅</div>
                    <div class="stat-info">
                        <div class="stat-label">Paid</div>
                        <div class="stat-number">₹${paidAmount.toFixed(2)}</div>
                    </div>
                </div>
                <div class="supplier-stat-card ${outstandingAmount > 0 ? 'danger' : 'success'}">
                    <div class="stat-icon">${outstandingAmount > 0 ? '⏳' : '✅'}</div>
                    <div class="stat-info">
                        <div class="stat-label">Outstanding</div>
                        <div class="stat-number">₹${outstandingAmount.toFixed(2)}</div>
                    </div>
                </div>
            </div>
            
            <div class="payment-breakdown">
                <h3>💳 Payment Breakdown</h3>
                <div class="payment-bars">
                    <div class="payment-bar-item">
                        <div class="payment-bar-label">
                            <span>✅ Paid</span>
                            <span>₹${paidAmount.toFixed(2)}</span>
                        </div>
                        <div class="payment-bar">
                            <div class="payment-bar-fill success" style="width: ${totalAmount > 0 ? (paidAmount / totalAmount * 100) : 0}%"></div>
                        </div>
                    </div>
                    <div class="payment-bar-item">
                        <div class="payment-bar-label">
                            <span>⏳ Pending</span>
                            <span>₹${pendingAmount.toFixed(2)}</span>
                        </div>
                        <div class="payment-bar">
                            <div class="payment-bar-fill danger" style="width: ${totalAmount > 0 ? (pendingAmount / totalAmount * 100) : 0}%"></div>
                        </div>
                    </div>
                    <div class="payment-bar-item">
                        <div class="payment-bar-label">
                            <span>💰 Partial</span>
                            <span>₹${partialAmount.toFixed(2)}</span>
                        </div>
                        <div class="payment-bar">
                            <div class="payment-bar-fill warning" style="width: ${totalAmount > 0 ? (partialAmount / totalAmount * 100) : 0}%"></div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="purchase-history-section">
                <h3>📋 Purchase History</h3>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Purchase #</th>
                                <th>Date</th>
                                <th>Invoice</th>
                                <th>Items</th>
                                <th>Amount</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${purchasesHtml}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('supplier-details-content').innerHTML = content;
    document.getElementById('supplier-details-modal').classList.add('active');
}

function closeSupplierDetailsModal() {
    document.getElementById('supplier-details-modal').classList.remove('active');
}

// Bill IDs are now auto-generated by the database

// Reports
async function loadBills() {
    try {
        bills = await APIService.getBills();
    } catch (error) {
        console.error('Error loading bills:', error);
        bills = [];
    }
}

// Bills are now saved via API, no need for saveBills function

function viewBillDetails(billId) {
    const bill = bills.find(b => b.id === billId);
    if (!bill) return;
    
    let itemsList = bill.items.map((item, idx) => 
        `${idx + 1}. ${item.name} (${item.size} ${item.unit}) x ${item.quantity} @ ₹${item.price} = ₹${item.amount.toFixed(2)} + GST(${item.gst}%) ₹${item.gstAmount.toFixed(2)} = ₹${item.total.toFixed(2)}`
    ).join('\n');
    
    let gstDetails = '';
    if (bill.gstBreakdown.type === 'SGST+CGST') {
        gstDetails = `SGST: ₹${bill.gstBreakdown.sgst.toFixed(2)}\nCGST: ₹${bill.gstBreakdown.cgst.toFixed(2)}`;
    } else {
        gstDetails = `IGST: ₹${bill.gstBreakdown.igst.toFixed(2)}`;
    }
    
    alert(`Bill #${bill.id}\n\nCustomer: ${bill.customer.name}\nPhone: ${bill.customer.phone || 'N/A'}\nState: ${bill.customer.state === 'same' ? 'Same State' : 'Other State'}\n\nItems:\n${itemsList}\n\nSubtotal: ₹${bill.subtotal.toFixed(2)}\n${gstDetails}\nTotal: ₹${bill.total.toFixed(2)}`);
}

function viewBillHistory() {
    showBillHistoryModal();
}

// Sales Management
function renderSales() {
    const tbody = document.getElementById('sales-tbody');
    tbody.innerHTML = '';
    
    if (bills.length === 0) {
        tbody.innerHTML = '<tr><td colspan="12" style="text-align: center; padding: 2rem;">No sales records found</td></tr>';
        return;
    }
    
    bills.slice().reverse().forEach(bill => {
        const row = document.createElement('tr');
        const date = new Date(bill.createdAt).toLocaleDateString('en-IN');
        const time = new Date(bill.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        const itemCount = bill.items.length;
        const stateText = bill.customer.state === 'same' ? 'Same State' : 'Other State';
        
        let paymentStatusBadge = '';
        const paymentStatus = bill.paymentStatus || 'paid'; // Default to paid for old bills
        if (paymentStatus === 'paid') {
            paymentStatusBadge = '<span class="badge badge-success">✅ Paid</span>';
        } else if (paymentStatus === 'pending') {
            paymentStatusBadge = '<span class="badge badge-danger">⏳ Pending</span>';
        } else {
            paymentStatusBadge = '<span class="badge badge-warning">💰 Partial</span>';
        }
        
        row.innerHTML = `
            <td><strong>#${bill.id}</strong></td>
            <td>${date}<br><small>${time}</small></td>
            <td>${bill.customer.name}</td>
            <td>${bill.customer.phone || '-'}</td>
            <td>${bill.customer.gst || '-'}</td>
            <td>${stateText}</td>
            <td>${itemCount} item${itemCount > 1 ? 's' : ''}</td>
            <td>₹${bill.subtotal.toFixed(2)}</td>
            <td>₹${bill.totalGST.toFixed(2)}</td>
            <td><strong>₹${bill.total.toFixed(2)}</strong></td>
            <td>${paymentStatusBadge}</td>
            <td class="actions-cell">
                <button class="action-btn action-btn-sm" onclick="viewBillDetailsModal(${bill.id})" title="View Details">👁️</button>
                <button class="action-btn action-btn-sm" onclick="downloadBillPDF(${bill.id})" title="Download PDF">📄</button>
                <button class="action-btn action-btn-sm" onclick="updatePaymentStatus(${bill.id})" title="Update Payment">💳</button>
                <button class="action-btn action-btn-sm delete" onclick="deleteBill(${bill.id})" title="Delete">🗑️</button>
            </td>
        `;
        tbody.appendChild(row);
    });
    
    updateSalesSummary();
}

function filterSales() {
    const search = document.getElementById('search-sales').value.toLowerCase();
    const rows = document.querySelectorAll('#sales-tbody tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(search) ? '' : 'none';
    });
}

function updateSalesSummary() {
    const totalSales = bills.reduce((sum, bill) => sum + bill.total, 0);
    const totalGST = bills.reduce((sum, bill) => sum + bill.totalGST, 0);
    const totalCount = bills.length;
    
    // Calculate actual pending amount using payment tracking
    let pendingAmount = 0;
    bills.forEach(bill => {
        if (bill.paymentStatus === 'pending') {
            pendingAmount += bill.total;
        } else if (bill.paymentStatus === 'partial' && bill.paymentTracking) {
            pendingAmount += bill.paymentTracking.amountPending;
        }
    });
    
    document.getElementById('sales-total').textContent = `₹${totalSales.toFixed(2)}`;
    document.getElementById('sales-count').textContent = totalCount;
    document.getElementById('sales-gst').textContent = `₹${totalGST.toFixed(2)}`;
    
    // Update or create pending payments card
    const pendingCard = document.getElementById('sales-pending');
    if (pendingCard) {
        pendingCard.textContent = `₹${pendingAmount.toFixed(2)}`;
    }
}

function viewBillDetailsModal(billId) {
    const bill = bills.find(b => b.id === billId);
    if (!bill) return;
    
    const date = new Date(bill.createdAt).toLocaleDateString('en-IN');
    const time = new Date(bill.createdAt).toLocaleTimeString('en-IN');
    
    let itemsHtml = bill.items.map((item, idx) => `
        <tr>
            <td>${idx + 1}</td>
            <td>${item.name}</td>
            <td>${item.size} ${item.unit}</td>
            <td>${item.quantity}</td>
            <td>₹${item.price.toFixed(2)}</td>
            <td>₹${item.amount.toFixed(2)}</td>
            <td>${item.gst}%</td>
            <td>₹${item.gstAmount.toFixed(2)}</td>
            <td>₹${item.total.toFixed(2)}</td>
        </tr>
    `).join('');
    
    let gstBreakdownHtml = '';
    if (bill.gstBreakdown.type === 'SGST+CGST') {
        gstBreakdownHtml = `
            <div class="summary-row">
                <span>SGST:</span>
                <span>₹${bill.gstBreakdown.sgst.toFixed(2)}</span>
            </div>
            <div class="summary-row">
                <span>CGST:</span>
                <span>₹${bill.gstBreakdown.cgst.toFixed(2)}</span>
            </div>
        `;
    } else {
        gstBreakdownHtml = `
            <div class="summary-row">
                <span>IGST:</span>
                <span>₹${bill.gstBreakdown.igst.toFixed(2)}</span>
            </div>
        `;
    }
    
    const content = `
        <div class="bill-info">
            <h3>Bill #${bill.id}</h3>
            <p><strong>Date:</strong> ${date} ${time}</p>
            <p><strong>Customer:</strong> ${bill.customer.name}</p>
            <p><strong>Phone:</strong> ${bill.customer.phone || 'N/A'}</p>
            <p><strong>GST Number:</strong> ${bill.customer.gst || 'N/A'}</p>
            <p><strong>Address:</strong> ${bill.customer.address || 'N/A'}</p>
            <p><strong>State:</strong> ${bill.customer.state === 'same' ? 'Same State (SGST+CGST)' : 'Other State (IGST)'}</p>
            <p><strong>Payment Status:</strong> ${bill.paymentStatus === 'paid' ? '✅ Paid' : bill.paymentStatus === 'pending' ? '⏳ Pending' : bill.paymentStatus === 'partial' ? '💰 Partial' : '✅ Paid'}</p>
        </div>
        
        <h3>Items</h3>
        <table class="bill-details-table">
            <thead>
                <tr>
                    <th>S.No</th>
                    <th>Item</th>
                    <th>Size</th>
                    <th>Qty</th>
                    <th>Rate</th>
                    <th>Amount</th>
                    <th>GST %</th>
                    <th>GST Amt</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>
                ${itemsHtml}
            </tbody>
        </table>
        
        <div class="bill-summary-box">
            <div class="summary-row">
                <span>Subtotal:</span>
                <span>₹${bill.subtotal.toFixed(2)}</span>
            </div>
            ${gstBreakdownHtml}
            <div class="summary-row total">
                <span>Total Amount:</span>
                <span>₹${bill.total.toFixed(2)}</span>
            </div>
        </div>
    `;
    
    document.getElementById('bill-details-content').innerHTML = content;
    document.getElementById('bill-details-modal').classList.add('active');
}

function closeBillDetailsModal() {
    document.getElementById('bill-details-modal').classList.remove('active');
}

async function deleteBill(billId) {
    if (!confirm('Are you sure you want to delete this bill? This action cannot be undone.')) return;
    
    try {
        await APIService.deleteBill(billId);
        bills = bills.filter(b => b.id !== billId);
        renderSales();
    } catch (error) {
        console.error('Error deleting bill:', error);
        alert('Failed to delete bill. Please try again.');
    }
}

function updatePaymentStatus(billId) {
    const bill = bills.find(b => b.id === billId);
    if (!bill) return;
    
    const currentStatus = bill.paymentStatus || 'paid';
    const statusLabels = {
        'paid': '✅ Paid',
        'pending': '⏳ Pending',
        'partial': '💰 Partial'
    };
    
    // Store the bill ID for later use
    window.currentBillIdForUpdate = billId;
    
    // Populate modal
    document.getElementById('update-bill-id').textContent = billId;
    document.getElementById('update-current-status').innerHTML = `<span class="badge badge-${currentStatus === 'paid' ? 'success' : currentStatus === 'pending' ? 'danger' : 'warning'}">${statusLabels[currentStatus]}</span>`;
    
    // Show modal
    document.getElementById('update-payment-modal').classList.add('active');
}

function closeUpdatePaymentModal() {
    document.getElementById('update-payment-modal').classList.remove('active');
    window.currentBillIdForUpdate = null;
    
    // Reset form
    document.getElementById('partial-payment-input').style.display = 'none';
    document.querySelectorAll('#update-payment-modal .payment-status-options')[0].style.display = 'flex';
    document.getElementById('partial-amount-input').value = '';
}

async function selectPaymentStatus(newStatus) {
    const billId = window.currentBillIdForUpdate;
    if (!billId) return;
    
    const bill = bills.find(b => b.id === billId);
    if (!bill) return;
    
    // If partial payment, show input form
    if (newStatus === 'partial') {
        // Hide payment options
        document.querySelectorAll('#update-payment-modal .payment-status-options')[0].style.display = 'none';
        
        // Show partial payment input
        const partialInput = document.getElementById('partial-payment-input');
        partialInput.style.display = 'block';
        
        // Initialize payment tracking if not exists
        if (!bill.paymentTracking) {
            bill.paymentTracking = {
                totalAmount: bill.total,
                amountPaid: 0,
                amountPending: bill.total,
                payments: []
            };
        }
        
        // Display amounts
        document.getElementById('bill-total-amount').textContent = `₹${bill.paymentTracking.totalAmount.toFixed(2)}`;
        document.getElementById('bill-already-paid').textContent = `₹${bill.paymentTracking.amountPaid.toFixed(2)}`;
        document.getElementById('bill-remaining-pending').textContent = `₹${bill.paymentTracking.amountPending.toFixed(2)}`;
        document.getElementById('partial-amount-input').value = '';
        document.getElementById('partial-amount-input').max = bill.paymentTracking.amountPending;
        
        return;
    }
    
    const statusLabels = {
        'paid': '✅ Paid',
        'pending': '⏳ Pending'
    };
    
    // For paid status, mark as fully paid
    if (newStatus === 'paid') {
        if (!bill.paymentTracking) {
            bill.paymentTracking = {
                totalAmount: bill.total,
                amountPaid: bill.total,
                amountPending: 0,
                payments: [{
                    amount: bill.total,
                    date: new Date().toISOString(),
                    note: 'Marked as paid'
                }]
            };
        } else {
            bill.paymentTracking.amountPaid = bill.paymentTracking.totalAmount;
            bill.paymentTracking.amountPending = 0;
        }
    }
    
    // For pending status, reset payments
    if (newStatus === 'pending') {
        bill.paymentTracking = {
            totalAmount: bill.total,
            amountPaid: 0,
            amountPending: bill.total,
            payments: []
        };
    }
    
    bill.paymentStatus = newStatus;
    
    try {
        await APIService.updateBill(bill.id, { 
            paymentStatus: newStatus,
            paymentTracking: bill.paymentTracking 
        });
        renderSales();
        closeUpdatePaymentModal();
        alert(`Payment status updated to: ${statusLabels[newStatus]}`);
    } catch (error) {
        console.error('Error updating bill payment status:', error);
        alert('Failed to update payment status. Please try again.');
    }
}

function calculateBillPending() {
    const billId = window.currentBillIdForUpdate;
    if (!billId) return;
    
    const bill = bills.find(b => b.id === billId);
    if (!bill) return;
    
    const amountReceived = parseFloat(document.getElementById('partial-amount-input').value) || 0;
    const newPending = bill.paymentTracking.amountPending - amountReceived;
    
    document.getElementById('bill-remaining-pending').textContent = `₹${Math.max(0, newPending).toFixed(2)}`;
}

async function confirmPartialPayment() {
    const billId = window.currentBillIdForUpdate;
    if (!billId) return;
    
    const bill = bills.find(b => b.id === billId);
    if (!bill) return;
    
    const amountReceived = parseFloat(document.getElementById('partial-amount-input').value);
    
    if (!amountReceived || amountReceived <= 0) {
        alert('Please enter a valid amount received');
        return;
    }
    
    if (amountReceived > bill.paymentTracking.amountPending) {
        alert('Amount received cannot be more than pending amount');
        return;
    }
    
    // Update payment tracking
    bill.paymentTracking.amountPaid += amountReceived;
    bill.paymentTracking.amountPending -= amountReceived;
    bill.paymentTracking.payments.push({
        amount: amountReceived,
        date: new Date().toISOString(),
        note: 'Partial payment received'
    });
    
    // Check if fully paid now
    if (bill.paymentTracking.amountPending <= 0.01) {
        bill.paymentStatus = 'paid';
        alert(`Payment completed! Total received: ₹${bill.paymentTracking.amountPaid.toFixed(2)}`);
    } else {
        bill.paymentStatus = 'partial';
        alert(`Partial payment recorded!\nReceived: ₹${amountReceived.toFixed(2)}\nRemaining: ₹${bill.paymentTracking.amountPending.toFixed(2)}`);
    }
    
    try {
        await APIService.updateBill(bill.id, { 
            paymentStatus: bill.paymentStatus,
            paymentTracking: bill.paymentTracking 
        });
        renderSales();
        closeUpdatePaymentModal();
    } catch (error) {
        console.error('Error updating bill payment:', error);
        alert('Failed to update payment. Please try again.');
    }
}

function cancelPartialPayment() {
    // Hide partial input and show payment options again
    document.getElementById('partial-payment-input').style.display = 'none';
    document.querySelectorAll('#update-payment-modal .payment-status-options')[0].style.display = 'flex';
    document.getElementById('partial-amount-input').value = '';
}

function showBillHistoryModal() {
    document.getElementById('bill-history-modal').classList.add('active');
    renderBillHistory();
}

function closeBillHistoryModal() {
    document.getElementById('bill-history-modal').classList.remove('active');
}

function renderBillHistory() {
    const tbody = document.getElementById('bill-history-tbody');
    tbody.innerHTML = '';
    
    // Get recent bills (last 20)
    const recentBills = bills.slice().reverse().slice(0, 20);
    
    if (recentBills.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-secondary);">No bills generated yet</td></tr>';
        return;
    }
    
    recentBills.forEach(bill => {
        const row = document.createElement('tr');
        const date = new Date(bill.createdAt).toLocaleDateString('en-IN');
        const time = new Date(bill.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        
        let statusBadge = '';
        if (bill.paymentStatus === 'paid') {
            statusBadge = '<span class="badge badge-success">✅ Paid</span>';
        } else if (bill.paymentStatus === 'pending') {
            statusBadge = '<span class="badge badge-danger">⏳ Pending</span>';
        } else {
            statusBadge = '<span class="badge badge-warning">💰 Partial</span>';
        }
        
        row.innerHTML = `
            <td><strong>#${bill.id}</strong></td>
            <td>${date}<br><small style="color: var(--text-secondary);">${time}</small></td>
            <td>${bill.customer.name}</td>
            <td>${bill.customer.phone || '-'}</td>
            <td>${bill.items.length}</td>
            <td><strong>₹${bill.total.toFixed(2)}</strong></td>
            <td>${statusBadge}</td>
        `;
        tbody.appendChild(row);
    });
}


// Customer Reports
function showCustomerReports() {
    document.getElementById('customer-reports-modal').classList.add('active');
    renderCustomerReports();
}

function closeCustomerReportsModal() {
    document.getElementById('customer-reports-modal').classList.remove('active');
}

function filterCustomerReports() {
    const search = document.getElementById('search-customer-reports').value.toLowerCase();
    const rows = document.querySelectorAll('#customer-reports-tbody tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(search) ? '' : 'none';
    });
}

function renderCustomerReports() {
    const tbody = document.getElementById('customer-reports-tbody');
    tbody.innerHTML = '';
    
    if (customers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 2rem; color: var(--text-secondary);">📊 No customer data available</td></tr>';
        return;
    }
    
    // Calculate data for each customer
    const customerData = customers.map(customer => {
        const customerBills = bills.filter(b => 
            b.customer.name.toLowerCase() === customer.name.toLowerCase() ||
            (b.customer.phone && customer.phone && b.customer.phone === customer.phone)
        );
        
        const totalOrders = customerBills.length;
        const totalAmount = customerBills.reduce((sum, b) => sum + b.total, 0);
        const paidAmount = customerBills
            .filter(b => (b.paymentStatus || 'paid') === 'paid')
            .reduce((sum, b) => sum + b.total, 0);
        const pendingAmount = customerBills
            .filter(b => b.paymentStatus === 'pending')
            .reduce((sum, b) => sum + b.total, 0);
        const partialAmount = customerBills
            .filter(b => b.paymentStatus === 'partial')
            .reduce((sum, b) => sum + b.total, 0);
        
        const lastPurchase = customerBills.length > 0 
            ? new Date(Math.max(...customerBills.map(b => new Date(b.createdAt)))).toLocaleDateString('en-IN')
            : 'N/A';
        
        return {
            customer,
            totalOrders,
            totalAmount,
            paidAmount,
            pendingAmount,
            partialAmount,
            lastPurchase,
            outstandingAmount: pendingAmount + partialAmount
        };
    });
    
    // Sort by total amount (highest first)
    customerData.sort((a, b) => b.totalAmount - a.totalAmount);
    
    customerData.forEach(data => {
        const row = document.createElement('tr');
        
        let paymentStatus = '';
        if (data.outstandingAmount === 0) {
            paymentStatus = '<span class="badge badge-success">✅ Clear</span>';
        } else if (data.pendingAmount > 0) {
            paymentStatus = '<span class="badge badge-danger">⏳ Pending</span>';
        } else {
            paymentStatus = '<span class="badge badge-warning">💰 Partial</span>';
        }
        
        row.innerHTML = `
            <td onclick="viewCustomerDetails('${data.customer.name.replace(/'/g, "\\'")}')"><strong>${data.customer.name}</strong></td>
            <td>${data.customer.phone || '-'}</td>
            <td>${data.customer.gst || '-'}</td>
            <td>${data.totalOrders}</td>
            <td>₹${data.totalAmount.toFixed(2)}</td>
            <td>₹${data.paidAmount.toFixed(2)}</td>
            <td>₹${data.outstandingAmount.toFixed(2)}</td>
            <td>${paymentStatus}</td>
            <td>${data.lastPurchase}</td>
            <td>
                <button class="action-btn" onclick="viewCustomerDetails('${data.customer.name.replace(/'/g, "\\'")}')">View Details</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function viewCustomerDetails(customerName) {
    const customer = customers.find(c => c.name === customerName);
    if (!customer) return;
    
    const customerBills = bills.filter(b => 
        b.customer.name.toLowerCase() === customer.name.toLowerCase() ||
        (b.customer.phone && customer.phone && b.customer.phone === customer.phone)
    );
    
    const totalOrders = customerBills.length;
    const totalAmount = customerBills.reduce((sum, b) => sum + b.total, 0);
    const paidAmount = customerBills.filter(b => (b.paymentStatus || 'paid') === 'paid').reduce((sum, b) => sum + b.total, 0);
    const pendingAmount = customerBills.filter(b => b.paymentStatus === 'pending').reduce((sum, b) => sum + b.total, 0);
    const partialAmount = customerBills.filter(b => b.paymentStatus === 'partial').reduce((sum, b) => sum + b.total, 0);
    const outstandingAmount = pendingAmount + partialAmount;
    
    // Generate purchase history HTML
    let billsHtml = '';
    if (customerBills.length > 0) {
        billsHtml = customerBills.map(b => {
            const date = new Date(b.createdAt).toLocaleDateString('en-IN');
            const time = new Date(b.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
            let statusBadge = '';
            const paymentStatus = b.paymentStatus || 'paid';
            if (paymentStatus === 'paid') {
                statusBadge = '<span class="badge badge-success">✅ Paid</span>';
            } else if (paymentStatus === 'pending') {
                statusBadge = '<span class="badge badge-danger">⏳ Pending</span>';
            } else {
                statusBadge = '<span class="badge badge-warning">💰 Partial</span>';
            }
            
            return `
                <tr>
                    <td><strong>#${b.id}</strong></td>
                    <td>${date}<br><small>${time}</small></td>
                    <td>${b.items.length} items</td>
                    <td>₹${b.total.toFixed(2)}</td>
                    <td>${statusBadge}</td>
                    <td>
                        <button class="action-btn" onclick="viewBillDetailsModal(${b.id})">View</button>
                    </td>
                </tr>
            `;
        }).join('');
    } else {
        billsHtml = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-secondary);">No purchases yet</td></tr>';
    }
    
    const content = `
        <div class="supplier-details-card">
            <div class="supplier-info-section">
                <h3>👤 Customer Information</h3>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">Name:</span>
                        <span class="info-value">${customer.name}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Phone:</span>
                        <span class="info-value">${customer.phone || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">GST Number:</span>
                        <span class="info-value">${customer.gst || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Address:</span>
                        <span class="info-value">${customer.address || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">State:</span>
                        <span class="info-value">${customer.state === 'same' ? 'Same State' : customer.state === 'other' ? 'Other State' : 'N/A'}</span>
                    </div>
                </div>
            </div>
            
            <div class="supplier-stats-grid">
                <div class="supplier-stat-card">
                    <div class="stat-icon">🛒</div>
                    <div class="stat-info">
                        <div class="stat-label">Total Orders</div>
                        <div class="stat-number">${totalOrders}</div>
                    </div>
                </div>
                <div class="supplier-stat-card">
                    <div class="stat-icon">💰</div>
                    <div class="stat-info">
                        <div class="stat-label">Total Amount</div>
                        <div class="stat-number">₹${totalAmount.toFixed(2)}</div>
                    </div>
                </div>
                <div class="supplier-stat-card success">
                    <div class="stat-icon">✅</div>
                    <div class="stat-info">
                        <div class="stat-label">Paid</div>
                        <div class="stat-number">₹${paidAmount.toFixed(2)}</div>
                    </div>
                </div>
                <div class="supplier-stat-card ${outstandingAmount > 0 ? 'danger' : 'success'}">
                    <div class="stat-icon">${outstandingAmount > 0 ? '⏳' : '✅'}</div>
                    <div class="stat-info">
                        <div class="stat-label">Outstanding</div>
                        <div class="stat-number">₹${outstandingAmount.toFixed(2)}</div>
                    </div>
                </div>
            </div>
            
            <div class="payment-breakdown">
                <h3>💳 Payment Breakdown</h3>
                <div class="payment-bars">
                    <div class="payment-bar-item">
                        <div class="payment-bar-label">
                            <span>✅ Paid</span>
                            <span>₹${paidAmount.toFixed(2)}</span>
                        </div>
                        <div class="payment-bar">
                            <div class="payment-bar-fill success" style="width: ${totalAmount > 0 ? (paidAmount / totalAmount * 100) : 0}%"></div>
                        </div>
                    </div>
                    <div class="payment-bar-item">
                        <div class="payment-bar-label">
                            <span>⏳ Pending</span>
                            <span>₹${pendingAmount.toFixed(2)}</span>
                        </div>
                        <div class="payment-bar">
                            <div class="payment-bar-fill danger" style="width: ${totalAmount > 0 ? (pendingAmount / totalAmount * 100) : 0}%"></div>
                        </div>
                    </div>
                    <div class="payment-bar-item">
                        <div class="payment-bar-label">
                            <span>💰 Partial</span>
                            <span>₹${partialAmount.toFixed(2)}</span>
                        </div>
                        <div class="payment-bar">
                            <div class="payment-bar-fill warning" style="width: ${totalAmount > 0 ? (partialAmount / totalAmount * 100) : 0}%"></div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="purchase-history-section">
                <h3>📋 Purchase History</h3>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Bill #</th>
                                <th>Date</th>
                                <th>Items</th>
                                <th>Amount</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${billsHtml}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('customer-details-content').innerHTML = content;
    document.getElementById('customer-details-modal').classList.add('active');
}

function closeCustomerDetailsModal() {
    document.getElementById('customer-details-modal').classList.remove('active');
}


// Dashboard Functions
function renderDashboard() {
    if (!isOwner()) {
        alert('Access Denied: Dashboard is only available to the Owner.');
        switchView('inventory');
        return;
    }
    
    // Get selected period
    const period = document.getElementById('dashboard-period')?.value || 'all';
    
    // Filter data based on period
    const filteredBills = filterByPeriod(bills, period);
    const filteredPurchases = filterByPeriod(purchases, period);
    
    // Update period info banner
    updatePeriodInfo(period);
    
    // Calculate metrics
    const totalRevenue = filteredBills.reduce((sum, bill) => sum + bill.total, 0);
    const totalPurchases = filteredPurchases.reduce((sum, p) => sum + p.total, 0);
    const estimatedProfit = totalRevenue - totalPurchases;
    const inventoryValue = inventory.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    
    // Calculate actual pending payments using payment tracking
    let pendingPayments = 0;
    filteredBills.forEach(bill => {
        if (bill.paymentStatus === 'pending') {
            pendingPayments += bill.total;
        } else if (bill.paymentStatus === 'partial' && bill.paymentTracking) {
            pendingPayments += bill.paymentTracking.amountPending;
        }
    });
    
    // Update metric cards
    document.getElementById('dash-total-revenue').textContent = `₹${totalRevenue.toFixed(2)}`;
    document.getElementById('dash-profit').textContent = `₹${estimatedProfit.toFixed(2)}`;
    document.getElementById('dash-inventory-value').textContent = `₹${inventoryValue.toFixed(2)}`;
    document.getElementById('dash-pending-payments').textContent = `₹${pendingPayments.toFixed(2)}`;
    
    // Sales Overview
    const totalBills = filteredBills.length;
    const paidBills = filteredBills.filter(b => (b.paymentStatus || 'paid') === 'paid').length;
    const pendingBills = filteredBills.filter(b => b.paymentStatus === 'pending' || b.paymentStatus === 'partial').length;
    const collectionRate = totalBills > 0 ? ((paidBills / totalBills) * 100).toFixed(1) : 0;
    
    document.getElementById('dash-total-bills').textContent = totalBills;
    document.getElementById('dash-paid-bills').textContent = paidBills;
    document.getElementById('dash-pending-bills').textContent = pendingBills;
    document.getElementById('dash-collection-rate').textContent = `${collectionRate}%`;
    document.getElementById('dash-collection-bar').style.width = `${collectionRate}%`;
    
    // Inventory Status
    const totalProducts = inventory.length;
    const lowStock = inventory.filter(item => item.quantity > 0 && item.quantity < 5).length;
    const outOfStock = inventory.filter(item => item.quantity === 0).length;
    
    document.getElementById('dash-total-products').textContent = totalProducts;
    document.getElementById('dash-low-stock').textContent = lowStock;
    document.getElementById('dash-out-stock').textContent = outOfStock;
    
    // Inventory Alerts
    renderInventoryAlerts();
    
    // Purchase Summary
    const purchaseCount = filteredPurchases.length;
    const supplierCount = suppliers.length;
    const paidPurchases = filteredPurchases.filter(p => p.paymentStatus === 'paid').reduce((sum, p) => sum + p.total, 0);
    const supplierPaymentRate = totalPurchases > 0 ? ((paidPurchases / totalPurchases) * 100).toFixed(1) : 0;
    
    document.getElementById('dash-total-purchases').textContent = `₹${totalPurchases.toFixed(2)}`;
    document.getElementById('dash-purchase-count').textContent = purchaseCount;
    document.getElementById('dash-supplier-count').textContent = supplierCount;
    document.getElementById('dash-supplier-payment-rate').textContent = `${supplierPaymentRate}%`;
    document.getElementById('dash-supplier-payment-bar').style.width = `${supplierPaymentRate}%`;
    
    // Customer Insights
    const customerCount = customers.length;
    const avgBill = totalBills > 0 ? (totalRevenue / totalBills).toFixed(2) : 0;
    const gstCollected = filteredBills.reduce((sum, bill) => sum + bill.totalGST, 0);
    
    document.getElementById('dash-customer-count').textContent = customerCount;
    document.getElementById('dash-avg-bill').textContent = `₹${avgBill}`;
    document.getElementById('dash-gst-collected').textContent = `₹${gstCollected.toFixed(2)}`;
    
    // Top Products (pass filtered bills)
    renderTopProducts(filteredBills);
    
    // Recent Activity (pass filtered data)
    renderRecentActivity(filteredBills, filteredPurchases);
}

function renderInventoryAlerts() {
    const alertsContainer = document.getElementById('dash-inventory-alerts');
    const lowStockItems = inventory.filter(item => item.quantity > 0 && item.quantity < 5);
    const outOfStockItems = inventory.filter(item => item.quantity === 0);
    
    let alertsHtml = '';
    
    outOfStockItems.forEach(item => {
        alertsHtml += `
            <div class="alert-item danger">
                <strong>⚠️ Out of Stock:</strong> ${item.name} (${item.size} ${item.unit})
            </div>
        `;
    });
    
    lowStockItems.forEach(item => {
        alertsHtml += `
            <div class="alert-item">
                <strong>⚠️ Low Stock:</strong> ${item.name} - Only ${item.quantity} ${item.unit} left
            </div>
        `;
    });
    
    if (alertsHtml === '') {
        alertsHtml = '<p style="text-align: center; color: var(--text-secondary); padding: 1rem;">✅ All products have sufficient stock</p>';
    }
    
    alertsContainer.innerHTML = alertsHtml;
}

function renderTopProducts(filteredBills = bills) {
    const container = document.getElementById('dash-top-products');
    
    // Calculate product sales
    const productSales = {};
    filteredBills.forEach(bill => {
        bill.items.forEach(item => {
            if (!productSales[item.id]) {
                productSales[item.id] = {
                    id: item.id,
                    name: item.name,
                    size: item.size,
                    unit: item.unit,
                    quantity: 0,
                    revenue: 0
                };
            }
            productSales[item.id].quantity += item.quantity;
            productSales[item.id].revenue += item.total;
        });
    });

    
    // Sort by quantity sold
    const topProducts = Object.values(productSales)
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);
    
    if (topProducts.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No sales data available yet</p>';
        return;
    }
    
    let html = '';
    topProducts.forEach((product, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        html += `
            <div class="product-item">
                <div class="product-item-info">
                    <div class="product-rank">${medal}</div>
                    <div class="product-details">
                        <h4>${product.name}</h4>
                        <p>${product.size} ${product.unit}</p>
                    </div>
                </div>
                <div class="product-stats">
                    <div class="quantity">${product.quantity} sold</div>
                    <div class="revenue">₹${product.revenue.toFixed(2)}</div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function renderRecentActivity(filteredBills = bills, filteredPurchases = purchases) {
    const container = document.getElementById('dash-recent-activity');
    
    // Combine bills and purchases with timestamps
    const activities = [];
    
    filteredBills.slice(-10).forEach(bill => {
        activities.push({
            type: 'sale',
            icon: '💰',
            text: `Sale to ${bill.customer.name} - ₹${bill.total.toFixed(2)}`,
            time: new Date(bill.createdAt),
            status: bill.paymentStatus || 'paid'
        });
    });
    
    filteredPurchases.slice(-10).forEach(purchase => {
        activities.push({
            type: 'purchase',
            icon: '🛒',
            text: `Purchase from ${purchase.supplier.name} - ₹${purchase.total.toFixed(2)}`,
            time: new Date(purchase.createdAt),
            status: purchase.paymentStatus
        });
    });
    
    // Sort by time (most recent first)
    activities.sort((a, b) => b.time - a.time);
    
    // Take top 10
    const recentActivities = activities.slice(0, 10);
    
    if (recentActivities.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No recent activity</p>';
        return;
    }

    
    let html = '';
    recentActivities.forEach(activity => {
        const timeAgo = getTimeAgo(activity.time);
        const statusBadge = activity.status === 'paid' ? 
            '<span class="badge badge-success">✅</span>' : 
            activity.status === 'pending' ? 
            '<span class="badge badge-danger">⏳</span>' : 
            '<span class="badge badge-warning">💰</span>';
        
        html += `
            <div class="activity-item">
                <div class="activity-icon">${activity.icon}</div>
                <div class="activity-content">
                    <div>${activity.text} ${statusBadge}</div>
                    <div class="activity-time">${timeAgo}</div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
    
    return date.toLocaleDateString('en-IN');
}

function refreshDashboard() {
    renderDashboard();
}

function changeDashboardPeriod() {
    renderDashboard();
}

function filterByPeriod(data, period) {
    if (period === 'all') {
        return data;
    }
    
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentQuarter = Math.floor(currentMonth / 3);
    
    return data.filter(item => {
        const itemDate = new Date(item.createdAt);
        const itemYear = itemDate.getFullYear();
        const itemMonth = itemDate.getMonth();
        const itemQuarter = Math.floor(itemMonth / 3);
        
        switch(period) {
            case 'month':
                return itemYear === currentYear && itemMonth === currentMonth;
            case 'quarter':
                return itemYear === currentYear && itemQuarter === currentQuarter;
            case 'year':
                return itemYear === currentYear;
            default:
                return true;
        }
    });
}

function updatePeriodInfo(period) {
    const now = new Date();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'];
    const currentMonth = monthNames[now.getMonth()];
    const currentYear = now.getFullYear();
    const currentQuarter = Math.floor(now.getMonth() / 3) + 1;
    
    let infoText = '';
    
    switch(period) {
        case 'month':
            infoText = `📅 Showing data for: ${currentMonth} ${currentYear}`;
            break;
        case 'quarter':
            infoText = `📅 Showing data for: Q${currentQuarter} ${currentYear}`;
            break;
        case 'year':
            infoText = `📅 Showing data for: Year ${currentYear}`;
            break;
        default:
            infoText = `📅 Showing data for: All Time`;
    }
    
    document.getElementById('period-info-text').textContent = infoText;
}


// PDF Generation Function
function generateBillPDF(bill) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Company Details (You can customize these)
    const companyName = "PLASTIWOOD";
    const companyAddress = "Your Business Address Here";
    const companyGST = "Your GST Number";
    const companyPhone = "Your Phone Number";
    const companyEmail = "your.email@example.com";
    
    // Colors
    const primaryColor = [37, 99, 235]; // Blue
    const darkColor = [15, 23, 42];
    const lightGray = [241, 245, 249];
    
    // Header with gradient effect
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 210, 40, 'F');
    
    // Company Name
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont(undefined, 'bold');
    doc.text(companyName, 105, 15, { align: 'center' });
    
    // GST Invoice Title
    doc.setFontSize(16);
    doc.text('TAX INVOICE', 105, 25, { align: 'center' });
    
    // Company Details
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text(companyAddress, 105, 31, { align: 'center' });
    doc.text(`GST: ${companyGST} | Phone: ${companyPhone} | Email: ${companyEmail}`, 105, 36, { align: 'center' });
    
    // Reset text color
    doc.setTextColor(...darkColor);
    
    // Invoice Details Box
    let yPos = 50;
    doc.setFillColor(...lightGray);
    doc.rect(10, yPos, 190, 30, 'F');
    
    // Left side - Bill details
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text(`Invoice No: ${bill.id}`, 15, yPos + 7);
    doc.setFont(undefined, 'normal');
    doc.text(`Date: ${new Date(bill.createdAt).toLocaleDateString('en-IN')}`, 15, yPos + 14);
    doc.text(`Payment Status: ${bill.paymentStatus.toUpperCase()}`, 15, yPos + 21);
    
    // Right side - Customer details
    doc.setFont(undefined, 'bold');
    doc.text('Bill To:', 110, yPos + 7);
    doc.setFont(undefined, 'normal');
    doc.text(bill.customer.name, 110, yPos + 14);
    if (bill.customer.phone) {
        doc.text(`Phone: ${bill.customer.phone}`, 110, yPos + 21);
    }
    
    // Customer GST and Address
    yPos += 35;
    if (bill.customer.gst) {
        doc.setFontSize(9);
        doc.text(`Customer GST: ${bill.customer.gst}`, 15, yPos);
        yPos += 5;
    }
    if (bill.customer.address) {
        doc.text(`Address: ${bill.customer.address}`, 15, yPos);
        yPos += 5;
    }
    doc.text(`State: ${bill.customer.state === 'same' ? 'Same State (SGST+CGST)' : 'Other State (IGST)'}`, 15, yPos);
    
    // Items Table
    yPos += 10;
    
    const tableHeaders = [
        ['S.No', 'Item Description', 'HSN/SAC', 'Qty', 'Unit', 'Rate (Rs.)', 'Amount (Rs.)', 'GST %', 'GST (Rs.)', 'Total (Rs.)']
    ];
    
    const tableData = bill.items.map((item, index) => [
        (index + 1).toString(),
        item.name,
        inventory.find(i => i.id === item.id)?.hsn || '-',
        item.quantity.toString(),
        item.unit,
        item.price.toFixed(2),
        item.amount.toFixed(2),
        item.gst + '%',
        item.gstAmount.toFixed(2),
        item.total.toFixed(2)
    ]);
    
    doc.autoTable({
        startY: yPos,
        head: tableHeaders,
        body: tableData,
        theme: 'grid',
        headStyles: {
            fillColor: primaryColor,
            textColor: [255, 255, 255],
            fontSize: 9,
            fontStyle: 'bold',
            halign: 'center'
        },
        bodyStyles: {
            fontSize: 9,
            textColor: darkColor
        },
        columnStyles: {
            0: { halign: 'center', cellWidth: 12 },
            1: { halign: 'left', cellWidth: 35 },
            2: { halign: 'center', cellWidth: 20 },
            3: { halign: 'center', cellWidth: 12 },
            4: { halign: 'center', cellWidth: 12 },
            5: { halign: 'right', cellWidth: 20 },
            6: { halign: 'right', cellWidth: 22 },
            7: { halign: 'center', cellWidth: 15 },
            8: { halign: 'right', cellWidth: 20 },
            9: { halign: 'right', cellWidth: 22 }
        },
        alternateRowStyles: {
            fillColor: [248, 250, 252]
        }
    });
    
    // Get final Y position after table
    yPos = doc.lastAutoTable.finalY + 10;
    
    // Summary Box
    const summaryX = 120;
    const summaryWidth = 80;
    
    doc.setFillColor(...lightGray);
    doc.rect(summaryX, yPos, summaryWidth, 45, 'F');
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    
    // Subtotal
    doc.text('Subtotal:', summaryX + 5, yPos + 7);
    doc.text('Rs. ' + bill.subtotal.toFixed(2), summaryX + summaryWidth - 5, yPos + 7, { align: 'right' });
    
    // GST Breakdown
    if (bill.gstBreakdown.type === 'SGST+CGST') {
        doc.text('SGST:', summaryX + 5, yPos + 14);
        doc.text('Rs. ' + bill.gstBreakdown.sgst.toFixed(2), summaryX + summaryWidth - 5, yPos + 14, { align: 'right' });
        
        doc.text('CGST:', summaryX + 5, yPos + 21);
        doc.text('Rs. ' + bill.gstBreakdown.cgst.toFixed(2), summaryX + summaryWidth - 5, yPos + 21, { align: 'right' });
    } else {
        doc.text('IGST:', summaryX + 5, yPos + 14);
        doc.text('Rs. ' + bill.gstBreakdown.igst.toFixed(2), summaryX + summaryWidth - 5, yPos + 14, { align: 'right' });
    }
    
    // Total GST
    doc.text('Total GST:', summaryX + 5, yPos + 28);
    doc.text('Rs. ' + bill.totalGST.toFixed(2), summaryX + summaryWidth - 5, yPos + 28, { align: 'right' });
    
    // Grand Total
    doc.setFont(undefined, 'bold');
    doc.setFontSize(12);
    doc.setFillColor(...primaryColor);
    doc.rect(summaryX, yPos + 33, summaryWidth, 12, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text('Grand Total:', summaryX + 5, yPos + 40);
    doc.text('Rs. ' + bill.total.toFixed(2), summaryX + summaryWidth - 5, yPos + 40, { align: 'right' });
    
    // Reset colors
    doc.setTextColor(...darkColor);
    doc.setFont(undefined, 'normal');
    
    // Amount in words
    yPos += 50;
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text('Amount in Words:', 15, yPos);
    doc.setFont(undefined, 'normal');
    doc.text(numberToWords(bill.total) + ' Rupees Only', 15, yPos + 6);
    
    // Terms and Conditions
    yPos += 15;
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.text('Terms & Conditions:', 15, yPos);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(8);
    doc.text('1. Goods once sold will not be taken back or exchanged', 15, yPos + 5);
    doc.text('2. All disputes are subject to local jurisdiction only', 15, yPos + 10);
    doc.text('3. Payment should be made within 30 days from the date of invoice', 15, yPos + 15);
    
    // Footer
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.text('For ' + companyName, 150, pageHeight - 20);
    doc.setFont(undefined, 'normal');
    doc.text('Authorized Signatory', 150, pageHeight - 10);
    
    // Thank you message
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text('Thank you for your business!', 105, pageHeight - 10, { align: 'center' });
    
    // Save PDF
    const fileName = `Invoice_${bill.id}_${bill.customer.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
}

// Helper function to convert number to words (Indian numbering system)
function numberToWords(num) {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    
    if (num === 0) return 'Zero';
    
    // Split into rupees and paise
    const rupees = Math.floor(num);
    const paise = Math.round((num - rupees) * 100);
    
    function convertLessThanThousand(n) {
        if (n === 0) return '';
        
        if (n < 10) return ones[n];
        if (n < 20) return teens[n - 10];
        if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
        
        return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + convertLessThanThousand(n % 100) : '');
    }
    
    function convertToWords(n) {
        if (n === 0) return '';
        
        if (n < 1000) return convertLessThanThousand(n);
        
        if (n < 100000) {
            const thousands = Math.floor(n / 1000);
            const remainder = n % 1000;
            return convertLessThanThousand(thousands) + ' Thousand' + 
                   (remainder !== 0 ? ' ' + convertLessThanThousand(remainder) : '');
        }
        
        if (n < 10000000) {
            const lakhs = Math.floor(n / 100000);
            const remainder = n % 100000;
            return convertLessThanThousand(lakhs) + ' Lakh' + 
                   (remainder !== 0 ? ' ' + convertToWords(remainder) : '');
        }
        
        const crores = Math.floor(n / 10000000);
        const remainder = n % 10000000;
        return convertLessThanThousand(crores) + ' Crore' + 
               (remainder !== 0 ? ' ' + convertToWords(remainder) : '');
    }
    
    let result = convertToWords(rupees);
    
    if (paise > 0) {
        result += ' and ' + convertToWords(paise) + ' Paise';
    }
    
    return result;
}

// Function to download PDF for existing bills
function downloadBillPDF(billId) {
    const bill = bills.find(b => b.id === billId);
    if (bill) {
        generateBillPDF(bill);
    } else {
        alert('Bill not found!');
    }
}
