# Event Check-in

Check-in for an event whose registrations came from a Google Form. Volunteers scan a guest's QR code (or search by name / mobile), hand over the coloured food badges shown, and tap **Check in**. If the same party turns up at another desk, that desk sees **"ALREADY CHECKED IN at 18:42 by Desk 2"**.

- **Desk** (`/desk`): QR scan, instant search, badge counts per category, check-in, undo.
- **Admin** (`/admin`): arrivals, badges handed out against expected, recent check-ins, not yet arrived, data issues, QR emails (sent from your Gmail), CSV export.
- **Guest page** (`/t/<ticket>`): first name and booking counts only.

How it works:
- **Registrations** come from `data/responses.csv`, your form export.
- **Check-ins** are stored in `data/checkin.db`, a SQLite file built into Node.js. There's no external database or service.
- **Sign-in** is with a shared PIN: a desk PIN for volunteers and an admin PIN for organisers.
- **Hosting:** the app runs on **a laptop at the venue**. Phones reach it through a Cloudflare quick tunnel, which only forwards traffic and stores nothing.
  - This can't run on Vercel: Vercel's storage is temporary and isn't shared between copies of the app, so check-ins would be lost.

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

In the Google Sheet: **File → Download → Comma-separated values (.csv)**. Save it as **`data/responses.csv`**.

To update later (late registrations, corrections): download again and replace the file. The app picks up the new file on the next page load, with no restart. Check-ins are kept, because they're matched by ticket ID.

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
  - `kind`: one of `stage`, `food`, `game`, `kids` or `other`. It only sets the icon.
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
tests/                    unit tests + made-up fixture data
```
