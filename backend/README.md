# PoultryStart Backend

REST API for **PoultryStart**, a role-based poultry management and advisory system for new and small-scale poultry farmers (broilers and layers).

Built with Node.js, Express 5, SQLite (`better-sqlite3`), JWT authentication and bcrypt password hashing.

> **Status:** the **authentication**, **farm management**, **farm users and roles**, **readiness assessment and resource checklist**, **flock management** (bird movements, corrections, closing), **daily tasks**, **production records** (bird weights, egg collections, feed and drinking-water consumption) **health observations**, **expenses**, **poultry guidance with the rule-based Poultry Advisor** and the **dashboard and reports** modules are working (backend only). There is no frontend yet.
>
> **Open task before real-world use (U-4):** consult MAAIF or a District Veterinary Officer on the guidance content and the Version 1 rules, as the research report advises (§19). **Status: open.** This consultation has not taken place.

---

## 1. Requirements

- Node.js 22 or newer (developed on Node 24)
- npm

## 2. Installation

```bash
cd backend
npm install
cp .env.example .env      # Windows PowerShell: Copy-Item .env.example .env
```

Open `.env` and set `JWT_SECRET` to a long random string. You can generate one with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## 3. Environment variables

| Variable | Purpose | Default |
|---|---|---|
| `PORT` | Port the API listens on | `5000` |
| `NODE_ENV` | `development` or `production` | `development` |
| `JWT_SECRET` | Secret used to sign login tokens. **Required.** Must be at least 32 characters in production. | none |
| `JWT_EXPIRES_IN` | How long a login stays valid (`8h`, `1d`, ...) | `8h` |
| `DB_PATH` | SQLite database file, relative to `backend/` | `database/poultrystart.db` |
| `BCRYPT_ROUNDS` | bcrypt cost factor | `10` |
| `CORS_ORIGIN` | Frontend URL allowed to call the API | `*` |
| `DEMO_SEED` | `true` creates any missing records of the fictional public demo account and its two demo farms on each start-up (see the root README, "Deploying a demo on Render (Free)"). Never duplicates, overwrites or deletes records. | off |
| `DEMO_PASSWORD` | Optional: replaces the documented public demo password | the documented demo password |

The real `.env` file is listed in `.gitignore` and must never be committed.

## 4. Running

```bash
npm run db:init   # optional: creates the database and lists the tables
npm run dev       # starts the server and restarts it when code changes
npm start         # starts the server normally
```

The API runs at `http://localhost:5000/api`. To check that it is running, open `http://localhost:5000/api/health`.

The database file and its tables are created automatically on first start. To start again with an empty database, stop the server and delete `database/poultrystart.db*`.

**Database upgrades (migrations).** Existing database files are upgraded automatically on start-up. Missing columns are added (see `MIGRATIONS` in `src/config/database.js`), and **existing records are kept**. You do not need to delete the database after an update.

**Warning:** deleting the database file permanently erases *all* data: user accounts, farms, members, readiness assessments, answers and checklists, flocks and their bird movements, tasks and task history, production records and their corrections, and later expenses. Only the readiness questions are recreated automatically. Copy `database/poultrystart.db` somewhere safe first if you want to keep the data. Resetting is for development only. The only database that cannot be upgraded is one created before the readiness module existed; the server stops with a message in that case.

## 5. Project structure

```
backend/
  database/
    schema.sql          All tables, keys and rules (CREATE TABLE statements)
  scripts/
    initDb.js           Creates the database and prints the tables
  src/
    config/             Settings (.env) and the database connection
    data/               Approved content: readiness questions, stocking densities,
                        starting stages, task templates, custom task types
                        production record, health observation and expense definitions,
                        the reviewed guidance articles (guidanceContent.js) and the
                        Poultry Advisor rules (advisorRules.js)
    models/             The only code that runs SQL queries
    services/           Business rules (e.g. "the farm creator becomes the owner"),
                        including the read-only dashboard and reports
                        (dashboardService.js, reportService.js, mortalityCalculations.js)
    controllers/        Read the request, call a service, send the response
    routes/             URLs, plus the checks each URL needs
    middleware/         Login check, farm access, permissions, validation, errors
    validators/         Input rules for each request
    utils/              Shared helpers, including the permission matrix
    app.js              Builds the Express app
    server.js           Starts the server
```

**How a request flows:**
`route → authenticate → loadFarmAccess → requirePermission → validate → controller → service → model → database`

Because SQL only appears in `models/` and `config/database.js`, the database could later be changed (for example to PostgreSQL) without touching the controllers or services.

## 6. Response format

Success:

```json
{ "success": true, "message": "Farm created successfully.", "data": { "farm": { ... } } }
```

Error:

```json
{ "success": false, "error": { "message": "Some of the information provided is invalid.",
  "details": [ { "field": "poultryType", "message": "Poultry type must be \"broiler\" or \"layer\"." } ] } }
```

| Status | Meaning |
|---|---|
| 200 / 201 | Success / created |
| 400 | Invalid input (see `details`) |
| 401 | Not logged in, or the token is invalid or expired |
| 403 | Logged in and a member of the farm, but your role does not allow the action |
| 404 | Not found. Also returned for farms you are not a member of, so other people's farms stay private. |
| 409 | Conflict (for example, the email is already registered) |
| 500 | Unexpected server error (details are logged on the server, not sent to the client) |

## 7. API endpoints (implemented so far)

Protected endpoints need this header: `Authorization: Bearer <token>`. You get the token from `register` or `login`.

### Authentication: `/api/auth`

| Method | URL | Purpose | Body | Auth | Response |
|---|---|---|---|---|---|
| POST | `/api/auth/register` | Create an account | `name`, `email`, `password` (8–72 characters) | none | `201` `{ user, token }` |
| POST | `/api/auth/login` | Log in | `email`, `password` | none | `200` `{ user, token }`. `401` if the email or password is wrong. |
| POST | `/api/auth/logout` | Log out | none | logged in | `200`. The client must delete its token. |
| GET | `/api/auth/me` | Current user | none | logged in | `200` `{ user }` |

**About logout (approved Option A):** JWT tokens are stateless. Logout works by the client deleting its token, and any token expires after `JWT_EXPIRES_IN`. Known limitation: a copied token stays valid until it expires. Keeping a server-side list of revoked tokens is a possible future improvement.

### Farms: `/api/farms`

| Method | URL | Purpose | Body | Who may do it |
|---|---|---|---|---|
| POST | `/api/farms` | Create a farm. The creator becomes the **Farm Owner** (BR-01). Returns `{ farm, capacity, readinessAssessment }`. | **Required:** `name`, `location`, `poultryType` (`broiler`/`layer`), `numberOfBirds` (planned, 0–1,000,000), `experienceLevel` (`beginner`/`some_experience`/`experienced`). **Optional:** `farmSize` (text), `managementMode` (`independent` (default) / `with_team`), `currency` (3 letters, default `UGX`), `startingStage` (broilers: `day_old`; layers: `day_old` (default), `pullet` with `startingAgeWeeks` 7–14, or `point_of_lay` with `startingAgeWeeks` 15–20), `houseStatus` (`existing` / `not_built`), `houseLengthM` and `houseWidthM` (usable poultry house, metres, above 0 and up to 500), `nonUsableAreaM2` (stores, feed rooms, passages inside the house, m²), `startAssessment` (`true` = Option A, start the readiness assessment now; `false`/omitted = Option B, plan only) | any logged-in user |
| GET | `/api/farms` | List farms you own or belong to, each with `myRole` | none | logged in |
| GET | `/api/farms/:farmId` | View one farm, with its capacity check. Returns `{ farm, capacity }`. | none | owner, manager, worker of that farm |
| PATCH | `/api/farms/:farmId` | Update farm details. Send only the fields you want to change; `null` clears an optional field. Returns `{ farm, capacity }` (recalculated). Changing `poultryType` does **not** change existing assessments (see readiness). | any of the fields above except `startAssessment` | **owner only** |
| DELETE | `/api/farms/:farmId` | Delete the farm and all its records | none | **owner only** |

Fields such as `id` and `ownerId` cannot be set by the client; they are ignored.

### Farm users and roles: `/api/farms/:farmId/members`

Adding users is **optional**. A farm works fully with just its owner (BR-02, BR-03). Members must already have a PoultryStart account; the owner adds them by email.

| Method | URL | Purpose | Body | Who may do it |
|---|---|---|---|---|
| GET | `/api/farms/:farmId/members` | List members (owner first) with `id`, `userId`, `name`, `email`, `role`, `joinedAt` | none | owner, manager |
| POST | `/api/farms/:farmId/members` | Add a registered user to the farm | `email`, `role` (`manager` or `worker`) | **owner only** |
| PATCH | `/api/farms/:farmId/members/:memberId` | Change a member's role | `role` (`manager` or `worker`) | **owner only** |
| DELETE | `/api/farms/:farmId/members/:memberId` | Remove a member. Their **pending** tasks on this farm become unassigned; completed tasks keep their history. | none | **owner only** |

`:memberId` is the member's `id` from the member list (the membership ID, not the user ID).

| Situation | Response |
|---|---|
| The email has no account | `404` "No PoultryStart account uses this email. Ask the person to register first..." |
| The user is already a member (including the owner) | `409` |
| `role` is `owner` or anything other than `manager`/`worker` | `400` |
| Trying to change or remove the owner | `400` |
| A manager or worker tries to add, change or remove members | `403` |

### Farm readiness assessment and resource checklist: `/api/farms/:farmId/readiness`

**Farm Owner only.** Managers and workers get `403` on every endpoint; non-members get `404`.

The approved questions (Q01–Q16) and default checklist items are in [`src/data/readinessContent.js`](src/data/readinessContent.js). Questions are loaded into the database when the server starts. A farm only sees the questions and items for its poultry type (broiler: 14 questions and 16 items; layer: 14 questions and 18 items).

| Method | URL | Purpose | Body | Response |
|---|---|---|---|---|
| GET | `/readiness` | The farm's readiness status, the current (newest) assessment and all assessments. Use it to **resume**: answers are saved as they are sent, so an unfinished assessment stays `in_progress`. | none | `200` `{ status, current: { assessment, summary } | null, assessments }`. `status` is `not_started` when the owner skipped the assessment. |
| POST | `/readiness` | Start a new assessment. The default checklist for the farm's poultry type is copied in, with every item unavailable. | none | `201` full assessment (see below) |
| GET | `/readiness/:assessmentId` | One assessment with its questions, answers, checklist and summary | none | `200` `{ assessment, summary, questions, resources }` |
| PATCH | `/readiness/:assessmentId/responses` | Save or update answers. Several can be sent at once. If any answer is invalid, none are saved. | `{ "responses": [ { "questionId": 1, "answer": "yes", "notes": "optional" } ] }` | `200` full assessment |
| GET | `/readiness/:assessmentId/resources` | The checklist, with missing items | none | `200` `{ assessmentId, status, resources, missingResources, optionalNotAvailable }` |
| POST | `/readiness/:assessmentId/resources` | Add a custom checklist item | `itemName`, `category` (`housing`/`equipment`/`feed`/`water`/`other`), optional `isRequired` (default `false`), `isAvailable` (default `false`), `notes` | `201` `{ resource, status }` |
| PATCH | `/readiness/:assessmentId/resources/:itemId` | Update an item. **Default items:** only `isAvailable` and `notes`. **Custom items:** also `itemName`, `category`, `isRequired`. | any of those fields | `200` `{ resource, status }` |

All URLs above start with `/api/farms/:farmId`.

- **Answers** must be `"yes"`, `"no"` or `"partly"`. `isRequired` and `isAvailable` must be JSON `true`/`false`.
- **Notes on an answer:** leave `notes` out to keep the existing notes, or send `"notes": null` to clear them.

**Readiness status.** It is recalculated after every change. There are no scores.

| Status | When |
|---|---|
| `not_started` | No answers saved yet (even if checklist items were updated) |
| `in_progress` | At least one **required** question is unanswered, **or** the space check is incomplete (house length/width or planned birds missing in the farm profile) |
| `not_ready` | All required questions answered, but at least one required question is `no`/`partly`, **or** a required checklist item is not available, **or** the planned birds are **above the recommended capacity** |
| `ready` | Every required question is `yes`, every required checklist item is available **and** the planned birds fit the space |

Only requirements needed **before the chicks arrive** count. Later-stage items (for layers, *Laying nests* and *Egg trays*, needed before the first egg) are listed in `summary.laterStageRequirements` with their deadline and never block day-one readiness. Optional questions and optional items never affect the status. Each assessment keeps the poultry type it was created with (`assessment.poultryType`); if the farm's type changes later, the old assessment keeps its questions, checklist and densities, and `assessment.farmPoultryTypeChanged` is `true`. Start a new assessment for the new type. The `summary` explains the status:

| Field | Meaning |
|---|---|
| `unansweredRequired` | Required questions with no answer yet |
| `needsAttention` | Required questions answered `no` or `partly` |
| `missingResources` | Required items that are not available |
| `optionalNotAvailable` | Optional items that are not available (for information only) |
| `areasNeedingAttention` | Preparation areas with something outstanding, e.g. `["equipment", "water"]` |
| Counts | `questionsTotal`, `questionsAnswered`, `requiredQuestionsTotal`, `requiredResourcesTotal`, `requiredResourcesAvailable` |

These lists are calculated each time, never stored. `completedAt` is set when every required question has been answered.

### Starting production stage

A flock can start as **day-old chicks** (broilers and layers), or, for layers only, as **pullets** (7–14 weeks) or **point-of-lay pullets** (15–20 weeks). Give the actual age in `startingAgeWeeks`. Farms created before this feature are treated as `day_old`. The age ranges are PoultryStart planning definitions (`src/data/startingStages.js`), not official trade standards or Ugandan legal requirements (approved 14 Nov 2026).

- **Snapshot.** Each assessment copies `startingStage`, `startingAgeWeeks` and `densityMode` from the farm when it is created. Later profile changes never alter it; `assessment.farmStartingStageChanged` shows when the farm has changed since.
- **Applicability.** Questions and checklist items have `startingStages`. Brooding requirements (Q06, Q07, Q15, Q17, Q19, the chick guard, the brooding heat source, starter feed) apply only to day-old starts. Pullet and point-of-lay starts get Q23, Q24 and "Feed suited to the birds' age on arrival" instead.
- **Deadlines.** Each `neededBy` has a deadline age: `before_transfer` week 15, `before_first_egg` week 18. A requirement is **immediate** (needed before the birds arrive) when the birds arrive at or after that age. Each question and resource in an assessment has `immediate: true/false`, and later items show `dueWeeksAfterArrival`.
- **Laying nests and egg trays.** For layers arriving **before week 18**, *Laying nests* and *Egg trays* are optional items due before the first egg and never block day-one readiness. For point-of-lay birds arriving at **weeks 18–20** both are **required before arrival**: either one missing makes the assessment `not_ready`. They are separate physical items, checked independently of each other and of Q22 ("Will nests be ready…"), so a "yes" to a planning question never marks equipment as available. The rule is fixed when the assessment is created.
- **Research limitations.** For pullet and point-of-lay starts, `summary.researchLimitations` and `capacity.researchLimitations` explain that the report does not establish Uganda-specific requirements for buying older birds. Q23 and Q24 carry a `verificationNote` (check with the supplier, an extension officer or a veterinarian).

### Space and bird-capacity check (planning)

Calculated from the farm profile (`houseLengthM`, `houseWidthM`, `nonUsableAreaM2`, `numberOfBirds`) and returned as `capacity` by the farm endpoints and inside each readiness assessment. The code is in `src/services/capacityService.js`; the densities and their sources are in `src/data/stockingDensities.js`.

- **Usable area** = length × width − non-usable area (stores, feed rooms, passages). Never total land area.
- **Recommended capacity** = floor(usable area × density) for **every stage**. The stage needing the most space (broiler *finishing*, layer *laying*) sets the capacity.
- **Required area** = planned birds ÷ density, rounded **up** to 0.1 m².

| Type | Stage (density, birds/m²) | Source |
|---|---|---|
| Broiler | brooding 30 · growing 25 · finishing: standard **10**, conservative **6** | MAAIF 2019; conservative: MAAIF/ILRI 2023 |
| Layer | chick 20 · pullet 10 · pullet at transfer 12 (**provisional international**, capped at the local pullet value 10) · laying: standard **6**, conservative **5** | MAAIF/ILRI 2023; transfer: Hy-Line 2026; laying: MAAIF 2019 |

**Starting stage and capacity.** Only the stages from the birds' arrival age onward are checked (`stages[].applicable`). Earlier stages stay in the full production plan with their density and source, but `recommendedCapacity` and `fits` are `null` for them.

**Density mode.** Beginner farms (`experienceLevel: "beginner"`) use the **conservative** values by default; other farms use the **standard** values. The other mode's result is always returned in `capacity.comparison`. This is configured in `DENSITY_SETTINGS.modeByExperience`. These are planning defaults chosen by PoultryStart (report sections 6.1 and 17), not legal requirements.

**Four situations**, each with its own `guidance` list:

| `capacity.status` | When | Readiness effect |
|---|---|---|
| `incomplete` | Measurements or planned birds missing (`missing` lists them) | `in_progress` |
| `house_not_built` | `houseStatus: "not_built"`. Shows `requiredAreaM2` to build, and checks the planned design if measurements are given (`plannedDesign`). | `not_ready` |
| `above_capacity` | House too small (`shortfallBirds`, `additionalAreaNeededM2`, options: reduce, extend, split batches) | `not_ready` |
| `within_capacity` | House big enough | the space requirement passes |

The result is a planning recommendation, not a legal standard or a guarantee of performance.

### Flocks: `/api/farms/:farmId/flocks` (FR-06, FR-09)

A **flock** is a group of birds that actually **arrived** together and is managed as one unit. A farm can have any number of flocks over time, and several at once. The farm profile stays the **plan** (planned birds, intended stage); a flock records what **actually** happened. Recording a flock never changes the farm profile.

| Method | URL | Purpose | Who may do it |
|---|---|---|---|
| POST | `/flocks` | Record a flock once its birds have arrived. Returns `{ flock, capacityCheck, planComparison, readiness, warnings }`. | owner, manager |
| GET | `/flocks` (optional `?status=active` or `closed`) | List flocks, newest arrival first | owner, manager, worker |
| GET | `/flocks/:flockId` | One flock, with `arrivalCorrections` and `milestoneChanges` (audit trails) | owner, manager, worker |
| PATCH | `/flocks/:flockId` | Edit details, correct arrival details, or set or change the first-egg date (layers) or expected sale date (broilers) (see below) | owner, manager |
| POST | `/flocks/:flockId/close` | Close the flock | owner, manager |
| DELETE | `/flocks/:flockId` | Delete a flock recorded by mistake | **owner only** |
| GET | `/flocks/:flockId/movements` | Bird-number history, with `fieldNotes` explaining the dates | owner, manager, worker |
| POST | `/flocks/:flockId/movements` | Record a change in bird numbers | depends on the type (below) |

**Recording a flock.** Required: `poultryType` (must match the farm), `arrivalDate` (`YYYY-MM-DD`; past dates allowed, future dates refused, using the date in Uganda, UTC+3), `birdsReceived` (1–1,000,000). Optional: `name` (default "Flock N"), `startingStage` and `ageAtArrivalWeeks` (same rules as the farm: broilers day-old only; layer pullets 7–14 weeks, point-of-lay 15–20 weeks), `breedStrain`, `supplier`, `malesReceived`, `femalesReceived` (together not more than the birds received), `vaccinationNotes` (a record only; no schedule is generated), `notes`.

- **`planComparison`** compares the farm's planned birds with the birds received, e.g. "50 fewer birds than planned". It is information, not an error.
- **`readiness`** is the latest readiness assessment's saved status (read only, never recalculated or changed here). A warning is added if there is no assessment or it is not `ready`; this never blocks recording.
- **`capacityCheck`** reuses the farm space check (`calculateCapacity`) with the flock's actual type, stage and age and the farm's house, experience level and density mode. It compares the **total live birds of all active flocks** in the house. If other flocks are active, `sharedHouse.note` explains that this is a simplified check: one stage density cannot describe flocks of different ages exactly. The birds received are **never** reduced to fit; an above-capacity flock is recorded with a warning. The result is saved on the flock as `capacityAtArrival`.
- **Farm type.** A farm's `poultryType` cannot be changed while it has active flocks of its current type (`409`).

**Live birds** are never stored or typed in. They are always the sum of the flock's bird movements: received + additions − mortality − culled − sold − transferred out ± corrections. The count can reach 0 but never go below it.

#### Bird movements

`POST .../movements` with `movementType`, `birdChange` (signed whole number), optional `movementDate` (effective date; default today), `notes`, and the type-specific fields below.

| `movementType` | `birdChange` | Who may record it | Notes |
|---|---|---|---|
| `received` | — | — | Created automatically with the flock; cannot be sent |
| `mortality` | negative | owner, manager, **worker** | permission `flocks:record_mortality` |
| `culled`, `sold`, `transferred_out` | negative | owner, manager | permission `flocks:manage`; sales record numbers only (no money) |
| `additional_received` | positive | owner, manager | `birdsAgeWeeks` required (see below) |
| `correction` | the intended correction | owner, manager | `correctsMovementId` and `reason` required; see below |

- The date cannot be before the flock arrived or in the future. Closed flocks accept no movements (`409`).
- A movement that would make the live count negative is refused with `409` ("Only 20 live birds are recorded…").
- **Concurrency.** The flock check, the live-count check and the insert run in one `BEGIN IMMEDIATE` transaction (SQLite's write lock is taken first), so two simultaneous requests cannot both use the same old balance. A database trigger also refuses any insert that would make the count negative.

**Additional birds.** Only birds of the same batch: `birdsAgeWeeks` (their age in weeks on the movement date) must equal the flock's age on that date, which also means the same stage. Birds of a different age or stage must be recorded as a separate flock. The age is stored with the movement. Every successful addition returns a **fresh `capacityCheck`** using the flock's new live count plus the other active flocks; the flock's `capacityAtArrival` snapshot is not changed, and the birds are never reduced to fit.

**Corrections.** History is never edited or deleted. A mistake is fixed with a `correction` that points at the original movement (`correctsMovementId`) and gives a `reason`. It takes the original's date. A correction can reduce an entry to 0 but not reverse it, and the birds received must stay above 0.

**Replacing a wrong correction.** Each original movement has **one effective correction** at a time. To fix a wrong correction, record a replacement: send the same `correctsMovementId`, plus `replacesMovementId` (the current correction) and a new `reason`. `birdChange` is again the intended correction to the **original**; it may be 0 to cancel the earlier correction. Two values are stored:

- `correctionAmount` = the intended correction to the original (what was sent);
- `birdChange` = what this entry changes in the live count = `correctionAmount` − the replaced correction's amount.

Example: mortality −5; first correction +2 (`birdChange` +2); replacement +1 (`birdChange` −1). Live effect: −5 + 2 − 1 = **−4**, nothing counted twice. In the history, the original shows `birdChangeAfterCorrection: -4` and `correctedByMovementId`; the first correction stays visible with `isEffective: false` and `replacedByMovementId`. A second correction without `replacesMovementId`, or replacing a correction that was already replaced, returns `409` naming the current correction. Workers cannot record or replace corrections.

**Dates in the history.** `movementDate` is the **effective date** (the day it happened on the farm, Uganda date). `recordedAt` is **when it was entered** (UTC date and time). Each entry also has `recordedBy` and `recordedByName` (name only, no email).

#### Editing, closing and deleting

- **Descriptive details** (`name`, `breedStrain`, `supplier`, `vaccinationNotes`, `notes`) can be edited at any time while the flock is active; `null` clears an optional value.
- **Arrival details** (`arrivalDate`, `startingStage`, `ageAtArrivalWeeks`, `malesReceived`, `femalesReceived`) can only be **corrected** while the flock has no movements other than its `received` entry, and need a `correctionReason`. The same stage and age rules apply. The `received` entry's date follows a corrected arrival date, the space check is re-run and `capacityAtArrival` is updated. Each correction is logged in `arrivalCorrections` (old and new values, including the old and new space check, reason, who, when). After other movements exist: `409`; use a correction movement for bird-number errors.
- **Never edited directly:** `poultryType`, `birdsReceived`, live birds, `status` and the closure fields (`400` explains what to do instead).
- **Milestones** (owner, manager; same `PATCH`): `firstEggDate` (**layers**: a real date, not before arrival, not in the future) and `expectedSaleDate` (**broilers**: not before arrival, may be in the future). Once set, a milestone cannot be removed; changing it needs `correctionReason`. A first-egg date before week 18 is saved with an `early_first_egg` warning. A first-egg date moved to a day after existing egg collection records is refused (`409`, listing them). The value, an append-only history row (`milestoneChanges` on the flock view) and the reconciliation of dependent tasks (see Daily tasks) are saved in **one transaction**: if anything fails, nothing is saved. PoultryStart never sets a broiler sale age itself.
- **Closing** (`POST .../close`): `closureDate` (not before arrival or the last movement, not in the future), `closureReason` (`completed` or `ended_early`), optional `closureNotes`. Only when the live count is exactly **0**; otherwise `409` with the number of birds still to account for. A closed flock stays viewable with its full history but accepts no movements or edits. In the same transaction, the flock's **pending tasks due on or after the closure date are cancelled** (reason and user recorded; returned as `cancelledTasks`), and a farm task **"Clean out and rest the house"** (TP-13) is created (`cleanOutTask`). Earlier tasks keep their real status.
- **Deleting** (owner only): only a flock whose **only** movement is its `received` entry (recorded by mistake), whose tasks have **no history** (none completed, none with review notes or reopen events), and which has **no production records**, **no health observations** and **no linked expenses** (voided ones included). Otherwise `409`. The flock's movements, arrival corrections and open or cancelled tasks are deleted with it (`removedTasks`).

#### Known limitations (V1)

- **Backdated movements** are checked against the **current** live count only. Bird counts on earlier dates are not rebuilt, so a backdated entry is accepted if today's count stays at 0 or more.
- **Corrected arrival snapshots** re-run the space check with the flocks that are active **now**, not those active on the original arrival date.
- **Descriptive edits** (name, breed, supplier, notes) are not individually audited; only `updatedAt` changes. Arrival corrections are fully audited.
- **Closed flocks** cannot be reopened, and cannot be deleted (closing requires sales or losses to be recorded, and a flock with movements cannot be deleted).

### Daily tasks: `/api/farms/:farmId/tasks` (FR-07)

Tasks track **whether work was done**. They never record measurements: deaths are recorded in the flock's mortality form (bird movements), and weights, eggs, feed and drinking water are recorded as production records, and health notes as health observations (see below). There are two kinds of task:

- **Custom tasks**: created by an owner or manager (any title, due date, optional flock, assignee and time of day). `taskType`: `general` (TC-01), `vet_plan` (TC-02, a reminder copied from the vet's or chick supplier's programme; it always shows *"PoultryStart does not create vaccination schedules or give medicine doses…"*) or `sale_preparation` (TC-03).
- **Generated tasks**: created by PoultryStart from the approved task catalogue (`src/data/taskTemplates.js`) for each active flock, and for the farm. They can only be reassigned, not edited.

| Method | URL | Purpose | Who may do it |
|---|---|---|---|
| GET | `/tasks` | List tasks (first generates the current tasks; see below). Filters: `from`, `to` (dates), `status` (`pending`, `overdue`, `missed`, `completed`, `cancelled`), `flockId`, `assignedTo` (`me`, `unassigned` or a user ID) | owner, manager: all tasks. **Workers: only tasks assigned to them and unassigned tasks** |
| POST | `/tasks` | Create a custom task. Required: `title`, `dueDate` (today or later, Uganda date). Optional: `description`, `timeSlot` (`morning`, `midday`, `evening`, `any`), `flockId` (an active flock of this farm), `assignedTo` (a member of this farm), `taskType` | owner, manager |
| GET | `/tasks/:taskId` | One task with its `history` | as for the list (another worker's task: `404`) |
| PATCH | `/tasks/:taskId` | Edit, assign, reassign or unassign (`assignedTo: null`) an open task | owner, manager |
| POST | `/tasks/:taskId/cancel` | Cancel an open task. `reason` required. The task stays in the history as cancelled | owner, manager |
| POST | `/tasks/:taskId/complete` | Complete a task. Optional `notes`; `problemReported: true` needs `notes` explaining the problem. Measurement fields (`birdsLost`, `feedKg`, `eggsCollected`, `weightKg`, …) are refused with a `400` naming the right record form | everyone, **workers only for their own and unassigned tasks** |
| POST | `/tasks/:taskId/reopen` | Reopen a completed task. `reason` required; the earlier completion is kept in the history | owner, manager (`tasks:reopen`) |
| POST | `/tasks/:taskId/notes` | Add a review note. It never changes the task (status, assignee, completion) | owner, manager |

There is no task delete endpoint: tasks are cancelled, so their history is kept.

#### Status

Stored status is only `pending` or `completed`; what users see (`displayStatus`) is worked out against **today's date in Uganda (UTC+3)**:

| `displayStatus` | When | Can it be completed? |
|---|---|---|
| `pending` | open, not past its last day | yes (a **daily** task only on its own day) |
| `overdue` | open, past its last day, **not** a daily task | yes, marked `completedLate: true` |
| `missed` | open, past its day, a **daily** task | **no, by nobody**. It stays missed; owners and managers can add review notes. It also cannot be edited, reassigned or cancelled |
| `completed` | done (`completedBy`, `completedAt`, `completionNotes`, `problemReported`) | no |
| `cancelled` | cancelled (`cancelledBy`, `cancelledAt`, `cancelReason`) | no, and it cannot be reopened |

The last day of a task is its due date, except **weekly tasks, which stay pending for their whole week** (due date + 6 days) and become overdue only after the week has ended. Completing two tasks at the same moment, or the same task twice, is safe: each change runs in one locked transaction.

#### History (audit)

- Completion details are kept on the task. **Reopening** stores the earlier completion (who, when, notes, problem flag), the reason and who reopened it in the task's `history`.
- **Review notes** are added to the `history` with the reviewer and time; the task itself is unchanged.
- History is append-only, and a task with history (completed, or with notes or reopen events) can never be deleted, not even by deleting its flock (the flock delete is refused with `409`). Deleting the whole farm still removes everything.

#### Generated tasks

**When:** opening the task list generates the tasks that are **current today** (Uganda date) for every **active** flock that has arrived, and the farm tasks while the farm has an active flock. There is **no background scheduler and no backfill**: a day, week or window in which nobody opened the list has no tasks.

| Frequency | What "current" means | Status |
|---|---|---|
| `daily` | due today | missed after today |
| `weekly`, flock | due on each new week of flock age, created during that week | pending all week, overdue after it |
| `weekly`, farm | due on **Monday** (Uganda date), created during that week | pending all week, overdue after it |
| `interval` | every N days counted from the arrival date (one task per period) | overdue after its due date |
| `once` (stage) | due on a flock age; created within **7 days** from its due date (1 day for the arrival-day and day-1 tasks) | overdue after its due date |
| `once` (sale) | counted back from the farmer's expected sale date; created from its due date **until the sale date** | overdue after its due date |

A stage task only applies if the birds arrived **before** that age (e.g. no grower-feed reminder for pullets that arrived at week 10). Brooding tasks are for **day-old starts only** (broilers days 0–13, layers days 0–48).

| Group | Tasks |
|---|---|
| Daily, every flock | TD-01 morning flock check · TD-02 feed check · TD-03 water and drinkers · TD-04 dead birds (links to the mortality form) · TD-05 litter inspection · TD-06 midday house check · TD-10 evening records review |
| Daily, farm | TD-08 footbath and house boots · TD-09 evening farm check |
| Brooding | TB-01 receive and inspect chicks (arrival day) · TB-02 first 24 hours water and feed · TB-03 crop-fill check (broilers, day 1) · TB-04 evening brooder check · TB-05 morning brooder temperature · TB-07 brooder space (every 3 days) |
| Interval | TI-01 turn wet or caked litter (every 3 days from day 3) · TW-07 litter top-up (every 14 days from day 14) |
| Weekly | TW-01 weigh birds (broilers from week 2, layers from week 4) · TW-02 feed and water review · TW-04 health review · TW-06 egg production review (laying layers) · farm: TW-03 house and biosecurity inspection, TW-05 stock and purchases (Monday) |
| Broiler stages | TP-01 order next-stage feed (day 3) · TP-02 starter to grower check (day 10) · TP-03 finisher check (day 25) |
| Broiler sale (needs an expected sale date) | TP-04 medicine withdrawal check with your vet (sale − 14 days) · TP-05 book buyers (− 7) · TP-06 crates and transport (− 3) · TP-07 lighting before catching, optional international guidance (− 3) · TP-08 catch and sell (sale day; links to the "sold" form) |
| Layers before laying | TP-09 grower feed (week 10) · TL-03 lighting before laying and TP-11 move to the laying house, if used (week 15) · TL-01 perches and adult feeder space (week 16) · TL-02 prepare nests and TP-10 pre-lay feed (week 17) · TL-04 check nests for first eggs (daily from week 18 until the first-egg date) |
| Layers laying (needs the first-egg date) | TE-01, TE-02, TE-03 collect eggs (morning, midday, afternoon/evening) · TP-12 layer feed: check your feeding programme (week 20 or the first-egg date, whichever is first) |
| When a flock closes | TP-13 clean out and rest the house (farm task, due on the closure date) |

No task gives vaccination or medicine schedules, doses or treatments, and none sets a broiler sale age. Vaccination reminders exist only as custom TC-02 tasks entered from the vet's or supplier's programme.

**Milestones and reconciliation.** TL-01 to TL-04, TP-10 to TP-12, TE-01 to TE-03 and TW-06 depend on the **first-egg date**; TP-04 to TP-08 depend on the **expected sale date**. When a milestone is recorded or changed, the flock's **pending generated** tasks of those templates **due today or later** are cancelled (reason and user recorded). Completed, missed and overdue tasks, and custom tasks, are never touched. The tasks that now apply are created the next time the list is opened. A task for an old due date and a task for a new due date are different occurrences: an old overdue task is kept and does not block the new one.

**No duplicates.** Each generated task has a generation key (template, flock or farm, due date, occurrence, milestone version) that is unique per farm in the database, including cancelled tasks, and generation runs in one locked transaction. Opening the list again, or by several users at once, creates nothing twice; a task someone cancelled is never recreated for the same milestone version; and a completed occurrence is never recreated, even after a milestone change.

#### What the evidence labels mean

Every generated task shows `guidance`: the detailed basis and the kinds of source behind it.

| Code | Shown as | What it means for the farmer |
|---|---|---|
| UG | Uganda official source | From the Ministry of Agriculture (MAAIF 2019 or MAAIF/ILRI 2023) training manuals for Uganda. |
| SUP | Ugandan supplier guidance | From a Ugandan chick supplier (for example Ugachick). Follow your own supplier where it differs. |
| INT | International guidance | From an international breeder guide or standard (Ross, Aviagen, Hy-Line, Hendrix, WOAH). **Not a Ugandan standard**; follow your supplier or local advice where it differs. |
| PD | PoultryStart planning definition | A planning rule chosen for PoultryStart (for example the week a task appears). Not a standard. |
| PG | PoultryStart practice guidance | A sensible routine suggested by PoultryStart. No source for it was found in the research report. |

#### Known limitations (V1)

- Tasks are generated **only when the task list is opened**, for the current day, week or window. There is no scheduler, no backfill and no planning of future days (tomorrow's tasks cannot be assigned in advance).
- There are **no reminders or notifications**, and **no frontend** yet.
- Weights, eggs, feed and water are recorded as production records, health notes as health observations, and money spent as expenses (owner only: TW-05 and TP-01 show the expense link to the owner only).
- Each generated task lists `recordLinks`: the record forms it points to, with the API `path` for its flock and, for production records and health observations, `recordsForTaskPeriod` (how many records exist for the task's day, or week for a weekly task). `recordLink` is the first of them.
- Brooding temperatures are not shown by PoultryStart; TB-05 asks the farmer to use the supplier's temperature guide.
- **First-day water (TB-02):** no temperature or quantity is given (the figures the report cites could not be verified). TB-02 says: *"Have clean drinking water ready for newly arrived chicks. Ask your chick supplier or extension officer how to give water to newly arrived chicks. Spread feed on paper or trays so the chicks find it at once."* The feed instruction is from Ross 2025 (international), report §7.1.
- **Egg storage (TE-01 to TE-03):** no storage rule is given: *"No verified Ugandan egg-storage standard is included in PoultryStart guidance. Ask your district veterinary officer or the Uganda National Bureau of Standards (UNBS) about storage and grading requirements."* (basis: "Storage: no verified Ugandan standard (§19).")
- Each generated task also lists `guidanceLinks`: fixed links to the reviewed guidance articles for its poultry type (for example TD-01 → G-ALL-HEALTH-01; TD-02 → G-BR-FEED-01 or G-LY-FEED-01, and G-ALL-FEED-02). The full mapping is `TASK_GUIDANCE` in `src/data/guidanceContent.js`. Custom tasks have none.
- Stage tasks follow flock age only (not body weight), so feed and lighting tasks are reminders to check the supplier's programme, not instructions.

### Production records: `/api/farms/:farmId/flocks/:flockId/records` (Version 1)

Four kinds of record of what **actually** happened on the farm. They are the farmer's own quantities: PoultryStart never fills them in from research estimates, never compares them with targets, and never declares a flock healthy or underweight.

| Record | Path | Fields | Stored unit |
|---|---|---|---|
| Bird weights | `/records/weights` | `recordDate`, and either `weights` (each sampled bird) **or** `sampleSize` + `averageWeight`; `unit` (`g` default, or `kg`); `notes` | grams |
| Egg collections (layers) | `/records/eggs` | `recordDate`, `collectionPeriod` (`morning`, `midday`, `evening`, `extra`), `goodEggs`, `secondGradeEggs`, `floorEggs` (whole numbers, default 0), `notes` | eggs |
| Feed consumption | `/records/feed` | `recordDate`, `quantity`, `unit` (`kg` default, or `g`), `measurementMethod` (`measured` or `estimated`), `feedStage` (optional; broilers `starter`, `grower`, `finisher`; layers `starter`, `grower`, `pre_lay`, `layer`; both `other`, `unknown` = default), `notes` | kilograms |
| Drinking-water consumption | `/records/water` | `recordDate`, `quantity`, `unit` (`L` default, or `ml`), `measurementMethod`, `notes` | litres |

For each kind (`<kind>` = `weights`, `eggs`, `feed` or `water`):

| Method | URL | Purpose | Who may do it |
|---|---|---|---|
| GET | `/records/<kind>` | List records, newest first. `date`, or `from` and `to` (default: the last 31 days; at most 366 days) | owner, manager, worker |
| GET | `/records/<kind>/summary` | Basic summary for the same range (see below) | owner, manager, worker |
| POST | `/records/<kind>` | Add a record | owner, manager, **worker** |
| GET | `/records/<kind>/:recordId` | One record with its `corrections` | owner, manager, worker |
| POST | `/records/<kind>/:recordId/corrections` | Correct a record: `expectedVersion` (the version you saw), `reason`, and the fields to change | owner, manager |
| GET | `/api/farms/:farmId/production-records?type=weight\|eggs\|feed\|water` | One kind of record across the farm's flocks; optional `flockId`, `date`, `from`, `to` | owner, manager, worker |

Permissions: `production:view` and `production:create` (all roles), `production:correct` (owner, manager). Nobody can delete a production record. A non-member, or a flock or record of another farm or flock, gets `404`.

**Rules for every record**

- It belongs to a flock of the farm in the URL, with the user who created it (`createdBy`, `createdByName`) and when (`createdAt`, UTC).
- `recordDate` is a Uganda date (UTC+3): not in the future, not before the flock arrived. Closed flocks accept records dated on or before the closure date only. Each kind accepts only its own fields (anything else, such as cleaning water on a water record, is refused).
- No duplicates: one egg record per flock, day and collection period; one feed record per flock, day and feed stage, and a day has **either** one record with an `unknown` stage **or** records for named stages, never both (the same feed would be counted twice); one water record per flock and day (the day's total). A weight session identical to one already recorded that day is refused; different sessions on the same day are allowed. A duplicate returns `409` naming the existing record: change it with a correction instead.
- Input limits only catch typing mistakes (they are not targets): one bird 10 g to 10 kg; at most 500 individual weights; feed up to 100,000 kg and water up to 1,000,000 L a day.
- **Bird population on the record date.** The birds weighed in a session, and the eggs of a day (all periods together; a hen lays at most one egg a day), cannot be more than the flock's live birds **on that date**, rebuilt from its bird movements up to and including that date: received, additional birds, mortality, culls, sales, transfers and corrections (a correction counts on the date of the movement it corrects).
- **Backdated movements.** A movement recorded later with an earlier date is still accepted, even if it leaves an existing weight or egg record above the population of its date. Such records are never changed or deleted: they show `populationOnDate`, `exceedsPopulation: true` and a `warnings` entry (`exceeds_population`) in the record, the lists and the summaries. A correction of such a record must bring it within the population of its date.

**Weights.** With `weights`, PoultryStart calculates the sample size, average, minimum and maximum. With `sampleSize` and `averageWeight`, no individual weights are needed. Values are stored in grams, and what the farmer typed is kept too: `enteredUnit`, `enteredWeights` or `enteredAverageWeight` (for example 1.5 kg is kept as 1.5 `kg` and stored as 1500 g). Records saved before this was added have these fields empty (their original unit is unknown). Responses add `averageWeightKg` and the flock's `ageWeeks` on that day. PoultryStart does not set a sample size and does not compare weights with breeder targets.

**Eggs.** Only for layer flocks, and only from the recorded **first-egg date** (without it: `409`, the owner or a manager must record it on the flock first; an egg record never sets it). Moving the first-egg date to a later day than existing egg records is refused with `409`, listing those records; neither the milestone nor the records are changed. The three counts never overlap, so each egg is counted once:
- `goodEggs`: clean, whole eggs from the nests;
- `secondGradeEggs`: cracked, dirty or misshapen eggs from the nests;
- `floorEggs`: eggs laid outside the nests, whatever their condition (handled separately).

A day cannot have more eggs than the birds the flock has had (a hen lays at most one egg a day). No egg storage or grading standard is given (none is established for Ugandan smallholders).

**Feed and water.** The stored quantity is converted to kilograms or litres; the quantity and unit the farmer entered are kept too (`enteredQuantity`, `enteredUnit`). Water records are **drinking water only**: not cleaning water, spillage or total farm water needs. `measurementMethod` says whether the farmer measured or estimated it. Feed records are not feed stock or purchases.

**Corrections.** A record is never edited in place or deleted. An owner or manager sends a correction with the `expectedVersion` they saw and a `reason`. In one locked transaction PoultryStart checks the version (`409` if someone corrected it meanwhile), applies the same rules as for a new record, and adds a correction row with every changed field's old and new value, the reason, who and when; the record's `version` goes up by 1. `GET .../:recordId` shows the current values and all `corrections`. The database refuses any other change, any deletion while the farm exists (so a flock with production records cannot be deleted: `409`), and any change to the correction history. Deleting the whole farm still removes everything.

**Summaries** (basic record summaries, not reports):
- eggs: per day, the periods recorded and the totals per category; totals for the range;
- feed and water: per day, the total (feed also per stage) and whether it was measured, estimated or mixed; the range total and the average per recorded day;
- weights: each session over time with the flock's age, and the change from the flock's own previous session.

Each summary carries the note that these are the farm's own records, not research estimates or targets.

**Daily tasks.** TD-02 and TW-02 link to feed records, TD-03 and TW-02 to water records, TW-01 to weight records, TE-01 to TE-03 and TW-06 to egg records, and TD-10 to all of them (eggs only for layer flocks with a recorded first-egg date) plus the mortality form. Completing a task still records only notes and a problem flag; deaths are still recorded only as bird movements.

**Known limitations (V1).** No feed purchasing, feed stock, costs or reminders (health notes are kept separately as health observations, below). Summaries do not calculate per-bird figures (such as grams per bird per day or laying percentage), because the bird count on each past day is not rebuilt. There is no frontend yet.

### Health observations: `/api/farms/:farmId/flocks/:flockId/records/health` (FR-09)

The farmer's own notes of what was seen in a flock. **Record-keeping only:** PoultryStart does not diagnose disease, recommend medicines or treatments, or plan vaccinations. Deaths are **not** recorded here: they go in the flock's mortality form (bird movements), and an observation never changes the number of birds.

Every successful response includes `disclaimer`:

> PoultryStart only keeps your notes. It does not diagnose disease, recommend medicines or replace a veterinarian. If birds are sick or dying, or you suspect a serious disease, contact your veterinarian or extension officer straight away.

| Field | Rule |
|---|---|
| `observationDate` | Required. Uganda date: not in the future, not before the flock arrived; closed flocks accept dates on or before the closure date only |
| `observation` | Required. What was noticed, in the farmer's own words (trimmed, 1–1000 characters) |
| `birdsAffected` | Optional. A whole number, 1 or more, not more than the flock's live birds **on the observation date**. Left out or `null`: not counted |
| `actionTaken` | Optional text (up to 1000 characters). Blank or `null`: none given |
| `vetContacted`, `extensionOfficerContacted` | Optional `true` or `false` (default `false`) |

Any other field is refused (`400`). Mortality fields such as `deaths` or `birdsLost` are refused with a pointer to the mortality form. Several observations per flock and day are allowed.

| Method | URL | Purpose | Who may do it |
|---|---|---|---|
| GET | `/records/health` | List the flock's observations, newest first. `date`, or `from` and `to` (default: the last 31 days; at most 366 days) | owner, manager, worker |
| POST | `/records/health` | Record an observation | owner, manager, **worker** |
| GET | `/records/health/:observationId` | One observation with its `corrections` | owner, manager, worker |
| POST | `/records/health/:observationId/corrections` | Correct an observation: `expectedVersion` (the version you saw), `reason`, and the fields to change (`null` removes `birdsAffected` or `actionTaken`) | owner, manager |
| GET | `/api/farms/:farmId/health-observations` | Observations across the farm's flocks; optional `flockId`, `date`, `from`, `to` | owner, manager, worker |

Permissions: `health:view` and `health:create` (all roles), `health:correct` (owner, manager). Nobody can delete an observation. A non-member, or a flock or observation of another farm or flock, gets `404`.

**Birds on the observation date.** Each observation shows `populationOnDate` (the flock's live birds on that date, rebuilt from its bird movements). If a movement recorded later with an earlier date leaves `birdsAffected` above that number, the observation is kept unchanged and shows `exceedsPopulation: true` and a `warnings` entry (`exceeds_population`) in the observation and both lists, until it is corrected.

**Corrections.** An observation is never edited in place or deleted. An owner or manager sends a correction with the `expectedVersion` they saw and a `reason`. In one locked transaction PoultryStart checks the version (`409` with the current version if someone corrected it meanwhile), applies the same date and population rules as for a new observation, and adds a correction row with every changed field's old and new value, the reason, who and when; `version` goes up by 1. A correction that changes nothing is refused. If any check fails, nothing changes. The database refuses any other change, any deletion while the farm exists, and any change to the correction history. A flock with observations cannot be deleted (`409`); deleting the whole farm still removes everything.

**Daily tasks.** TD-10 (evening records review) and TW-04 (weekly health review) link to the flock's health observations, with `recordsForTaskPeriod`: the number of the flock's observations on the task's day (TD-10) or in its week (TW-04). Zero is normal (nothing unusual was seen); no observation is needed to complete a task.

**Known limitations (V1).** Free text only: no symptom lists, statistics or trends. No reminders or alerts, and no vaccination, medicine or treatment records (Version 2 health management). Error responses use the standard error format, without the disclaimer. There is no frontend yet.

### Expenses: `/api/farms/:farmId/expenses` (FR-10, owner only)

Money spent on the farm. **Expenses only:** no sales, income, profit, feed stock, inventory, suppliers or payments.

| Field | Rule |
|---|---|
| `expenseDate` | Required. Uganda date, not in the future. It may be before a flock arrived (chicks, feed and equipment are often paid for in advance) |
| `category` | Required: `feed`, `chicks`, `medication`, `equipment`, `labour`, `transport` or `other` |
| `amount` | Required. A **whole number** from 1 to 10,000,000,000 in whole units of the farm's currency (no decimals; the maximum is only a typing-mistake check, not a spending recommendation) |
| `description` | Required, 1–500 characters (trimmed) |
| `flockId` | Optional. A flock of this farm, active or closed (another farm's flock: `404`) |

The **currency is copied from the farm** when the expense is recorded (`currency`) and never changes, not even through a correction or when the farm's currency is changed later. Sending `currency` is refused. Any other unknown field is refused (`400`).

| Method | URL | Purpose |
|---|---|---|
| POST | `/expenses` | Record an expense |
| GET | `/expenses` | List, newest first. `date`, or `from` and `to` (default: the last 31 days; at most 366 days); optional `category`, `flockId` (a flock ID, or `none` for expenses not linked to a flock) and `includeVoided` (`true` default, or `false`) |
| GET | `/expenses/summary` | Summary for the same range and filters (see below) |
| GET | `/expenses/:expenseId` | One expense with its `corrections` |
| POST | `/expenses/:expenseId/corrections` | Correct it (`expectedVersion`, `reason`, the fields to change; `flockId: null` removes the flock link), or void it (`expectedVersion`, `reason`, `voided: true`, nothing else) |

**Permissions.** `expenses:view`, `expenses:record` and `expenses:correct` are **owner only**. Managers and workers get `403` on every expense route, and task responses never show them expense links, paths or counts. A non-member gets `404`. Nobody can delete an expense.

**Corrections.** In one locked transaction PoultryStart checks the version (`409` with the current version if it changed meanwhile), applies the same rules as for a new expense, and adds a correction row with every changed field's old and new value, the reason, who and when; `version` goes up by 1. A correction that changes nothing is refused. If any check fails, nothing changes. The database refuses any other change, any change of currency, any deletion while the farm exists and any change to the correction history.

**Voiding.** A mistaken expense is voided with a correction of its own (`voided: true` and a reason). It stays in the list (`voided: true`, `voidReason`, `voidedBy`, `voidedAt`) with its full history, is **left out of every total**, and can never be un-voided. Its flock link can still be corrected (so a flock recorded by mistake can be deleted); nothing else can.

**Summaries** (`GET /expenses/summary`): for each currency **separately** (different currencies are never converted or added together; there is no grand total across currencies), the total and number of expenses, and:
- `byCategory`: all seven categories, zeros included;
- `byMonth`: each calendar month touched by the range, with its dates within the range;
- `byFlock`: each linked flock, plus "Not linked to a flock".

`voidedExcluded` says how many voided expenses were left out. There is no cost per bird, profit or income.

**Flocks and farms.** A flock with linked expenses (voided ones included) cannot be deleted (`409`); the owner can remove the link from each expense with a correction first, and the expense keeps its history. Deleting the whole farm still removes everything.

**Daily tasks.** TW-05 (stock and purchases, Monday) links to the farm's expenses, and TP-01 (order next-stage feed, broilers day 3) to the flock's expenses (`?flockId=`), with `recordsForTaskPeriod`: the expenses not voided in the task's week (TW-05) or on its day (TP-01). Only the owner sees these links; zero is normal, and no expense is needed to complete a task.

**Older expense records.** The earlier `expense_records` table is kept unchanged and is no longer written to. At start-up, any rows it has are copied once into the expense records (no flock, the farm's current currency, the old notes as the description), remembered by `copiedFromExpenseRecordId`, so they are never copied twice.

**Known limitations (V1).** Expenses only: no sales, income, profit, stock, suppliers, payments or receipts. Whole currency units only. No currency conversion. No reminders. There is no frontend yet.

### Poultry guidance: `/api/guidance` (FR-11)

Beginner-friendly guidance articles for broilers and layers. **Any logged-in user** can read them, with or without a farm (no farm permission). Read-only: there is no route to add, edit or delete articles.

**Content and storage.** The 33 articles of the approved *G0 Poultry Guidance catalogue, revision 4* are written in `src/data/guidanceContent.js`, the reviewed source of truth, built from the research report and approved project decisions. At every start-up they are **synchronised** into the existing `poultry_guidance` table by their stable article code:
- missing articles are added;
- changed ones are updated (`updated_at` changes only when something changed);
- coded articles removed from the file are marked inactive, never deleted;
- running the sync again changes nothing and never creates duplicates.

Older databases get the new columns through additive migrations (`code` with a unique index, `summary`, `stages`, `steps`, `key_values`, `notice`, `evidence_labels`, `sources`, `source_differences`, `strain_note`, `referral`, `related_codes`, `keywords`, `content_version`, `reviewed_on`, `is_active`, `sort_order`). Older rows **without a code** are kept unchanged but **never shown**. To change an article, edit the file, raise its `contentVersion`, update `reviewedOn` and have the change reviewed.

**Organisation.**
- **Topics:** the 8 FR-11 topics: farm preparation, housing, feeding, water, flock management, hygiene and biosecurity, health monitoring, daily activities.
- **Poultry type:** `broiler`, `layer` or `all` (for both).
- **Stages** (the app's own age helpers; weeks are counted from 0, so week 2 = age days 14–20):
  - **broilers:** `preparation`, `brooding` (age days 0–13), `growing` (day 14 on), `sale` (from 14 days before the expected sale date, the TP-04 schedule value, until the flock is closed, even after the sale date; brooding has priority if they overlap; no sale date means no sale stage). The sale stage is an **approved PoultryStart planning definition, not a published standard** (decisions D-S1 to D-S3): the topics endpoint and the Advisor show it with the PD qualification "PoultryStart planning definition, not a published standard.". `after_flock`;
  - **layers:** `preparation`, `brooding` (weeks 0–6, age days 0–48), `rearing` (weeks 7–14), `pre_lay` (week 15 until the recorded first-egg date), `laying`, `after_flock`.
- Articles for both types list stages per type; one article (biosecurity) applies at `any` stage.

**Evidence and qualifications.** Every article lists its evidence labels (UG, SUP, INT, PD, PG; see the table under Daily tasks). Every figure is returned in `keyValues` with its sources, the report section, and its **qualification printed beside it**:

| Marker | Qualification printed beside the figure |
|---|---|
| `UG` | none (Uganda official source; the source is named) |
| `INT` | "International guidance, not a Ugandan standard; may apply only to the named strain or housing system." |
| `SUP` | "Supplier guidance from {supplier}, not a Ugandan national standard." |
| `MIX` | "Combined Ugandan and international sources; not confirmed as a Ugandan standard." |
| `PD` | "PoultryStart planning definition, not a published standard." |
| `PG` | "PoultryStart practice suggestion." |
| `UG-R` | "Local Ugandan research (one study), not an official MAAIF standard." |

Where sources disagree, both are shown (`sourceDifferences`), never averaged. Where evidence is missing, the article says so and refers the farmer to the supplier, veterinarian, extension officer or the right authority. For example, there is no verified Ugandan egg-storage standard, so storage questions go to the district veterinary officer or UNBS.

**Endpoints**

| Method | URL | Purpose |
|---|---|---|
| GET | `/api/guidance` | List articles (short entries). Filters: `poultryType` (`broiler` or `layer` include articles for both types; `all` returns only articles for both types), `topic`, `stage` (`any` returns the any-stage article), `q` (2–100 characters; every word must appear in the title, summary, content or keywords) |
| GET | `/api/guidance/topics` | Topics with article counts, stages per poultry type, evidence labels, markers and the catalogue revision |
| GET | `/api/guidance/:code` | One article: `summary`, `notice` (planning-estimate box or evidence gap), `steps`, `keyValues`, `sourceDifferences`, `limits`, `referral`, `evidenceLabels` (explained), `sources`, `relatedArticles`, `contentVersion`, `reviewedOn`. Unknown or inactive codes: `404` "Guidance article not found." |

Every guidance response includes `disclaimer`:

> This is general poultry-management information for learning and planning. It does not replace advice from a veterinarian or extension officer. If birds are sick or dying, or you suspect a serious disease, contact your veterinarian or extension officer straight away.

**What the guidance never contains:** disease diagnosis, medicine names, doses or treatments, vaccination schedules or vaccine-handling instructions, brooding temperature tables, production targets, prices or profit figures, or the unverified first-day water figures.

### Poultry Advisor: `GET /api/farms/:farmId/advisor` (FR-11)

A **read-only, rule-based** Advisor. It looks at information already recorded on the farm and returns practical reminders with links to guidance. It is calculated on each request and **stores nothing**:
- no advice is saved;
- no tasks are generated;
- no readiness status is saved;
- no record is created or changed.

It **never reads the text** of health observations or task notes, never uses **expenses**, never diagnoses disease, and never recommends medicines, doses, treatments or vaccination schedules.

**Access.** Every farm role (`advisor:view`); non-members get `404`. Optional `flockId` (a flock of this farm, otherwise `404`) limits advice to that flock and leaves out farm-level readiness advice.

**Response.**
- **Overall fields:** `date` (Uganda date), `role`, `flockId`, `flocks` (id, name, age in days and weeks, stage), `limitation`, `disclaimer`, `totalCount`, `omittedCount` and `advice`.
- **Limit:** at most **10** items, most urgent first (`urgent`, `important`, `routine`, `info`, then rule order, then flock); `omittedCount` says how many more there were.
- **Each item:**
  - `rule`, `priority`, `kind`, `title`, `message`, `nextStep`, `flockId`;
  - `facts`: the structured facts used: dates, counts, ages; never free text;
  - `basis`: the evidence labels and the rule's basis;
  - `guidance`: article links;
  - `targets`: structured API information such as `{ type: 'flock' | 'task' | 'health_observation' | 'production_record' | 'record_form' | 'mortality_form' | 'flock_update' | 'readiness', id, method, path }`, only for resources of this farm that the viewer may use.

Every response contains this exact limitation:

> This Advisor only evaluates information recorded in PoultryStart. No alert does not mean your flock is healthy or that there is no problem.

**Rules** (`src/data/advisorRules.js`, reviewed). "The last 3 days" = today and the 2 days before; "the last 2 full days" = yesterday and the day before (Uganda dates). Only active flocks, except AR-23.

| Rule | Priority | Who sees it | Trigger |
|---|---|---|---|
| AR-01 | urgent | all | Deaths (after corrections) recorded on **at least 2 of the last 3 days**. Refers to a veterinarian or extension officer straight away. *PoultryStart design rule, not a veterinary threshold or diagnosis.* |
| AR-02 | urgent | all | Deaths in the last 3 days **and** a health observation dated in the last 3 days (when AR-01 does not already apply). Same referral; same basis. |
| AR-03 | important | all | A health observation in the last 7 days with **no vet or extension officer contact** recorded: a **review reminder**, not an emergency. |
| AR-30 | important | all (workers: own and unassigned tasks) | Daily tasks missed in the last 7 days. |
| AR-31 | important | all (as above) | Overdue tasks. |
| AR-32 | important | owner, manager | Tasks completed in the last 7 days with a reported problem (the notes are not read). |
| AR-43 | important | all | Weight or egg records, or health observations, from the last 31 days above the flock's population on their date (the existing population warnings). |
| AR-40, AR-41 | routine | all | No feed (AR-40) or drinking-water (AR-41) record on either of the last 2 full days, counted only from the flock's arrival. *PoultryStart monitoring prompt, not a biological standard or proof of a problem.* |
| AR-42 | routine | all | Layers only: no egg record on either of the last 2 full days, only from the recorded first-egg date (never for broilers). Same basis. |
| AR-10 | important if not ready, otherwise routine | **owner** | No active flock and the latest assessment's **saved** status is not "ready": details (areas needing attention, unanswered and needs-attention counts, missing resources). |
| AR-11 | routine | **owner** | No flock and no assessment: start the readiness assessment. |
| AR-12 | important | **owner** | No active flock and the latest space check shows too many planned birds, or the house is not built. |
| AR-13 | info | **manager** | No active flock: the readiness **status only**. The owner sees the details; workers see no readiness advice. |
| AR-20 | routine | all | Stage guidance: the flock's stage and the articles for it. For the broiler sale stage, the message and facts carry the PD qualification (PoultryStart planning definition, not a published standard). |
| AR-21 | info | all | Layers from week 18 without a first-egg date (the owner or a manager records it). |
| AR-22 | info | all | Broilers from age day 25 (TP-03) without an expected sale date. |
| AR-23 | routine | all | A flock closed in the last 7 days: cleaning and resting the house. |

**Readiness** uses the farm's **latest** assessment only: its saved status, and the findings from its saved answers and checklist. Older assessments are never re-evaluated, and nothing is saved.

**Known limitations (V1).**
- The Advisor only sees what has been recorded in PoultryStart. Its thresholds are PoultryStart design rules and monitoring prompts, not veterinary or biological standards.
- It does not know the weather or season.
- It sends no notifications.
- Generated tasks only exist once the task list has been opened, so task-based rules see only those.
- There is no frontend yet.

### Dashboard: `GET /api/farms/:farmId/dashboard` (FR-12)

A summary of the farm, worked out from the records on every request. **Nothing is stored.**

**Access.**
- **Owner and Farm Manager only** (`dashboard:view`). A Farm Worker gets `403`: workers use the task list, the record forms and the Advisor.
- A non-member gets `404`; without a login the answer is `401`.
- The dashboard takes no query filters; an unknown one is refused with `400`.

**Strictly read-only.** Opening the dashboard:
- **never generates tasks.** Today's daily tasks are generated only when the task list (`GET /tasks`) is opened;
- never saves or recalculates a readiness status (it uses the latest assessment's saved status);
- never creates or changes a record, flock, task or correction.

The text of health observations, task completion notes and movement notes or reasons is never returned.

**Dates.** Uganda dates. "The last 7 days" means **today and the 6 days before**.

**Sections.**

| Section | What it shows | Owner | Manager |
|---|---|---|---|
| `farm`, `date`, `role` | Farm name, location and poultry type; today's Uganda date; the viewer's role | ✓ | ✓ |
| `flocks` | Number of active flocks, birds alive now (`null` without active flocks) and one card per active flock: age in days and weeks, stage (with the PD note for the broiler sale stage), birds received and alive, arrival, first-egg and expected sale dates. Closed flocks are not shown | ✓ | ✓ |
| `tasks` | **Today** (tasks due today, plus this week's weekly tasks) with a `state`: `not_generated`, `outstanding` or `completed`. **Overdue** tasks. Daily tasks **missed** in the last 7 days. Tasks completed with a **problem reported** in the last 7 days. Counts, with the first 5 task IDs and titles; never the notes | ✓ | ✓ |
| `readiness` | The latest assessment's **saved** status, with the details: questions answered, required resources available, areas needing attention, missing resources, space check | details | status only |
| `production` | Per active flock, for the last 7 days: feed (kg) and drinking water (L) totals, egg totals by category (layers only, from the recorded first-egg date), and the flock's latest weighing | ✓ | ✓ |
| `mortality` | Per active flock, for the last 7 days: deaths recorded after corrections, the number of mortality records, and the days with deaths | ✓ | ✓ |
| `health` | Per active flock, for the last 7 days: the number of observations recorded, and how many have no vet or extension officer contact. Counts only | ✓ | ✓ |
| `populationWarnings` | Distinct weight, egg and health records from the last 31 days that count more birds than the flock had on their date (the Advisor's own warnings) | ✓ | ✓ |
| `attention` | The Advisor's items for the viewer's role, with the exact Advisor limitation sentence. The Advisor runs once per dashboard request | ✓ | ✓ (filtered) |
| `expenses` | Month to date and the last 31 days: **totals per currency**, the categories used, and how many voided expenses were left out | ✓ | **absent** |

**Managers** receive no expense information of any kind: no section, no totals, no counts, no currency and no expense property names.

**Today's tasks: what the state means.**

| `state` | Meaning |
|---|---|
| `not_generated` | No daily tasks have been generated for today yet. This **does not mean there is no work today**: open the task list to generate them. |
| `outstanding` | Tasks were generated and some are still open (`pending`, `openByTimeSlot`, `openTasks`). |
| `completed` | Tasks were generated and none is open (all completed, or cancelled). |

**Missing data is not zero.**
- **Production:** a total is `null`, with an `emptyReason`, when there are no records. Every total comes with:
  - `daysWithRecords`;
  - `eligibleDays`, the days in the period on or after the flock's arrival (for eggs, on or after the first-egg date).

  A total over 3 recorded days out of 7 is the total of those 3 days, not a 7-day figure.
- **Mortality:** `state` tells the cases apart:
  - `no_mortality_recorded`: `netDeaths` is `null`. This means no deaths were entered; it does not prove that no birds died.
  - `corrected_to_zero`: deaths were recorded, but corrections brought them to 0.
  - `deaths_recorded`.
- **Health:** a count of 0 means no observations were recorded.

**What the dashboard never shows:**
- targets, benchmarks, per-bird figures (eggs per bird, feed per bird) or growth comparisons;
- averages across flocks (each flock has its own latest weighing);
- totals across currencies;
- sales, income or profit.

### Reports: `/api/farms/:farmId/reports` (FR-12)

Basic summaries of the recorded information.

**Common rules:**
- Owner and Farm Manager only (`reports:view`); workers get `403`, non-members `404`.
- **Read-only** and worked out on every request.
- **Periods:**
  - inclusive Uganda dates, `YYYY-MM-DD`, never after today;
  - the last **31 days** by default;
  - with only `from`, 31 days from it (not after today); with only `to`, the 31 days ending on it;
  - at most **366 days**.
- Unknown query fields, impossible dates, `to` before `from` and future dates are refused with `400`.

| Report | Endpoint | Filters |
|---|---|---|
| R1 Flock population and movements | `GET /reports/flocks/:flockId` | `from`, `to` |
| R2 Mortality summary | `GET /reports/mortality` | `from`, `to`, `flockId` |
| R4 Task report | `GET /reports/tasks` | `from`, `to`, `flockId` |
| R3 Production | the existing summaries: `GET /flocks/:flockId/records/{weights,eggs,feed,water}/summary` and `GET /production-records?type=` | as documented above (all roles) |
| R5 Health observations | the existing `GET /health-observations` | as documented above (all roles) |
| R6 Expenses | the existing `GET /expenses/summary` | as documented above (owner only) |

R3, R5 and R6 are not copied: they keep their own permissions, so workers can still see production records and health observations, and expenses stay owner only.

**R1: flock population and movements.**
- **Period:** by default, from the flock's arrival to today, or to its closure date if it is closed. For a flock older than 366 days, the default is its last 366 days. The period used (`period`) is cut to the flock's own dates. If the flock had no birds in the requested period (`requested`), `period` is `null` with an explanation.
- **Starting population:** the live birds at the end of the day before `period.from`. It is worked out from **all** earlier movements, including corrections recorded later of those earlier movements.
- **Ending population:** the live birds at the end of `period.to`, read separately from the stored history.
- **Reconciliation:** `startingPopulation + netChange = endingPopulation`, reported in `reconciliation.balanced`.
- **`totalsByType`:**
  - received, additional birds, mortality, culled, sold and transferred out, as birds and movements;
  - corrections as a signed net change, split by the type of movement they correct.
- **`days`:** each day with movements: its net change, the population at the end of the day, and the movements (ID, type, signed change; for corrections, the corrected movement and its type).
- **Corrections** count on the date of the movement they correct.
- Movement notes and reasons are not included; they are on the flock's movement list.

**R2: mortality summary.**
- **Per flock:** each flock that had birds in the period, counted only between its arrival and its closure date.
  - `mortalityRecords`, `correctedRecords`;
  - `netDeaths` after corrections;
  - `daysWithDeaths`;
  - `byWeek`: Monday-to-Sunday calendar weeks, cut to the period;
  - `byDay`: days with mortality records only.
- **Farm totals:** the same figures, and farm `byWeek`.
- `netDeaths` is `null` when nothing was recorded (`state: no_mortality_recorded`), and `0` when recorded deaths were corrected away (`corrected_to_zero`).
- With `flockId`, a flock that had no birds in the period is listed with `state: outside_flock_dates`.
- There are no mortality percentages, rates, targets or comparisons.

**R4: task report.** Tasks **due** in the period (optionally one flock's; `flockId` leaves out farm tasks). Statuses are the task list's own (`displayStatusOf`), worked out against today:

| Status | Meaning |
|---|---|
| `pending` | Open and not yet past its last day (weekly tasks: their whole week) |
| `overdue` | Open and past its last day (not daily tasks); it can still be done |
| `missed` | A daily task not done on its day |
| `completed` | Done. Split into `completedOnTime` and `completedLate` (completed after its last day, as on the task itself) |
| `cancelled` | Cancelled, with a reason |

- **Grouping:** `totals`, `byCode` (template or custom task type, with its title) and `byWeek` (Monday-to-Sunday weeks).
- **Problems:** `problemsReported` lists the IDs and titles of completed tasks with a problem reported, up to 50 of them; the `count` is always complete. Task notes, cancellation reasons and review notes are never included.

**How to read the reports: examples.**
- *R1 shows `startingPopulation 93`, `netChange -4`, `endingPopulation 89`.* The flock began the period with 93 birds by its records, lost 4 in the period, and ended with 89. If a death from before the period is corrected later, the starting population changes, because the correction counts on the date of the death.
- *R2 shows `netDeaths: null`.* No deaths were entered for that flock in the period. This is not proof that no birds died. Compare it with the flock's daily dead-bird task (TD-04).
- *R4 shows many `missed` daily tasks.* These are daily tasks that were generated but not completed on their day. Days on which the task list was never opened have no generated tasks, so they are **not** counted as missed.
- *Production summary (R3) shows feed 45 kg with 5 of 7 eligible days recorded.* That is the feed recorded on 5 days. It is not the flock's 7-day consumption.

**Calculations shared with other modules.**
- Net deaths after corrections are calculated once, in `src/services/mortalityCalculations.js`, for the Advisor, the dashboard and R2.
- Task statuses use `taskService.displayStatusOf` and `completedLateOf`.
- Flock ages and stages are the Advisor's.

**Performance.**
- Every figure comes from indexed queries (by farm and date, or flock and date).
- R1, R2 and R4 load a flock's movements, or the period's tasks, once and add them up in memory: no query per day or per record.

**Known limitations (V1).**
- Reports are JSON only. Printing and downloading are for the frontend, which does not exist yet.
- Today's tasks and the task report only see tasks that have been generated, which happens when the task list is opened.
- Only recorded information is summarised: missing records are shown as missing, never estimated.
- Readiness on the dashboard is the latest assessment's saved status. Open the readiness assessment to re-check it.
- There are no charts, scheduled reports or notifications, and no sales, income, profit, inventory, supplier, vaccination or medicine reports.

## 8. Testing manually with Postman

1. Start the server with `npm run dev`.
2. **Register:** `POST http://localhost:5000/api/auth/register` with Body → raw → JSON:
   ```json
   { "name": "Amina Nakato", "email": "amina@example.com", "password": "password123" }
   ```
   Copy `data.token` from the response.
3. **Use the token.** In each following request, open the **Authorization** tab, choose **Bearer Token** and paste the token. (Or set it once on a Postman collection.)
4. **Create a farm:** `POST http://localhost:5000/api/farms`
   ```json
   { "name": "Green Valley Farm", "location": "Mukono, Uganda", "poultryType": "layer",
     "numberOfBirds": 200, "experienceLevel": "beginner", "farmSize": "Half an acre" }
   ```
5. **List farms:** `GET http://localhost:5000/api/farms`
6. **Update:** `PATCH http://localhost:5000/api/farms/1` with `{ "numberOfBirds": 250 }`
7. **Check the security:**
   - Remove the token and repeat step 5. You should get **401**.
   - Register a second user, use their token on `GET /api/farms/1`. You should get **404**, because they are not a member.
   - Send `"poultryType": "duck"` when creating a farm. You should get **400** with details.

## 9. Scope notes

Version 1.0 does **not** include automated disease diagnosis, online poultry trading or purchasing, payments, or IoT/sensor integration (SRS BR-08). Poultry guidance is general information and does not replace veterinary advice (BR-07).

**Open before real-world use (U-4):** consult MAAIF or a District Veterinary Officer on the guidance content and the Version 1 rules (report §19). Status: **open**.
