/**
 * BloodLink - Requests Listing & Discovery Controller
 * Handles live filtering, sorting, card rendering, and donor response modal.
 */

let allLoadedRequests = [];
let activeModalRequest = null;

// Fetch requests with query parameters
async function loadBloodRequests() {
  const container = document.getElementById('requests-container');
  const countText = document.getElementById('results-count-text');
  
  const bloodGroup = document.getElementById('filter-blood-group')?.value || '';
  const componentType = document.getElementById('filter-component')?.value || '';
  const urgency = document.getElementById('filter-urgency')?.value || '';
  const search = document.getElementById('filter-search')?.value.trim() || '';
  const sortBy = document.getElementById('sort-by')?.value || 'urgency';

  const params = new URLSearchParams();
  if (bloodGroup) params.append('bloodGroup', bloodGroup);
  if (componentType) params.append('componentType', componentType);
  if (urgency) params.append('urgency', urgency);
  if (search) params.append('search', search);
  if (sortBy) params.append('sortBy', sortBy);

  try {
    const data = await API.get(`/api/requests?${params.toString()}`);
    if (data.success) {
      allLoadedRequests = data.requests || [];
      if (countText) {
        countText.textContent = `Showing ${allLoadedRequests.length} active emergency request(s)`;
      }
      renderRequestCards(allLoadedRequests);
    }
  } catch (err) {
    if (container) {
      container.innerHTML = `
        <div class="col-12">
          <div class="alert alert-danger small">
            <strong>Unable to load blood requests:</strong> ${err.message}. Please check if the server is running.
          </div>
        </div>
      `;
    }
  }
}

// Render Request Cards to DOM
function renderRequestCards(requests) {
  const container = document.getElementById('requests-container');
  if (!container) return;

  if (requests.length === 0) {
    container.innerHTML = `
      <div class="col-12">
        <div class="card text-center p-5 bg-white">
          <h5 class="fw-bold text-dark">No Matching Blood Requests Found</h5>
          <p class="text-muted small mb-3">
            There are currently no open emergency requests matching your selected filters.
          </p>
          <div>
            <button class="btn btn-outline-secondary btn-sm" onclick="resetFilters()">Reset All Filters</button>
            <a href="/request-blood.html" class="btn btn-danger btn-sm ms-2">Submit a Request</a>
          </div>
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = requests.map(req => {
    const urgencyBadgeClass = req.urgency === 'immediate' 
      ? 'bg-danger' 
      : req.urgency === 'within_24h' 
        ? 'bg-warning text-dark' 
        : 'bg-info text-dark';
    
    const urgencyLabel = req.urgency === 'immediate'
      ? 'Immediate (< 12h)'
      : req.urgency === 'within_24h'
        ? 'Within 24h'
        : 'Within 48h';

    const componentLabel = req.componentType === 'platelets' ? 'Platelets' : 'Whole Blood';
    const postedDate = new Date(req.createdAt).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    return `
      <div class="col-lg-4 col-md-6">
        <div class="card h-100 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all d-flex flex-column justify-content-between">
          <div>
            <div class="d-flex justify-content-between align-items-start mb-2.5">
              <span class="badge-blood">${req.bloodGroup}</span>
              <span class="badge ${urgencyBadgeClass} px-2.5 py-1 text-xs rounded-full font-semibold">${urgencyLabel}</span>
            </div>

            <h6 class="font-bold text-slate-900 text-sm mb-1">${escapeHtml(req.hospitalName)}</h6>
            <p class="text-slate-500 text-xs mb-3 font-medium">
              ${escapeHtml(req.locality ? `${req.locality}, ${req.city}` : req.city)}
            </p>

            <div class="d-flex flex-wrap gap-1.5 mb-3">
              <span class="badge bg-slate-100 text-slate-700 border border-slate-200 text-xs px-2.5 py-1 rounded-lg">
                ${req.unitsRequired} Unit(s)
              </span>
              <span class="badge bg-slate-100 text-slate-700 border border-slate-200 text-xs px-2.5 py-1 rounded-lg">
                ${componentLabel}
              </span>
              <span class="badge ${req.status === 'open' ? 'badge-status-open' : 'bg-primary'} text-xs px-2.5 py-1 rounded-lg">
                ${req.status === 'open' ? 'Open' : 'Responses Received'}
              </span>
            </div>
          </div>

          <div class="border-t border-slate-100 pt-3 mt-auto d-flex justify-content-between align-items-center">
            <span class="text-slate-400 text-xs">Posted: ${postedDate}</span>
            <button class="btn btn-outline-danger btn-sm py-1.5 px-3 rounded-xl text-xs font-semibold" onclick="openRequestModal('${req._id}')">
              View Details
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Open Detailed Modal
function openRequestModal(requestId) {
  const req = allLoadedRequests.find(r => r._id === requestId);
  if (!req) return;
  activeModalRequest = req;

  const content = document.getElementById('modal-request-content');
  const actions = document.getElementById('modal-request-actions');

  const componentLabel = req.componentType === 'platelets' ? 'Platelets (SDP/RDP)' : 'Whole Blood';
  const urgencyLabel = req.urgency === 'immediate'
    ? 'Immediate (< 12 Hours)'
    : req.urgency === 'within_24h'
      ? 'Within 24 Hours'
      : 'Within 48 Hours';

  content.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-3">
      <div>
        <span class="badge-blood fs-5">${req.bloodGroup}</span>
        <span class="badge bg-secondary ms-2">${componentLabel}</span>
      </div>
      <span class="badge bg-danger p-2">${urgencyLabel}</span>
    </div>

    <table class="table table-sm table-bordered small mb-3">
      <tbody>
        <tr><th class="bg-light w-40">Units Required:</th><td>${req.unitsRequired} Unit(s)</td></tr>
        <tr><th class="bg-light">Required By Date:</th><td>${req.requiredDate || 'Urgent'}</td></tr>
        <tr><th class="bg-light">Hospital:</th><td class="fw-bold">${escapeHtml(req.hospitalName)}</td></tr>
        <tr><th class="bg-light">Location:</th><td>${escapeHtml(req.locality ? `${req.locality}, ${req.city}` : req.city)}</td></tr>
        <tr><th class="bg-light">Hospital Address:</th><td>${escapeHtml(req.hospitalAddress)}</td></tr>
        <tr><th class="bg-light">Patient Name:</th><td>${escapeHtml(req.patientName)}</td></tr>
        <tr><th class="bg-light">Notes:</th><td>${escapeHtml(req.notes || 'None provided')}</td></tr>
      </tbody>
    </table>

    <div class="alert alert-info py-2 px-3 small mb-0">
      <strong>Coordination Note:</strong> If you are eligible and available to donate, submit your response below. The requester will receive your contact details directly to coordinate donation at the hospital blood bank.
    </div>
  `;

  // Render Action Buttons depending on login & role
  if (!currentUser) {
    actions.innerHTML = `
      <span class="small text-muted me-auto">Log in as a donor to respond.</span>
      <a href="/login.html" class="btn btn-danger btn-sm">Login to Respond</a>
      <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Close</button>
    `;
  } else if (currentUser._id === req.requesterId) {
    actions.innerHTML = `
      <span class="badge bg-info text-dark me-auto">This is your submitted request.</span>
      <a href="/dashboard.html" class="btn btn-secondary btn-sm">Manage in Dashboard</a>
      <button type="button" class="btn btn-outline-secondary btn-sm" data-bs-dismiss="modal">Close</button>
    `;
  } else if (currentUser.role === 'donor') {
    actions.innerHTML = `
      <div class="w-100">
        <div id="donor-response-feedback" class="d-none mb-2"></div>
        <div class="mb-2">
          <input type="text" id="donor-message-input" class="form-control form-control-sm" placeholder="Optional message (e.g. 'I can reach the hospital by 4 PM')">
        </div>
        <div class="d-flex justify-content-end gap-2">
          <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cancel</button>
          <button type="button" class="btn btn-danger btn-sm" id="btn-donor-respond" onclick="submitDonorResponse('${req._id}')">
            I'm Available to Help
          </button>
        </div>
      </div>
    `;
  } else {
    actions.innerHTML = `
      <span class="small text-muted me-auto">Only registered donor accounts can submit availability responses.</span>
      <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Close</button>
    `;
  }

  const modal = new bootstrap.Modal(document.getElementById('requestDetailModal'));
  modal.show();
}

// Submit Donor Response
async function submitDonorResponse(requestId) {
  const btn = document.getElementById('btn-donor-respond');
  const feedback = document.getElementById('donor-response-feedback');
  const messageInput = document.getElementById('donor-message-input');

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Recording...';

  try {
    const data = await API.post(`/api/requests/${requestId}/respond`, {
      message: messageInput ? messageInput.value.trim() : ''
    });

    feedback.className = 'alert alert-success py-2 px-3 small d-block';
    feedback.textContent = data.message || 'Thank you! Your availability has been shared with the requester.';
    btn.className = 'btn btn-success btn-sm';
    btn.textContent = 'Response Recorded ✔';
    btn.disabled = true;

    setTimeout(() => {
      loadBloodRequests();
    }, 1200);
  } catch (err) {
    feedback.className = 'alert alert-danger py-2 px-3 small d-block';
    feedback.textContent = err.message || 'Could not submit response. You may have already responded.';
    btn.disabled = false;
    btn.textContent = "I'm Available to Help";
  }
}

// Reset Filters helper
function resetFilters() {
  const form = document.getElementById('filter-form');
  if (form) form.reset();
  loadBloodRequests();
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

// Init listeners
document.addEventListener('DOMContentLoaded', () => {
  const filterForm = document.getElementById('filter-form');
  if (filterForm) {
    filterForm.addEventListener('submit', (e) => {
      e.preventDefault();
      loadBloodRequests();
    });
  }

  const resetBtn = document.getElementById('btn-reset-filters');
  if (resetBtn) {
    resetBtn.addEventListener('click', resetFilters);
  }

  const sortSelect = document.getElementById('sort-by');
  if (sortSelect) {
    sortSelect.addEventListener('change', loadBloodRequests);
  }

  loadBloodRequests();
});
