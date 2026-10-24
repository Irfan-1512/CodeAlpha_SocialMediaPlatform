import { api } from './api.js';
import { avatar } from './avatar.js';

const $ = (id) => document.getElementById(id);
let profile;

// All user text goes in through textContent, never innerHTML.
function render(p) {
  profile = p;
  document.title = `${p.name} (@${p.username}) | MoonCircle`;
  $('p-avatar').replaceChildren(avatar(p, 72));
  $('p-name').textContent = p.name;
  $('p-handle').textContent = `@${p.username}`;
  $('p-bio').textContent = p.bio || 'No bio yet.';
  $('p-joined').textContent = `Joined ${new Date(p.created_at.replace(' ', 'T') + 'Z').toLocaleDateString()}`;
  $('c-posts').textContent = p.post_count;
  $('c-followers').textContent = p.follower_count;
  $('c-following').textContent = p.following_count;
  $('edit-btn').hidden = !p.is_me;
  $('status').hidden = true;
  $('profile').hidden = false;
}

async function load() {
  try {
    let username = new URLSearchParams(location.search).get('user');
    if (!username) {
      // No ?user= means "my own profile"
      const { user } = await api('/auth/me');
      if (!user) {
        location.href = '/login.html';
        return;
      }
      username = user.username;
    }
    render(await api(`/users/${encodeURIComponent(username)}`));
  } catch (err) {
    $('status').textContent = err.message;
    $('status').classList.add('error');
  }
}

$('edit-btn').addEventListener('click', () => {
  $('edit-name').value = profile.name;
  $('edit-bio').value = profile.bio;
  $('edit-notice').textContent = '';
  $('edit-form').hidden = false;
  $('edit-name').focus();
});

$('edit-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const notice = $('edit-notice');
  notice.className = 'notice';
  try {
    const updated = await api('/users/me', {
      method: 'PATCH',
      body: JSON.stringify({ name: $('edit-name').value, bio: $('edit-bio').value }),
    });
    render({ ...profile, ...updated });
    $('edit-form').hidden = true;
    $('edit-btn').focus();
  } catch (err) {
    notice.className = 'notice error';
    notice.textContent = err.message;
  }
});

load();