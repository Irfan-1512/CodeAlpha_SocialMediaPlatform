import { api } from './api.js';
import { avatar } from './avatar.js';
import { postCard, el, when } from './post-card.js';

const $ = (id) => document.getElementById(id);
const MAX = 200;
let me = null;

function updateCount() {
  const n = $('comments').children.length;
  $('comments-title').textContent = `Comments (${n})`;
  $('empty').hidden = n > 0;
}

function commentItem(comment) {
  const li = el('li', 'comment');
  const author = comment.author;

  const link = el('a', 'post-author');
  link.href = `/profile.html?user=${encodeURIComponent(author.username)}`;
  link.append(el('strong', '', author.name), el('span', 'muted', ` @${author.username}`));

  const time = el('time', 'muted', when(comment.created_at).toLocaleString());
  time.dateTime = when(comment.created_at).toISOString();

  const body = el('div', 'post-body');
  body.append(link, time, el('p', 'post-text', comment.content));

  if (me && me.id === author.id) {
    const del = el('button', 'btn btn-secondary btn-delete', 'Delete');
    del.type = 'button';
    del.addEventListener('click', async () => {
      if (!confirm('Delete this comment?')) return;
      del.disabled = true;
      try {
        await api(`/comments/${comment.id}`, { method: 'DELETE' });
        li.remove();
        updateCount();
      } catch (err) {
        del.disabled = false;
        alert(err.message);
      }
    });
    body.append(del);
  }

  li.append(avatar(author, 32), body);
  return li;
}

async function start() {
  const id = new URLSearchParams(location.search).get('id');
  try {
    try {
      me = (await api('/auth/me')).user;
    } catch {
      me = null;
    }
    if (!/^\d+$/.test(id || '')) throw new Error('Post not found');

    const [post, comments] = await Promise.all([api(`/posts/${id}`), api(`/posts/${id}/comments`)]);
    // After deleting the post there is nothing left to show here, so go home.
    $('post').replaceChildren(postCard(post, { me, onDelete: () => (location.href = '/') }));
    for (const comment of comments) $('comments').append(commentItem(comment));

    $('status').hidden = true;
    $('comments-section').hidden = false;
    $('comment-form').hidden = !me;
    $('invite').hidden = Boolean(me);
    updateCount();
  } catch (err) {
    $('status').textContent = err.message;
    $('status').classList.add('error');
    return;
  }

  const text = $('comment-text');
  const notice = $('comment-notice');
  const submit = $('comment-submit');

  text.addEventListener('input', () => {
    $('counter').textContent = `${MAX - text.value.length} characters left`;
  });

  $('comment-form').addEventListener('submit', async (event) => {
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
      const comment = await api(`/posts/${id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content: text.value }),
      });
      $('comments').append(commentItem(comment));
      text.value = '';
      $('counter').textContent = `${MAX} characters left`;
      updateCount();
    } catch (err) {
      notice.className = 'notice error';
      notice.textContent = err.message;
    }
    submit.disabled = false;
  });
}

start();