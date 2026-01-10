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

    // Setup mobile-friendly table scrolling
    setupMobileTableScroll();
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
    } else if (viewName === 'settings') {
        if (!isOwner()) {
            alert('Access Denied: Settings are only available to the Owner.');
            switchView('inventory');
            return;
        }
        loadSettings();
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

// Make functions available globally (moved to end of file after all functions are defined)

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
        console.error('Full error details:', error.message, error.stack);

        // Show more helpful error message
        const errorMsg = error.message.includes('Failed to fetch')
            ? 'Cannot connect to server. Please check if the backend is running.'
            : `Failed to load inventory: ${error.message}`;

        alert(errorMsg + '\n\nPlease check the browser console for more details.');

        // Initialize with empty inventory to prevent app crash
        inventory = [];
        renderInventory();
    }
}

function renderInventory() {
    const tbody = document.getElementById('inventory-tbody');
    tbody.innerHTML = '';
    const userRole = getCurrentUser()?.role;

    inventory.forEach((item) => {
        const row = document.createElement('tr');
        const stockStatus = item.quantity < 5 ? 'badge-danger' : item.quantity < 20 ? 'badge-warning' : 'badge-success';

        // Ensure price and gst are numbers (convert from string if needed)
        const price = parseFloat(item.price) || 0;
        const gst = parseFloat(item.gst) || 0;

        // Calculate taxed price (price + GST)
        const taxedPrice = price + (price * gst / 100);

        // Show actions only for owner
        const actionsHtml = userRole === 'owner' ? `
            <td>
                <button class="action-btn" onclick="showAddStockModal(${item.id})">+ Stock</button>
                <button class="action-btn" onclick="showRemoveStockModal(${item.id})">- Stock</button>
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
            <td>₹${price.toFixed(2)}</td>
            <td>${gst}%</td>
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

// Global variable to track if we're editing
let editingItemId = null;

function showAddItemModal() {
    if (!checkOwnerPermission()) return;
    editingItemId = null; // Reset editing mode
    document.getElementById('add-item-form').reset();

    // Update modal title if element exists
    const modalTitle = document.querySelector('#add-item-modal h2');
    if (modalTitle) {
        modalTitle.textContent = 'Add New Product';
    }

    document.getElementById('add-item-modal').classList.add('active');
}

function closeModal() {
    document.getElementById('add-item-modal').classList.remove('active');
    document.getElementById('add-item-form').reset();
    editingItemId = null;
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

// Remove Stock Management
function showRemoveStockModal(itemId) {
    if (!checkOwnerPermission()) return;

    const item = inventory.find(i => i.id === itemId);
    if (!item) return;

    if (item.quantity === 0) {
        alert('Cannot remove stock. Current stock is already 0.');
        return;
    }

    document.getElementById('remove-stock-item-id').value = itemId;
    document.getElementById('remove-stock-item-name').textContent = `${item.name} (${item.size} ${item.unit})`;
    document.getElementById('remove-stock-item-current').textContent = item.quantity;
    document.getElementById('remove-stock-modal').classList.add('active');
}

function closeRemoveStockModal() {
    document.getElementById('remove-stock-modal').classList.remove('active');
    document.getElementById('remove-stock-form').reset();
}

async function removeStockSubmit(event) {
    event.preventDefault();

    const itemId = parseInt(document.getElementById('remove-stock-item-id').value);
    const quantityToRemove = parseInt(document.getElementById('remove-stock-quantity').value);
    const reason = document.getElementById('remove-stock-reason').value;

    const item = inventory.find(i => i.id === itemId);
    if (!item) return;

    if (quantityToRemove > item.quantity) {
        alert(`Cannot remove ${quantityToRemove} units. Only ${item.quantity} units available in stock.`);
        return;
    }

    try {
        // Update quantity
        const oldQuantity = item.quantity;
        item.quantity -= quantityToRemove;

        // Save to database
        await APIService.updateInventoryItem(itemId, { quantity: item.quantity });

        // Update local state
        await loadInventory();

        closeRemoveStockModal();
        alert(`Successfully removed ${quantityToRemove} units from ${item.name}.\nReason: ${reason}\nOld Stock: ${oldQuantity}\nNew Stock: ${item.quantity}`);
    } catch (error) {
        console.error('Error removing stock:', error);
        alert('Failed to remove stock. Please try again.');
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
        price: parseFloat(document.getElementById('product-price').value),
        gst: parseFloat(document.getElementById('product-gst').value)
    };

    try {
        if (editingItemId) {
            // Update existing item
            const existingItem = inventory.find(i => i.id === editingItemId);
            if (existingItem) {
                // Keep existing quantity and minStock when editing
                item.quantity = existingItem.quantity;
                item.minStock = existingItem.minStock;
            }
            await APIService.updateInventoryItem(editingItemId, item);
            await loadInventory();
            closeModal();
            alert('Product updated successfully!');
        } else {
            // Add new item
            item.quantity = 0;
            item.minStock = 0;
            await APIService.addInventoryItem(item);
            await loadInventory();
            closeModal();
            alert('Product added successfully!');
        }
    } catch (error) {
        console.error('Error saving item:', error);
        alert('Failed to save product. Please try again.');
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

    editingItemId = id; // Set editing mode

    document.getElementById('product-name').value = item.name;
    document.getElementById('product-description').value = item.description || '';
    document.getElementById('product-hsn').value = item.hsn || '';
    document.getElementById('product-size').value = item.size || '';
    document.getElementById('product-colour').value = item.colour || '';
    document.getElementById('product-unit').value = item.unit || '';
    document.getElementById('product-price').value = item.price;
    document.getElementById('product-gst').value = item.gst || 18;

    // Update modal title if element exists
    const modalTitle = document.querySelector('#add-item-modal h2');
    if (modalTitle) {
        modalTitle.textContent = 'Edit Product';
    }

    document.getElementById('add-item-modal').classList.add('active');
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
        productSelect.addEventListener('change', function () {
            const productId = parseInt(this.value);
            if (productId) {
                const product = inventory.find(p => p.id === productId);
                if (product) {
                    const price = parseFloat(product.price) || 0;
                    document.getElementById('item-rate').value = price.toFixed(2);
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

    // Initialize payment tracking based on payment status
    let paymentTracking = {
        totalAmount: total,
        amountPaid: 0,
        amountPending: total,
        payments: []
    };

    if (paymentStatus === 'paid') {
        paymentTracking = {
            totalAmount: total,
            amountPaid: total,
            amountPending: 0,
            payments: [{
                amount: total,
                date: new Date().toISOString(),
                note: 'Paid at time of billing'
            }]
        };
    }

    // Save or update customer
    const customerData = {
        name: customerName,
        phone: customerPhone || null,
        gst: customerGst || null,
        address: customerAddress || null,
        state: customerState
    };

    try {
        await saveOrUpdateCustomer(customerData);
    } catch (error) {
        console.error('Error saving customer:', error);
        // Continue even if customer save fails
    }

    const bill = {
        customer: customerData,
        items: itemsWithGST,
        subtotal,
        gstBreakdown,
        totalGST,
        total,
        paymentStatus: paymentStatus,
        paymentTracking: paymentTracking
    };

    console.log('Creating bill with data:', JSON.stringify(bill, null, 2));

    try {
        // Update inventory quantities in database
        for (const billItem of currentBillItems) {
            const invItem = inventory.find(i => i.id === billItem.id);
            if (invItem) {
                const newQuantity = invItem.quantity - billItem.quantity;
                if (newQuantity < 0) {
                    alert(`Error: Not enough stock for ${invItem.name}. Available: ${invItem.quantity}, Required: ${billItem.quantity}`);
                    return;
                }
                invItem.quantity = newQuantity;
                await APIService.updateInventoryItem(invItem.id, { quantity: newQuantity });
            }
        }

        // Save bill to database
        console.log('Sending bill to API...');
        const savedBill = await APIService.addBill(bill);
        console.log('✅ Bill saved successfully:', savedBill);

        // Reload data to get fresh bills list
        await loadInventory();
        await loadBills();

        // Find the bill in the reloaded bills array
        const reloadedBill = bills.find(b => b.id == savedBill.id);

        // Use the reloaded bill if found, otherwise use saved bill
        const billForPDF = reloadedBill || savedBill;

        console.log('Generating PDF for bill:', billForPDF);

        // Generate PDF with normalized bill
        generateBillPDF(billForPDF);

        // Check for low stock after sale
        const lowStockWarnings = [];
        currentBillItems.forEach(billItem => {
            const invItem = inventory.find(i => i.id === billItem.id);
            if (invItem && invItem.quantity < 5) {
                lowStockWarnings.push(`${invItem.name}: ${invItem.quantity} ${invItem.unit} remaining`);
            }
        });

        let alertMessage = `✅ Bill #${savedBill.id} generated successfully!\n\nTotal Amount: ₹${total.toFixed(2)}\nPayment Status: ${paymentStatus.toUpperCase()}\n\nPDF invoice has been downloaded!`;

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
        console.error('❌ Error generating bill:', error);
        console.error('Error details:', error.message);
        console.error('Stack trace:', error.stack);
        alert('Failed to generate bill. Please try again.\n\nError: ' + error.message);
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

    searchInput.addEventListener('input', function () {
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

    searchInput.addEventListener('change', function () {
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
        console.log(`✅ Loaded ${purchases.length} purchases`);
        console.log('Purchases data:', purchases);

        // Log each purchase structure
        purchases.forEach(purchase => {
            console.log(`Purchase #${purchase.id}:`, {
                id: purchase.id,
                hasSupplier: !!purchase.supplier,
                hasItems: !!purchase.items,
                itemsCount: purchase.items?.length || 0,
                supplier: purchase.supplier,
                items: purchase.items
            });
        });
    } catch (error) {
        console.error('Error loading purchases:', error);
        purchases = [];
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
            newSearchInput.addEventListener('input', function () {
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
            newSearchInput.addEventListener('change', function () {
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

function updatePurchaseItemSNos() {
    const rows = document.querySelectorAll('#purchase-items-container .purchase-item-row');
    rows.forEach((row, index) => {
        const snoSpan = row.querySelector('.item-sno');
        if (snoSpan) {
            snoSpan.textContent = `${index + 1}.`;
        }
    });
}

function addPurchaseItemRow() {
    const container = document.getElementById('purchase-items-container');
    const newRow = document.createElement('div');
    newRow.className = 'purchase-item-row';
    newRow.innerHTML = `
        <span class="item-sno" style="padding: 0.5rem; font-weight: bold; min-width: 30px; display: inline-flex; align-items: center;"></span>
        <select class="purchase-product" required>
            <option value="">Select Product</option>
        </select>
        <input type="number" class="purchase-qty" placeholder="Quantity" min="1" required>
        <input type="number" class="purchase-rate" placeholder="Rate (₹)" step="0.01" min="0" required>
        <button type="button" class="btn btn-secondary" onclick="removePurchaseItemRow(this)">−</button>
    `;
    container.appendChild(newRow);
    updatePurchaseProductSelects();
    updatePurchaseItemSNos();
}

function removePurchaseItemRow(button) {
    button.parentElement.remove();
    updatePurchaseItemSNos();
}

async function addPurchase(event) {
    event.preventDefault();

    const supplierName = document.getElementById('purchase-supplier-name').value;
    const supplierPhone = document.getElementById('purchase-supplier-phone').value;
    const supplierGst = document.getElementById('purchase-supplier-gst').value;
    const invoiceNo = document.getElementById('purchase-invoice').value;
    const purchaseDate = document.getElementById('purchase-date').value;
    const paymentStatus = document.getElementById('purchase-payment-status').value;

    // Validate only supplier name
    if (!supplierName || supplierName.trim() === '') {
        alert('Please enter Supplier Name');
        return;
    }

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
                // Ensure gst is a number
                const gst = parseFloat(product.gst) || 0;
                const amount = quantity * rate;
                const gstAmount = (amount * gst) / 100;

                items.push({
                    id: productId,
                    name: product.name || 'Unknown',
                    size: product.size || '',
                    unit: product.unit || 'pcs',
                    quantity: quantity,
                    rate: rate,
                    amount: amount,
                    gst: gst,
                    gstAmount: gstAmount,
                    total: amount + gstAmount
                });

                subtotal += amount;
                totalGST += gstAmount;

                // Update inventory stock
                const oldQuantity = parseInt(product.quantity) || 0;
                const newQuantity = oldQuantity + quantity;

                // Track stock update for notification
                stockUpdates.push({
                    name: product.name || 'Unknown',
                    added: quantity,
                    oldStock: oldQuantity,
                    newStock: newQuantity,
                    unit: product.unit || 'pcs'
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
        phone: supplierPhone || null,
        gst: supplierGst || null
    });

    // Generate invoice number if empty
    const finalInvoiceNo = invoiceNo || `INV-${Date.now()}`;

    // Use today's date if not provided
    const finalPurchaseDate = purchaseDate || new Date().toISOString().split('T')[0];

    try {
        // Create purchase via API (ID will be auto-generated by database)
        // Helper to convert file to base64
        const fileToBase64 = (file) => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });

        let billImage = null;
        const fileInput = document.getElementById('purchase-bill-image');
        if (fileInput && fileInput.files.length > 0) {
            try {
                billImage = await fileToBase64(fileInput.files[0]);
            } catch (err) {
                console.error('Error converting file to base64:', err);
                alert('Error reading the bill image file.');
                return;
            }
        }

        const purchaseData = {
            supplier: {
                name: supplierName,
                phone: supplierPhone || null,
                gst: supplierGst || null
            },
            invoiceNo: finalInvoiceNo,
            purchaseDate: finalPurchaseDate,
            items: items,
            subtotal: subtotal,
            totalGST: totalGST,
            total: total,
            paymentStatus: paymentStatus || 'pending',
            paymentTracking: null,  // Explicitly set to null
            billImage: billImage
        };

        console.log('Sending purchase items:', items);
        console.log('Items length:', items.length);

        console.log('Sending purchase data:', JSON.stringify(purchaseData, null, 2));

        const newPurchase = await APIService.addPurchase(purchaseData);

        // Update inventory for each item
        try {
            for (const item of items) {
                const product = inventory.find(p => p.id === item.id);
                if (product) {
                    product.quantity += item.quantity;
                    await APIService.updateInventoryItem(product.id, { quantity: product.quantity });
                }
            }
        } catch (stockError) {
            console.error('Error updating stock quantities:', stockError);
            alert('Purchase added, but failed to update stock quantities automatically. Please check inventory.');
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

        // Switch to purchases view to show the new purchase
        switchView('purchases');

        // Render updated data
        renderPurchases();
        renderInventory();
        updateProductSelect();
    } catch (error) {
        console.error('Error adding purchase:', error);
        console.error('Error details:', error.message);
        console.error('Purchase data:', {
            supplier: { name: supplierName, phone: supplierPhone, gst: supplierGst },
            invoiceNo, purchaseDate, items, subtotal, totalGST, total, paymentStatus
        });
        alert('Failed to add purchase. Please try again.\n\nError: ' + error.message);
    }
}

// This duplicate function is removed - using the async version above

function renderPurchases() {
    const tbody = document.getElementById('purchases-tbody');
    tbody.innerHTML = '';

    console.log('📦 Rendering purchases:', purchases);

    if (purchases.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 2rem; color: var(--text-secondary);">📦 No purchase records found. Click "Add Purchase" to get started!</td></tr>';
        return;
    }

    purchases.slice().reverse().forEach(purchase => {
        console.log('Purchase data:', purchase);

        // Normalize purchase format - handle both old and new formats
        const supplier = purchase.supplier || {
            name: purchase.supplierName,
            phone: purchase.supplierPhone,
            gst: purchase.supplierGst
        };

        const items = Array.isArray(purchase.items) ? purchase.items : [];

        const row = document.createElement('tr');
        const date = new Date(purchase.purchaseDate).toLocaleDateString('en-IN');
        const itemCount = items.length;

        console.log('Purchase items count:', itemCount);

        let statusBadge = '';
        const paymentStatus = purchase.paymentStatus || 'paid';
        if (paymentStatus === 'paid') {
            statusBadge = '<span class="badge badge-success">✅ Paid</span>';
        } else if (paymentStatus === 'pending') {
            statusBadge = '<span class="badge badge-danger">⏳ Pending</span>';
        } else {
            statusBadge = '<span class="badge badge-warning">💰 Partial</span>';
        }

        row.innerHTML = `
            <td><strong>#${purchase.id}</strong></td>
            <td>${date}</td>
            <td>${supplier.name}</td>
            <td>${purchase.invoiceNo || '-'}</td>
            <td>₹${(purchase.subtotal || 0).toFixed(2)}</td>
            <td>₹${(purchase.totalGST || 0).toFixed(2)}</td>
            <td><strong>₹${(purchase.total || 0).toFixed(2)}</strong></td>
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
                ${purchase.billImage ? `
                <div style="margin-top: 1rem; text-align: right;">
                    <button class="action-btn" onclick="const win = window.open(); win.document.write('<img src=\\'${purchase.billImage}\\' style=\\'max-width:100%;\\'>');" style="background: var(--primary); color: white;">
                        📄 View Bill Document
                    </button>
                </div>` : ''}
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
        // Format date to YYYY-MM-DD for MySQL
        const formattedDate = new Date(purchase.purchaseDate).toISOString().split('T')[0];

        await APIService.updatePurchase(purchase.id, {
            ...purchase,
            purchaseDate: formattedDate,
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
        // Format date to YYYY-MM-DD for MySQL
        const formattedDate = new Date(purchase.purchaseDate).toISOString().split('T')[0];

        await APIService.updatePurchase(purchase.id, {
            ...purchase,
            purchaseDate: formattedDate,
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
        const totalAmount = supplierPurchases.reduce((sum, p) => sum + (parseFloat(p.total) || 0), 0);
        const paidAmount = supplierPurchases
            .filter(p => p.paymentStatus === 'paid')
            .reduce((sum, p) => sum + (parseFloat(p.total) || 0), 0);
        const pendingAmount = supplierPurchases
            .filter(p => p.paymentStatus === 'pending')
            .reduce((sum, p) => sum + (parseFloat(p.total) || 0), 0);
        const partialAmount = supplierPurchases
            .filter(p => p.paymentStatus === 'partial')
            .reduce((sum, p) => sum + (parseFloat(p.total) || 0), 0);

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
            <td onclick="downloadSupplierReportPDF('${data.supplier.name.replace(/'/g, "\\'")}')" style="cursor: pointer; color: var(--primary); text-decoration: underline;">
                <strong>${data.supplier.name}</strong>
            </td>
            <td>${data.supplier.phone || '-'}</td>
            <td>${data.supplier.gst || '-'}</td>
            <td>${data.totalPurchases}</td>
            <td>₹${data.totalAmount.toFixed(2)}</td>
            <td>₹${data.paidAmount.toFixed(2)}</td>
            <td>₹${data.outstandingAmount.toFixed(2)}</td>
            <td>${paymentStatus}</td>
            <td>${data.lastPurchase}</td>
            <td>
                <button class="action-btn" onclick="viewSupplierDetails('${data.supplier.name.replace(/'/g, "\\'")}')">View</button>
                <button class="action-btn" onclick="editSupplier(${data.supplier.id})">Edit</button>
                <button class="action-btn delete" onclick="deleteSupplier(${data.supplier.id}, '${data.supplier.name.replace(/'/g, "\\'")}')">Delete</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

async function downloadSupplierReportPDF(supplierName) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Find supplier data
    const supplier = suppliers.find(s => s.name === supplierName);
    if (!supplier) {
        alert('Supplier data not found');
        return;
    }

    // Get supplier's purchase history
    const supplierPurchases = purchases.filter(p =>
        p.supplier.name.toLowerCase() === supplierName.toLowerCase() ||
        (p.supplier.phone && supplier.phone && p.supplier.phone === supplier.phone)
    );

    // Calculate totals
    const totalPurchases = supplierPurchases.length;
    const totalAmount = supplierPurchases.reduce((sum, p) => sum + (parseFloat(p.total) || 0), 0);
    const paidAmount = supplierPurchases
        .filter(p => p.paymentStatus === 'paid')
        .reduce((sum, p) => sum + (parseFloat(p.total) || 0), 0);
    const pendingAmount = supplierPurchases
        .filter(p => p.paymentStatus === 'pending')
        .reduce((sum, p) => sum + (parseFloat(p.total) || 0), 0);

    // --- PDF GENERATION ---

    // 1. Header Section
    doc.setFillColor(41, 128, 185); // Primary Color (Blue)
    doc.rect(0, 0, 210, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("PLASTIWOOD", 105, 15, { align: "center" });

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("Supplier Account Statement", 105, 25, { align: "center" });

    doc.setFontSize(10);
    doc.text(`Report Date: ${new Date().toLocaleDateString('en-IN')}`, 105, 33, { align: "center" });

    // 2. Supplier Details Section
    doc.setTextColor(44, 62, 80); // Dark text
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Supplier Profile", 14, 50);

    doc.setDrawColor(200, 200, 200);
    doc.line(14, 52, 196, 52);

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");

    // Left Column
    doc.text(`Name:`, 14, 60);
    doc.text(`Phone:`, 14, 66);
    doc.text(`GST No:`, 14, 72);

    doc.setFont("helvetica", "normal");
    doc.text(`${supplier.name}`, 40, 60);
    doc.text(`${supplier.phone || 'N/A'}`, 40, 66);
    doc.text(`${supplier.gst || 'N/A'}`, 40, 72);

    // Right Column (Summary)
    doc.setFont("helvetica", "bold");
    doc.text(`Total Orders:`, 120, 60);
    doc.text(`Total Business:`, 120, 66);
    doc.text(`Outstanding:`, 120, 72);

    doc.setFont("helvetica", "normal");
    doc.text(`${totalPurchases}`, 160, 60);
    doc.text(`Rs. ${totalAmount.toFixed(2)}`, 160, 66);

    // Color code outstanding
    if (pendingAmount > 0) {
        doc.setTextColor(231, 76, 60); // Red
    } else {
        doc.setTextColor(39, 174, 96); // Green
    }
    doc.text(`Rs. ${pendingAmount.toFixed(2)}`, 160, 72);
    doc.setTextColor(44, 62, 80); // Reset color

    // 3. Transactions Table
    doc.autoTable({
        startY: 85,
        head: [['S.No', 'Date', 'Invoice No', 'Items', 'Total (Rs.)', 'Payment Status']],
        body: supplierPurchases.map((p, index) => [
            index + 1,
            new Date(p.purchaseDate).toLocaleDateString('en-IN'),
            p.invoiceNo || '-',
            Array.isArray(p.items) ? p.items.length : 0,
            p.total.toFixed(2),
            p.paymentStatus.toUpperCase()
        ]),
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 3 },
        alternateRowStyles: { fillColor: [240, 248, 255] }
    });

    // 4. Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Page ${i} of ${pageCount} - Generated by Plastiwood System`, 105, 290, { align: "center" });
    }

    // Save PDF
    doc.save(`Supplier_Report_${supplier.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
}

function viewSupplierDetails(supplierName) {
    const supplier = suppliers.find(s => s.name === supplierName);
    if (!supplier) return;

    const supplierPurchases = purchases.filter(p =>
        p.supplier.name.toLowerCase() === supplier.name.toLowerCase() ||
        (p.supplier.phone && supplier.phone && p.supplier.phone === supplier.phone)
    );

    const totalPurchases = supplierPurchases.length;
    const totalAmount = supplierPurchases.reduce((sum, p) => sum + (parseFloat(p.total) || 0), 0);
    const paidAmount = supplierPurchases.filter(p => p.paymentStatus === 'paid').reduce((sum, p) => sum + (parseFloat(p.total) || 0), 0);
    const pendingAmount = supplierPurchases.filter(p => p.paymentStatus === 'pending').reduce((sum, p) => sum + (parseFloat(p.total) || 0), 0);
    const partialAmount = supplierPurchases.filter(p => p.paymentStatus === 'partial').reduce((sum, p) => sum + (parseFloat(p.total) || 0), 0);
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

// Edit Supplier
function editSupplier(supplierId) {
    const supplier = suppliers.find(s => s.id === supplierId);
    if (!supplier) {
        alert('Supplier not found');
        return;
    }

    const newName = prompt('Enter Supplier Name:', supplier.name);
    if (newName === null) return; // User cancelled

    if (!newName || newName.trim() === '') {
        alert('Supplier name cannot be empty');
        return;
    }

    const newPhone = prompt('Enter Phone Number:', supplier.phone || '');
    const newGst = prompt('Enter GST Number:', supplier.gst || '');

    const updatedSupplier = {
        name: newName.trim(),
        phone: newPhone ? newPhone.trim() : null,
        gst: newGst ? newGst.trim() : null
    };

    APIService.updateSupplier(supplierId, updatedSupplier)
        .then(() => {
            alert('Supplier updated successfully!');
            loadSuppliers().then(() => {
                renderSupplierReports();
            });
        })
        .catch(error => {
            console.error('Error updating supplier:', error);
            alert('Failed to update supplier. Please try again.');
        });
}

// Delete Supplier
async function deleteSupplier(supplierId, supplierName) {
    // Check if supplier has any purchases
    const supplierPurchases = purchases.filter(p =>
        p.supplier.name.toLowerCase() === supplierName.toLowerCase()
    );

    if (supplierPurchases.length > 0) {
        const confirmMsg = `⚠️ Warning: ${supplierName} has ${supplierPurchases.length} purchase(s) in the system.\n\nDeleting this supplier will NOT delete the purchase records, but the supplier information will be removed.\n\nAre you sure you want to delete this supplier?`;

        if (!confirm(confirmMsg)) return;
    } else {
        if (!confirm(`Are you sure you want to delete supplier "${supplierName}"?`)) return;
    }

    try {
        await APIService.deleteSupplier(supplierId);
        alert('Supplier deleted successfully!');
        await loadSuppliers();
        renderSupplierReports();
    } catch (error) {
        console.error('Error deleting supplier:', error);
        alert('Failed to delete supplier. Please try again.');
    }
}

// Bill IDs are now auto-generated by the database

// Reports
async function loadBills() {
    try {
        bills = await APIService.getBills();
        console.log(`✅ Loaded ${bills.length} bills`);
        console.log('Bills data:', bills);

        // Log each bill's structure
        bills.forEach(bill => {
            console.log(`Bill #${bill.id}:`, {
                id: bill.id,
                hasCustomer: !!bill.customer,
                hasItems: !!bill.items,
                itemsCount: bill.items?.length || 0,
                customer: bill.customer,
                items: bill.items
            });
        });
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
    console.log(`🔄 Rendering sales table with ${bills.length} bills`);
    const tbody = document.getElementById('sales-tbody');

    // Reset listener flag before clearing content
    if (tbody) {
        tbody.dataset.listenerAttached = 'false';
    }

    tbody.innerHTML = '';

    if (bills.length === 0) {
        tbody.innerHTML = '<tr><td colspan="12" style="text-align: center; padding: 2rem;">No sales records found</td></tr>';
        return;
    }

    bills.slice().reverse().forEach(bill => {
        console.log('Bill data:', bill);
        console.log('Bill items:', bill.items);
        console.log('Items type:', typeof bill.items, 'Is array:', Array.isArray(bill.items));

        // Normalize bill format - handle both old and new formats
        const customer = bill.customer || {
            name: bill.customerName,
            phone: bill.customerPhone,
            gst: bill.customerGst,
            address: bill.customerAddress,
            state: bill.customerState
        };

        const row = document.createElement('tr');
        const date = new Date(bill.createdAt).toLocaleDateString('en-IN');
        const time = new Date(bill.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

        // Ensure items is an array
        const items = Array.isArray(bill.items) ? bill.items : [];
        const itemCount = items.length;
        console.log('Item count:', itemCount);

        const stateText = customer.state === 'same' ? 'Same State' : 'Other State';

        // Create payment status dropdown
        const paymentStatus = bill.paymentStatus || 'paid';
        const paymentDropdown = `
            <select class="payment-status-select" data-bill-id="${bill.id}" onchange="quickUpdatePaymentStatus(${bill.id}, this.value)" style="padding: 0.5rem; border-radius: 5px; border: 2px solid ${paymentStatus === 'paid' ? '#28a745' : paymentStatus === 'pending' ? '#dc3545' : '#ffc107'}; background: ${paymentStatus === 'paid' ? '#d4edda' : paymentStatus === 'pending' ? '#f8d7da' : '#fff3cd'}; color: ${paymentStatus === 'paid' ? '#155724' : paymentStatus === 'pending' ? '#721c24' : '#856404'}; font-weight: 600; cursor: pointer;">
                <option value="paid" ${paymentStatus === 'paid' ? 'selected' : ''}>✅ Paid</option>
                <option value="pending" ${paymentStatus === 'pending' ? 'selected' : ''}>⏳ Pending</option>
                <option value="partial" ${paymentStatus === 'partial' ? 'selected' : ''}>💰 Partial</option>
            </select>
        `;

        row.innerHTML = `
            <td><strong>#${bill.id}</strong></td>
            <td>${date}<br><small>${time}</small></td>
            <td>${customer.name}</td>
            <td>${customer.phone || '-'}</td>
            <td>${customer.gst || '-'}</td>
            <td>${stateText}</td>
            <td>${itemCount} item${itemCount > 1 ? 's' : ''}</td>
            <td>₹${(bill.subtotal || 0).toFixed(2)}</td>
            <td>₹${(bill.totalGST || 0).toFixed(2)}</td>
            <td><strong>₹${(bill.total || 0).toFixed(2)}</strong></td>
            <td>${paymentDropdown}</td>
            <td class="actions-cell">
                <button class="action-btn action-btn-sm btn-view" data-bill-id="${bill.id}" title="View Details">👁️</button>
                <button class="action-btn action-btn-sm delete btn-delete" data-bill-id="${bill.id}" title="Delete">🗑️</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    updateSalesSummary();

    // Setup event listeners after rendering
    setupSalesTableActions();
}

// Setup event delegation for sales table action buttons
function setupSalesTableActions() {
    console.log('🔧 Setting up sales table actions...');

    // Remove existing listener if any
    const salesTbody = document.getElementById('sales-tbody');
    if (!salesTbody) {
        console.warn('Sales tbody not found, will retry...');
        return;
    }

    // Use event delegation on the tbody directly (more reliable)
    // Remove the data attribute to prevent duplicate listeners
    if (salesTbody.dataset.listenerAttached === 'true') {
        console.log('Listener already attached, skipping...');
        return;
    }

    // Add event listener to tbody
    salesTbody.addEventListener('click', (e) => {
        console.log('Sales table clicked:', e.target);

        // Find the button (might be the target or a parent)
        let target = e.target;

        // If clicked on emoji/text inside button, get the button
        if (!target.classList.contains('action-btn')) {
            target = target.closest('.action-btn');
        }

        if (!target || !target.classList.contains('action-btn')) {
            console.log('Not an action button');
            return;
        }

        const billId = parseInt(target.dataset.billId);
        console.log('Button clicked, billId:', billId, 'Button classes:', target.className);

        if (!billId) {
            console.error('No billId found on button');
            return;
        }

        // Prevent multiple clicks
        if (target.disabled) {
            console.log('Button already processing...');
            return;
        }

        if (target.classList.contains('btn-view')) {
            console.log('View button clicked for bill:', billId);
            viewBillDetailsModal(billId);
        } else if (target.classList.contains('btn-delete')) {
            console.log('Delete button clicked for bill:', billId);
            deleteBill(billId);
        }
    });

    // Mark as attached
    salesTbody.dataset.listenerAttached = 'true';

    console.log('✅ Sales table actions setup complete');
}

// Simple function to update payment status from dropdown
async function quickUpdatePaymentStatus(billId, newStatus) {
    console.log(`Updating bill #${billId} to status: ${newStatus}`);

    const bill = bills.find(b => b.id == billId);
    if (!bill) {
        alert('Bill not found!');
        return;
    }

    // If partial payment is selected, show payment details card
    if (newStatus === 'partial') {
        showPartialPaymentCard(billId, bill);
        return;
    }

    // Show loading state
    const dropdown = document.querySelector(`select[data-bill-id="${billId}"]`);
    if (dropdown) {
        dropdown.disabled = true;
        dropdown.style.opacity = '0.6';
    }

    try {
        // Normalize bill data
        const customer = bill.customer || {
            name: bill.customerName,
            phone: bill.customerPhone,
            gst: bill.customerGst,
            address: bill.customerAddress,
            state: bill.customerState
        };

        // Initialize payment tracking
        let paymentTracking = bill.paymentTracking || {
            totalAmount: bill.total || 0,
            amountPaid: 0,
            amountPending: bill.total || 0,
            payments: []
        };

        // Update payment tracking based on status
        if (newStatus === 'paid') {
            paymentTracking = {
                totalAmount: bill.total,
                amountPaid: bill.total,
                amountPending: 0,
                payments: [{
                    amount: bill.total,
                    date: new Date().toISOString(),
                    note: 'Marked as paid'
                }]
            };
        } else if (newStatus === 'pending') {
            paymentTracking = {
                totalAmount: bill.total,
                amountPaid: 0,
                amountPending: bill.total,
                payments: []
            };
        }

        // Prepare update data
        const updateData = {
            customer: {
                name: customer.name,
                phone: customer.phone || null,
                gst: customer.gst || null,
                address: customer.address || null,
                state: customer.state || null
            },
            items: Array.isArray(bill.items) ? bill.items.map(item => ({
                id: item.id,
                name: item.name || '',
                size: item.size || '',
                unit: item.unit || '',
                quantity: parseFloat(item.quantity) || 0,
                price: parseFloat(item.price) || 0,
                amount: parseFloat(item.amount) || 0,
                gst: parseFloat(item.gst) || 0,
                gstAmount: parseFloat(item.gstAmount) || 0,
                total: parseFloat(item.total) || 0
            })) : [],
            subtotal: parseFloat(bill.subtotal) || 0,
            gstBreakdown: bill.gstBreakdown || {},
            totalGST: parseFloat(bill.totalGST) || 0,
            total: parseFloat(bill.total) || 0,
            paymentStatus: newStatus,
            paymentTracking: paymentTracking
        };

        // Update via API
        await APIService.updateBill(billId, updateData);

        // Reload bills and re-render
        await loadBills();
        renderSales();

        // Show success message
        const statusLabels = {
            'paid': '✅ Paid',
            'pending': '⏳ Pending'
        };
        alert(`Payment status updated to: ${statusLabels[newStatus]}`);

    } catch (error) {
        console.error('Error updating payment status:', error);
        alert('Failed to update payment status. Please try again.');

        // Reload to reset the dropdown
        await loadBills();
        renderSales();
    }
}

// Show partial payment card
function showPartialPaymentCard(billId, bill) {
    // Remove any existing card
    const existingCard = document.getElementById('partial-payment-card');
    if (existingCard) {
        existingCard.remove();
    }

    // Initialize payment tracking if not exists
    const paymentTracking = bill.paymentTracking || {
        totalAmount: bill.total || 0,
        amountPaid: 0,
        amountPending: bill.total || 0,
        payments: []
    };

    // Create the card
    const card = document.createElement('div');
    card.id = 'partial-payment-card';
    card.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 2rem;
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        z-index: 10000;
        min-width: 400px;
        max-width: 90%;
    `;

    card.innerHTML = `
        <h3 style="margin: 0 0 1.5rem 0; color: #667eea;">💰 Partial Payment - Bill #${billId}</h3>
        
        <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                <span style="font-weight: 600;">Total Amount:</span>
                <span style="font-size: 1.1rem; font-weight: 700;">₹${paymentTracking.totalAmount.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                <span style="color: #28a745;">Already Paid:</span>
                <span style="color: #28a745; font-weight: 600;">₹${paymentTracking.amountPaid.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding-top: 0.5rem; border-top: 2px solid #dee2e6;">
                <span style="color: #dc3545; font-weight: 600;">Remaining:</span>
                <span style="color: #dc3545; font-size: 1.2rem; font-weight: 700;">₹${paymentTracking.amountPending.toFixed(2)}</span>
            </div>
        </div>
        
        <div style="margin-bottom: 1.5rem;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #333;">
                Amount Received Now:
            </label>
            <input 
                type="number" 
                id="partial-amount-input-${billId}" 
                placeholder="Enter amount received" 
                step="0.01" 
                min="0.01" 
                max="${paymentTracking.amountPending}"
                style="width: 100%; padding: 0.75rem; border: 2px solid #667eea; border-radius: 8px; font-size: 1rem;"
                oninput="updatePartialPaymentPreview(${billId})"
            >
        </div>
        
        <div id="payment-preview-${billId}" style="background: #e7f3ff; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; display: none;">
            <div style="display: flex; justify-content: space-between;">
                <span style="font-weight: 600;">New Remaining:</span>
                <span id="new-remaining-${billId}" style="font-size: 1.1rem; font-weight: 700; color: #0066cc;">₹0.00</span>
            </div>
        </div>
        
        <div style="display: flex; gap: 1rem;">
            <button 
                onclick="confirmPartialPaymentUpdate(${billId})"
                style="flex: 1; padding: 0.875rem; background: #28a745; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 1rem;"
            >
                ✅ Confirm Payment
            </button>
            <button 
                onclick="closePartialPaymentCard(${billId})"
                style="flex: 1; padding: 0.875rem; background: #6c757d; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 1rem;"
            >
                ❌ Cancel
            </button>
        </div>
    `;

    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'partial-payment-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        z-index: 9999;
    `;
    overlay.onclick = () => closePartialPaymentCard(billId);

    // Add to page
    document.body.appendChild(overlay);
    document.body.appendChild(card);

    // Focus on input
    setTimeout(() => {
        document.getElementById(`partial-amount-input-${billId}`).focus();
    }, 100);
}

// Update preview when amount changes
function updatePartialPaymentPreview(billId) {
    const bill = bills.find(b => b.id == billId);
    if (!bill) return;

    const paymentTracking = bill.paymentTracking || {
        totalAmount: bill.total || 0,
        amountPaid: 0,
        amountPending: bill.total || 0,
        payments: []
    };

    const input = document.getElementById(`partial-amount-input-${billId}`);
    const preview = document.getElementById(`payment-preview-${billId}`);
    const newRemainingSpan = document.getElementById(`new-remaining-${billId}`);

    const amountReceived = parseFloat(input.value) || 0;

    if (amountReceived > 0) {
        const newRemaining = paymentTracking.amountPending - amountReceived;
        newRemainingSpan.textContent = `₹${Math.max(0, newRemaining).toFixed(2)}`;
        preview.style.display = 'block';
    } else {
        preview.style.display = 'none';
    }
}

// Confirm partial payment
async function confirmPartialPaymentUpdate(billId) {
    const bill = bills.find(b => b.id == billId);
    if (!bill) {
        alert('Bill not found!');
        return;
    }

    const input = document.getElementById(`partial-amount-input-${billId}`);
    const amountReceived = parseFloat(input.value);

    if (!amountReceived || amountReceived <= 0) {
        alert('Please enter a valid amount received');
        input.focus();
        return;
    }

    const paymentTracking = bill.paymentTracking || {
        totalAmount: bill.total || 0,
        amountPaid: 0,
        amountPending: bill.total || 0,
        payments: []
    };

    if (amountReceived > paymentTracking.amountPending) {
        alert(`Amount cannot be more than remaining amount: ₹${paymentTracking.amountPending.toFixed(2)}`);
        input.focus();
        return;
    }

    // Disable button to prevent double-click
    event.target.disabled = true;
    event.target.textContent = 'Processing...';

    try {
        // Update payment tracking
        const newAmountPaid = paymentTracking.amountPaid + amountReceived;
        const newAmountPending = paymentTracking.amountPending - amountReceived;

        const updatedPaymentTracking = {
            totalAmount: paymentTracking.totalAmount,
            amountPaid: newAmountPaid,
            amountPending: newAmountPending,
            payments: [
                ...(paymentTracking.payments || []),
                {
                    amount: amountReceived,
                    date: new Date().toISOString(),
                    note: 'Partial payment received'
                }
            ]
        };

        // Determine final status
        const finalStatus = newAmountPending <= 0.01 ? 'paid' : 'partial';

        // Normalize bill data
        const customer = bill.customer || {
            name: bill.customerName,
            phone: bill.customerPhone,
            gst: bill.customerGst,
            address: bill.customerAddress,
            state: bill.customerState
        };

        // Prepare update data
        const updateData = {
            customer: {
                name: customer.name,
                phone: customer.phone || null,
                gst: customer.gst || null,
                address: customer.address || null,
                state: customer.state || null
            },
            items: Array.isArray(bill.items) ? bill.items.map(item => ({
                id: item.id,
                name: item.name || '',
                size: item.size || '',
                unit: item.unit || '',
                quantity: parseFloat(item.quantity) || 0,
                price: parseFloat(item.price) || 0,
                amount: parseFloat(item.amount) || 0,
                gst: parseFloat(item.gst) || 0,
                gstAmount: parseFloat(item.gstAmount) || 0,
                total: parseFloat(item.total) || 0
            })) : [],
            subtotal: parseFloat(bill.subtotal) || 0,
            gstBreakdown: bill.gstBreakdown || {},
            totalGST: parseFloat(bill.totalGST) || 0,
            total: parseFloat(bill.total) || 0,
            paymentStatus: finalStatus,
            paymentTracking: updatedPaymentTracking
        };

        // Update via API
        await APIService.updateBill(billId, updateData);

        // Close card
        closePartialPaymentCard(billId);

        // Reload bills and re-render
        await loadBills();
        renderSales();

        // Show success message
        if (finalStatus === 'paid') {
            alert(`✅ Payment completed!\n\nTotal Received: ₹${newAmountPaid.toFixed(2)}\nBill is now fully paid.`);
        } else {
            alert(`💰 Partial payment recorded!\n\nReceived: ₹${amountReceived.toFixed(2)}\nRemaining: ₹${newAmountPending.toFixed(2)}`);
        }

    } catch (error) {
        console.error('Error updating partial payment:', error);
        alert('Failed to update payment. Please try again.');
        event.target.disabled = false;
        event.target.textContent = '✅ Confirm Payment';
    }
}

// Close partial payment card
function closePartialPaymentCard(billId) {
    const card = document.getElementById('partial-payment-card');
    const overlay = document.getElementById('partial-payment-overlay');

    if (card) card.remove();
    if (overlay) overlay.remove();

    // Reset dropdown to current status
    const bill = bills.find(b => b.id == billId);
    if (bill) {
        const dropdown = document.querySelector(`select[data-bill-id="${billId}"]`);
        if (dropdown) {
            dropdown.value = bill.paymentStatus || 'paid';
        }
    }
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
    console.log('viewBillDetailsModal called with billId:', billId, 'type:', typeof billId);
    console.log('Available bills:', bills.map(b => ({ id: b.id, type: typeof b.id })));

    const bill = bills.find(b => b.id == billId); // Use == instead of === for type coercion

    if (!bill) {
        console.error('Bill not found with ID:', billId);
        alert('Bill not found!');
        return;
    }

    console.log('Found bill:', bill);
    console.log('Bill items:', bill.items);
    console.log('Bill items type:', typeof bill.items);
    console.log('Bill items is array:', Array.isArray(bill.items));

    // Normalize bill format - handle both old and new formats
    const customer = bill.customer || {
        name: bill.customerName,
        phone: bill.customerPhone,
        gst: bill.customerGst,
        address: bill.customerAddress,
        state: bill.customerState
    };

    const date = new Date(bill.createdAt).toLocaleDateString('en-IN');
    const time = new Date(bill.createdAt).toLocaleTimeString('en-IN');

    // Ensure items is an array - handle string JSON or already parsed array
    let items = [];
    if (typeof bill.items === 'string') {
        try {
            items = JSON.parse(bill.items);
        } catch (e) {
            console.error('Error parsing items JSON:', e);
            items = [];
        }
    } else if (Array.isArray(bill.items)) {
        items = bill.items;
    }

    console.log('Parsed items:', items);
    console.log('Items count:', items.length);

    let itemsHtml = '';
    if (items.length === 0) {
        itemsHtml = '<tr><td colspan="9" style="text-align: center; padding: 1rem; color: #6c757d;">No items found</td></tr>';
    } else {
        itemsHtml = items.map((item, idx) => `
            <tr>
                <td style="text-align: center;">${idx + 1}</td>
                <td><strong>${item.name || 'N/A'}</strong></td>
                <td>${item.size || ''} ${item.unit || ''}</td>
                <td style="text-align: center;">${item.quantity || 0}</td>
                <td style="text-align: right;">₹${(parseFloat(item.price) || 0).toFixed(2)}</td>
                <td style="text-align: right;">₹${(parseFloat(item.amount) || 0).toFixed(2)}</td>
                <td style="text-align: center;">${parseFloat(item.gst) || 0}%</td>
                <td style="text-align: right;">₹${(parseFloat(item.gstAmount) || 0).toFixed(2)}</td>
                <td style="text-align: right;"><strong>₹${(parseFloat(item.total) || 0).toFixed(2)}</strong></td>
            </tr>
        `).join('');
    }

    // Parse gstBreakdown if it's a string
    let gstBreakdown = bill.gstBreakdown;
    if (typeof gstBreakdown === 'string') {
        try {
            gstBreakdown = JSON.parse(gstBreakdown);
        } catch (e) {
            console.error('Error parsing gstBreakdown JSON:', e);
            gstBreakdown = {};
        }
    }

    console.log('GST Breakdown:', gstBreakdown);

    let gstBreakdownHtml = '';
    if (gstBreakdown && gstBreakdown.type === 'SGST+CGST') {
        gstBreakdownHtml = `
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #e9ecef;">
                <span style="color: #6c757d;">SGST:</span>
                <span style="font-weight: 600;">₹${(parseFloat(gstBreakdown.sgst) || 0).toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #e9ecef;">
                <span style="color: #6c757d;">CGST:</span>
                <span style="font-weight: 600;">₹${(parseFloat(gstBreakdown.cgst) || 0).toFixed(2)}</span>
            </div>
        `;
    } else if (gstBreakdown && gstBreakdown.type === 'IGST') {
        gstBreakdownHtml = `
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #e9ecef;">
                <span style="color: #6c757d;">IGST:</span>
                <span style="font-weight: 600;">₹${(parseFloat(gstBreakdown.igst) || 0).toFixed(2)}</span>
            </div>
        `;
    } else {
        // If no breakdown type, show total GST
        gstBreakdownHtml = `
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #e9ecef;">
                <span style="color: #6c757d;">Total GST:</span>
                <span style="font-weight: 600;">₹${(parseFloat(bill.totalGST) || 0).toFixed(2)}</span>
            </div>
        `;
    }

    // Payment status badge
    const paymentStatus = bill.paymentStatus || 'paid';
    let statusBadge = '';
    let statusColor = '';
    if (paymentStatus === 'paid') {
        statusBadge = '✅ Paid';
        statusColor = '#28a745';
    } else if (paymentStatus === 'pending') {
        statusBadge = '⏳ Pending';
        statusColor = '#dc3545';
    } else {
        statusBadge = '💰 Partial';
        statusColor = '#ffc107';
    }

    // Payment tracking details
    let paymentTrackingHtml = '';
    if (bill.paymentTracking && (paymentStatus === 'partial' || paymentStatus === 'paid')) {
        const tracking = bill.paymentTracking;
        paymentTrackingHtml = `
            <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; margin-top: 1rem;">
                <h4 style="margin: 0 0 0.75rem 0; color: #495057; font-size: 0.95rem;">💳 Payment Details</h4>
                <div style="display: flex; justify-content: space-between; padding: 0.4rem 0;">
                    <span style="color: #6c757d;">Total Amount:</span>
                    <span style="font-weight: 600;">₹${(parseFloat(tracking.totalAmount) || 0).toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 0.4rem 0;">
                    <span style="color: #28a745;">Amount Paid:</span>
                    <span style="font-weight: 600; color: #28a745;">₹${(parseFloat(tracking.amountPaid) || 0).toFixed(2)}</span>
                </div>
                ${tracking.amountPending > 0 ? `
                <div style="display: flex; justify-content: space-between; padding: 0.4rem 0;">
                    <span style="color: #dc3545;">Amount Pending:</span>
                    <span style="font-weight: 600; color: #dc3545;">₹${(parseFloat(tracking.amountPending) || 0).toFixed(2)}</span>
                </div>
                ` : ''}
            </div>
        `;
    }

    const content = `
        <div style="max-width: 900px; margin: 0 auto;">
            <!-- Header Card -->
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 1.5rem; border-radius: 12px 12px 0 0; margin: -1rem -1rem 0 -1rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                    <div>
                        <h2 style="margin: 0; font-size: 1.75rem;">Bill #${bill.id}</h2>
                        <p style="margin: 0.5rem 0 0 0; opacity: 0.9;">${date} at ${time}</p>
                    </div>
                    <div style="background: rgba(255,255,255,0.2); padding: 0.75rem 1.5rem; border-radius: 8px; text-align: center;">
                        <div style="font-size: 0.85rem; opacity: 0.9; margin-bottom: 0.25rem;">Status</div>
                        <div style="font-size: 1.1rem; font-weight: 700;">${statusBadge}</div>
                    </div>
                </div>
            </div>
            
            <!-- Customer Details Card -->
            <div style="background: white; padding: 1.5rem; border: 1px solid #e9ecef; border-top: none;">
                <h3 style="margin: 0 0 1rem 0; color: #495057; font-size: 1.1rem; display: flex; align-items: center;">
                    <span style="margin-right: 0.5rem;">👤</span> Customer Information
                </h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem;">
                    <div>
                        <div style="color: #6c757d; font-size: 0.85rem; margin-bottom: 0.25rem;">Name</div>
                        <div style="font-weight: 600; color: #212529;">${customer.name || 'N/A'}</div>
                    </div>
                    <div>
                        <div style="color: #6c757d; font-size: 0.85rem; margin-bottom: 0.25rem;">Phone</div>
                        <div style="font-weight: 600; color: #212529;">${customer.phone || 'N/A'}</div>
                    </div>
                    <div>
                        <div style="color: #6c757d; font-size: 0.85rem; margin-bottom: 0.25rem;">GST Number</div>
                        <div style="font-weight: 600; color: #212529;">${customer.gst || 'N/A'}</div>
                    </div>
                    <div>
                        <div style="color: #6c757d; font-size: 0.85rem; margin-bottom: 0.25rem;">State</div>
                        <div style="font-weight: 600; color: #212529;">${customer.state === 'same' ? 'Same State (SGST+CGST)' : 'Other State (IGST)'}</div>
                    </div>
                </div>
                ${customer.address ? `
                <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #e9ecef;">
                    <div style="color: #6c757d; font-size: 0.85rem; margin-bottom: 0.25rem;">Address</div>
                    <div style="font-weight: 600; color: #212529;">${customer.address}</div>
                </div>
                ` : ''}
            </div>
            
            <!-- Items Table Card -->
            <div style="background: white; padding: 1.5rem; border: 1px solid #e9ecef; border-top: none; margin-top: 1rem;">
                <h3 style="margin: 0 0 1rem 0; color: #495057; font-size: 1.1rem; display: flex; align-items: center;">
                    <span style="margin-right: 0.5rem;">📦</span> Items (${items.length})
                </h3>
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                        <thead>
                            <tr style="background: #f8f9fa; border-bottom: 2px solid #dee2e6;">
                                <th style="padding: 0.75rem; text-align: center; font-weight: 600; color: #495057;">#</th>
                                <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #495057;">Item</th>
                                <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #495057;">Size</th>
                                <th style="padding: 0.75rem; text-align: center; font-weight: 600; color: #495057;">Qty</th>
                                <th style="padding: 0.75rem; text-align: right; font-weight: 600; color: #495057;">Rate</th>
                                <th style="padding: 0.75rem; text-align: right; font-weight: 600; color: #495057;">Amount</th>
                                <th style="padding: 0.75rem; text-align: center; font-weight: 600; color: #495057;">GST%</th>
                                <th style="padding: 0.75rem; text-align: right; font-weight: 600; color: #495057;">GST Amt</th>
                                <th style="padding: 0.75rem; text-align: right; font-weight: 600; color: #495057;">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsHtml}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <!-- Summary Card -->
            <div style="background: white; padding: 1.5rem; border: 1px solid #e9ecef; border-top: none; border-radius: 0 0 12px 12px; margin-bottom: 1rem;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                    <!-- GST Breakdown -->
                    <div>
                        <h4 style="margin: 0 0 1rem 0; color: #495057; font-size: 0.95rem;">📊 GST Breakdown</h4>
                        ${gstBreakdownHtml}
                    </div>
                    
                    <!-- Total Summary -->
                    <div>
                        <h4 style="margin: 0 0 1rem 0; color: #495057; font-size: 0.95rem;">💰 Bill Summary</h4>
                        <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #e9ecef;">
                            <span style="color: #6c757d;">Subtotal:</span>
                            <span style="font-weight: 600;">₹${(parseFloat(bill.subtotal) || 0).toFixed(2)}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #e9ecef;">
                            <span style="color: #6c757d;">Total GST:</span>
                            <span style="font-weight: 600;">₹${(parseFloat(bill.totalGST) || 0).toFixed(2)}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 0.75rem 0; margin-top: 0.5rem; background: #f8f9fa; padding: 1rem; border-radius: 8px;">
                            <span style="font-size: 1.1rem; font-weight: 700; color: #212529;">Total Amount:</span>
                            <span style="font-size: 1.3rem; font-weight: 700; color: #667eea;">₹${(parseFloat(bill.total) || 0).toFixed(2)}</span>
                        </div>
                    </div>
                </div>
                
                ${paymentTrackingHtml}
            </div>
            
            <!-- Action Button -->
            <div style="text-align: center; margin-top: 1.5rem;">
                <button 
                    onclick="downloadBillPDF(${bill.id})" 
                    style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 1rem 2.5rem; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4); transition: transform 0.2s;"
                    onmouseover="this.style.transform='translateY(-2px)'"
                    onmouseout="this.style.transform='translateY(0)'"
                >
                    📄 Download PDF Invoice
                </button>
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

    // Store index for rollback
    const originalBills = [...bills];

    // Optimistic update
    bills = bills.filter(b => b.id != billId);
    renderSales();
    updateSalesSummary();

    try {
        await APIService.deleteBill(billId);
        // Optional: Refresh data in background to ensure sync
        loadBills();
    } catch (error) {
        console.error('Error deleting bill:', error);
        alert('Failed to delete bill. Restoring record.');
        bills = originalBills;
        renderSales();
        updateSalesSummary();
    }
}

function updatePaymentStatus(billId) {
    console.log('updatePaymentStatus called with billId:', billId);
    console.log('Available bills:', bills.map(b => ({ id: b.id, type: typeof b.id })));

    const bill = bills.find(b => b.id == billId); // Use == for type coercion

    if (!bill) {
        console.error('Bill not found with ID:', billId);
        alert('Bill not found! Please refresh the page and try again.');
        return;
    }

    console.log('Found bill:', bill);

    // Check if modal exists
    const modal = document.getElementById('update-payment-modal');
    if (!modal) {
        console.error('Update payment modal not found in DOM');
        alert('Error: Payment update modal not found. Please refresh the page.');
        return;
    }

    const billIdElement = document.getElementById('update-bill-id');
    const statusElement = document.getElementById('update-current-status');

    if (!billIdElement || !statusElement) {
        console.error('Modal elements not found:', { billIdElement, statusElement });
        alert('Error: Modal elements not found. Please refresh the page.');
        return;
    }

    const currentStatus = bill.paymentStatus || 'paid';
    const statusLabels = {
        'paid': '✅ Paid',
        'pending': '⏳ Pending',
        'partial': '💰 Partial'
    };

    // Store the bill ID for later use
    window.currentBillIdForUpdate = billId;

    // Populate modal
    billIdElement.textContent = billId;
    statusElement.innerHTML = `<span class="badge badge-${currentStatus === 'paid' ? 'success' : currentStatus === 'pending' ? 'danger' : 'warning'}">${statusLabels[currentStatus]}</span>`;

    console.log('Opening payment modal for bill:', billId);

    // Show modal
    modal.classList.add('active');
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

    let bill = bills.find(b => b.id == billId); // Use == for type coercion
    if (!bill) {
        console.error('Bill not found with ID:', billId);
        alert('Bill not found!');
        return;
    }

    // Normalize bill format - handle both old and new formats
    bill = {
        ...bill,
        customer: bill.customer || {
            name: bill.customerName,
            phone: bill.customerPhone,
            gst: bill.customerGst,
            address: bill.customerAddress,
            state: bill.customerState
        },
        items: Array.isArray(bill.items) ? bill.items : [],
        gstBreakdown: bill.gstBreakdown || {},
        paymentTracking: bill.paymentTracking || {
            totalAmount: bill.total || 0,
            amountPaid: 0,
            amountPending: bill.total || 0,
            payments: []
        }
    };

    // If partial payment, show input form
    if (newStatus === 'partial') {
        // Hide payment options
        document.querySelectorAll('#update-payment-modal .payment-status-options')[0].style.display = 'none';

        // Show partial payment input
        const partialInput = document.getElementById('partial-payment-input');
        partialInput.style.display = 'block';

        // Ensure payment tracking is properly initialized
        if (!bill.paymentTracking.totalAmount) {
            bill.paymentTracking.totalAmount = bill.total;
        }
        if (!bill.paymentTracking.amountPaid) {
            bill.paymentTracking.amountPaid = 0;
        }
        if (!bill.paymentTracking.amountPending) {
            bill.paymentTracking.amountPending = bill.total;
        }
        if (!bill.paymentTracking.payments) {
            bill.paymentTracking.payments = [];
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
        // Ensure all numeric values are valid and customer name is not empty
        if (!bill.customer || !bill.customer.name) {
            throw new Error('Customer name is required');
        }

        const updateData = {
            customer: {
                name: bill.customer.name,
                phone: bill.customer.phone || null,
                gst: bill.customer.gst || null,
                address: bill.customer.address || null,
                state: bill.customer.state || null
            },
            items: Array.isArray(bill.items) ? bill.items.map(item => ({
                id: item.id,
                name: item.name || '',
                size: item.size || '',
                unit: item.unit || '',
                quantity: parseFloat(item.quantity) || 0,
                price: parseFloat(item.price) || 0,
                amount: parseFloat(item.amount) || 0,
                gst: parseFloat(item.gst) || 0,
                gstAmount: parseFloat(item.gstAmount) || 0,
                total: parseFloat(item.total) || 0
            })) : [],
            subtotal: parseFloat(bill.subtotal) || 0,
            gstBreakdown: bill.gstBreakdown || {},
            totalGST: parseFloat(bill.totalGST) || 0,
            total: parseFloat(bill.total) || 0,
            paymentStatus: newStatus,
            paymentTracking: {
                totalAmount: parseFloat(bill.paymentTracking.totalAmount) || parseFloat(bill.total) || 0,
                amountPaid: parseFloat(bill.paymentTracking.amountPaid) || 0,
                amountPending: parseFloat(bill.paymentTracking.amountPending) || parseFloat(bill.total) || 0,
                payments: Array.isArray(bill.paymentTracking.payments) ? bill.paymentTracking.payments : []
            }
        };

        console.log('Sending update data:', JSON.stringify(updateData, null, 2));

        // Send the complete bill object to the server
        await APIService.updateBill(bill.id, updateData);

        // Reload bills to get fresh data
        await loadBills();
        renderSales();
        closeUpdatePaymentModal();
        alert(`Payment status updated to: ${statusLabels[newStatus]}`);
    } catch (error) {
        console.error('Error updating bill payment status:', error);
        console.error('Error details:', error.message);
        alert('Failed to update payment status. Please try again.');
    }
}

function calculateBillPending() {
    const billId = window.currentBillIdForUpdate;
    if (!billId) return;

    let bill = bills.find(b => b.id == billId); // Use == for type coercion
    if (!bill) return;

    // Normalize bill format
    bill = {
        ...bill,
        paymentTracking: bill.paymentTracking || {}
    };

    const amountReceived = parseFloat(document.getElementById('partial-amount-input').value) || 0;
    const newPending = bill.paymentTracking.amountPending - amountReceived;

    document.getElementById('bill-remaining-pending').textContent = `₹${Math.max(0, newPending).toFixed(2)}`;
}

async function confirmPartialPayment() {
    const billId = window.currentBillIdForUpdate;
    if (!billId) return;

    let bill = bills.find(b => b.id == billId); // Use == for type coercion
    if (!bill) return;

    // Normalize bill format
    bill = {
        ...bill,
        customer: bill.customer || {
            name: bill.customerName,
            phone: bill.customerPhone,
            gst: bill.customerGst,
            address: bill.customerAddress,
            state: bill.customerState
        },
        items: Array.isArray(bill.items) ? bill.items : [],
        gstBreakdown: bill.gstBreakdown || {},
        paymentTracking: bill.paymentTracking || {
            totalAmount: bill.total || 0,
            amountPaid: 0,
            amountPending: bill.total || 0,
            payments: []
        }
    };

    // Ensure payment tracking fields exist
    if (!bill.paymentTracking.totalAmount) {
        bill.paymentTracking.totalAmount = bill.total;
    }
    if (!bill.paymentTracking.amountPaid) {
        bill.paymentTracking.amountPaid = 0;
    }
    if (!bill.paymentTracking.amountPending) {
        bill.paymentTracking.amountPending = bill.total;
    }
    if (!bill.paymentTracking.payments) {
        bill.paymentTracking.payments = [];
    }

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
        // Ensure customer name is not empty
        if (!bill.customer || !bill.customer.name) {
            throw new Error('Customer name is required');
        }

        // Send the complete bill object to the server with properly formatted data
        await APIService.updateBill(bill.id, {
            customer: {
                name: bill.customer.name,
                phone: bill.customer.phone || null,
                gst: bill.customer.gst || null,
                address: bill.customer.address || null,
                state: bill.customer.state || null
            },
            items: Array.isArray(bill.items) ? bill.items.map(item => ({
                id: item.id,
                name: item.name || '',
                size: item.size || '',
                unit: item.unit || '',
                quantity: parseFloat(item.quantity) || 0,
                price: parseFloat(item.price) || 0,
                amount: parseFloat(item.amount) || 0,
                gst: parseFloat(item.gst) || 0,
                gstAmount: parseFloat(item.gstAmount) || 0,
                total: parseFloat(item.total) || 0
            })) : [],
            subtotal: parseFloat(bill.subtotal) || 0,
            gstBreakdown: bill.gstBreakdown || {},
            totalGST: parseFloat(bill.totalGST) || 0,
            total: parseFloat(bill.total) || 0,
            paymentStatus: bill.paymentStatus,
            paymentTracking: {
                totalAmount: parseFloat(bill.paymentTracking.totalAmount) || 0,
                amountPaid: parseFloat(bill.paymentTracking.amountPaid) || 0,
                amountPending: parseFloat(bill.paymentTracking.amountPending) || 0,
                payments: Array.isArray(bill.paymentTracking.payments) ? bill.paymentTracking.payments : []
            }
        });

        // Reload bills to get fresh data
        await loadBills();
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

// Edit Customer
function editCustomer(customerId) {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) {
        alert('Customer not found');
        return;
    }

    const newName = prompt('Enter Customer Name:', customer.name);
    if (newName === null) return; // User cancelled

    if (!newName || newName.trim() === '') {
        alert('Customer name cannot be empty');
        return;
    }

    const newPhone = prompt('Enter Phone Number:', customer.phone || '');
    const newGst = prompt('Enter GST Number:', customer.gst || '');
    const newAddress = prompt('Enter Address:', customer.address || '');
    const newState = prompt('Enter State (same/other):', customer.state || '');

    const updatedCustomer = {
        name: newName.trim(),
        phone: newPhone ? newPhone.trim() : null,
        gst: newGst ? newGst.trim() : null,
        address: newAddress ? newAddress.trim() : null,
        state: newState ? newState.trim() : null
    };

    APIService.updateCustomer(customerId, updatedCustomer)
        .then(() => {
            alert('Customer updated successfully!');
            loadCustomers().then(() => {
                renderCustomerReports();
            });
        })
        .catch(error => {
            console.error('Error updating customer:', error);
            alert('Failed to update customer. Please try again.');
        });
}

// Delete Customer
async function deleteCustomer(customerId, customerName) {
    // Check if customer has any bills
    const customerBills = bills.filter(b =>
        b.customer.name.toLowerCase() === customerName.toLowerCase()
    );

    if (customerBills.length > 0) {
        const confirmMsg = `⚠️ Warning: ${customerName} has ${customerBills.length} bill(s) in the system.\n\nDeleting this customer will NOT delete the bill records, but the customer information will be removed.\n\nAre you sure you want to delete this customer?`;

        if (!confirm(confirmMsg)) return;
    } else {
        if (!confirm(`Are you sure you want to delete customer "${customerName}"?`)) return;
    }

    try {
        await APIService.deleteCustomer(customerId);
        alert('Customer deleted successfully!');
        await loadCustomers();
        renderCustomerReports();
    } catch (error) {
        console.error('Error deleting customer:', error);
        alert('Failed to delete customer. Please try again.');
    }
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
                <button class="action-btn" onclick="viewCustomerDetails('${data.customer.name.replace(/'/g, "\\'")}')">View</button>
                <button class="action-btn" onclick="editCustomer(${data.customer.id})">Edit</button>
                <button class="action-btn delete" onclick="deleteCustomer(${data.customer.id}, '${data.customer.name.replace(/'/g, "\\'")}')">Delete</button>
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
                <div class="supplier-stat-card ${outstandingAmount > 0 ? 'danger' : 'success'}" style="position: relative;">
                    <div class="stat-icon">${outstandingAmount > 0 ? '⏳' : '✅'}</div>
                    <div class="stat-info">
                        <div class="stat-label">Outstanding</div>
                        <div class="stat-number">₹${outstandingAmount.toFixed(2)}</div>
                    </div>
                    <div class="stat-actions" style="position: absolute; top: 10px; right: 10px; display: flex; gap: 5px;">
                        <button onclick="downloadCustomerReportPDF('${customer.name.replace(/'/g, "\\'")}')" class="btn-icon" title="Download PDF">📄</button>
                        <button onclick="downloadCustomerReportCSV('${customer.name.replace(/'/g, "\\'")}')" class="btn-icon" title="Download CSV">📊</button>
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

async function downloadCustomerReportPDF(customerName) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const customer = customers.find(c => c.name === customerName);
    if (!customer) {
        alert('Customer data not found');
        return;
    }

    const customerBills = bills.filter(b =>
        b.customer.name.toLowerCase() === customerName.toLowerCase() ||
        (b.customer.phone && customer.phone && b.customer.phone === customer.phone)
    );

    const totalAmount = customerBills.reduce((sum, b) => sum + b.total, 0);
    const paidAmount = customerBills.filter(b => (b.paymentStatus || 'paid') === 'paid').reduce((sum, b) => sum + b.total, 0);
    const pendingAmount = customerBills.filter(b => b.paymentStatus === 'pending').reduce((sum, b) => sum + b.total, 0);
    const partialAmount = customerBills.filter(b => b.paymentStatus === 'partial').reduce((sum, b) => sum + b.total, 0);
    const outstandingAmount = pendingAmount + partialAmount;

    // Header
    doc.setFillColor(41, 128, 185);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("PLASTIWOOD", 105, 15, { align: "center" });
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("Customer Account Statement", 105, 25, { align: "center" });
    doc.setFontSize(10);
    doc.text(`Report Date: ${new Date().toLocaleDateString('en-IN')}`, 105, 33, { align: "center" });

    // Customer Info
    doc.setTextColor(44, 62, 80);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Customer Profile", 14, 50);
    doc.line(14, 52, 196, 52);
    doc.setFontSize(10);
    doc.text(`Name:`, 14, 60);
    doc.text(`Phone:`, 14, 66);
    doc.text(`GST No:`, 14, 72);
    doc.setFont("helvetica", "normal");
    doc.text(`${customer.name}`, 40, 60);
    doc.text(`${customer.phone || 'N/A'}`, 40, 66);
    doc.text(`${customer.gst || 'N/A'}`, 40, 72);

    // Summary
    doc.setFont("helvetica", "bold");
    doc.text(`Total Orders:`, 120, 60);
    doc.text(`Total Business:`, 120, 66);
    doc.text(`Outstanding:`, 120, 72);
    doc.setFont("helvetica", "normal");
    doc.text(`${customerBills.length}`, 160, 60);
    doc.text(`Rs. ${totalAmount.toFixed(2)}`, 160, 66);
    if (outstandingAmount > 0) doc.setTextColor(231, 76, 60);
    else doc.setTextColor(39, 174, 96);
    doc.text(`Rs. ${outstandingAmount.toFixed(2)}`, 160, 72);
    doc.setTextColor(44, 62, 80);

    // Table
    doc.autoTable({
        startY: 85,
        head: [['Bill #', 'Date', 'Items', 'Amount (Rs.)', 'Status']],
        body: customerBills.map(b => [
            `#${b.id}`,
            new Date(b.createdAt).toLocaleDateString('en-IN'),
            b.items.length,
            b.total.toFixed(2),
            b.paymentStatus.toUpperCase()
        ]),
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185], textColor: 255 },
        styles: { fontSize: 9 }
    });

    doc.save(`Customer_Report_${customer.name.replace(/\s+/g, '_')}.pdf`);
}

function downloadCustomerReportCSV(customerName) {
    const customer = customers.find(c => c.name === customerName);
    if (!customer) return;

    const customerBills = bills.filter(b =>
        b.customer.name.toLowerCase() === customerName.toLowerCase() ||
        (b.customer.phone && customer.phone && b.customer.phone === customer.phone)
    );

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Bill #,Date,Items Count,Amount (INR),Payment Status\n";

    customerBills.forEach(b => {
        const date = new Date(b.createdAt).toLocaleDateString('en-IN');
        csvContent += `${b.id},${date},${b.items.length},${b.total.toFixed(2)},${b.paymentStatus.toUpperCase()}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Customer_Report_${customer.name.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
    const totalRevenue = filteredBills.reduce((sum, bill) => sum + (parseFloat(bill.total) || 0), 0);
    const totalPurchases = filteredPurchases.reduce((sum, p) => sum + (parseFloat(p.total) || 0), 0);
    const totalBillsCount = filteredBills.length;

    // Calculate Average Order Value (AOV)
    const averageOrderValue = totalBillsCount > 0 ? (totalRevenue / totalBillsCount) : 0;

    const inventoryValue = inventory.reduce((sum, item) => sum + (item.quantity * (parseFloat(item.price) || 0)), 0);

    // Calculate actual pending payments using payment tracking
    let pendingPayments = 0;
    filteredBills.forEach(bill => {
        if (bill.paymentStatus === 'pending') {
            pendingPayments += parseFloat(bill.total) || 0;
        } else if (bill.paymentStatus === 'partial' && bill.paymentTracking) {
            pendingPayments += parseFloat(bill.paymentTracking.amountPending) || 0;
        }
    });

    // Update metric cards
    document.getElementById('dash-total-revenue').textContent = `₹${totalRevenue.toFixed(2)}`;
    document.getElementById('dash-aov').textContent = `₹${averageOrderValue.toFixed(2)}`;
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

        switch (period) {
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

    switch (period) {
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
    console.log('generateBillPDF called with bill:', bill);

    // Validate bill object
    if (!bill) {
        console.error('Bill is undefined or null');
        alert('Error: Bill data is missing. Cannot generate PDF.');
        return;
    }

    if (!bill.customer) {
        console.error('Bill customer is undefined');
        alert('Error: Customer data is missing. Cannot generate PDF.');
        return;
    }

    if (!bill.items || !Array.isArray(bill.items)) {
        console.error('Bill items is undefined or not an array');
        alert('Error: Bill items data is missing. Cannot generate PDF.');
        return;
    }

    // Ensure all numeric fields have defaults
    bill.subtotal = parseFloat(bill.subtotal) || 0;
    bill.totalGST = parseFloat(bill.totalGST) || 0;
    bill.total = parseFloat(bill.total) || 0;
    bill.id = bill.id || 'N/A';
    bill.createdAt = bill.createdAt || new Date();
    bill.gstBreakdown = bill.gstBreakdown || {};
    bill.paymentStatus = bill.paymentStatus || 'paid';

    // Ensure all items have numeric fields
    bill.items = bill.items.map(item => ({
        ...item,
        quantity: parseFloat(item.quantity) || 0,
        price: parseFloat(item.price) || 0,
        amount: parseFloat(item.amount) || 0,
        gst: parseFloat(item.gst) || 0,
        gstAmount: parseFloat(item.gstAmount) || 0,
        total: parseFloat(item.total) || 0,
        name: item.name || 'Unknown Item',
        size: item.size || '',
        unit: item.unit || ''
    }));

    console.log('Bill after normalization:', bill);

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Load saved company and banking details
    const savedCompany = localStorage.getItem('companyDetails');
    const savedBanking = localStorage.getItem('bankingDetails');

    const company = savedCompany ? JSON.parse(savedCompany) : {};
    const banking = savedBanking ? JSON.parse(savedBanking) : {};

    // Company Details (use saved or defaults)
    const companyName = company.name || "PLASTIWOOD";
    const companyAddress = company.address || "Your Business Address Here";
    const companyGST = company.gst || "Your GST Number";
    const companyPhone = company.phone || "Your Phone Number";
    const companyEmail = company.email || "your.email@example.com";
    const companyPAN = company.pan || "";
    const companyWebsite = company.website || "";

    // Colors
    const primaryColor = [37, 99, 235]; // Blue
    const darkColor = [15, 23, 42];
    const lightGray = [241, 245, 249];

    // Header with gradient effect
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 210, 45, 'F');

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

    let contactLine = `Phone: ${companyPhone}`;
    if (companyEmail) contactLine += ` | Email: ${companyEmail}`;
    doc.text(contactLine, 105, 36, { align: 'center' });

    let gstLine = `GST: ${companyGST}`;
    if (companyPAN) gstLine += ` | PAN: ${companyPAN}`;
    if (companyWebsite) gstLine += ` | ${companyWebsite}`;
    doc.text(gstLine, 105, 41, { align: 'center' });

    // Reset text color
    doc.setTextColor(...darkColor);

    // Invoice Details Box
    let yPos = 55;
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
    // GST Breakdown
    const sgst = parseFloat(bill.gstBreakdown.sgst) || 0;
    const cgst = parseFloat(bill.gstBreakdown.cgst) || 0;
    const igst = parseFloat(bill.gstBreakdown.igst) || 0;

    if (bill.gstBreakdown.type === 'SGST+CGST') {
        doc.text('SGST:', summaryX + 5, yPos + 14);
        doc.text('Rs. ' + sgst.toFixed(2), summaryX + summaryWidth - 5, yPos + 14, { align: 'right' });

        doc.text('CGST:', summaryX + 5, yPos + 21);
        doc.text('Rs. ' + cgst.toFixed(2), summaryX + summaryWidth - 5, yPos + 21, { align: 'right' });
    } else {
        doc.text('IGST:', summaryX + 5, yPos + 14);
        doc.text('Rs. ' + igst.toFixed(2), summaryX + summaryWidth - 5, yPos + 14, { align: 'right' });
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

    // Banking Details (if available)
    if (Object.keys(banking).length > 0) {
        yPos += 25;
        doc.setFontSize(9);
        doc.setFont(undefined, 'bold');
        doc.text('Banking Details:', 15, yPos);
        doc.setFont(undefined, 'normal');
        doc.setFontSize(8);

        let bankYPos = yPos + 5;
        if (banking.bankName) {
            doc.text(`Bank: ${banking.bankName}`, 15, bankYPos);
            bankYPos += 4;
        }
        if (banking.accountName) {
            doc.text(`Account Name: ${banking.accountName}`, 15, bankYPos);
            bankYPos += 4;
        }
        if (banking.accountNumber) {
            doc.text(`Account Number: ${banking.accountNumber}`, 15, bankYPos);
            bankYPos += 4;
        }
        if (banking.ifsc) {
            doc.text(`IFSC Code: ${banking.ifsc}`, 15, bankYPos);
            bankYPos += 4;
        }
        if (banking.branch) {
            doc.text(`Branch: ${banking.branch}`, 15, bankYPos);
            bankYPos += 4;
        }
        if (banking.upiId) {
            doc.text(`UPI ID: ${banking.upiId}`, 15, bankYPos);
        }
    }

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
    console.log('downloadBillPDF called with billId:', billId, 'type:', typeof billId);
    console.log('Available bills:', bills);
    console.log('Bills IDs:', bills.map(b => ({ id: b.id, type: typeof b.id })));

    const bill = bills.find(b => {
        console.log(`Comparing b.id (${b.id}, ${typeof b.id}) with billId (${billId}, ${typeof billId})`);
        return b.id == billId;
    });

    console.log('Found bill:', bill);

    if (bill) {
        // Normalize bill format - handle both old and new formats
        const normalizedBill = {
            ...bill,
            customer: bill.customer || {
                name: bill.customerName,
                phone: bill.customerPhone,
                gst: bill.customerGst,
                address: bill.customerAddress,
                state: bill.customerState
            },
            items: Array.isArray(bill.items) ? bill.items : [],
            gstBreakdown: bill.gstBreakdown || {},
            paymentTracking: bill.paymentTracking || {}
        };

        console.log('Normalized bill:', normalizedBill);
        console.log('Bill customer:', normalizedBill.customer);
        console.log('Bill items:', normalizedBill.items);

        generateBillPDF(normalizedBill);
    } else {
        console.error('Bill not found with ID:', billId);
        console.error('Available bill IDs:', bills.map(b => b.id));
        alert('Bill not found! Please refresh the page and try again.');
    }
}

// Settings Management
let companyDetails = {};
let bankingDetails = {};

// Load settings from localStorage
function loadSettings() {
    const savedCompany = localStorage.getItem('companyDetails');
    const savedBanking = localStorage.getItem('bankingDetails');

    if (savedCompany) {
        companyDetails = JSON.parse(savedCompany);
        populateCompanyForm();
    }

    if (savedBanking) {
        bankingDetails = JSON.parse(savedBanking);
        populateBankingForm();
    }

    displayCurrentSettings();
}

// Populate company form with saved data
function populateCompanyForm() {
    document.getElementById('company-name').value = companyDetails.name || '';
    document.getElementById('company-address').value = companyDetails.address || '';
    document.getElementById('company-phone').value = companyDetails.phone || '';
    document.getElementById('company-email').value = companyDetails.email || '';
    document.getElementById('company-gst').value = companyDetails.gst || '';
    document.getElementById('company-pan').value = companyDetails.pan || '';
    document.getElementById('company-website').value = companyDetails.website || '';
}

// Populate banking form with saved data
function populateBankingForm() {
    document.getElementById('bank-name').value = bankingDetails.bankName || '';
    document.getElementById('bank-account-name').value = bankingDetails.accountName || '';
    document.getElementById('bank-account-number').value = bankingDetails.accountNumber || '';
    document.getElementById('bank-ifsc').value = bankingDetails.ifsc || '';
    document.getElementById('bank-branch').value = bankingDetails.branch || '';
    document.getElementById('upi-id').value = bankingDetails.upiId || '';
}

// Save company details
function saveCompanyDetails(event) {
    event.preventDefault();

    if (!checkOwnerPermission()) return;

    companyDetails = {
        name: document.getElementById('company-name').value,
        address: document.getElementById('company-address').value,
        phone: document.getElementById('company-phone').value,
        email: document.getElementById('company-email').value,
        gst: document.getElementById('company-gst').value,
        pan: document.getElementById('company-pan').value,
        website: document.getElementById('company-website').value
    };

    localStorage.setItem('companyDetails', JSON.stringify(companyDetails));
    displayCurrentSettings();
    alert('✅ Company details saved successfully!');
}

// Save banking details
function saveBankingDetails(event) {
    event.preventDefault();

    if (!checkOwnerPermission()) return;

    bankingDetails = {
        bankName: document.getElementById('bank-name').value,
        accountName: document.getElementById('bank-account-name').value,
        accountNumber: document.getElementById('bank-account-number').value,
        ifsc: document.getElementById('bank-ifsc').value,
        branch: document.getElementById('bank-branch').value,
        upiId: document.getElementById('upi-id').value
    };

    localStorage.setItem('bankingDetails', JSON.stringify(bankingDetails));
    displayCurrentSettings();
    alert('✅ Banking details saved successfully!');
}

// Display current settings
function displayCurrentSettings() {
    const container = document.getElementById('current-settings-display');

    if (Object.keys(companyDetails).length === 0 && Object.keys(bankingDetails).length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No settings saved yet. Fill in the forms above to save your business details.</p>';
        return;
    }

    let html = '';

    if (Object.keys(companyDetails).length > 0) {
        html += '<h3 style="color: var(--primary); margin-bottom: 1rem;">🏢 Company Details</h3>';
        if (companyDetails.name) html += `<div class="setting-item"><strong>Company Name</strong><span>${companyDetails.name}</span></div>`;
        if (companyDetails.address) html += `<div class="setting-item"><strong>Address</strong><span>${companyDetails.address}</span></div>`;
        if (companyDetails.phone) html += `<div class="setting-item"><strong>Phone</strong><span>${companyDetails.phone}</span></div>`;
        if (companyDetails.email) html += `<div class="setting-item"><strong>Email</strong><span>${companyDetails.email}</span></div>`;
        if (companyDetails.gst) html += `<div class="setting-item"><strong>GST Number</strong><span>${companyDetails.gst}</span></div>`;
        if (companyDetails.pan) html += `<div class="setting-item"><strong>PAN Number</strong><span>${companyDetails.pan}</span></div>`;
        if (companyDetails.website) html += `<div class="setting-item"><strong>Website</strong><span>${companyDetails.website}</span></div>`;
    }

    if (Object.keys(bankingDetails).length > 0) {
        html += '<h3 style="color: var(--primary); margin: 2rem 0 1rem;">🏦 Banking Details</h3>';
        if (bankingDetails.bankName) html += `<div class="setting-item"><strong>Bank Name</strong><span>${bankingDetails.bankName}</span></div>`;
        if (bankingDetails.accountName) html += `<div class="setting-item"><strong>Account Holder</strong><span>${bankingDetails.accountName}</span></div>`;
        if (bankingDetails.accountNumber) html += `<div class="setting-item"><strong>Account Number</strong><span>${bankingDetails.accountNumber}</span></div>`;
        if (bankingDetails.ifsc) html += `<div class="setting-item"><strong>IFSC Code</strong><span>${bankingDetails.ifsc}</span></div>`;
        if (bankingDetails.branch) html += `<div class="setting-item"><strong>Branch</strong><span>${bankingDetails.branch}</span></div>`;
        if (bankingDetails.upiId) html += `<div class="setting-item"><strong>UPI ID</strong><span>${bankingDetails.upiId}</span></div>`;
    }

    container.innerHTML = html;
}

// Load settings on page load
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
});

// Expose functions globally for onclick handlers
window.toggleMenu = toggleMenu;
window.logout = logout;
window.showAddItemModal = showAddItemModal;
window.closeModal = closeModal;
window.addInventoryItem = addInventoryItem;
window.editItem = editItem;
window.deleteItem = deleteItem;
window.showAddStockModal = showAddStockModal;
window.closeStockModal = closeStockModal;
window.addStock = addStock;
window.showRemoveStockModal = showRemoveStockModal;
window.closeRemoveStockModal = closeRemoveStockModal;
window.removeStockSubmit = removeStockSubmit;
window.filterInventory = filterInventory;
window.addBillItem = addBillItem;
window.removeBillItem = removeBillItem;
window.generateBill = generateBill;
window.viewBillHistory = viewBillHistory;
window.closeBillHistoryModal = closeBillHistoryModal;
window.viewBillDetailsModal = viewBillDetailsModal;
window.downloadBillPDF = downloadBillPDF;
window.closeBillDetailsModal = closeBillDetailsModal;
window.deleteBill = deleteBill;
window.quickUpdatePaymentStatus = quickUpdatePaymentStatus;
window.updatePartialPaymentPreview = updatePartialPaymentPreview;
window.confirmPartialPaymentUpdate = confirmPartialPaymentUpdate;
window.closePartialPaymentCard = closePartialPaymentCard;
window.filterSales = filterSales;
window.switchView = switchView;
window.showAddPurchaseModal = showAddPurchaseModal;
window.closePurchaseModal = closePurchaseModal;
window.addPurchaseItemRow = addPurchaseItemRow;
window.addPurchase = addPurchase;
window.filterPurchases = filterPurchases;
window.viewPurchaseDetailsModal = viewPurchaseDetailsModal;
window.closePurchaseDetailsModal = closePurchaseDetailsModal;
window.downloadPurchasePDF = downloadPurchasePDF;
window.deletePurchase = deletePurchase;
window.updatePurchasePaymentStatus = updatePurchasePaymentStatus;
window.closeUpdatePurchasePaymentModal = closeUpdatePurchasePaymentModal;
window.selectPurchasePaymentStatus = selectPurchasePaymentStatus;
window.confirmPartialPurchasePayment = confirmPartialPurchasePayment;
window.cancelPartialPurchasePayment = cancelPartialPurchasePayment;
window.calculatePurchasePending = calculatePurchasePending;
window.showSupplierReports = showSupplierReports;
window.closeSupplierReportsModal = closeSupplierReportsModal;
window.filterSuppliers = filterSuppliers;
window.viewSupplierDetails = viewSupplierDetails;
window.closeSupplierDetailsModal = closeSupplierDetailsModal;
window.deleteSupplier = deleteSupplier;
window.showCustomerReports = showCustomerReports;
window.closeCustomerReportsModal = closeCustomerReportsModal;
window.filterCustomers = filterCustomers;
window.viewCustomerDetails = viewCustomerDetails;
window.closeCustomerDetailsModal = closeCustomerDetailsModal;
window.deleteCustomer = deleteCustomer;
window.refreshDashboard = refreshDashboard;
window.changeDashboardPeriod = changeDashboardPeriod;
window.saveCompanyDetails = saveCompanyDetails;
window.saveBankingDetails = saveBankingDetails;


// Mobile-friendly table scrolling
function setupMobileTableScroll() {
    const tableContainers = document.querySelectorAll('.table-container');

    tableContainers.forEach(container => {
        let hasScrolled = false;

        container.addEventListener('scroll', () => {
            if (!hasScrolled) {
                hasScrolled = true;
                container.classList.add('scrolled');
            }
        }, { once: true });
    });
}
