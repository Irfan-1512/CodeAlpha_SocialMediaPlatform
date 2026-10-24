import { api } from './api.js';
import { avatar } from './avatar.js';

export const when = (sqlDate) => new Date(sqlDate.replace(' ', 'T') + 'Z');
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text; // user text always via textContent
  return node;
}

// Heart button: updates at once, then shows the server's numbers, or reverts on failure.
function likeButton(post, me) {
  const button = el('button', 'like-btn');
  button.type = 'button';
  button.setAttribute('aria-label', `Like post by ${post.author.name}`);
  const message = el('span', 'sr-only');
  message.setAttribute('aria-live', 'polite');

  let liked = post.liked_by_me;
  let count = post.like_count;

  function paint() {
    button.setAttribute('aria-pressed', String(liked));
    button.classList.toggle('liked', liked);
    // The shape changes too (filled vs outline), so state is never shown by colour alone.
    button.textContent = `${liked ? '\u2665' : '\u2661'} ${count}`;
  }
  paint();

  button.addEventListener('click', async () => {
    if (!me) {
      location.href = '/login.html';
      return;
    }
    const before = { liked, count };
    liked = !liked;
    count += liked ? 1 : -1;
    paint();
    button.disabled = true;
    try {
      const result = await api(`/posts/${post.id}/like`, { method: liked ? 'POST' : 'DELETE' });
      liked = result.liked_by_me;
      count = result.like_count;
      message.className = 'sr-only';
      message.textContent = liked ? 'Liked' : 'Unliked';
    } catch (err) {
      ({ liked, count } = before);
      message.className = 'like-error';
      message.textContent = err.message;
    }
    paint();
    button.disabled = false;
  });

  const wrap = el('span', 'like-wrap');
  wrap.append(button, message);
  return wrap;
}

export function postCard(post, { me, onDelete } = {}) {
  const author = post.author;
  const li = el('li', 'post');

  const link = el('a', 'post-author');
  link.href = `/profile.html?user=${encodeURIComponent(author.username)}`;
  link.append(el('strong', '', author.name), el('span', 'muted', ` @${author.username}`));

  const time = el('time', 'muted', when(post.created_at).toLocaleString());
  time.dateTime = when(post.created_at).toISOString();

  const comments = el('a', 'comment-link', plural(post.comment_count, 'comment'));
  comments.href = `/post.html?id=${post.id}`;

  const actions = el('div', 'post-actions');
  actions.append(likeButton(post, me), comments);

  if (me && me.id === author.id) {
    const del = el('button', 'btn btn-secondary btn-delete', 'Delete');
    del.type = 'button';
    del.addEventListener('click', async () => {
      if (!confirm('Delete this post?')) return;
      del.disabled = true;
      try {
        await api(`/posts/${post.id}`, { method: 'DELETE' });
        li.remove();
        if (onDelete) onDelete();
      } catch (err) {
        del.disabled = false;
        alert(err.message);
      }
    });
    actions.append(del);
  }

  const body = el('div', 'post-body');
  body.append(link, time, el('p', 'post-text', post.content), actions);
  li.append(avatar(author), body);
  return li;
}

// Loads posts into a list and wires the "Load more" button (cursor = id of the last post).
export function initPostList({ list, more, status, params = {}, me }) {
  let before = null;

  async function load() {
    more.disabled = true;
    status.className = 'status';
    status.textContent = 'Loading posts...';
    status.hidden = false;
    try {
      const query = new URLSearchParams(params);
      if (before) query.set('before', before);
      const { posts, has_more } = await api(`/posts?${query}`);
      for (const post of posts) list.append(postCard(post, { me }));
      if (posts.length) before = posts[posts.length - 1].id;
      more.hidden = !has_more;
      status.textContent = 'Nothing here yet.';
      status.hidden = list.children.length > 0;
    } catch (err) {
      status.className = 'status error';
      status.textContent = err.message;
    }
    more.disabled = false;
  }

  more.addEventListener('click', load);
  load();

  return {
    prepend(post) {
      list.prepend(postCard(post, { me }));
      status.hidden = true;
    },
  };
}