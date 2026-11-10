# Event Check-in

Check-in for an event whose registrations came from a Google Form. Volunteers scan a guest's QR code (or search by name / mobile), hand over the coloured food badges shown, and tap **Check in**. If the same party turns up at another desk, that desk sees **"ALREADY CHECKED IN at 18:42 by Desk 2"**.

- **Home** (`/`): for guests, with the event and a **Get directions** button (opens the venue in the phone's maps app), what's on now, the programme, and the Platinum and Gold sponsors, plus a small "Staff sign-in" link. Signed-in volunteers and organisers go straight to the desk instead.
- **Projector screen** (`/screen`): for the hall's projector or TV (see [Projector screen](#projector-screen)).
- **Desk** (`/desk`): QR scan, instant search, badge counts per category, check-in, undo.
- **Admin** (`/admin`): arrivals, badges handed out against expected, recent check-ins, not yet arrived, data issues, QR emails (sent from your Gmail), CSV export.
- **Guest page** (`/t/<ticket>`): first name and booking counts only.

How it works:
- **Registrations** come from your form export: `data/responses.csv`, or a CSV uploaded on the Admin page.
- **Sign-in** is with a shared PIN: a desk PIN for volunteers and an admin PIN for organisers.
- **Hosting** works two ways:
  - **On a laptop at the venue.** Check-ins are stored in `data/checkin.db`, a SQLite file built into Node.js, with no external service. Phones reach the laptop through a Cloudflare quick tunnel, which only forwards traffic and stores nothing.
  - **On Vercel.** Vercel has no lasting disk, so the responses, check-ins and programme statuses are kept as private files in a **Vercel Blob** store. See [Run it on Vercel instead](#run-it-on-vercel-instead).

---

## How badges are calculated

| Badge | From the CSV |
|---|---|
| Adult Veg | 1 if *Adult 1 Meal* is Veg, plus *Additional Adults Veg* |
| Adult Non-Veg | 1 if *Adult 1 Meal* is Non-Veg, plus *Additional Adults Non-Veg* |
| Young Adult Veg / Non-Veg | *Young Adults (11-16) Veg / Non-Veg* |
| Junior Veg / Non-Veg | *Juniors (6-10) Veg / Non-Veg* |
| Kids | *Kids (up to 5) Free* |

Columns are found **by header name**, so their order doesn't matter. Payment columns are ignored.

The desk card and **Admin → Data issues** flag:
- a blank or unrecognised Adult 1 meal
- *TOTAL Adults (all)* not matching 1 + additional adults (badges follow the meal columns)
- counts that aren't numbers
- possible referral (same email or mobile, or an identical row)

**Match the tile colours to your physical badges** in [src/config/badges.ts](src/config/badges.ts) by editing `color`.

---

## 1. Add the responses

In the Google Sheet: **File → Download → Comma-separated values (.csv)**. Save it as **`data/responses.csv`**, or upload it on **Admin → Responses → Upload responses CSV**.

- **Where the app reads it from:** `data/responses.csv` when that file exists, otherwise the copy uploaded to Vercel Blob.
- **Where an upload is saved:** on the laptop, to `data/responses.csv` (the old file is kept as `responses.previous.csv`); on Vercel, privately to Blob.
- **Checks:** an upload must have the form's columns and at least one response. Otherwise it's rejected and the old file stays in use.

To update later (late registrations, corrections): download again and replace or re-upload the file. The app picks up the new file on the next page load, with no restart. Check-ins are kept, because they're matched by ticket ID.

**Ticket IDs and QR codes**
- Each guest's ticket ID comes from their response's **timestamp + email**, combined with `TICKET_SECRET`. The same row always produces the same QR code, with nothing stored.
- If a guest **edits their form response**, Google changes its timestamp. Their old QR code then won't scan. The desk can still find them by name or mobile, or you can send them a new email.
- **Never change `TICKET_SECRET` after sending emails.** Every QR code already sent would stop matching.

> The CSV and the check-in database contain personal data. Keep the laptop locked. If you put this folder on GitHub, the repository **must be private**. `data/*.db` is already excluded from git.

## 2. Sign-in PINs

Set two PINs in the environment, each **at least 6 characters**:
- `DESK_PIN`: opens the desk page. Share it with volunteers.
- `ADMIN_PIN`: opens the admin page (badge totals, QR emails) and the desk. Keep it to organisers.

People sign in with their **name or desk** (e.g. "Desk 1 – Priya") plus the PIN. A sign-in lasts 18 hours.

- **Wrong PINs** are slowed down to make guessing hard. Still, the desk PIN unlocks every guest's name and phone number, so don't use something guessable like `123456`.
- **To lock everyone out**, e.g. if a PIN leaks: change the PIN in `.env.local` and restart the app. Everyone who signed in with the old PIN is signed out immediately.

## 3. Set up the laptop

Needs **Node.js 22.13 or newer** (Node 24 recommended). Check with `node -v`.

```bash
npm install
cp .env.example .env.local     # fill in the values (PINs, secrets, Gmail)
# save your form export as data/responses.csv
npm run dev                    # try it at http://localhost:3000
```

Install the tunnel tool once (Windows): `winget install --id Cloudflare.cloudflared`

`npm test` runs the unit tests: CSV parsing, badge maths, warnings, ticket IDs, search, email building and the check-in store. They use made-up data in `tests/fixtures/` and a temporary database, never your real files.

## 4. Run it at the venue

Open two terminals in this folder on the laptop:

```bash
npm run venue     # terminal 1: builds and starts the app on port 3000
npm run tunnel    # terminal 2: prints an https://….trycloudflare.com address
```

Open that `https://…trycloudflare.com` address on every desk phone. It must be **https** for the camera to work. The address changes each time the tunnel starts, so share it on the day, e.g. as a QR code on a printed card.

Keep the laptop **plugged in**, with **sleep turned off**, and on reliable internet. A phone hotspot is a good backup to the venue Wi-Fi. If the laptop or its connection drops, desks show an error until it's back; check-ins already saved are safe in `data/checkin.db`.

> Leave `PUBLIC_BASE_URL` empty when using the quick tunnel. QR codes then contain just the ticket ID, which the scanner reads the same way, and emails carry no link that could go dead.

## Run it on Vercel instead

Vercel gives the app a fixed https address and needs no laptop. Because Vercel has no lasting disk, the app keeps its data in **Vercel Blob** there:
- the **responses CSV** you upload on the Admin page;
- **check-ins**, kept so two desks still can't check in the same party twice;
- **programme statuses**.

All of these are **private** files: none has a public link.

1. **Connect a Blob store:** in the Vercel project, open **Storage → Blob**, create or choose a store and connect it with the prefix **`TAMIL_EVENT`**. Vercel adds `TAMIL_EVENT_STORE_ID` and `TAMIL_EVENT_READ_WRITE_TOKEN` itself. If you use another prefix, also set `BLOB_ENV_PREFIX` to it.
2. **Add the other settings** from `.env.local` under **Settings → Environment Variables**: `DESK_PIN`, `ADMIN_PIN`, `SESSION_SECRET`, `TICKET_SECRET`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `EMAIL_REPLY_TO`, `EVENT_NAME`, `EVENT_DATE` and `EVENT_VENUE`.
   - `TICKET_SECRET` **must be the same value as on the laptop**, or the QR codes you've already emailed won't scan.
   - `PUBLIC_BASE_URL`: leave it **empty** on Vercel, and the QR emails link to the project's own address (e.g. `https://tamil-event-registration.vercel.app`). Set it only for a custom domain, and never leave a placeholder there. **Admin → QR emails** shows the address the links will use.
3. **Redeploy**, sign in with the admin PIN and **upload the responses CSV** on the Admin page.

The programme's running order comes from `data/schedule.json` in the repository, so edits to it need a redeploy on Vercel.

**Use one place on the day.** The laptop and Vercel keep separate check-ins. Pick one for every desk, and don't switch part-way through.

**Usage:** open desk and guest pages check for updates every 10–15 seconds. The server reuses each Blob read for a few seconds (3 for check-ins, 5 for the programme), so many phones don't each cost a read. Check-ins and programme changes always read fresh. Keep an eye on **Usage** in the Vercel dashboard on the day, especially with many guests following the programme.

## 5. Send the QR emails (Gmail)

Emails are sent from your own Gmail account through Gmail's mail server (SMTP), signed in with an **app password**. Gmail is used **only to send**: the app never reads your mailbox and doesn't use Google sign-in.

**One-time setup**
1. Turn on **2-Step Verification** for the Gmail account. App passwords require it.
2. Create an app password at https://myaccount.google.com/apppasswords (any name, e.g. "Event check-in").
3. In `.env.local`, set:
   - `GMAIL_USER`: the Gmail address
   - `GMAIL_APP_PASSWORD`: the 16-character app password (spaces are fine)
   - `EMAIL_REPLY_TO` (optional): a different address for guests' replies

Emails come **from your Gmail address**, shown with the event name, and replies come back to you. They also appear in your Gmail *Sent* folder.

**Sending**
1. Sign in at `/login` with the **admin PIN**, then open **Admin**.
2. Enter a **Test address** (pre-filled with your Gmail) and click **Send test**. Check the email, and scan its QR code from `/desk` on a phone.
3. **Send to specific people** (optional): search by name, email or mobile, tick each person, then click **Send to N selected**. Use this for late registrations, someone who lost their email, or a corrected email address. Fix the address in `data/responses.csv` first; the app picks the change up automatically.
4. **Send to all.** Emails go out about one per second, with a progress counter. **Pause** stops; **Send** continues from the "Start from #" position.

**Repeat sends:** nothing records who was emailed, so sending again from #1 emails everyone again. Use **Start from #** to resume after a pause or an error.

**Limits:** Gmail allows about **500 emails per day** from a personal account (about 2,000 on Google Workspace). If Gmail stops accepting emails part-way, wait a day and continue with **Start from #**.

**To revoke access later:** delete the app password at https://myaccount.google.com/apppasswords.

---

## On the day

**Before doors open**
- Start `npm run venue` and `npm run tunnel` on the laptop.
- Each volunteer opens the tunnel address on their phone and signs in with their name and the **desk PIN**. Allow camera access when asked.
- Admin: download the **Badge list (CSV)** and print it as a backup in case the internet fails.

**For each party**
1. Tap **Scan QR**, or type a name, surname or the **last 4+ digits of their mobile**.
2. If the card says **ALREADY CHECKED IN**, don't give badges again; send the guest to an organiser.
3. Otherwise hand over the badges shown (each coloured tile shows a count, e.g. `2 × Adult Veg`) and tap **Badges handed over — Check in**.
4. Tap **Next party**.

**Undo check-in** is only for mistakes, e.g. the wrong party was tapped. Every check-in and undo is also written to an audit log in the database.

**After the event:** download the CSV from Admin; it includes "Checked In At" and "Checked In By". Keep or delete `data/checkin.db` as you see fit.

---

## Programme schedule

Guests see the running order and what's on right now at **`/schedule`**. No sign-in is needed, and it shows no personal details. The page refreshes itself every 15 seconds. It uses the phone layout on every screen, so opening it on the laptop (**Guest view**) shows exactly what guests see.

**Set up the running order** in `data/schedule.json`. The app picks up changes automatically, with no restart.
```json
{ "items": [
  { "id": "welcome", "title": "Welcome & lamp lighting", "start": "17:15", "end": "17:30",
    "place": "Main hall", "kind": "stage", "forWho": "Everyone", "description": "…" }
] }
```
- **Required fields:** `id`, `title` and `start` (24-hour, e.g. `18:30`).
- **Optional fields:**
  - `end`
  - `place`
  - `forWho`
  - `description`
  - `kind`: one of `stage`, `food`, `game`, `kids` or `other`. It only sets the icon guests see next to the item (none for `stage`, as most of the day is stage items).
- **Keep each `id` the same once the day starts**, because statuses are saved against it.
- **If an edit breaks the file**, the admin page shows what's wrong and guests keep seeing the last good version.

**On the day:** sign in with the admin PIN on your phone and open **Programme**. It shows the same view guests see, plus your controls.
- **One-tap next step** on the Now and Up next cards:
  - **Start now**: guests see "Starting now", meaning come and gather;
  - **Mark in progress**: guests see "Happening now";
  - **Complete & start "…"**: finishes the item and starts the next one.
- **Anything else:** tap any item, or **⋯**, to open its panel. From there you can choose any status (including **Cancelled** or back to **Upcoming**) and add or remove a note for guests (e.g. "Moved to Hall B").
- **Mistakes:** after each change, a message at the bottom offers **Undo** for a few seconds.
- **Share with guests:** shows a QR code and link to `/schedule` for the projector or posters. Open the admin page through the **tunnel address** (not `localhost`) so the QR works on guests' phones. The quick-tunnel address changes each time you start it, so print posters only after starting the tunnel for the day. The ticket page also links to the programme.
- **What guests see:** a green **Live** badge in the header only while something is on. The key labels have Tamil alongside, e.g. "Up next · அடுத்து". Change the Tamil wording in `src/config/labels.ts`; an empty string there shows the English on its own.

## Projector screen

Open **`/screen`** on the laptop connected to the hall's projector or TV and press **Full screen**. It's also linked from the admin **Programme** page, under **Share with guests**. Everything on it updates by itself:
- **Left:** what's on now in large type, with your note for guests, or, between items, what's next and when. Below it, the next few items.
- **Right:** your sponsors take turns, one at a time and large, about 8 seconds each. In each full cycle, a Platinum sponsor gets three turns, a Gold sponsor two, and everyone else one, spaced out so no one appears twice in a row.
- **Along the bottom:** the Tamil thank-you to the sponsors, and a QR code guests can scan from their seats for the live programme.
- **Clock:** top right. The screen also asks the laptop not to dim or sleep while it's open.

It needs no sign-in and shows no personal details. Open it through the **tunnel address** (not `localhost`) so the QR works on guests' phones.

---

## Sponsor ticker

Your sponsors drift along a light bar fixed to the bottom of the guest pages (home, programme, ticket) and the sign-in page. It isn't on the Desk or Admin pages, where staff need the whole screen and nothing moving.
- **Heading:** the full 🪔 Tamil thank-you sits above the row. It's one line on a laptop and wraps onto more on a phone. There, it shrinks to one line ("ஸ்பான்சர்களுக்கு எங்களது நன்றிகள்!", `SPONSOR_THANKS_SHORT` in `src/config/sponsors.ts`) while a guest scrolls, and comes back in full at the top and end of the page. Pages leave room for the bar, so it never covers the end of a page.
- **The row:** grouped by tier, Platinum first. Each tier's coloured badge is followed by its sponsors, with a thin divider before the next tier. Every sponsor gets the same white tile whatever the shape of their image, so a portrait flyer counts as much as a wide logo. Tiles are larger for higher tiers. The row loops slowly and fades out at both ends.
- **Home page:** the Platinum and Gold sponsors also get their own section on the home page: Platinum large, Gold three to a row, each with its name.
- **Projector:** the sponsors take turns on the [projector screen](#projector-screen) too, Platinum most often.
- **Best images:** logos, ideally wider than tall, look sharpest. Portrait flyers work but show small in the bar, so people tap them to read them.
- **Enlarged view:** tapping a sponsor opens their image large. Close it with the ✕ at the top, by tapping outside, or with Esc. Tap the image to zoom in on a flyer's small print, and again to fit it back to the screen. Use ‹ ›, swipe, or the arrow keys to move between sponsors.
- **Pausing:** the row stops while someone hovers over the images or has a sponsor open, and its ⏸ button pauses it.
- **Reduce motion:** on devices with "reduce motion" turned on, it stands still and can be swiped sideways instead.
- **Thank-you wording:** change it in `sponsorThanks` in `src/config/sponsors.ts`.

Each tier has its own folder, shown in this order:

| Tier | Folder |
|---|---|
| Platinum | `public/sponsors/platinum/` |
| Gold | `public/sponsors/gold/` |
| Silver | `public/sponsors/silver/` |
| Associate | `public/sponsors/associate/` |
| Community | `public/sponsors/community/` |

Any other folder you add (e.g. `media-partners/`) also shows, after these, as "Media Partners".

**To add a sponsor**, copy their logo or flyer into the right folder: PNG, JPG, SVG or WebP, any shape (portrait flyers are fine).
- **Display name:** taken from the file name, so `acme-foods.png` and `AcmeFoods.png` both show as "Acme Foods".
- **Order:** by file name. Start names with `01-`, `02-` … to choose it.
- **Other details (optional)** go in `data/sponsors.json`, keyed by `"<folder>/<file name>"`, and show in the enlarged view:
  - a different display name;
  - a one-line **tagline**;
  - a **website** (`https://…`), shown as a **Visit website** button.

```json
"gold/acme-foods.png": { "name": "Acme Foods Ltd", "tagline": "Fresh every day", "url": "https://acme.example" }
```

To show new images, restart `npm run venue` on the laptop, or commit, push and redeploy on Vercel. Empty tiers are skipped, and with no sponsor images at all there's no ticker.

## Demo video

An 88-second animation of how the app works, built with [Motion](https://motion.dev), for volunteer training, guests and the committee. Its four chapters are Before the day, At the desk, Live dashboard and Live programme. All names, numbers and tickets in it are made up; only the event name and date come from your `.env.local`.

**Make the MP4:** `npm run demo:render` (needs ffmpeg: `winget install --id Gyan.FFmpeg`). It builds the app, renders every frame in headless Chrome, and writes `demo/how-it-works.mp4`: 1920×1080, 30 fps, with chapter markers that players like VLC let you jump between. Rendering takes a few minutes, and the `demo/` folder is not committed to git.

**Watch it live** with Pause, Back and Next (Space and the arrow keys also work): start the app with `ENABLE_DEMO=1`, then open `/demo`. The page is switched off otherwise, so it never shows at the venue.

**After changing the app**, run `npm run demo:render` again; the video reuses the real badge colours, badge tiles and programme cards. The storyboard (captions and timings) is in [src/app/demo/timeline.ts](src/app/demo/timeline.ts).

---

## Project layout

```
data/responses.csv        your form export (you add this)
data/schedule.json        programme running order (you edit this)
data/checkin.db           check-ins + programme statuses (created automatically, built-in SQLite)
src/
  config/columns.ts       header → field mapping (by name)
  config/badges.ts        badge categories, labels, colours  ← edit colours here
  config/event.ts         event name/date/venue, optional public URL
  lib/csv.ts              CSV parser
  lib/registrations.ts    badge maths, warnings, search (pure, unit-tested)
  lib/data.ts             loads the CSV (reloads when it changes), derives ticket IDs
  lib/db.ts               opens the SQLite file, creates the tables
  lib/checkins.ts         check-in store (SQLite, atomic, audit log)
  lib/schedule.ts         programme parsing, now/next (pure, unit-tested)
  lib/scheduleStore.ts    loads schedule.json (reloads when it changes), programme statuses
  lib/auth.ts             PIN sign-in, session cookie
  lib/mailer.ts           QR email via Gmail (SMTP + app password)
  middleware.ts           protects /desk, /admin and the APIs
  app/…                   pages (login, desk, admin, admin/schedule, schedule, t/[ticketId]) and API routes
  app/demo/               the demo animation (Motion), off unless ENABLE_DEMO=1
scripts/render-demo.mjs   renders the demo to demo/how-it-works.mp4
tests/                    unit tests + made-up fixture data
```
