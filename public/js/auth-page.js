import { api } from './api.js';

const $ = (id) => document.getElementById(id);
let registering = false;

// Hidden fields must not be "required", or the browser blocks the form silently.
function setMode(register) {
  registering = register;
  for (const field of document.querySelectorAll('[data-register]')) {
    field.hidden = !register;
    field.querySelector('input').required = register;
  }
  $('auth-title').textContent = register ? 'Create account' : 'Log in';
  $('auth-submit').textContent = register ? 'Register' : 'Log in';
  $('switch-text').textContent = register ? 'Already a member?' : 'New here?';
  $('switch-btn').textContent = register ? 'Log in' : 'Create an account';
  $('password').autocomplete = register ? 'new-password' : 'current-password';
  $('auth-notice').textContent = '';
}

$('switch-btn').addEventListener('click', () => setMode(!registering));

$('auth-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const notice = $('auth-notice');
  const button = $('auth-submit');
  const email = $('email').value;
  const password = $('password').value;

  button.disabled = true;
  notice.className = 'notice';
  notice.textContent = 'Please wait...';
  try {
    if (registering) {
      await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name: $('name').value, username: $('username').value, email, password }),
      });
    }
    // Register does not set the cookie, so log in straight after.
    await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    location.href = '/';
  } catch (err) {
    notice.className = 'notice error';
    notice.textContent = err.message;
    button.disabled = false;
  }
});

setMode(location.hash === '#register');