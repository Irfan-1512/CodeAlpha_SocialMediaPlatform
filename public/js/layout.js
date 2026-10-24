import { api } from './api.js';
import { avatar } from './avatar.js';

// Icons are static markup (no user input), so innerHTML is safe for them and the shell below.
const ICONS = {
  home: '<path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  login: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
};
const item = (name, label) =>
  `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ` +
  `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>` +
  `<span class="nav-label">${label}</span>`;

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
      <a class="nav-item" href="/">${item('home', 'Home')}</a>
      <a class="nav-item" href="/login.html" id="auth-link">${item('login', 'Login')}</a>
    </nav>
  </div>`;

document.getElementById('site-footer').innerHTML = `
  <div class="container"><p>&copy; 2026 MoonCircle. Built for CodeAlpha.</p></div>`;

// Mark the link for the current page (read by screen readers and styled in CSS).
function markCurrent() {
  for (const link of document.querySelectorAll('.site-nav a')) {
    const same = link.pathname === location.pathname &&
      (link.pathname !== '/profile.html' || link.search === location.search);
    if (same) link.setAttribute('aria-current', 'page');
  }
}
markCurrent();

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
async function showUser() {
  try {
    const { user } = await api('/auth/me');
    if (!user) return;

    const profile = document.createElement('a');
    profile.className = 'nav-item';
    profile.href = `/profile.html?user=${encodeURIComponent(user.username)}`;
    profile.innerHTML = item('user', 'Profile');

    const logout = document.createElement('button');
    logout.className = 'nav-item';
    logout.type = 'button';
    logout.innerHTML = item('logout', 'Logout');
    logout.addEventListener('click', async () => {
      try {
        await api('/auth/logout', { method: 'POST' });
      } catch {
        // already logged out
      }
      location.href = '/';
    });

    document.getElementById('auth-link').replaceWith(profile, logout);
    markCurrent();
  } catch {
    // leave the Login link in place
  }
}

showUser();