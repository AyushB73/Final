// Utility Functions
export const Utils = {
    // Format currency
    formatCurrency(amount) {
        return `₹${parseFloat(amount || 0).toFixed(2)}`;
    },

    // Format date
    formatDate(date) {
        return new Date(date).toLocaleDateString('en-IN');
    },

    // Format time
    formatTime(date) {
        return new Date(date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    },

    // Parse JSON safely
    parseJSON(str, defaultValue = {}) {
        if (typeof str === 'string') {
            try {
                return JSON.parse(str);
            } catch (e) {
                console.error('JSON parse error:', e);
                return defaultValue;
            }
        }
        return str || defaultValue;
    },

    // Show loading state
    showLoading(element, show = true) {
        if (element) {
            element.disabled = show;
            element.style.opacity = show ? '0.6' : '1';
        }
    },

    // Debounce function
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
};
