# We Are Indecisive

A mobile-first group decision app: collect ideas, close suggestions, rank preferences, and compare ranked-choice, first-past-the-post, and Borda results.

## Run locally

Use Node.js 22 LTS for deployment (local preview and tests also work with Node 18.18+).

```sh
npm install
npm run dev
```

Open **http://localhost:5173**. With no API configured, the app works entirely in your browser and starts with a clearly labeled example containing three sample ballots. Create a new decision for a clean session. Local decisions and draft rankings persist in localStorage. Local demo links do not share data across devices.

## Group flow

1. Create a decision and share its invite link when the API is connected.
2. Anyone with the link can suggest choices. The host closes submissions after at least two choices.
3. Voters tap **+** to move choices from Undecided to Decided, then use up/down buttons or desktop drag-and-drop to rank them. **×** returns a choice to Undecided. Partial rankings are allowed.
4. Submit a ballot; submitting again replaces that participant’s vote until voting closes.
5. The host closes voting. Results become visible to everyone, with a selectable counting method and ranked-choice round details.

The API refreshes every five seconds. An update conflict asks the participant to retry after refresh; it never silently overwrites another participant’s changes. Unsubmitted rankings stay on the participant’s device. Ballot contents are not returned by the API before voting closes, except for the caller’s own ballot.

## GitHub Pages + MongoDB

GitHub Pages hosts static files. MongoDB credentials belong in a separate server environment, never browser code. This project includes both parts:

- `public/`: static frontend, with relative assets so repository Pages URLs work.
- `server/index.mjs`: Node HTTP API that accesses MongoDB through the official driver.

### Deploy the API

Deploy this repository to a Node-capable host using `npm ci` as the install command and `npm start` as the start command. Configure these environment variables in the hosting service:

| Variable         | Value                                                                                                |
| ---------------- | ---------------------------------------------------------------------------------------------------- |
| `MONGODB_URI`    | Your Atlas connection string with a database user and password                                       |
| `MONGODB_DB`     | `indecisive` or your preferred database                                                              |
| `ALLOWED_ORIGIN` | Exact frontend origin, e.g. `https://YOUR_USERNAME.github.io` (no repository path or trailing slash) |
| `PORT`           | Assigned by the hosting service; defaults to `3001`                                                  |

Allow the backend’s outbound IP in Atlas, and grant the database user read/write access only to the app database. Use HTTPS for the deployed API.

For local API development in PowerShell:

```powershell
$env:MONGODB_URI = 'your-connection-string'
$env:ALLOWED_ORIGIN = 'http://localhost:5173'
npm start
```

`.env.example` documents the variables; the server reads process environment variables and does not automatically load `.env`.

### Deploy the frontend

1. Set `apiUrl` in `public/config.js` to the deployed API URL (or `http://localhost:3001` for local development).
2. Push the project to your GitHub repository on `main`.
3. In repository **Settings → Pages**, select **GitHub Actions** as the source.
4. The included Pages workflow runs tests and publishes only `public/`.

No database credentials or backend source are included in the Pages artifact. Setup references: [GitHub Pages documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) and [MongoDB connection documentation](https://www.mongodb.com/docs/drivers/node/v6.x/connect/mongoclient/).

## Counting rules

- **First past the post:** one vote for the first ranked choice. Equal totals produce joint winners.
- **Borda:** with N choices, ranks receive N, N−1, …, 1 points. Omitted choices get zero. Equal top scores produce joint winners.
- **Ranked choice / instant runoff:** count the highest remaining choice on each ballot. A majority of continuing ballots wins. Eliminate the lowest choice and transfer its ballots. Ballots with no remaining choice are exhausted and excluded from the majority denominator. Zero-vote choices can be eliminated together. A nonzero tie for elimination pauses the count and reports that the group must resolve it; equal counts among every remaining choice produce a tie. No random tie-breaking.

## Scope and verification

```sh
npm test
```

Tests cover vote transfers, exhausted ballots, ties, partial rankings, phase permissions, locked choices, and replacement of prior ballots.

This is an anonymous, link-based app for informal groups. Participant tokens and host controls are saved in the browser. Clearing storage loses host access and creates a new participant identity; another browser can vote separately. There are no verified accounts, host recovery, moderation tools, or protection against determined ballot stuffing. Decision links grant access to the room and final anonymized rankings. Keep host tokens private. API requests have a basic per-connection-IP limit; configure deployment-level limits for internet-scale use. Decisions currently have no automatic expiry or deletion UI. Choice and voter limits are 50 and 1,000 per decision.

Fonts use Google Fonts with local sans-serif fallbacks. The frontend has no build step or runtime package dependencies. A live MongoDB deployment and host credentials are needed to verify cross-device operation and publish the app.

› How do I add the mongodb key to the github page without it being public?

• I’ll check how this project connects to MongoDB so I can explain where the secret should go.

• Ran Get-ChildItem -Name; rg -n --glob '!package-lock.json' --glob '!yarn.lock' --glob '!.env\*' 'mongodb|mongoose|MONGODB|
│ github.io' .
└ .github
node_modules
… +1030 lines (ctrl + t to view transcript)
.\node_modules\mongodb\lib\operations\search_indexes\drop.js:36: const isNamespaceNotFoundError = error instanceof
error_1.MongoServerError && error.code === error_1.MONGODB_ERROR_CODES.NamespaceNotFound;

• Searching the web

• Searched the web for site.docs.github.com GitHub Pages static site hosting secrets

• Ran Get-Content README.md; Get-Content public/config.js; Get-Content package.json
└ # We Are Indecisive

    … +89 lines (ctrl + t to view transcript)
      "dependencies": { "mongodb": "^6.20.0" }
    }

────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

• You can’t keep a MongoDB key secret inside GitHub Pages. Pages serves static files to visitors, so credentials included in its
JavaScript are exposed. GitHub’s documentation

Your project already supports the secure setup:

GitHub Pages → your backend API → MongoDB

1. Deploy the backend to a Node.js hosting service, using npm ci to install and npm start to run.
2. Add the credentials in that hosting service’s environment settings:

   MONGODB_URI=your MongoDB connection string
   MONGODB_DB=indecisive
   ALLOWED_ORIGIN=https://YOUR_USERNAME.github.io

3. Put only the backend’s public URL in /D:/Programming/Projects/WeAreIndecisive/public/config.js:

   window.APP_CONFIG = { apiUrl: 'https://your-backend.example.com' };

4. Allow the backend’s outbound IP in MongoDB Atlas.

GitHub Actions secrets don’t hide credentials that you copy into the published website. Keep MONGODB_URI exclusively on the
backend.

────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

› What does it mean to deploy the backend to a nodejshosting service? is that mongo db? can you link a tutorial?

• I’ll find a tutorial for hosting the Node.js backend and explain how it connects to MongoDB.

• Searching the web

• Searched the web for site.render.com/docs deploy node express app environment variables ...

────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

• Deploying the backend means running your server code on an internet-connected computer managed by a hosting company. Node.js
is the software that runs that JavaScript code.

MongoDB is a separate part. Your app has three pieces:

Piece What it does Where it runs
━━━━━━━━━━ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Frontend Displays the page and buttons GitHub Pages
────────── ─────────────────────────────────────────────────────────────────────────────── ────────────────────────────────
Backend Handles requests to save and load votes, keeping database credentials private A Node.js host, such as Render
────────── ─────────────────────────────────────────────────────────────────────────────── ────────────────────────────────
Database Stores decisions and votes MongoDB Atlas

When someone votes, the page sends the vote to your backend, which saves it in MongoDB.

Here’s a tutorial: Deploy a Node Express App on Render. Your backend uses Node directly rather than Express, but the
deployment steps still apply.

For your repository, follow that guide with these settings:

1. Connect your existing GitHub repository instead of copying their example.
2. Create a Web Service, and choose Node.
3. Set Build Command to npm ci.
4. Set Start Command to npm start.
5. In the service’s environment settings, add:

   MONGODB_URI = your MongoDB connection string
   MONGODB_DB = indecisive
   ALLOWED_ORIGIN = https://YOUR_USERNAME.github.io

6. In Atlas, allow the hosting service’s outbound IP addresses. See MongoDB’s connection guide.
7. Once deployed, put the Render URL into public/config.js:

   window.APP_CONFIG = { apiUrl: 'https://your-service.onrender.com' };

8. Push that change to GitHub.

Your MongoDB password stays in Render’s server environment; visitors only receive the backend’s public URL.
