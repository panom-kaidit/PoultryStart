# PoultryStart Frontend

This is the web interface of **PoultryStart: A Role-Based Poultry Management and Advisory System for New Poultry Farmers**. For the project overview, see the [root README](../README.md). For the API, see the [backend README](../backend/README.md).

| | |
|---|---|
| **Live frontend** | <https://poultrystart-1.onrender.com> |
| **Backend API it calls** | <https://poultrystart.onrender.com/api> |
| **Backend health check** | <https://poultrystart.onrender.com/api/health> |

## Contents

1. [Frontend overview](#1-frontend-overview)
2. [Main features](#2-main-features)
3. [Technology and structure](#3-technology-and-structure)
4. [Requirements](#4-requirements)
5. [Run locally](#5-run-locally)
6. [Backend API configuration](#6-backend-api-configuration)
7. [Production build and deployment](#7-production-build-and-deployment)
8. [Important notes](#8-important-notes)
9. [Troubleshooting](#9-troubleshooting)
10. [Related documentation](#10-related-documentation)

## 1. Frontend overview

The PoultryStart frontend is a single-page web application that new and small-scale poultry farmers use in the browser, on a phone, tablet or computer. With it, they can:
- create an account and set up a broiler or layer farm, with a guided readiness check;
- record flocks and bird numbers;
- follow daily tasks;
- record production, health observations and expenses;
- read poultry guidance and see the rule-based Advisor's reminders;
- view a dashboard and reports.

All data is stored and checked by the PoultryStart **backend REST API**. The frontend displays that data and sends the user's actions to the API.

It is built with **HTML5, CSS3 and vanilla JavaScript (ES6+ modules)**. It does **not** use React, Vue, Angular, TypeScript or any other frontend framework or library, and it has no runtime npm dependencies. The browser loads the JavaScript files directly as native ES modules, with no bundler or transpiler.

## 2. Main features

| Module | What the user can do | Main page files (`js/pages/`) |
|---|---|---|
| **Authentication** | Create an account, log in, view the account and log out. If the login has expired or is invalid, the user is returned to the login page with a message. | `register.js`, `login.js`, `account.js` |
| **Farm selection and setup** | See "My farms", open or switch farm, and create a farm through a four-step guided setup: the birds, the poultry house (with a live space check), the readiness checklist, and the results. | `farms.js`, `setup.js`, `setup-checklist.js`, `setup-result.js` |
| **Today** | The farm's landing screen: a summary of the day for the open farm. | `today.js` |
| **Dashboard** | Owners and managers see the farm summary: flocks, today's tasks, records and reminders. | `dashboard.js` |
| **Flocks** | List active and closed flocks, record a new flock, open a flock's hub (overview, bird-number history, health, money and details), record deaths and other bird changes, and edit or close a flock. | `flocks-list.js`, `create-flock.js`, `flock-detail.js`, `edit-flock.js` |
| **Daily tasks** | See the day's tasks, mark tasks as done with notes and a "problem reported" flag, see missed tasks, and (owners and managers) create, assign, edit, cancel and reopen tasks and add review notes. Opening the Daily Tasks list is the only action that asks the backend for the task list, because that request also generates the day's tasks. | `tasks-list.js`, `task-detail.js`, `task-form.js` |
| **Production records** | Record bird weights, egg collections (layers), feed use and drinking-water use. View overviews and farm-wide lists with filters. Owners and managers can correct records, and the correction history is kept. A "Record today" shortcut opens the recording form. | `records-overview.js`, `records-list.js`, `record-form.js`, `record-detail.js` |
| **Health observations** | Record free-text observations about a flock, list them across the farm or per flock, and view and correct them. The disclaimer is shown, and there are no diagnosis or treatment fields. | `health-overview.js`, `health-list.js`, `health-flock.js`, `health-form.js`, `health-detail.js` |
| **Expenses ("Money")** | Owner only: spending per currency, farm-wide and per-flock lists with filters, and recording, correcting and voiding expenses with their history. | `expenses-overview.js`, `expenses-list.js`, `expenses-flock.js`, `expense-form.js`, `expense-detail.js` |
| **Poultry guidance ("Learn")** | The guidance library for every logged-in user, with or without a farm: broiler and layer pages, an article list with filters and search, and articles with evidence labels and sources. | `guidance-home.js`, `guidance-type.js`, `guidance-articles.js`, `guidance-article.js` |
| **Poultry Advisor** | Read-only, rule-based reminders for the farm or for one flock, with links to guidance. | `advisor.js` |
| **Reports** | Owners and managers can view R1 flock population and movements, R2 mortality, R3 production records, R4 daily tasks and R5 health observations. R6 expenses is for the owner only. Reports have a print button, and the browser's print dialog can also save them as PDF. | `reports.js`, `report.js` |
| **Readiness** | Owner only: the farm's readiness assessments, with answers and the resource checklist. | `readiness-list.js`, `readiness-assessment.js` |
| **Farm and members** | The "Farm and people" page, the farm profile (view for all roles; edit and delete for the owner), and the member list (owner and manager). Only the owner can add, change or remove members, by the email of an already-registered user. | `more.js`, `farm-settings.js`, `edit-farm.js`, `members.js` |

### Role-based navigation and access

The roles and what each one is shown are defined in **`js/farm/access.js`**:

- **Owner:** every screen, including Money (expenses), Reports (R1–R6), Readiness assessment, Farm settings and Members.
- **Manager:** Today, Dashboard, Flocks, Tasks, Production records, Health observations, Advisor, Learn, Reports (R1–R5), Farm profile and Members (view only). No Money and no Readiness assessment.
- **Worker:** Today, Flocks, Tasks, Production records, Health observations, Advisor, Learn and Farm profile. No Dashboard, Reports, Money, Readiness assessment or Members. Review notes on tasks are not shown to workers.

Navigation adapts to the screen size (`js/components/navigation.js`):
- **Phones:** a top bar and a bottom navigation bar (Today, Flocks, Record today, Learn, More).
- **From 900 px wide:** a sidebar with the farm selector, "Record today" and the role's destinations (Today, Flocks, Learn, Money, Reports, Farm and people).

Buttons for actions a role may not take, such as editing a flock or correcting a record, are not shown. If a user opens the address of a screen their role cannot use, the app shows a "not available" page.

> Hiding a menu item or button is **not** a security measure. The backend checks the user's role on every request (see [Important notes](#8-important-notes)).

## 3. Technology and structure

| Area | Implementation |
|---|---|
| Markup | One page, `index.html`. The app draws every screen into `<div id="app">` |
| Styles | Plain CSS files in `css/`, with design tokens (colours, spacing and type) in `css/tokens.css` and print styles in `css/print.css` |
| JavaScript | Native ES modules. `js/app.js` is the entry point, loaded with `<script type="module">` |
| Routing | A hash router (`js/router.js`): addresses look like `#/farms/1/today`, so the site works on any static file server |
| API calls | `fetch()` through `js/api/client.js`, which adds the login token and turns errors into readable messages |
| Session | The login token is kept in the browser's `sessionStorage` (`js/auth/auth.js`), so closing the tab ends the session |
| Font and icons | The Inter font is self-hosted in `fonts/` (licence: `fonts/OFL.txt`); icons are inline SVG (`js/components/icons.js`) |
| Tooling | Two small Node.js scripts with no packages: `scripts/serve.js` (development server) and `scripts/build.js` (production build) |

### Directory structure

```
frontend/
├── index.html            The single HTML page: Content Security Policy, API-address meta tag, stylesheets, js/app.js
├── package.json          npm scripts "start" and "build"; no dependencies
├── package-lock.json
├── scripts/
│   ├── serve.js          Local development server (npm start)
│   └── build.js          Production build into dist/ (npm run build)
├── css/                  tokens.css, base.css, layout.css, components.css, responsive.css,
│                         one stylesheet per area (login, setup, today, flocks, flock-hub, learn,
│                         money, reports, farm-people) and print.css
├── fonts/                Inter (woff2) and its licence
├── assets/icons/         favicon.svg
└── js/
    ├── app.js            Start-up, the route table, login and role checks, drawing each page
    ├── router.js         Hash router
    ├── config.js         API address (API_BASE_URL) and app name
    ├── api/              One module per API area: client.js (shared fetch), auth, farms, members,
    │                     readiness, flocks, tasks, production, health, expenses, guidance, advisor, reports
    ├── auth/             auth.js (session and token), guards.js (login and role checks for routes)
    ├── farm/             access.js (role permissions and menus), farm.js (the open farm and the user's role),
    │                     the setup flow and the space-check rules, and data helpers for Today, Flocks and Readiness
    ├── components/       Reusable interface pieces: dom.js (the h() element helper), navigation.js (app frame),
    │                     forms, alerts, loading and error blocks, confirmation dialogs, icons, and
    │                     feature components (tasks, flocks, production, health, expenses, guidance, reports…)
    ├── pages/            One module per screen (see the table in section 2)
    └── utils/            dates.js and format.js
```

### How the code is organised

- **`js/app.js`** contains the route table. For each address it:
  1. checks that the user is logged in;
  2. loads the open farm and the user's role on it (`GET /farms/:id`);
  3. checks that the role may open the screen;
  4. draws the page inside the app frame.
- **Page modules** (`js/pages/*.js`) each export a function that builds a screen. They load their data through the API modules and use the shared components.
- **Components** build DOM elements with the small `h()` helper in `js/components/dom.js`. There is no templating library or virtual DOM.
- **API modules** (`js/api/*.js`) are thin functions, one per backend endpoint, that call the shared `request()` in `js/api/client.js`. That function:
  - sends the `Authorization: Bearer <token>` header;
  - parses the JSON response;
  - throws an `ApiError` with the backend's message;
  - when a logged-in request receives `401 Unauthorized`, ends the session and redirects to the login page.
- **Styles** come from shared tokens and base, layout and component styles, plus one stylesheet per area. All are listed in `index.html`.
- **Component gallery:** the hidden page `#/__styleguide` shows the shared components. It is a developer reference and is not linked from the app.

## 4. Requirements

- **Node.js 20 or newer** is needed to run the frontend's two scripts (`"engines": { "node": ">=20" }` in `frontend/package.json`). The backend needs Node.js `>=22 <25`, so if you run both, use **Node.js 22, 23 or 24**. There is no `package.json` at the repository root.
- **npm**, which comes with Node.js, to run the scripts.
- **No frontend dependencies.** `package.json` lists no `dependencies` or `devDependencies`, so `npm install` is **not** required. The scripts use only Node.js built-in modules.
- A modern browser with ES module support, such as current Chrome, Edge or Firefox.
- The PoultryStart **backend** running locally (see [`backend/README.md`](../backend/README.md)), or a deployed backend.

## 5. Run locally

1. **Start the backend first.** Follow [`backend/README.md`](../backend/README.md): `npm install`, copy `.env.example` to `.env` and set `JWT_SECRET`, then `npm run dev`. The API runs at `http://localhost:5000/api`. Check it at <http://localhost:5000/api/health>.
2. **Start the frontend** in a second terminal, from the repository root:
   ```bash
   cd frontend
   npm start
   ```
   This runs `node scripts/serve.js`, a small static file server, and prints:
   ```
   PoultryStart frontend: http://localhost:5173 (the backend API should run on http://localhost:5000)
   ```
3. **Open <http://localhost:5173>** in the browser. Register an account, or log in with the [demo account](../README.md#10-demonstration-account) if the backend runs with `DEMO_SEED=true`.

**How the local frontend reaches the local backend:**
- In development, the frontend runs **directly from its source files**, so no build step is needed. Edit a file and reload the page; the server sends `Cache-Control: no-store`, so changes appear immediately.
- The source `index.html` contains the API address `http://localhost:5000/api`, and its Content Security Policy allows connections to `http://localhost:*` and `http://127.0.0.1:*`.
- The backend accepts browser requests only from the address in its `CORS_ORIGIN` setting. The value in `backend/.env.example` is `http://localhost:5173`, which matches this server.

**Development server settings** (environment variables read by `scripts/serve.js`):

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `5173` | Port of the development server |
| `HOST` | `127.0.0.1` | Network interface it listens on (this computer only) |

For example, `PORT=5174 npm start` in Bash or Git Bash. In PowerShell, use `$env:PORT=5174; npm start`. If you change the port, also change `CORS_ORIGIN` in `backend/.env` to the new address and restart the backend.

The development server:
- serves only `index.html` and the `css/`, `js/`, `assets/` and `fonts/` folders;
- answers only `GET` and `HEAD` requests;
- refuses hidden files and paths outside these folders.

It is for development only and does not serve the `dist/` build.

## 6. Backend API configuration

The API address is set in **`js/config.js`**, which exports `API_BASE_URL`. It uses the first of these that is set:

1. `window.POULTRYSTART_API_BASE_URL`, a global variable (not set anywhere in the project; available as an override);
2. the **`poultrystart-api-base-url` meta tag** in `index.html`;
3. the local fallback **`http://localhost:5000/api`**.

Any trailing `/` is removed. All API modules build their URLs from this value, for example `${API_BASE_URL}/farms`.

| Situation | API address used | How it is set |
|---|---|---|
| Local development (`npm start`) | `http://localhost:5000/api` | The meta tag in the source `index.html` (also the fallback in `config.js`) |
| Production (`dist/`) | Your deployed API, for example `https://poultrystart.onrender.com/api` | Written into the meta tag of `dist/index.html` by `npm run build` from the `API_BASE_URL` environment variable |

`API_BASE_URL` is the only setting the build needs, and it is not secret: it is a public address that every visitor's browser receives. The frontend never holds secrets. The backend's `JWT_SECRET` and other private settings stay on the server. Do not change the source `index.html` for production; let the build write the production address.

## 7. Production build and deployment

### Build command

From the `frontend/` folder:

```bash
API_BASE_URL=https://poultrystart.onrender.com/api npm run build          # Bash / Git Bash / macOS / Linux
$env:API_BASE_URL="https://poultrystart.onrender.com/api"; npm run build   # Windows PowerShell
```

On success it prints:

```
Frontend built in dist/ for the API at https://poultrystart.onrender.com/api (CSP connect-src: 'self' https://poultrystart.onrender.com).
```

### What `scripts/build.js` does

1. **Checks `API_BASE_URL`.** The build stops with `Frontend build failed: …` if the value:
   - is missing or is not a valid address;
   - uses `http://` for anything except `localhost` or `127.0.0.1` (production must use `https://`);
   - contains a query, fragment or credentials.

   So a production build can never silently point at `localhost`.
2. **Deletes any old `dist/`** and copies `css/`, `js/`, `fonts/` and `assets/` into a new `dist/`.
3. **Writes `dist/index.html`** from the source `index.html`, with two changes:
   - the `poultrystart-api-base-url` meta tag is set to the API address;
   - the Content Security Policy's `connect-src` is narrowed to `'self'` and the API's origin only, for example `connect-src 'self' https://poultrystart.onrender.com`. The browser then refuses connections to any other server, including localhost.
4. **Never modifies the source files.**

The rest of the Content Security Policy is the same in development and production: scripts, styles and fonts only from the site itself, images from the site or `data:` URIs, no plugins, and `base-uri 'none'`.

The generated **`frontend/dist/` folder is the deployment output**. It is a complete static site that any static host can serve. It is listed in `frontend/.gitignore` and is not committed; it is rebuilt on every deployment.

### Deployment (Render Static Site)

The live frontend is a **Render Static Site** on the free tier:

| Setting | Value |
|---|---|
| Root directory | `frontend` |
| Build command | `npm run build` |
| Publish directory | `dist` |
| Environment variable | `API_BASE_URL` = `https://poultrystart.onrender.com/api` |

- **Live frontend:** <https://poultrystart-1.onrender.com>
- **Backend API it communicates with:** <https://poultrystart.onrender.com/api>
- **Backend health endpoint:** <https://poultrystart.onrender.com/api/health>. It returns `{"success":true,"message":"PoultryStart API is running."}`.

For the browser to accept the API's responses, the backend's `CORS_ORIGIN` must be exactly the frontend's address: `https://poultrystart-1.onrender.com`, with no trailing slash. Because the frontend uses hash addresses (`#/…`), the static host needs no rewrite rules.

## 8. Important notes

- **The frontend is only the interface; the backend protects the data.** Role-based menus, hidden buttons and "not available" pages make the app easier to use, but they are not security measures: anyone can change code running in their own browser. Every restricted action and every piece of restricted data, such as owner-only expenses, member management, the dashboard and reports, is checked by the **backend** on each request using the user's role on that farm.
- **The public demo account is shared.** The login `demo@poultrystart.example` is published in the root README, so anyone may log in and change its fictional data. **Do not enter real farmer data or personal information** in the demo, or in any account on the free deployment.
- **The demo backend's data is temporary.** The deployed backend stores its SQLite database on Render's free-tier temporary filesystem. Data can be lost whenever the backend restarts, is redeployed or spins down after inactivity. The demo account and its sample farms are recreated automatically, but other data is not.
- **The frontend stores no farm data.** Everything is loaded from and saved to the backend API. The browser keeps only the login token and the page to return to after logging in, in `sessionStorage` for the current tab. The open farm is kept in memory. Nothing is stored permanently in the browser, and the app does not work offline.
- **Guidance is general information.** The Advisor and guidance pages do not diagnose disease or replace a veterinarian.

## 9. Troubleshooting

| Problem | Likely cause and fix |
|---|---|
| "Could not reach the PoultryStart server…" locally | The backend is not running, or not on port 5000. Start it (`npm run dev` in `backend/`) and check <http://localhost:5000/api/health>. |
| Requests go to the wrong address | Check the `poultrystart-api-base-url` meta tag in the `index.html` being served. Locally it must be `http://localhost:5000/api`. In production, rebuild with the correct `API_BASE_URL`, including `/api` at the end. |
| `Frontend build failed: set API_BASE_URL…` | `API_BASE_URL` was not set in the environment of `npm run build`. Set it as shown in [section 7](#7-production-build-and-deployment). |
| `Frontend build failed: API_BASE_URL must use https://…` | Production addresses must use `https://`. `http://` is accepted only for `localhost` and `127.0.0.1`. |
| CORS error in the browser console | The page's address does not exactly match the backend's `CORS_ORIGIN`. Locally, open `http://localhost:5173` (not `http://127.0.0.1:5173`), or change `CORS_ORIGIN` to match. In production, `CORS_ORIGIN` must be `https://poultrystart-1.onrender.com` with no trailing slash. Restart or redeploy the backend after changing it. |
| Content Security Policy "connect-src" error | The page is trying to reach an API address that its Content Security Policy does not allow. The source `index.html` allows only localhost. A `dist/` build allows only the `API_BASE_URL` it was built with, so rebuild with the correct address. |
| The live site is slow at first or cannot reach the server | The free backend sleeps after inactivity and can take a while to wake. Open <https://poultrystart.onrender.com/api/health>, wait until it responds, then retry in the app. |
| Sent back to the login page with a "session expired" message | The login token expired (8 hours by default) or the backend was restarted with a new database. Log in again. On the free deployment, accounts other than the demo account may have been lost when the backend restarted. |
| `EADDRINUSE` on `npm start` | Port 5173 is in use. Stop the other program, or use another `PORT` and update `CORS_ORIGIN` to match. |
| A blank page with "PoultryStart needs JavaScript" | JavaScript is turned off in the browser. Turn it on and reload. |

## 10. Related documentation

- [Root README](../README.md): project overview, roles, setup of both parts, deployment and the demonstration account.
- [Backend README](../backend/README.md): API endpoints, business rules, permissions and backend environment variables.
