const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3004' : '';

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const session = urlParams.get('session');
    const userInfoDiv = document.getElementById('user-info');
    const verifyBtn = document.getElementById('verify-btn');
    const resendBtn = document.getElementById('resend-btn');
    const codeInput = document.getElementById('verification-code');
    const errorMsg = document.getElementById('error-message');
    const timerSpan = document.getElementById('timer');

    if (!session) {
        window.location.href = '/';
        return;
    }

    try {
        const userData = JSON.parse(atob(session));
        userInfoDiv.innerHTML = `<p>Logged in as: <strong>${userData.username}#${userData.discriminator}</strong></p>`;

        // Auto-send code on load
        await sendCode(userData.id);

    } catch (e) {
        console.error('Invalid session:', e);
        window.location.href = '/';
    }

    async function sendCode(discordId) {
        resendBtn.disabled = true;
        try {
            const res = await fetch(`${API_BASE}/api/verify/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ discordId })
            });
            const data = await res.json();

            if (data.success) {
                startCooldown(60);
            } else {
                showError(data.error || 'Failed to send code.');
                resendBtn.disabled = false;
            }
        } catch (err) {
            showError('Network error sending code.');
            resendBtn.disabled = false;
        }
    }

    verifyBtn.addEventListener('click', async () => {
        const code = codeInput.value.trim();
        if (code.length !== 6) {
            showError('Please enter a valid 6-digit code.');
            return;
        }

        const userData = JSON.parse(atob(session));
        verifyBtn.disabled = true;
        verifyBtn.textContent = 'Verifying...';

        try {
            const res = await fetch(`${API_BASE}/api/verify/check`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ discordId: userData.id, code })
            });
            const data = await res.json();

            if (data.success) {
                window.location.href = '/success.html';
            } else {
                showError(data.error || 'Invalid code.');
                verifyBtn.disabled = false;
                verifyBtn.textContent = 'Verify Code';
            }
        } catch (err) {
            showError('Network error verifying code.');
            verifyBtn.disabled = false;
            verifyBtn.textContent = 'Verify Code';
        }
    });

    resendBtn.addEventListener('click', () => {
        const userData = JSON.parse(atob(session));
        sendCode(userData.id);
    });

    function startCooldown(seconds) {
        let remaining = seconds;
        resendBtn.disabled = true;
        timerSpan.textContent = `(${remaining}s)`;

        const interval = setInterval(() => {
            remaining--;
            timerSpan.textContent = `(${remaining}s)`;
            if (remaining <= 0) {
                clearInterval(interval);
                timerSpan.textContent = '';
                resendBtn.disabled = false;
            }
        }, 1000);
    }

    function showError(msg) {
        errorMsg.textContent = msg;
        errorMsg.style.display = 'block';
    }
});
