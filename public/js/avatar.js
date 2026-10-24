// Six fixed colours picked by user id, all readable with white initials.
const COLORS = ['#7c3aed', '#0e7490', '#b45309', '#be185d', '#15803d', '#1d4ed8'];

export function avatar(user, size = 44) {
  const el = document.createElement('span');
  el.className = 'avatar';
  el.setAttribute('aria-hidden', 'true'); // the name is always shown next to it
  el.style.width = el.style.height = `${size}px`;
  el.style.fontSize = `${Math.round(size * 0.4)}px`;
  el.style.background = COLORS[user.id % COLORS.length];
  el.textContent = user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
  return el;
}