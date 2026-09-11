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
