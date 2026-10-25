/**
 * BloodLink - Unified User & Donor Dashboard Controller
 * Loads user requests, donor responses, and in-app notifications.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const user = await checkAuthSession();
  if (!user) {
    // Redirect to login if not authenticated
    window.location.href = '/login.html?redirect=dashboard';
    return;
  }

  // Populate User Info
  document.getElementById('dash-user-name').textContent = user.name;
  document.getElementById('dash-user-role').textContent = user.role.toUpperCase();
  document.getElementById('dash-user-role').className = user.role === 'admin' 
    ? 'badge bg-dark' 
    : user.role === 'donor' 
      ? 'badge bg-danger' 
      : 'badge bg-primary';

  document.getElementById('dash-user-info').textContent = 
    `Email: ${user.email} | Phone: ${user.phone} | Location: ${user.locality || ''}, ${user.city}`;

  // Hide or show sections depending on role
  if (user.role === 'requester') {
    const donorSection = document.getElementById('section-my-responses');
    const donorCard = document.getElementById('card-donor-quick-profile');
    if (donorSection) donorSection.classList.add('d-none');
    if (donorCard) donorCard.classList.add('d-none');
  } else if (user.role === 'donor') {
    loadDonorProfileSummary();
  }

  // Load Dashboard Data
  loadMyRequests();
  if (user.role === 'donor' || user.role === 'admin') {
    loadMyResponses();
  }
  loadNotifications();
});

// Load Donor Summary
async function loadDonorProfileSummary() {
  try {
    const data = await API.get('/api/donors/profile');
    if (data.success && data.profile) {
      document.getElementById('quick-blood-group').textContent = data.profile.bloodGroup || '-';
      const avail = document.getElementById('quick-avail-status');
      if (data.profile.isAvailable) {
        avail.className = 'badge bg-success';
        avail.textContent = 'Available to Donate';
      } else {
        avail.className = 'badge bg-secondary';
        avail.textContent = 'Temporarily Unavailable';
      }
    }
  } catch (err) {
    console.error('Error loading donor profile:', err);
  }
}

// Load My Submitted Requests
async function loadMyRequests() {
  const tbody = document.getElementById('my-requests-tbody');
  const countBadge = document.getElementById('badge-my-requests-count');

  try {
    const data = await API.get('/api/requests/my');
    if (data.success) {
      const requests = data.requests || [];
      countBadge.textContent = requests.length;

      if (requests.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" class="text-center py-4 text-muted">
              You haven't submitted any blood requests yet.
              <a href="/request-blood.html" class="ms-1 text-danger fw-semibold">Submit a Request</a>
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = requests.map(r => {
        const statusBadgeClass = r.status === 'open' 
          ? 'badge-status-open' 
          : r.status === 'fulfilled' 
            ? 'badge-status-fulfilled' 
            : r.status === 'cancelled'
              ? 'badge-status-cancelled'
              : 'badge bg-info text-dark';

        const statusLabel = r.status.replace('_', ' ').toUpperCase();
        const responseCount = r.responseCount || 0;

        return `
          <tr>
            <td>
              <span class="badge-blood me-1">${r.bloodGroup}</span>
              <strong class="d-block mt-1">${escapeHtml(r.patientName)}</strong>
            </td>
            <td>
              <div>${escapeHtml(r.hospitalName)}</div>
              <small class="text-muted">${escapeHtml(r.city)}</small>
            </td>
            <td>${r.unitsRequired} Unit(s)</td>
            <td><span class="badge bg-light text-dark border">${r.urgency}</span></td>
            <td><span class="badge ${statusBadgeClass}">${statusLabel}</span></td>
            <td>
              <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="viewResponsesForRequest('${r._id}')">
                ${responseCount} Response(s)
              </button>
            </td>
            <td>
              <div class="dropdown">
                <button class="btn btn-sm btn-light border dropdown-toggle" type="button" data-bs-toggle="dropdown">
                  Manage
                </button>
                <ul class="dropdown-menu dropdown-menu-end shadow-sm">
                  <li><button class="dropdown-item small" onclick="viewResponsesForRequest('${r._id}')">View Responses</button></li>
                  ${r.status === 'open' || r.status === 'responses_received' ? `
                    <li><button class="dropdown-item small text-success" onclick="updateRequestStatus('${r._id}', 'fulfilled')">Mark as Fulfilled</button></li>
                    <li><button class="dropdown-item small text-danger" onclick="updateRequestStatus('${r._id}', 'cancelled')">Cancel Request</button></li>
                  ` : ''}
                </ul>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }
  } catch (err) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center py-4 text-danger">
          Failed to load requests: ${err.message}
        </td>
      </tr>
    `;
  }
}

// Load My Donation Responses (for donors)
async function loadMyResponses() {
  const tbody = document.getElementById('my-responses-tbody');
  const countBadge = document.getElementById('badge-my-responses-count');

  try {
    const data = await API.get('/api/donors/my-responses');
    if (data.success) {
      const responses = data.responses || [];
      countBadge.textContent = responses.length;

      if (responses.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" class="text-center py-4 text-muted">
              You haven't responded to any blood requests yet.
              <a href="/find-blood.html" class="ms-1 text-danger fw-semibold">Browse Open Requests</a>
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = responses.map(resp => {
        const date = new Date(resp.createdAt).toLocaleDateString();
        const statusBadge = resp.status === 'completed'
          ? 'bg-success'
          : resp.status === 'cancelled'
            ? 'bg-danger'
            : resp.status === 'contacted'
              ? 'bg-primary'
              : 'bg-warning text-dark';

        return `
          <tr>
            <td>
              <span class="badge-blood">${resp.requestBloodGroup || '-'}</span>
              <span class="ms-1 fw-semibold">${escapeHtml(resp.requestPatientName || 'Emergency')}</span>
            </td>
            <td>${escapeHtml(resp.hospitalName || '-')}</td>
            <td><span class="badge bg-light text-dark border">${resp.urgency || 'Standard'}</span></td>
            <td><span class="badge ${statusBadge}">${resp.status.toUpperCase()}</span></td>
            <td><span class="text-muted">${date}</span></td>
            <td>
              ${resp.status === 'pending' || resp.status === 'contacted' ? `
                <button class="btn btn-outline-danger btn-sm py-0 px-2" onclick="cancelDonorResponse('${resp._id}')">
                  Cancel Response
                </button>
              ` : '<span class="text-muted small">No actions</span>'}
            </td>
          </tr>
        `;
      }).join('');
    }
  } catch (err) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-4 text-danger">
          Failed to load responses: ${err.message}
        </td>
      </tr>
    `;
  }
}

// View Responses Received for a Specific Request
async function viewResponsesForRequest(requestId) {
  const modalContent = document.getElementById('responses-modal-content');
  const modal = new bootstrap.Modal(document.getElementById('responsesModal'));
  modal.show();

  modalContent.innerHTML = `
    <div class="text-center py-4 text-muted">
      <div class="spinner-border spinner-border-sm text-danger me-2"></div>
      Loading donor responses...
    </div>
  `;

  try {
    const data = await API.get(`/api/requests/${requestId}/responses`);
    if (data.success) {
      const responses = data.responses || [];
      if (responses.length === 0) {
        modalContent.innerHTML = `
          <div class="text-center py-4">
            <p class="text-muted mb-0">No donors have pledged availability for this request yet.</p>
          </div>
        `;
        return;
      }

      modalContent.innerHTML = `
        <p class="text-secondary small mb-3">
          The following donors have pledged availability to donate for this emergency. Please contact them directly to coordinate hospital blood bank arrival.
        </p>
        <div class="list-group list-group-flush">
          ${responses.map(r => `
            <div class="list-group-item d-flex justify-content-between align-items-center px-0 py-3">
              <div>
                <div class="d-flex align-items-center gap-2">
                  <span class="badge-blood">${r.donorBloodGroup || 'Donor'}</span>
                  <strong class="text-dark">${escapeHtml(r.donorName)}</strong>
                  <span class="badge bg-light text-dark border">${r.status.toUpperCase()}</span>
                </div>
                <div class="text-secondary small mt-1">
                  📞 Phone: <strong class="text-dark">${escapeHtml(r.donorPhone)}</strong> | 📍 City: ${escapeHtml(r.donorCity || 'N/A')}
                </div>
                ${r.message ? `<div class="small text-muted mt-1 fst-italic">"${escapeHtml(r.message)}"</div>` : ''}
              </div>
              <div class="text-end">
                <a href="tel:${r.donorPhone}" class="btn btn-sm btn-outline-success">Call Donor</a>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }
  } catch (err) {
    modalContent.innerHTML = `
      <div class="alert alert-danger mb-0">
        Failed to load responses: ${err.message}
      </div>
    `;
  }
}

// Update Request Status (Fulfilled / Cancelled)
async function updateRequestStatus(requestId, newStatus) {
  if (!confirm(`Are you sure you want to mark this request as ${newStatus}?`)) return;

  try {
    await API.put(`/api/requests/${requestId}/status`, { status: newStatus });
    showAlert(`Request marked as ${newStatus}.`, 'success');
    loadMyRequests();
  } catch (err) {
    showAlert(`Could not update status: ${err.message}`, 'danger');
  }
}

// Cancel Donor Response
async function cancelDonorResponse(responseId) {
  if (!confirm('Are you sure you want to cancel your donation pledge?')) return;

  try {
    await API.delete(`/api/donors/responses/${responseId}`);
    showAlert('Your donation response was cancelled.', 'info');
    loadMyResponses();
  } catch (err) {
    showAlert(`Could not cancel response: ${err.message}`, 'danger');
  }
}

// Load In-App Notifications
async function loadNotifications() {
  const list = document.getElementById('notifications-list');
  try {
    const data = await API.get('/api/requests/notifications');
    if (data.success && data.notifications && data.notifications.length > 0) {
      list.innerHTML = data.notifications.map(n => `
        <div class="list-group-item py-2 px-3 ${n.isRead ? 'text-muted bg-light' : 'bg-white fw-semibold'}">
          <div class="d-flex justify-content-between align-items-start">
            <span class="text-dark">${escapeHtml(n.title)}</span>
            <small class="text-muted" style="font-size: 0.7rem;">${new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
          </div>
          <p class="small mb-0 text-secondary">${escapeHtml(n.message)}</p>
        </div>
      `).join('');
    } else {
      list.innerHTML = `<div class="list-group-item text-center py-3 text-muted">No notifications yet.</div>`;
    }
  } catch (err) {
    list.innerHTML = `<div class="list-group-item text-center py-3 text-muted">No notifications.</div>`;
  }
}

async function markAllNotificationsRead() {
  try {
    await API.put('/api/requests/notifications/read', {});
    loadNotifications();
  } catch (err) {
    console.error('Failed to mark notifications read:', err);
  }
}

// Utility: Show Alert
function showAlert(message, type = 'info') {
  const alertBox = document.getElementById('dashboard-alert');
  if (!alertBox) return;
  alertBox.className = `alert alert-${type} alert-dismissible fade show d-block`;
  alertBox.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;
}

// XSS Sanitizer Helper
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
