const BACKEND_URL = 'http://localhost:3004';

// Update member count (mock for now, or fetch from backend if endpoint exists)
const memberCountEl = document.getElementById('member-count');
if (memberCountEl) {
    memberCountEl.innerHTML = '<i class="fa-solid fa-user-group"></i> 50';
}

function login() {
    // Redirect to backend auth endpoint which handles the Discord OAuth URL construction
    window.location.href = `${BACKEND_URL}/auth/login`;
}

const navLoginBtn = document.getElementById('nav-login-btn');
if (navLoginBtn) navLoginBtn.addEventListener('click', login);

const verifyBtn = document.getElementById('verify-btn');
if (verifyBtn) verifyBtn.addEventListener('click', login);
