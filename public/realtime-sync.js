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
    handleBillCreated(data) {
        const currentUser = getCurrentUser();
        
        if (data.bill) {
            // Add bill to bills array if not already present
            if (!bills.find(b => b.id === data.bill.id)) {
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
