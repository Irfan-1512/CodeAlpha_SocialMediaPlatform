const bcrypt = require('bcrypt');
const db = require('./db');

// Documented demo password: for the live demo and the video only.
const DEMO_PASSWORD = 'moonpass123';

const USERS = [
  ['anna', 'Anna Rao', 'Coffee and code'],
  ['raj', 'Raj Patel', 'Cricket, chai and late-night builds'],
  ['priya', 'Priya Nair', 'Design student. Sketching everything.'],
  ['sam', 'Sam Lee', 'Learning something new every week'],
  ['maya', 'Maya Das', 'Hiking, books and bad puns'],
];

// [author username, text]; ids follow this order
const POSTS = [
  ['anna', 'Hello MoonCircle! First post from the moon.'],
  ['raj', 'Just shipped my first Express API. It only took five cups of chai.'],
  ['priya', 'Colour palettes are my love language.'],
  ['sam', 'Day 12 of learning SQL. JOINs finally make sense!'],
  ['maya', 'Sunrise hike this morning. Totally worth the 5 a.m. alarm.'],
  ['anna', 'Hot take: a good README is worth more than clever code.'],
  ['raj', 'Debugging tip: explain the bug out loud. Even to a wall.'],
  ['priya', 'Sketched a tiny moon logo today. Dark mode forever.'],
  ['sam', 'Anyone have good resources for learning Node.js?'],
  ['maya', 'Currently reading a book about space. Feeling very on theme.'],
  ['anna', 'Reminder: commit small, commit often.'],
  ['raj', 'Weekend plan: build, break, fix, repeat.'],
  ['priya', 'Accessibility is not optional. Contrast matters!'],
  ['sam', 'Finished my first full-stack project. Tiny but mine.'],
  ['maya', 'Who else loves a quiet evening and a fresh cup of tea?'],
];

// [post number (1-based), author username, text]
const COMMENTS = [
  [1, 'raj', 'Welcome aboard!'],
  [1, 'priya', 'Love the name.'],
  [4, 'anna', 'JOINs click eventually. Keep going!'],
  [9, 'raj', 'The MDN docs and the official Node guides are great.'],
  [13, 'sam', 'Agreed. Learning this the hard way.'],
  [14, 'maya', 'Congrats! Share the link.'],
];

// [username, post number (1-based)]
const LIKES = [
  ['raj', 1], ['priya', 1], ['sam', 1], ['maya', 1],
  ['anna', 2], ['sam', 2],
  ['anna', 4], ['maya', 4],
  ['raj', 6], ['priya', 6],
  ['anna', 9], ['anna', 13], ['raj', 13], ['maya', 14], ['anna', 14],
];

// [follower username, followed username]
const FOLLOWS = [
  ['anna', 'raj'], ['anna', 'priya'], ['raj', 'anna'], ['priya', 'anna'],
  ['sam', 'anna'], ['sam', 'maya'], ['maya', 'priya'],
];

const count = (table) => db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;

function seed() {
  if (count('users') > 0) {
    console.log('Database already has users; seed skipped.');
    return;
  }

  const hash = bcrypt.hashSync(DEMO_PASSWORD, 12);
  const insertUser = db.prepare(
    'INSERT INTO users (username, name, email, password_hash, bio) VALUES (?, ?, ?, ?, ?)'
  );
  const insertPost = db.prepare('INSERT INTO posts (user_id, content) VALUES (?, ?)');
  const insertComment = db.prepare(
    'INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)'
  );
  const insertLike = db.prepare('INSERT OR IGNORE INTO likes (user_id, post_id) VALUES (?, ?)');
  const insertFollow = db.prepare(
    'INSERT OR IGNORE INTO follows (follower_id, following_id) VALUES (?, ?)'
  );

  // One transaction: either everything is seeded or nothing is.
  db.transaction(() => {
    const userIds = {};
    for (const [username, name, bio] of USERS) {
      userIds[username] = insertUser.run(username, name, `${username}@example.com`, hash, bio)
        .lastInsertRowid;
    }
    const postIds = POSTS.map(([username, text]) => insertPost.run(userIds[username], text).lastInsertRowid);

    for (const [n, username, text] of COMMENTS) insertComment.run(postIds[n - 1], userIds[username], text);
    for (const [username, n] of LIKES) insertLike.run(userIds[username], postIds[n - 1]);
    for (const [a, b] of FOLLOWS) insertFollow.run(userIds[a], userIds[b]);
  })();

  console.log(
    `Seeded: ${count('users')} users, ${count('posts')} posts, ${count('comments')} comments, ` +
      `${count('likes')} likes, ${count('follows')} follows.`
  );
  console.log(`Demo login: anna@example.com / ${DEMO_PASSWORD}`);
}

// Run directly (npm run seed) or import seed() from another file.
if (require.main === module) seed();

module.exports = seed;