import { api } from './api.js';
import { initPostList } from './post-card.js';

const $ = (id) => document.getElementById(id);
const MAX = 280;

async function start() {
  let me = null;
  try {
    me = (await api('/auth/me')).user;
  } catch {
    // treated as logged out
  }
  $('composer').hidden = !me;
  $('invite').hidden = Boolean(me);

  const feed = initPostList({
    list: $('posts'),
    more: $('more'),
    status: $('status'),
    params: { feed: 'all' },
    me,
  });

  const text = $('post-text');
  const counter = $('counter');
  const notice = $('composer-notice');
  const submit = $('post-submit');

  text.addEventListener('input', () => {
    counter.textContent = `${MAX - text.value.length} characters left`;
  });

  $('composer').addEventListener('submit', async (event) => {
    event.preventDefault();
    notice.className = 'notice';
    notice.textContent = '';
    if (!text.value.trim()) {
      notice.className = 'notice error';
      notice.textContent = 'Write something first';
      return;
    }
    submit.disabled = true;
    try {
      feed.prepend(await api('/posts', { method: 'POST', body: JSON.stringify({ content: text.value }) }));
      text.value = '';
      counter.textContent = `${MAX} characters left`;
    } catch (err) {
      notice.className = 'notice error';
      notice.textContent = err.message;
    }
    submit.disabled = false;
  });
}

start();