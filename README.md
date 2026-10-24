# MoonCircle

A mini social media app: create a profile, share short posts, comment, like and follow people.
Built for **CodeAlpha Task 2 (Social Media Platform)**.

**Live demo:** _add the link after deploying_
**Demo video:** _add the LinkedIn link after posting_

## Features

- Register and log in with a unique username
- Profiles with name, bio, and post, follower and following counts; edit your own name and bio
- Create and delete your own posts (up to 280 characters)
- Comment on posts (up to 200 characters) and delete your own comments
- Like and unlike posts
- Follow and unfollow users, with search by name or username
- Home feed with **All** and **Following** tabs and "Load more" pagination

## Tech stack

- Frontend: HTML, CSS, vanilla JavaScript (ES modules), no build step
- Backend: Node.js 18+ with Express
- Database: SQLite (better-sqlite3)
- Auth: bcrypt and a JWT in an httpOnly cookie
- Security: helmet, express-rate-limit, parameterised SQL, server-side ownership checks

## Screenshots

_add screenshots here_

## Setup

```bash
git clone https://github.com/Irfan-1512/CodeAlpha_SocialMediaPlatform.git
cd CodeAlpha_SocialMediaPlatform
npm install
cp .env.example .env     # Windows: copy .env.example .env
```

Edit `.env` and set `JWT_SECRET` to a long random value:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Then:

```bash
npm run seed    # demo users and posts (safe to run twice)
npm run dev     # http://localhost:3000
npm test        # API tests with a temporary database
```

## Environment variables

| Variable | Purpose |
| --- | --- |
| PORT | Server port (default 3000) |
| JWT_SECRET | Long random signing key; the server refuses the placeholder |
| NODE_ENV | `development` locally, `production` when deployed |
| DB_FILE | SQLite file path (default `./mooncircle.db`) |

## Demo accounts

Password for all demo accounts: `moonpass123`

| Email | Username |
| --- | --- |
| anna@example.com | anna |
| raj@example.com | raj |
| priya@example.com | priya |
| sam@example.com | sam |
| maya@example.com | maya |

These are for demo only. On a free host the database resets on restart, and the seed recreates them.

## API summary

All routes are under `/api`. Reading is public; writing needs a login.

| Method | Route | Purpose |
| --- | --- | --- |
| POST | /auth/register, /auth/login, /auth/logout | Account and session |
| GET | /auth/me | Current user or null |
| GET | /users?q= | Search users |
| GET, PATCH | /users/:username, /users/me | Profile and edit |
| POST, DELETE | /users/:username/follow | Follow and unfollow |
| GET, POST | /posts | Feed (all, following, one user) and create |
| GET, DELETE | /posts/:id | One post and delete own |
| POST, DELETE | /posts/:id/like | Like and unlike |
| GET, POST | /posts/:id/comments | List and add comments |
| DELETE | /comments/:id | Delete own comment |

## Security notes

- Passwords hashed with bcrypt; emails and hashes are never returned by the API
- Only the author can delete a post or comment (checked on the server, returns 403)
- All SQL uses bound parameters; user text is rendered with `textContent`
- Rate limits on auth and write routes; request bodies limited to 10 KB

Built by Irfan for CodeAlpha.