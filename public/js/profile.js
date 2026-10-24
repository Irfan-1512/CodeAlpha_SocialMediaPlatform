import { api } from './api.js';
import { avatar } from './avatar.js';
import { initPostList } from './post-card.js';

const $ = (id) => document.getElementById(id);
let profile;
let me = null;
let postsStarted = false;

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

  // The list is started once, even if the profile is re-rendered after an edit.
  if (!postsStarted) {
    postsStarted = true;
    initPostList({
      list: $('posts'),
      more: $('more'),
      status: $('posts-status'),
      params: { user: p.username },
      me,
    });
  }
}

async function load() {
  try {
    try {
      me = (await api('/auth/me')).user;
    } catch {
      me = null;
    }
    let username = new URLSearchParams(location.search).get('user');
    if (!username) {
      // No ?user= means "my own profile"
      if (!me) {
        location.href = '/login.html';
        return;
      }
      username = me.username;
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