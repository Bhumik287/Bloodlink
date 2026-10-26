/**
 * BloodLink - Client-side Authentication & Navigation Synchronization
 * Handles session verification, dynamic navbar state, and logout actions.
 */

let currentUser = null;

async function checkAuthSession() {
  try {
    const data = await API.get('/api/auth/me');
    if (data.success && data.user) {
      currentUser = data.user;
      renderAuthenticatedNav(currentUser);
      return currentUser;
    }
  } catch (err) {
    currentUser = null;
    renderUnauthenticatedNav();
    return null;
  }
}

function renderAuthenticatedNav(user) {
  const navContainer = document.getElementById('navbar-auth-links');
  if (!navContainer) return;

  const roleBadge = user.role === 'admin' 
    ? '<span class="badge bg-dark text-white ms-1">Admin</span>'
    : user.role === 'donor'
      ? '<span class="badge bg-light text-danger ms-1">Donor</span>'
      : '<span class="badge bg-light text-dark ms-1">Requester</span>';

  let adminLink = '';
  if (user.role === 'admin') {
    adminLink = `<li class="nav-item"><a class="nav-link text-white fw-bold" href="/admin.html">🛡️ Admin Panel</a></li>`;
  }

  let profileLink = '';
  if (user.role === 'donor') {
    profileLink = `<li class="nav-item"><a class="nav-link text-white/90 hover:text-white" href="/profile.html">Profile</a></li>`;
  }

  let dashboardLink = '';
  if (!window.location.pathname.includes('dashboard.html')) {
    dashboardLink = `<li class="nav-item"><a class="nav-link text-white/90 hover:text-white" href="/dashboard.html">Dashboard</a></li>`;
  }

  // Render clean authenticated actions without duplicating primary navbar links
  navContainer.innerHTML = `
    ${adminLink}
    ${dashboardLink}
    ${profileLink}
    <li class="nav-item d-flex align-items-center ms-lg-2 my-2 my-lg-0">
      <span class="text-white text-xs font-semibold me-2">${escapeNavHtml(user.name)}${roleBadge}</span>
    </li>
    <li class="nav-item ms-lg-1 my-1 my-lg-0">
      <button class="btn btn-outline-light btn-sm text-xs rounded-lg px-2.5 py-1 font-semibold w-100 w-lg-auto" onclick="handleLogout()" title="Log out and switch account">
        🚪 Logout
      </button>
    </li>
  `;
}

function renderUnauthenticatedNav() {
  const navContainer = document.getElementById('navbar-auth-links');
  if (!navContainer) return;

  navContainer.innerHTML = `
    <li class="nav-item">
      <a class="nav-link text-white/90 hover:text-white font-medium" href="/login.html">🔑 Login</a>
    </li>
    <li class="nav-item ms-lg-2 mt-2 mt-lg-0">
      <a class="nav-link btn bg-white text-crimson-600 hover:bg-slate-100 font-semibold px-4 py-1.5 rounded-lg shadow-sm" href="/register.html">Register</a>
    </li>
  `;
}

async function handleLogout() {
  try {
    await API.post('/api/auth/logout', {});
    window.location.href = '/login.html?logged_out=1';
  } catch (err) {
    console.error('Logout error:', err);
    window.location.href = '/login.html';
  }
}

function escapeNavHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Automatically close mobile navbar collapse when a link is clicked
document.addEventListener('click', (e) => {
  const link = e.target.closest('.navbar-collapse .nav-link:not(.dropdown-toggle)');
  if (link && window.innerWidth < 992) {
    const navbarCollapse = link.closest('.navbar-collapse');
    if (navbarCollapse && navbarCollapse.classList.contains('show')) {
      if (typeof bootstrap !== 'undefined' && bootstrap.Collapse) {
        const bsCollapse = bootstrap.Collapse.getInstance(navbarCollapse) || new bootstrap.Collapse(navbarCollapse, { toggle: false });
        bsCollapse.hide();
      } else {
        navbarCollapse.classList.remove('show');
      }
    }
  }
});

// Auto-run on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  checkAuthSession();
});
