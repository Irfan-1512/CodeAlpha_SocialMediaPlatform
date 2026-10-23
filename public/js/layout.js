import { api } from './api.js';

// Shared header and footer. The markup is static (no user input), so innerHTML is safe here.
document.getElementById('site-header').innerHTML = `
  <div class="container header-inner">
    <a class="logo" href="/">MoonCircle</a>
    <nav class="site-nav" aria-label="Main">
      <a href="/">Home</a>
      <a href="/login.html" id="auth-link">Login</a>
    </nav>
  </div>`;

document.getElementById('site-footer').innerHTML = `
  <div class="container"><p>&copy; 2026 MoonCircle. Built for CodeAlpha.</p></div>`;

// When logged in, swap the Login link for Profile and Logout.
// Until /api/auth/me exists (Phase 2) the request fails and Login stays.
async function showUser() {
  try {
    const { user } = await api('/auth/me');
    if (!user) return;

    const profile = document.createElement('a');
    profile.href = `/profile.html?user=${encodeURIComponent(user.username)}`;
    profile.textContent = 'Profile';

    const logout = document.createElement('button');
    logout.className = 'btn btn-secondary';
    logout.type = 'button';
    logout.textContent = 'Logout';
    logout.addEventListener('click', async () => {
      try {
        await api('/auth/logout', { method: 'POST' });
      } catch {
        // already logged out
      }
      location.href = '/';
    });

    document.getElementById('auth-link').replaceWith(profile, logout);
  } catch {
    // leave the Login link in place
  }
}

showUser();
s