import { api } from './api.js';
import { initPostList } from './post-card.js';

const $ = (id) => document.getElementById(id);
const MAX = 280;
const EMPTY = {
  all: 'Nothing here yet.',
  following: 'Nothing here yet. Follow someone to fill this feed.',
};

async function start() {
  let me = null;
  try {
    me = (await api('/auth/me')).user;
  } catch {
    // treated as logged out
  }
  $('composer').hidden = !me;
  $('invite').hidden = Boolean(me);
  $('tabs').hidden = !me; // the Following feed needs a login

  const tabs = [...document.querySelectorAll('.tab')];
  let feed;

  function showTab(name) {
    for (const tab of tabs) {
      const selected = tab.dataset.feed === name;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    }
    if (feed) feed.stop();
    $('posts').replaceChildren();
    $('more').hidden = true;
    feed = initPostList({
      list: $('posts'),
      more: $('more'),
      status: $('status'),
      params: { feed: name },
      me,
      empty: EMPTY[name],
    });
  }

  // Tab pattern: click selects; Left/Right arrows move between tabs.
  for (const tab of tabs) {
    tab.addEventListener('click', () => showTab(tab.dataset.feed));
    tab.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      const next = tabs[(tabs.indexOf(tab) + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
      next.focus();
      showTab(next.dataset.feed);
    });
  }
  showTab('all');

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