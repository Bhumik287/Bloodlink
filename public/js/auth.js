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

  // Always show a visible, direct "Logout" button so users can easily switch accounts!
  navContainer.innerHTML = `
    <li class="nav-item">
      <a class="nav-link text-white/90 hover:text-white" href="/">🏠 Home</a>
    </li>
    ${adminLink}
    <li class="nav-item">
      <a class="nav-link text-white/90 hover:text-white" href="/dashboard.html">Dashboard</a>
    </li>
    ${profileLink}
    <li class="nav-item d-flex align-items-center ms-lg-2 my-1 my-lg-0">
      <span class="text-white text-xs font-semibold me-2">${escapeNavHtml(user.name)}${roleBadge}</span>
    </li>
    <li class="nav-item ms-lg-1 my-1 my-lg-0">
      <button class="btn btn-outline-light btn-sm text-xs rounded-lg px-2.5 py-1 font-semibold" onclick="handleLogout()" title="Log out and switch account">
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
      <a class="nav-link text-white/90 hover:text-white" href="/">🏠 Home</a>
    </li>
    <li class="nav-item">
      <a class="nav-link text-white/90 hover:text-white" href="/login.html">Login</a>
    </li>
    <li class="nav-item ms-lg-2">
      <a class="nav-link btn btn-light text-danger btn-sm px-3 font-semibold rounded-lg" href="/register.html">Register</a>
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

// Auto-run on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  checkAuthSession();
});
