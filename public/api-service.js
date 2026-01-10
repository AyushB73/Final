// API Service for Backend Communication
// This replaces localStorage with real database calls

const API_BASE_URL = 'https://windowersplastiwood.up.railway.app';

class APIService {
    // Generic API call handler
    static async request(endpoint, options = {}) {
        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('API Error Response:', errorText);
                throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            console.error('Endpoint:', endpoint);
            console.error('API Base URL:', API_BASE_URL);
            throw error;
        }
    }

    // Inventory API
    static async getInventory() {
        return await this.request('/api/inventory');
    }

    static async addInventoryItem(item) {
        return await this.request('/api/inventory', {
            method: 'POST',
            body: JSON.stringify(item)
        });
    }

    static async updateInventoryItem(id, item) {
        return await this.request(`/api/inventory/${id}`, {
            method: 'PUT',
            body: JSON.stringify(item)
        });
    }

    static async deleteInventoryItem(id) {
        return await this.request(`/api/inventory/${id}`, {
            method: 'DELETE'
        });
    }

    // Bills API
    static async getBills() {
        return await this.request('/api/bills');
    }

    static async addBill(bill) {
        return await this.request('/api/bills', {
            method: 'POST',
            body: JSON.stringify(bill)
        });
    }

    static async updateBill(id, bill) {
        try {
            const jsonData = JSON.stringify(bill);
            console.log('Stringified bill data:', jsonData);
            return await this.request(`/api/bills/${id}`, {
                method: 'PUT',
                body: jsonData
            });
        } catch (error) {
            console.error('Error stringifying bill data:', error);
            console.error('Bill object:', bill);
            throw new Error('Failed to serialize bill data: ' + error.message);
        }
    }

    static async deleteBill(id) {
        return await this.request(`/api/bills/${id}`, {
            method: 'DELETE'
        });
    }

    // Purchases API
    static async getPurchases() {
        return await this.request('/api/purchases');
    }

    static async addPurchase(purchase) {
        return await this.request('/api/purchases', {
            method: 'POST',
            body: JSON.stringify(purchase)
        });
    }

    static async updatePurchase(id, purchase) {
        return await this.request(`/api/purchases/${id}`, {
            method: 'PUT',
            body: JSON.stringify(purchase)
        });
    }

    static async deletePurchase(id) {
        return await this.request(`/api/purchases/${id}`, {
            method: 'DELETE'
        });
    }

    // Customers API
    static async getCustomers() {
        return await this.request('/api/customers');
    }

    static async addCustomer(customer) {
        return await this.request('/api/customers', {
            method: 'POST',
            body: JSON.stringify(customer)
        });
    }

    static async updateCustomer(id, customer) {
        return await this.request(`/api/customers/${id}`, {
            method: 'PUT',
            body: JSON.stringify(customer)
        });
    }

    static async deleteCustomer(id) {
        return await this.request(`/api/customers/${id}`, {
            method: 'DELETE'
        });
    }

    // Suppliers API
    static async getSuppliers() {
        return await this.request('/api/suppliers');
    }

    static async addSupplier(supplier) {
        return await this.request('/api/suppliers', {
            method: 'POST',
            body: JSON.stringify(supplier)
        });
    }

    static async updateSupplier(id, supplier) {
        return await this.request(`/api/suppliers/${id}`, {
            method: 'PUT',
            body: JSON.stringify(supplier)
        });
    }

    static async deleteSupplier(id) {
        return await this.request(`/api/suppliers/${id}`, {
            method: 'DELETE'
        });
    }

    // Initialize database with sample data
    static async initializeDatabase() {
        return await this.request('/api/initialize', {
            method: 'POST'
        });
    }
}

// Make it globally available
window.APIService = APIService;
