// Authentication and Authorization

const AUTH_KEY = 'plastiwood_auth';

// Demo users (in production, this would be in a secure backend)
const USERS = {
    'Pramod': { password: 'Pramod@2026', role: 'owner', name: 'Pramod' },
    'Sandeep': { password: 'Sandeep@2026', role: 'staff', name: 'Sandeep' }
};

function handleLogin(event) {
    event.preventDefault();
    
    const name = document.getElementById('name').value;
    const password = document.getElementById('password').value;
    
    const user = USERS[name];
    
    if (!user) {
        showError('Invalid name selected');
        return;
    }
    
    if (user.password !== password) {
        showError('Invalid password');
        return;
    }
    
    // Store auth session
    const session = {
        username: name,
        role: user.role,
        name: user.name,
        loginTime: new Date().toISOString()
    };
    
    localStorage.setItem(AUTH_KEY, JSON.stringify(session));
    
    // Redirect to main app
    window.location.href = 'index.html';
}

function showError(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 3000);
}

function getCurrentUser() {
    const session = localStorage.getItem(AUTH_KEY);
    return session ? JSON.parse(session) : null;
}

function logout() {
    localStorage.removeItem(AUTH_KEY);
    window.location.href = 'login.html';
}

function requireAuth() {
    const user = getCurrentUser();
    if (!user) {
        window.location.href = 'login.html';
        return null;
    }
    return user;
}

function isOwner() {
    const user = getCurrentUser();
    return user && user.role === 'owner';
}

function isStaff() {
    const user = getCurrentUser();
    return user && user.role === 'staff';
}
