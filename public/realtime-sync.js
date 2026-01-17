// Real-time Synchronization Module
// Handles WebSocket connections for instant updates between owner and staff

class RealtimeSync {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
    }

    // Initialize Socket.IO connection
    init() {
        try {
            this.socket = io({
                reconnection: true,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
                reconnectionAttempts: this.maxReconnectAttempts
            });

            this.setupEventListeners();
            console.log('⚡ Real-time sync initialized');
        } catch (error) {
            console.error('❌ Failed to initialize real-time sync:', error);
        }
    }

    // Setup all event listeners
    setupEventListeners() {
        // Connection events
        this.socket.on('connect', () => {
            this.isConnected = true;
            this.reconnectAttempts = 0;
            console.log('✅ Connected to real-time server');
            this.updateConnectionStatus('connected');
            this.showNotification('Connected', 'Real-time updates enabled', 'success');

            // Register user with server
            const currentUser = getCurrentUser();
            if (currentUser) {
                this.socket.emit('user:register', {
                    role: currentUser.role,
                    name: currentUser.name
                });
            }
        });

        this.socket.on('disconnect', () => {
            this.isConnected = false;
            console.log('⚠️ Disconnected from real-time server');
            this.updateConnectionStatus('disconnected');
            this.showNotification('Disconnected', 'Attempting to reconnect...', 'warning');
        });

        this.socket.on('connect_error', (error) => {
            this.reconnectAttempts++;
            console.error('❌ Connection error:', error);
            this.updateConnectionStatus('disconnected');
            if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                this.showNotification('Connection Failed', 'Please refresh the page', 'error');
            }
        });

        // Inventory update events
        this.socket.on('inventory:updated', (data) => {
            console.log('📦 Inventory update received:', data);
            this.handleInventoryUpdate(data);
        });

        this.socket.on('inventory:refresh', (data) => {
            console.log('🔄 Full inventory refresh received');
            this.handleInventoryRefresh(data);
        });

        // Bill/Sales events
        this.socket.on('bill:created', (data) => {
            console.log('💰 New bill created:', data);
            this.handleBillCreated(data);
        });

        // Purchase events
        this.socket.on('purchase:created', (data) => {
            console.log('🛒 New purchase created:', data);
            this.handlePurchaseCreated(data);
        });

        this.socket.on('purchase:updated', (data) => {
            console.log('🛒 Purchase updated:', data);
            this.handlePurchaseUpdated(data);
        });

        this.socket.on('purchase:deleted', (data) => {
            console.log('🛒 Purchase deleted:', data);
            this.handlePurchaseDeleted(data);
        });

        // Bill update/delete events
        this.socket.on('bill:updated', (data) => {
            console.log('💰 Bill updated:', data);
            this.handleBillUpdated(data);
        });

        this.socket.on('bill:deleted', (data) => {
            console.log('💰 Bill deleted:', data);
            this.handleBillDeleted(data);
        });

        // Customer events
        this.socket.on('customer:created', (data) => {
            console.log('👤 Customer created:', data);
            this.handleCustomerCreated(data);
        });

        this.socket.on('customer:updated', (data) => {
            console.log('👤 Customer updated:', data);
            this.handleCustomerUpdated(data);
        });

        this.socket.on('customer:deleted', (data) => {
            console.log('👤 Customer deleted:', data);
            this.handleCustomerDeleted(data);
        });

        // Supplier events
        this.socket.on('supplier:created', (data) => {
            console.log('🏭 Supplier created:', data);
            this.handleSupplierCreated(data);
        });

        this.socket.on('supplier:updated', (data) => {
            console.log('🏭 Supplier updated:', data);
            this.handleSupplierUpdated(data);
        });

        this.socket.on('supplier:deleted', (data) => {
            console.log('🏭 Supplier deleted:', data);
            this.handleSupplierDeleted(data);
        });

        // Proforma events
        this.socket.on('proforma:created', (data) => {
            console.log('📑 Proforma created:', data);
            this.handleProformaCreated(data);
        });

        this.socket.on('proforma:deleted', (data) => {
            console.log('📑 Proforma deleted:', data);
            this.handleProformaDeleted(data);
        });

        // Settings events
        this.socket.on('settings:updated', (data) => {
            console.log('⚙️ Settings updated:', data);
            this.handleSettingsUpdated(data);
        });
    }

    // Handle inventory updates (add, edit, delete, stock change)
    handleInventoryUpdate(data) {
        const { action, item, itemId } = data;
        const currentUser = getCurrentUser();

        switch (action) {
            case 'add':
                // Add new item to inventory array
                if (item && !inventory.find(i => i.id === item.id)) {
                    inventory.push(item);
                    this.showNotification('New Product Added', `${item.name} added to inventory`, 'info');
                }
                break;

            case 'update':
                // Update existing item
                const index = inventory.findIndex(i => i.id === item.id);
                if (index !== -1) {
                    inventory[index] = item;
                    this.showNotification('Product Updated', `${item.name} has been updated`, 'info');
                }
                break;

            case 'delete':
                // Remove item from inventory
                const deleteIndex = inventory.findIndex(i => i.id === itemId);
                if (deleteIndex !== -1) {
                    const deletedItem = inventory[deleteIndex];
                    inventory.splice(deleteIndex, 1);
                    this.showNotification('Product Removed', `${deletedItem.name} removed from inventory`, 'info');
                }
                break;
        }

        // Refresh UI
        if (typeof renderInventory === 'function') {
            renderInventory();
        }
        if (typeof updateProductSelect === 'function') {
            updateProductSelect();
        }
    }

    // Handle full inventory refresh (after sales)
    handleInventoryRefresh(data) {
        if (data.inventory) {
            inventory = data.inventory;

            // Refresh UI
            if (typeof renderInventory === 'function') {
                renderInventory();
            }
            if (typeof updateProductSelect === 'function') {
                updateProductSelect();
            }

            const currentUser = getCurrentUser();
            if (currentUser && currentUser.role === 'owner') {
                this.showNotification('Stock Updated', 'Inventory updated after sale', 'info');
            }
        }
    }

    // Handle new bill creation (for owner to see staff sales)
    // Handle new bill creation (for owner to see staff sales)
    handleBillCreated(data) {
        const currentUser = getCurrentUser();

        if (data.bill) {
            // Add bill to bills array if not already present
            // bills is a global variable from app.js
            if (typeof bills !== 'undefined' && !bills.find(b => b.id === data.bill.id)) {
                bills.unshift(data.bill);

                // Show notification to owner
                if (currentUser && currentUser.role === 'owner') {
                    this.showNotification(
                        'New Sale!',
                        `Bill #${data.bill.id} - ₹${data.bill.total.toFixed(2)} by ${data.bill.customer.name}`,
                        'success'
                    );
                }

                // Refresh sales view if active
                if (typeof renderSales === 'function') {
                    renderSales();
                }
            }
        }
    }

    handlePurchaseCreated(data) {
        if (!data.purchase) return;

        // Add to purchases array if not exists
        if (typeof purchases !== 'undefined' && !purchases.find(p => p.id === data.purchase.id)) {
            purchases.unshift(data.purchase);
            if (typeof renderPurchases === 'function') {
                renderPurchases();
            }
            this.showNotification('New Purchase', `Purchase #${data.purchase.id} added`, 'success');
        }
    }

    handlePurchaseUpdated(data) {
        if (!data.purchase || typeof purchases === 'undefined') return;

        const index = purchases.findIndex(p => p.id === data.purchase.id);
        if (index !== -1) {
            purchases[index] = data.purchase;
            if (typeof renderPurchases === 'function') {
                renderPurchases();
            }
            this.showNotification('Purchase Updated', `Purchase #${data.purchase.id} updated`, 'info');
        }
    }

    handlePurchaseDeleted(data) {
        if (!data.purchaseId || typeof purchases === 'undefined') return;

        const index = purchases.findIndex(p => p.id === data.purchaseId);
        if (index !== -1) {
            purchases.splice(index, 1);
            if (typeof renderPurchases === 'function') {
                renderPurchases();
            }
            this.showNotification('Purchase Deleted', `Purchase #${data.purchaseId} removed`, 'warning');
        }
    }

    handleBillUpdated(data) {
        if (!data.bill || typeof bills === 'undefined') return;
        const index = bills.findIndex(b => b.id === data.bill.id);
        if (index !== -1) {
            bills[index] = data.bill;
            if (typeof renderSales === 'function') renderSales();
            this.showNotification('Bill Updated', `Bill #${data.bill.id} updated`, 'info');
        }
    }

    handleBillDeleted(data) {
        if (!data.billId || typeof bills === 'undefined') return;
        const index = bills.findIndex(b => b.id === data.billId);
        if (index !== -1) {
            bills.splice(index, 1);
            if (typeof renderSales === 'function') renderSales();
            this.showNotification('Bill Deleted', `Bill #${data.billId} removed`, 'warning');
        }
    }

    handleCustomerCreated(data) {
        if (!data.customer || typeof customers === 'undefined') return;
        if (!customers.find(c => c.id === data.customer.id)) {
            customers.push(data.customer);
            if (typeof updateCustomerDatalist === 'function') updateCustomerDatalist();
            this.showNotification('Customer Added', `${data.customer.name} added`, 'success');
        }
    }

    handleCustomerUpdated(data) {
        if (!data.customer || typeof customers === 'undefined') return;
        const index = customers.findIndex(c => c.id === data.customer.id);
        if (index !== -1) {
            customers[index] = data.customer;
            if (typeof updateCustomerDatalist === 'function') updateCustomerDatalist();
            this.showNotification('Customer Updated', `${data.customer.name} updated`, 'info');
        }
    }

    handleCustomerDeleted(data) {
        if (!data.customerId || typeof customers === 'undefined') return;
        const index = customers.findIndex(c => c.id === data.customerId);
        if (index !== -1) {
            const customerName = customers[index].name;
            customers.splice(index, 1);
            if (typeof updateCustomerDatalist === 'function') updateCustomerDatalist();
            this.showNotification('Customer Deleted', `${customerName} removed`, 'warning');
        }
    }

    handleSupplierCreated(data) {
        if (!data.supplier || typeof suppliers === 'undefined') return;
        if (!suppliers.find(s => s.id === data.supplier.id)) {
            suppliers.push(data.supplier);
            if (typeof updateSupplierDatalist === 'function') updateSupplierDatalist();
            this.showNotification('Supplier Added', `${data.supplier.name} added`, 'success');
        }
    }

    handleSupplierUpdated(data) {
        if (!data.supplier || typeof suppliers === 'undefined') return;
        const index = suppliers.findIndex(s => s.id === data.supplier.id);
        if (index !== -1) {
            suppliers[index] = data.supplier;
            if (typeof updateSupplierDatalist === 'function') updateSupplierDatalist();
            this.showNotification('Supplier Updated', `${data.supplier.name} updated`, 'info');
        }
    }

    handleSupplierDeleted(data) {
        if (!data.supplierId || typeof suppliers === 'undefined') return;
        const index = suppliers.findIndex(s => s.id === data.supplierId);
        if (index !== -1) {
            const supplierName = suppliers[index].name;
            suppliers.splice(index, 1);
            if (typeof updateSupplierDatalist === 'function') updateSupplierDatalist();
            this.showNotification('Supplier Deleted', `${supplierName} removed`, 'warning');
        }
    }

    handleProformaCreated(data) {
        if (!data.proforma || typeof proformaInvoices === 'undefined') return;
        if (!proformaInvoices.find(p => p.id === data.proforma.id)) {
            proformaInvoices.unshift(data.proforma);
            if (typeof renderProformaInvoices === 'function') renderProformaInvoices();
            this.showNotification('Proforma Created', `Proforma #${data.proforma.id} created`, 'success');
        }
    }

    handleProformaDeleted(data) {
        if (!data.proformaId || typeof proformaInvoices === 'undefined') return;
        const index = proformaInvoices.findIndex(p => p.id === data.proformaId);
        if (index !== -1) {
            proformaInvoices.splice(index, 1);
            if (typeof renderProformaInvoices === 'function') renderProformaInvoices();
            this.showNotification('Proforma Deleted', `Proforma #${data.proformaId} removed`, 'warning');
        }
    }

    handleSettingsUpdated(data) {
        if (!data.type || !data.data) return;
        if (data.type === 'company' && typeof companyDetails !== 'undefined') {
            Object.assign(companyDetails, data.data);
            localStorage.setItem('companyDetails', JSON.stringify(companyDetails));
            this.showNotification('Settings Updated', 'Company details updated', 'info');
        } else if (data.type === 'banking' && typeof bankingDetails !== 'undefined') {
            Object.assign(bankingDetails, data.data);
            localStorage.setItem('bankingDetails', JSON.stringify(bankingDetails));
            this.showNotification('Settings Updated', 'Banking details updated', 'info');
        }
        if (typeof displayCurrentSettings === 'function') displayCurrentSettings();
    }

    // Show toast notification
    showNotification(title, message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `realtime-notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <strong>${this.getIcon(type)} ${title}</strong>
                <p>${message}</p>
            </div>
        `;

        // Add styles if not already present
        if (!document.getElementById('realtime-notification-styles')) {
            const style = document.createElement('style');
            style.id = 'realtime-notification-styles';
            style.textContent = `
                .realtime-notification {
                    position: fixed;
                    top: 80px;
                    right: 20px;
                    background: white;
                    padding: 15px 20px;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    z-index: 10000;
                    min-width: 300px;
                    max-width: 400px;
                    animation: slideIn 0.3s ease-out;
                    border-left: 4px solid #667eea;
                }
                .realtime-notification.success {
                    border-left-color: #10b981;
                }
                .realtime-notification.error {
                    border-left-color: #ef4444;
                }
                .realtime-notification.warning {
                    border-left-color: #f59e0b;
                }
                .realtime-notification.info {
                    border-left-color: #3b82f6;
                }
                .notification-content strong {
                    display: block;
                    margin-bottom: 5px;
                    font-size: 14px;
                }
                .notification-content p {
                    margin: 0;
                    font-size: 13px;
                    color: #666;
                }
                @keyframes slideIn {
                    from {
                        transform: translateX(400px);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                @keyframes slideOut {
                    from {
                        transform: translateX(0);
                        opacity: 1;
                    }
                    to {
                        transform: translateX(400px);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(notification);

        // Auto remove after 4 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        }, 4000);
    }

    // Get icon for notification type
    getIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || icons.info;
    }

    // Check connection status
    isOnline() {
        return this.isConnected;
    }

    // Update connection status indicator in UI
    updateConnectionStatus(status) {
        const statusElement = document.getElementById('connection-status');
        const statusText = statusElement?.querySelector('.status-text');

        if (!statusElement || !statusText) return;

        statusElement.className = 'connection-status';

        switch (status) {
            case 'connected':
                statusElement.classList.add('connected');
                statusText.textContent = 'Live';
                statusElement.title = 'Real-time updates active';
                break;
            case 'disconnected':
                statusElement.classList.add('disconnected');
                statusText.textContent = 'Offline';
                statusElement.title = 'Reconnecting...';
                break;
            default:
                statusText.textContent = 'Connecting...';
                statusElement.title = 'Establishing connection...';
        }
    }
}

// Initialize real-time sync when DOM is ready
let realtimeSync;

document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for auth to complete
    setTimeout(() => {
        realtimeSync = new RealtimeSync();
        realtimeSync.init();

        // Make it globally available
        window.realtimeSync = realtimeSync;
    }, 500);
});
