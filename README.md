# PoultryStart: A Role-Based Poultry Management and Advisory System for New Poultry Farmers

PoultryStart is a web application that helps new and small-scale poultry farmers prepare for, run and keep records of a poultry flock. In one place, a farmer can set up a farm, check whether the farm is ready before the birds arrive, and record flocks and bird numbers. They can also follow daily tasks, keep production records, health observations and expenses, and read practical poultry guidance. A rule-based Advisor and simple reports support their decisions. Version 1 supports **broiler** and **layer** poultry. The primary context is **Uganda**: farm dates follow the Uganda calendar day, and the guidance is written for local conditions. The system is designed so that it can be adapted to other African farming contexts.

| | |
|---|---|
| **Live application** | <https://poultrystart-1.onrender.com> |
| **Backend API health check** | <https://poultrystart.onrender.com/api/health> |
| **Source code** | <https://github.com/panom-kaidit/PoultryStart> |
| **Demo login** | `demo@poultrystart.example` / `PoultryStart-Demo-2026` (see [Demonstration account](#10-demonstration-account)) |

> PoultryStart gives general poultry-management information. It does **not** diagnose disease, prescribe treatment or replace a veterinarian. See the [poultry guidance disclaimer](#12-poultry-guidance-disclaimer-and-open-review-item).

## Table of contents

1. [Problem statement](#1-problem-statement)
2. [Proposed solution](#2-proposed-solution)
3. [Main features](#3-main-features)
4. [User roles and permissions](#4-user-roles-and-permissions)
5. [Technology stack](#5-technology-stack)
6. [System architecture](#6-system-architecture)
7. [Repository structure](#7-repository-structure)
8. [Installation and local setup](#8-installation-and-local-setup)
9. [Public deployment](#9-public-deployment)
10. [Demonstration account](#10-demonstration-account)
11. [Project scope and limitations](#11-project-scope-and-limitations)
12. [Poultry guidance disclaimer and open review item](#12-poultry-guidance-disclaimer-and-open-review-item)
13. [Documentation and project references](#13-documentation-and-project-references)
14. [Academic project information](#14-academic-project-information)

## 1. Problem statement

People who are starting poultry farming often face practical difficulties:

- **Inconsistent records.** Farm and flock details are often written in notebooks or kept in memory. This makes it hard to know how many birds are alive, what has been recorded, and what happened earlier in the flock's life.
- **Daily routines are hard to follow.** Feeding, watering, cleaning and checking birds must be done every day, at the right times and for the right stage of the flock. A beginner can easily forget or miss these routines, especially when several people work on the farm.
- **Production, health and costs are tracked separately, or not at all.** Bird weights, egg collections, feed and water use, unusual signs in the flock, and money spent all affect a farm's results. When they are not recorded consistently, it is hard to see what is going well or badly.
- **Guidance is hard to find and apply.** Poultry-management information is scattered, and it is not always easy for a beginner to understand or to match to their flock's current age and stage.
- **Readiness gaps go unnoticed.** New farmers may receive birds before the house, equipment, feed and water are ready, or put more birds in a house than its space allows. They may also have no clear view of what is still outstanding.

These problems matter because a new farmer's early decisions about preparation, routine care and record-keeping shape how well a flock is managed. PoultryStart was designed to address these practical needs. It makes no claim to have produced measured improvements on real farms.

## 2. Proposed solution

PoultryStart brings these activities together in one **role-based web application**:

- farm setup and a readiness check before the birds arrive;
- flock records, with a full history of bird numbers;
- daily tasks generated for each flock's type and age;
- production records, health observations and expenses;
- a guidance library and a rule-based Advisor;
- a dashboard and reports.

Each farm has an owner, who can work alone or add managers and workers. Each role sees and does only what it is responsible for.

By keeping records in one place and turning them into daily tasks, reminders, summaries and links to relevant guidance, PoultryStart helps farmers organise their work. It shows what has been done and what is outstanding, so farmers can make more informed management decisions. The decisions remain the farmer's own: PoultryStart reports what has been recorded and does not judge or diagnose the flock.

## 3. Main features

| Feature | What it does |
|---|---|
| **Registration and login** | Users create an account and log in with email and password. Passwords are stored as bcrypt hashes. A signed login token (JWT) expires after a set time (8 hours by default). Users can also log out and view their account. |
| **Farm creation and profile** | Any logged-in user can create a farm and becomes its owner. The farm profile records the poultry type (broiler or layer), the farmer's experience level, the starting production stage and the house details. One user can belong to several farms and switch between them. |
| **Farm-readiness assessment** | A guided readiness questionnaire and resource checklist (housing, equipment, feed, water and other items). It includes a space and bird-capacity check based on the house's usable floor area. The result shows what is ready and what is still missing before the birds arrive. |
| **Farm members and roles** | The owner can add an already-registered user by email as a **manager** or **worker**, change their role or remove them. A farm also works with its owner alone. |
| **Broiler and layer flocks** | Record a flock when the birds arrive, then record deaths, other changes in bird numbers, additional birds received and corrections. Current bird numbers are always calculated from this movement history. Flocks can be edited and closed. Closed flocks are kept as read-only records. |
| **Daily tasks** | Each day's tasks are generated for every active flock, based on its type and age. Owners and managers can also add custom tasks and assign, edit, cancel or reopen tasks. Any member can mark a task as done, with notes and a "problem reported" flag. Missed and overdue tasks stay visible, and owners and managers can add review notes. |
| **Production records** | Record bird weights, egg collections (layers), feed use and drinking-water use for each flock. The app shows summaries and lists. Corrections are made by owners and managers and keep their history. |
| **Health observations** | Free-text notes of anything unusual seen in a flock, with a list of past observations and corrections that keep their history. This is record-keeping only: there are no diagnosis, severity or treatment fields. |
| **Expenses** | Owner-only records of money spent: feed, chicks, medication, equipment, labour, transport or other. An expense can be linked to a flock. Summaries are given per currency. Mistakes are corrected or voided, and the history is kept. |
| **Poultry guidance library** | 33 beginner-friendly articles for broilers and layers, organised into 8 topics (farm preparation, housing, feeding, water, flock management, hygiene and biosecurity, health monitoring, daily activities) and by flock stage. Articles show evidence labels and their sources. Any logged-in user can read them, with or without a farm. |
| **Rule-based Poultry Advisor** | A read-only list of up to 10 practical reminders for the farm, most urgent first. It is worked out from recorded facts such as flock ages, tasks, records and readiness, and links to relevant guidance. It uses fixed rules, not AI. It does not read free-text notes, does not use expenses, and saves nothing. |
| **Dashboard and reports** | For owners and managers: a dashboard summarising flocks, today's tasks, recent records and reminders. There are six reports: R1 flock population and movements, R2 mortality, R3 production records, R4 daily tasks, R5 health observations, and R6 expenses (owner only). Reports are calculated each time they are opened and can be printed. |

## 4. User roles and permissions

Every farm has exactly one **Farm Owner** and, optionally, **Farm Managers** and **Farm Workers**. A user's role belongs to a particular farm. The backend checks the user's role on every farm request, and the frontend shows each role only the menus and buttons it may use. A request for a farm the user does not belong to is answered as "not found", so other people's farms stay private.

- **Farm Owner:** the person responsible for the farm. The owner has full access, including the farm settings, members, the readiness assessment and the farm's finances.
- **Farm Manager:** supervises daily work. A manager manages flocks and tasks, corrects records, and uses the dashboard and operational reports, but cannot see expenses or manage members.
- **Farm Worker:** does the daily work. A worker completes tasks and records what they see: deaths, production records and health observations.

| Capability | Owner | Manager | Worker |
|---|:---:|:---:|:---:|
| View the farm profile | ✓ | ✓ | ✓ |
| Edit or delete the farm | ✓ | | |
| View the farm members | ✓ | ✓ | |
| Add, change or remove members | ✓ | | |
| Readiness assessment and resource checklist | ✓ | Status only (on the dashboard) | |
| View flocks and their bird-number history; record deaths | ✓ | ✓ | ✓ |
| Create, edit and close flocks; record other bird changes and corrections | ✓ | ✓ | |
| Delete a flock recorded by mistake | ✓ | | |
| View and complete daily tasks | ✓ (all tasks) | ✓ (all tasks) | ✓ (unassigned tasks and tasks assigned to them) |
| Create, assign, edit, cancel and reopen tasks; add review notes | ✓ | ✓ | |
| Add production records and health observations | ✓ | ✓ | ✓ |
| Correct production records and health observations | ✓ | ✓ | |
| Expenses (view, record, correct, void) | ✓ | | |
| Dashboard | ✓ (including expenses and full readiness) | ✓ (no expenses; readiness status only) | |
| Reports R1–R5 | ✓ | ✓ | |
| Report R6: Expenses | ✓ | | |
| Poultry Advisor | ✓ | ✓ | ✓ |
| Poultry guidance library | ✓ | ✓ | ✓ |

**Privacy:**
- **Expenses are owner-only.** The backend refuses expense requests from managers and workers. It also leaves the expense summary out of the manager's dashboard, and the R6 expense report is not available to managers.
- **Workers have no access to** expenses, the dashboard, reports, the readiness assessment or the member list. These are refused by the backend and hidden in the interface.
- **Task review notes** (owner and manager notes on a task) are shown only to owners and managers in the task history.

## 5. Technology stack

| Area | Technology |
|---|---|
| Backend | Node.js (22, 23 or 24) and Express 5, as a REST API |
| Database | SQLite, accessed through `better-sqlite3`. The schema is in `backend/database/schema.sql` |
| Frontend | HTML5, CSS3 and vanilla JavaScript (ES modules), with a hash-based router. No frontend framework and no runtime packages |
| Authentication | JSON Web Tokens (`jsonwebtoken`) for login sessions. Passwords are hashed with `bcrypt`. The frontend keeps the token in the browser's session storage |
| Security and validation | `helmet` (secure HTTP headers), `cors` (only the configured frontend address may call the API), `express-validator` (request validation), a Content Security Policy in `index.html`, and role-based permission checks on every farm route |
| Configuration | `dotenv` (backend `.env` file) |
| Development tools | `nodemon` (backend auto-restart). The frontend uses its own small Node.js scripts to serve and build the site, with no extra packages |
| Hosting | Render: a **Static Site** for the frontend and a **Web Service** for the backend, both on the free tier |
| Self-hosted font | Inter (licence in `frontend/fonts/OFL.txt`) |

## 6. System architecture

PoultryStart has two separate parts that communicate over HTTPS using JSON:

```
 Browser (HTML, CSS, JavaScript modules)
        │  fetch() requests with a "Bearer" login token
        ▼
 Backend REST API  (Node.js + Express, under /api)
   routes → authentication and farm-role checks → validation → controllers → services → models
        │
        ▼
 SQLite database file  (better-sqlite3)
```

- **Frontend:** a single-page application. `index.html` loads `js/app.js`, which uses a hash router (for example `#/farms/1/today`) to show each page. Pages call the API through small modules in `js/api/`. The API address comes from a meta tag in `index.html`: the production build writes the deployed API address there, and local development uses `http://localhost:5000/api`.
- **Backend:** an Express application. All endpoints are under `/api`: `/api/auth`, `/api/farms` (with members, readiness, flocks, tasks, records, health observations, expenses, Advisor, dashboard and reports nested under each farm), `/api/guidance` and `/api/health`. The layers are routes, middleware (authentication, farm access, validation), controllers, services (business rules) and models (database queries).
- **Database:** a single SQLite file stores users, farms, memberships, readiness assessments, flocks and bird movements, tasks and task history, production records, health observations, expenses and the guidance articles. When the backend starts, it creates any missing tables, applies additive updates to existing databases, and synchronises the guidance articles and readiness questions from the files in `backend/src/data/`.

## 7. Repository structure

```
PoultryStart/
├── README.md                 Project overview (this file)
├── backend/                  REST API
│   ├── README.md             Backend reference: endpoints, rules and permissions
│   ├── package.json          Scripts and dependencies (Node.js >=22 <25)
│   ├── .env.example          Example environment variables
│   ├── database/schema.sql   Database tables
│   ├── scripts/initDb.js     Creates the database and lists its tables (npm run db:init)
│   └── src/
│       ├── server.js         Entry point: opens the database, starts the server, runs the demo seed
│       ├── app.js            Express app: security headers, CORS, JSON, /api routes
│       ├── config/           Environment settings and database connection
│       ├── routes/           URL definitions
│       ├── middleware/       Authentication, farm-role checks, validation, errors
│       ├── controllers/      Request handling
│       ├── services/         Business rules (tasks, Advisor, dashboard, reports and more)
│       ├── models/           Database queries
│       ├── validators/       Request validation rules
│       ├── data/             Guidance articles, readiness questions, task templates, Advisor rules
│       ├── demo/demoSeed.js  Optional demonstration account and farms
│       └── utils/            Permissions, dates, errors and responses
└── frontend/                 Web interface
    ├── README.md             Frontend notes
    ├── package.json          start and build scripts (no dependencies)
    ├── index.html            The single page: Content Security Policy and API address
    ├── scripts/serve.js      Local development server (npm start)
    ├── scripts/build.js      Production build into dist/ (npm run build)
    ├── css/                  Stylesheets
    ├── fonts/                Self-hosted Inter font
    ├── assets/               Icons
    └── js/
        ├── app.js, router.js, config.js
        ├── api/              One module per API area
        ├── auth/             Session handling
        ├── farm/             Farm context, role access rules and setup flow
        ├── components/       Shared interface pieces
        ├── pages/            One module per screen
        └── utils/            Dates and formatting
```

- **Root `README.md`:** an overview of the project for evaluators and new developers.
- **`backend/README.md`:** the detailed API reference, with every endpoint, business rule and permission.
- **`frontend/README.md`:** notes specific to the frontend.

Some local files are excluded from Git by `.gitignore` and are **not** in the public repository: environment files (`.env`), database files, `node_modules/`, the frontend build output (`dist/`), log files and the local `docs/` folder.

## 8. Installation and local setup

### 8.1 Prerequisites

- **Node.js 22, 23 or 24**, with npm. The backend requires `>=22 <25` (`engines` in `backend/package.json`). The frontend scripts need Node.js 20 or newer, so one Node.js 22–24 installation runs both.
- **Git**, to clone the repository.
- A modern web browser (Chrome, Edge or Firefox).

### 8.2 Clone the repository

```bash
git clone https://github.com/panom-kaidit/PoultryStart.git
cd PoultryStart
```

### 8.3 Install the backend dependencies

```bash
cd backend
npm install
```

### 8.4 Configure the backend environment

Copy the example file to `.env`:

```bash
cp .env.example .env              # macOS, Linux or Git Bash
Copy-Item .env.example .env       # Windows PowerShell
```

Then open `backend/.env` and set `JWT_SECRET` to your own long random text. Never commit `.env`. It is already listed in `.gitignore`.

| Variable | Example value | Needed locally? | Meaning |
|---|---|---|---|
| `JWT_SECRET` | *your own long random text* | **Yes** | Secret used to sign login tokens. The server will not start without it. With `NODE_ENV=production` it must be at least 32 characters |
| `PORT` | `5000` | Keep the example | API port (default 5000). The local frontend expects the API on port 5000 |
| `NODE_ENV` | `development` | Keep the example | `production` on the deployed server |
| `JWT_EXPIRES_IN` | `8h` | Optional | How long a login lasts (default 8 hours) |
| `DB_PATH` | `database/poultrystart.db` | Optional | Location of the SQLite file, relative to `backend/` (created automatically) |
| `BCRYPT_ROUNDS` | `10` | Optional | Password-hashing cost (default 10) |
| `CORS_ORIGIN` | `http://localhost:5173` | Keep the example | The frontend address that is allowed to call the API |
| `DEMO_SEED` | `false` | Optional | `true` creates the demonstration account and farms at start-up (see [section 10](#10-demonstration-account)) |
| `DEMO_PASSWORD` | *(not set)* | Optional | Replaces the default demo password |

### 8.5 Start the backend

From `backend/`:

```bash
npm run dev       # development: restarts automatically when a file changes (nodemon)
# or
npm start         # runs node src/server.js once
```

The API runs at **http://localhost:5000/api**. Check it at <http://localhost:5000/api/health>, which should return `{"success":true,"message":"PoultryStart API is running."}`. The database file and its tables are created automatically on the first start. You can also create the database and list its tables without starting the server: `npm run db:init`.

### 8.6 Start the frontend

Open a **second terminal** at the repository root:

```bash
cd frontend
npm start
```

The frontend has no dependencies, so `npm install` is not needed. `npm start` runs `scripts/serve.js`, a small static server, on **http://localhost:5173**. In local development, the frontend runs directly from its source files and calls the API at `http://localhost:5000/api`. **No build is needed for local development.**

### 8.7 Open the application

Open **<http://localhost:5173>** in your browser. Register an account, create a farm and follow the guided setup. To try the other roles, register a second account in a private browser window. Then, as the farm owner, add that account's email under **Farm and people → Members** as a manager or worker.

To try PoultryStart with ready-made sample data, set `DEMO_SEED=true` in `backend/.env` and restart the backend. Then log in with the [demonstration account](#10-demonstration-account).

### 8.8 Build the frontend for deployment (optional locally)

The build is only needed for a hosted deployment. It copies the site into `frontend/dist/` and writes the API address into the built `index.html`, in both the API meta tag and the Content Security Policy:

```bash
cd frontend
API_BASE_URL=https://<your-backend>.onrender.com/api npm run build           # macOS, Linux or Git Bash
$env:API_BASE_URL="https://<your-backend>.onrender.com/api"; npm run build    # Windows PowerShell
```

The build stops with an error if `API_BASE_URL` is missing or invalid, or does not use `https://` (`http://` is accepted only for `localhost` and `127.0.0.1`). It never changes the source files. `npm start` serves the source files, not `dist/`.

### 8.9 Troubleshooting

| Problem | Cause and solution |
|---|---|
| Backend stops with `JWT_SECRET is not set` | `backend/.env` is missing or has no `JWT_SECRET`. Copy `.env.example` to `.env` and set a value. |
| Backend stops with `JWT_SECRET must be at least 32 characters in production` | `NODE_ENV=production` is set. Use a secret of at least 32 characters, or set `NODE_ENV=development` locally. |
| `npm install` warns about the engine or `better-sqlite3` fails to install | The Node.js version is outside `>=22 <25`. Install Node.js 22, 23 or 24 and run `npm install` again. |
| The page shows that it cannot reach the server | Check that the backend is running on port 5000 (<http://localhost:5000/api/health>). The local frontend always calls `http://localhost:5000/api`. |
| The browser reports a CORS error | The page's address must exactly match `CORS_ORIGIN` (`http://localhost:5173` by default). Open the app at `http://localhost:5173`, not `http://127.0.0.1:5173`. If you change the frontend port (for example `PORT=5174 npm start`), update `CORS_ORIGIN` and restart the backend. |
| `EADDRINUSE` when starting | Port 5000 or 5173 is already in use. Stop the other program. If you change the frontend port, also update `CORS_ORIGIN`. The local frontend expects the backend on port 5000. |
| Backend stops saying the database "cannot be upgraded" | An old development database file is in use. Back it up, delete `backend/database/poultrystart.db` (and its `-wal`/`-shm` files) and start again. |
| `Frontend build failed: set API_BASE_URL…` | Set `API_BASE_URL` to the backend's address ending in `/api`, as shown in [8.8](#88-build-the-frontend-for-deployment-optional-locally). |

## 9. Public deployment

PoultryStart is deployed on **Render's free hosting tier** as an academic demonstration:

| Part | Render service | Address |
|---|---|---|
| Frontend | Static Site | <https://poultrystart-1.onrender.com> |
| Backend API | Web Service | <https://poultrystart.onrender.com/api> |
| Health check | (backend) | <https://poultrystart.onrender.com/api/health> |

Deployment configuration:
- **Backend Web Service:** root directory `backend`, build command `npm ci`, start command `npm start`, health-check path `/api/health`. Environment variables are set in the Render dashboard, never in the repository: `NODE_ENV=production`, a private `JWT_SECRET` of at least 32 characters, `CORS_ORIGIN` set to the frontend address, and `DEMO_SEED=true`.
- **Frontend Static Site:** root directory `frontend`, build command `npm run build`, publish directory `dist`, with `API_BASE_URL` set to the backend address ending in `/api`.

> **Important hosting limitation: data is temporary.**
> The backend stores its SQLite database on the Render web service's temporary filesystem. Render's free tier provides no persistent disk for this database, so **all data may be lost whenever the service restarts, is redeployed or spins down after inactivity.** Because `DEMO_SEED=true` is set, the demonstration account and its sample farms and records are created again automatically on the next start. Other accounts and data entered by visitors are not recreated. This deployment is a demonstration, **not** production-grade persistent hosting. Do not enter real or personal information.

**Wake-up delay:** free Render services go to sleep after a period without visits. The first request after that may take a minute or so while the backend wakes up. If the app cannot reach the server at first, wait briefly and try again. You can open the [health check](https://poultrystart.onrender.com/api/health) first to wake the backend.

## 10. Demonstration account

| | |
|---|---|
| **Email** | `demo@poultrystart.example` |
| **Default password** | `PoultryStart-Demo-2026` |

- This is a **shared, public demonstration account** with fictional data. Anyone with this README can log in, so the password is not a secret.
- It owns two fictional farms:
  - **Demo Broiler Farm:** an active flock of 500 broiler chicks.
  - **Demo Layer Farm:** an active laying flock of 300 hens.

  Each farm has recent bird-number history, production records, a health observation, expenses, today's tasks and a started readiness checklist. The dates are relative to the day the data was created.
- **Visitors may change the shared demo data,** so what you see may differ from the description above.
- **The demo data may reset** whenever the backend restarts, because the database is temporary (see [section 9](#9-public-deployment)).
- The demo data is created only when the server has `DEMO_SEED=true`. Each start creates only the missing demo records; nothing is duplicated or deleted.
- If the server has `DEMO_PASSWORD` set, that value replaces the default password. If the demo email already exists with a different password, the seed changes nothing.
- To try the manager or worker role, register a second account, log in as the demo owner and add that account to a demo farm under **Farm and people → Members**.

## 11. Project scope and limitations

**Implemented in Version 1:** all the features in [section 3](#3-main-features), for broiler and layer farms, with three farm roles.

**Not included in Version 1:**
- No veterinary diagnosis, automated disease detection or treatment prescriptions. Health observations are notes only.
- Not a replacement for professional veterinary advice.
- No vaccination schedules, medicine management or medication dosages.
- No sales, income or profitability management. Only expenses are recorded.
- No feed-stock or inventory management, purchasing, suppliers or payments.
- No online trading or marketplace.
- No AI services. The Advisor uses fixed, transparent rules.
- No notifications or weather alerts.
- No offline operation: an internet connection to the backend is required.
- No IoT or sensor integration.
- No invitation-and-acceptance workflow: the owner adds a user who has already registered, using their email address.
- Poultry types are limited to broilers and layers.

**Other limitations:**
- The public deployment uses temporary storage (see [section 9](#9-public-deployment)).
- The guidance content has not yet been reviewed by an official veterinary authority (see [section 12](#12-poultry-guidance-disclaimer-and-open-review-item)).
- Automated tests are not part of this repository. The application was checked manually.

## 12. Poultry guidance disclaimer and open review item

The Poultry Advisor is **rule-based**. It applies fixed rules to facts already recorded on the farm, such as flock ages, outstanding tasks, records and readiness, and returns general management reminders with links to guidance articles. It does not diagnose disease, does not recommend medicines, doses, treatments or vaccination schedules, and does not read free-text notes. The Advisor and the health-observation records both show a disclaimer to this effect.

**Always consult a qualified veterinarian or extension officer** about any poultry health concern, for example when birds are sick or dying or a serious disease is suspected.

**Open review item:** the guidance content and the Version 1 rules have **not yet been reviewed** by the Ministry of Agriculture, Animal Industry and Fisheries (MAAIF) or a qualified District Veterinary Officer. This review is recommended before real-world use, and its status is **open**. No official approval has been received.

## 13. Documentation and project references

| Resource | Location |
|---|---|
| GitHub repository | <https://github.com/panom-kaidit/PoultryStart> |
| Deployed frontend | <https://poultrystart-1.onrender.com> |
| Backend health endpoint | <https://poultrystart.onrender.com/api/health> |
| Backend documentation (API reference) | [`backend/README.md`](backend/README.md) |
| Frontend documentation | [`frontend/README.md`](frontend/README.md) |
| Software Requirements Specification (SRS) | *Link to be added* |

## 14. Academic project information

| | |
|---|---|
| **Project title** | PoultryStart: A Role-Based Poultry Management and Advisory System for New Poultry Farmers |
| **Author** | Panom Michael Makuei |
| **Institution** | African Leadership University |
