# CINEMA platform

Responsive streaming-style UI with server-backed registration/login, profiles, favorites, watch history and an admin dashboard.

## Requirements
- Node.js 20+
- npm

## Run locally
1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env` and set private environment variables. This app does not automatically load `.env`; export variables in your terminal or configure them in your host dashboard.
3. Set `SESSION_SECRET` to a random secret of 32+ characters.
4. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` (admin password must be at least 12 characters).
5. Start:
   `npm start`
6. Open `http://localhost:3000`

## Replit / hosted deployment
- Upload the project files.
- Install packages with `npm install`.
- In Secrets / Environment Variables, set `NODE_ENV=production`, `SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and optionally `PORT`.
- Start command: `npm start`.
- Ensure the host provides persistent storage for `cinema.sqlite` and `sessions.sqlite`; ephemeral filesystems can erase accounts on redeploy.
- Back up the SQLite database regularly.
- Use HTTPS in production.

## Admin account
The first admin is bootstrapped from `ADMIN_EMAIL` and `ADMIN_PASSWORD` at server startup if that email does not already exist. The app does not let ordinary visitors choose an admin role during registration. Existing non-admin accounts are never automatically promoted by changing the environment variable.

## Notes / production hardening
- This is a runnable starter, not a full security audit.
- Add email verification and password reset using a real email provider before public launch.
- Consider CSRF protection and account recovery policy for a public production service.
- The profile avatar accepts HTTPS Unsplash URLs only in this starter.
- Real video streaming requires a legal video URL and a real video player/source. The demo play action records watch history and displays a placeholder.
- The Tailwind CDN is not required by this version; the visual design is implemented with CSS.
