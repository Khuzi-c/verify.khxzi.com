const BACKEND_URL = 'https://verify.khxzi.com';
const urlParams = new URLSearchParams(window.location.search);
const requestId = urlParams.get('id');

if (!requestId) {
    document.getElementById('status-container').innerHTML = '<p>No Request ID found.</p>';
} else {
    pollStatus();
}

async function pollStatus() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/verify/${requestId}`);
        if (!res.ok) throw new Error('Request not found');

        const data = await res.json();
        renderStatus(data);

        if (data.status === 'pending') {
            setTimeout(pollStatus, 5000); // Poll every 5 seconds
        }
    } catch (err) {
        document.getElementById('status-container').innerHTML = `<p>Error: ${err.message}</p>`;
    }
}

function renderStatus(data) {
    const container = document.getElementById('status-container');
    let color = '#ccc';
    if (data.status === 'approved') color = '#00FF00';
    if (data.status === 'rejected') color = '#FF0000';
    if (data.status === 'pending') color = '#FFA500';

    container.innerHTML = `
        <h2 style="color: ${color}">${data.status.toUpperCase()}</h2>
        <p><strong>Request ID:</strong> ${data.id}</p>
        <p><strong>Submitted:</strong> ${new Date(data.createdAt).toLocaleString()}</p>
        ${data.reviewerNote ? `<p><strong>Note:</strong> ${data.reviewerNote}</p>` : ''}
    `;
}
