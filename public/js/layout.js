import { api } from './api.js';
import { avatar } from './avatar.js';

// Shared header and footer. The markup is static (no user input), so innerHTML is safe here.
document.getElementById('site-header').innerHTML = `
  <div class="container header-inner">
    <a class="logo" href="/">MoonCircle</a>
    <form class="search" id="search-form" role="search">
      <label class="sr-only" for="search-input">Search users</label>
      <input id="search-input" type="search" placeholder="Search users" maxlength="50" autocomplete="off">
      <ul id="search-results" class="search-results" hidden></ul>
      <p id="search-live" class="sr-only" aria-live="polite"></p>
    </form>
    <nav class="site-nav" aria-label="Main">
      <a href="/">Home</a>
      <a href="/login.html" id="auth-link">Login</a>
    </nav>
  </div>`;

document.getElementById('site-footer').innerHTML = `
  <div class="container"><p>&copy; 2026 MoonCircle. Built for CodeAlpha.</p></div>`;

// User search: results are built with textContent because names are user text.
const form = document.getElementById('search-form');
const input = document.getElementById('search-input');
const results = document.getElementById('search-results');
const live = document.getElementById('search-live');
let timer;
let latest = 0; // ignore answers that arrive after a newer search

function showResults(users) {
  results.replaceChildren();
  if (!users.length) {
    const none = document.createElement('li');
    none.className = 'muted search-none';
    none.textContent = 'No users found';
    results.append(none);
  }
  for (const user of users) {
    const li = document.createElement('li');
    const link = document.createElement('a');
    link.href = `/profile.html?user=${encodeURIComponent(user.username)}`;
    const text = document.createElement('span');
    const name = document.createElement('strong');
    name.textContent = user.name;
    const handle = document.createElement('span');
    handle.className = 'muted';
    handle.textContent = ` @${user.username}`;
    text.append(name, handle);
    link.append(avatar(user, 32), text);
    li.append(link);
    results.append(li);
  }
  results.hidden = false;
  live.textContent = `${users.length} users found`;
}

async function search() {
  const q = input.value.trim();
  if (!q) {
    results.hidden = true;
    return;
  }
  const mine = ++latest;
  try {
    const users = await api(`/users?q=${encodeURIComponent(q)}`);
    if (mine === latest) showResults(users);
  } catch {
    if (mine === latest) results.hidden = true;
  }
}

input.addEventListener('input', () => {
  clearTimeout(timer);
  timer = setTimeout(search, 250);
});
form.addEventListener('submit', (event) => {
  event.preventDefault();
  clearTimeout(timer);
  search();
});
input.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') results.hidden = true;
});
document.addEventListener('click', (event) => {
  if (!form.contains(event.target)) results.hidden = true;
});

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