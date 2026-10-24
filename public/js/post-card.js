import { api } from './api.js';
import { avatar } from './avatar.js';

const when = (sqlDate) => new Date(sqlDate.replace(' ', 'T') + 'Z');
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text; // user text always via textContent
  return node;
}

export function postCard(post, { me } = {}) {
  const author = post.author;
  const li = el('li', 'post');

  const link = el('a', 'post-author');
  link.href = `/profile.html?user=${encodeURIComponent(author.username)}`;
  link.append(el('strong', '', author.name), el('span', 'muted', ` @${author.username}`));

  const time = el('time', 'muted', when(post.created_at).toLocaleString());
  time.dateTime = when(post.created_at).toISOString();

  const actions = el('div', 'post-actions');
  actions.append(
    el('span', 'muted', plural(post.like_count, 'like')),
    el('span', 'muted', plural(post.comment_count, 'comment'))
  );

  if (me && me.id === author.id) {
    const del = el('button', 'btn btn-secondary btn-delete', 'Delete');
    del.type = 'button';
    del.addEventListener('click', async () => {
      if (!confirm('Delete this post?')) return;
      del.disabled = true;
      try {
        await api(`/posts/${post.id}`, { method: 'DELETE' });
        li.remove();
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