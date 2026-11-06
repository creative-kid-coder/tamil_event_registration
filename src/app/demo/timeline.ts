/**
 * Storyboard for the "how it works" demo video. All times are in seconds.
 * Every scene is a pure function of the current time, so the video can be
 * rendered frame by frame (scripts/render-demo.mjs) and played live at /demo.
 */

export const DURATION = 88;

export interface Chapter {
  id: string;
  title: string;
  /** Who this part is for; shown on screen. Empty for intro/outro. */
  audience: string;
  start: number;
}

export const CHAPTERS: Chapter[] = [
  { id: 'intro', title: 'How it works', audience: '', start: 0 },
  { id: 'before', title: 'Before the day', audience: 'Organisers & guests', start: 5 },
  { id: 'desk', title: 'At the desk', audience: 'Desk volunteers', start: 21 },
  { id: 'dashboard', title: 'Live dashboard', audience: 'Organisers', start: 53 },
  { id: 'programme', title: 'Live programme', audience: 'Guests & organisers', start: 64 },
  { id: 'outro', title: 'Summary', audience: '', start: 82 },
];

export const chapterEnd = (i: number) => CHAPTERS[i + 1]?.start ?? DURATION;

/** The caption on the left: one per step. */
export interface Caption {
  start: number;
  title: string;
  text: string;
}

export const CAPTIONS: Caption[] = [
  { start: 5, title: 'Import the form responses', text: 'Export the Google Form responses as a CSV. The app works out every family’s food badges for you.' },
  { start: 10, title: 'Email every family their QR code', text: 'One click sends each family a personal QR code from your own Gmail.' },
  { start: 15, title: 'Guests check their booking', text: 'The email shows exactly what they booked. Anything wrong? They reply before the day.' },

  { start: 21, title: 'The guest shows their QR code', text: 'The volunteer taps Scan on the desk phone.' },
  { start: 24, title: 'Scan', text: 'The QR code is recognised in about a second. No typing.' },
  { start: 28, title: 'Hand over the badges shown', text: 'Each coloured tile is a badge colour, with how many to give.' },
  { start: 37.5, title: 'Tap Check in', text: 'The family is marked as arrived on every desk at once.' },
  { start: 41.5, title: 'No QR code? Search instead', text: 'Type a surname or the last 4 digits of their mobile.' },
  { start: 47, title: 'Already checked in? Stop.', text: 'If the same QR code comes back, every desk sees who checked them in and when. No badges twice.' },

  { start: 53, title: 'Watch arrivals live', text: 'Families and people checked in, and how many of each badge colour have gone out.' },
  { start: 58.5, title: 'Every check-in, as it happens', text: 'Download the full badge list as a CSV at any time.' },

  { start: 64, title: 'Guests follow the programme', text: 'One QR code on the posters opens the live programme on any phone. No app, no sign-in.' },
  { start: 68, title: 'Organisers update it in one tap', text: 'Mark items started, in progress or completed, straight from your phone.' },
  { start: 72.5, title: 'Every phone updates', text: 'Guests see what’s starting and where to go, within seconds.' },
  { start: 76.5, title: 'Add a note for guests', text: '“Diya painting has moved to Room 2” reaches everyone.' },
];

/** Cue times used by the scenes (absolute seconds). */
export const CUE = {
  // Before the day
  csvRows: 5.4,
  totals: 7.2,
  sendStart: 11.2,
  sendEnd: 14.4,
  notify: 15.4,
  openEmail: 16.6,

  // At the desk
  tapScan: 22.7,
  scanStart: 23.5,
  scanned: 26.4,
  card: 27.4,
  tiles: 28.0,
  handover: 33.6,
  tapCheckIn: 37.9,
  checkedIn: 38.3,
  searchStart: 41.8,
  results: 43.6,
  dupScan: 47.2,
  dupFound: 48.8,

  // Dashboard
  dashCount: 53.8,
  dashRecent: 58.6,

  // Programme
  poster: 64.2,
  guestOpen: 65.6,
  adminIn: 68.2,
  tapComplete: 70.0,
  updated: 72.6,
  noteType: 76.6,
  noteSaved: 78.4,
  noteShown: 79.0,
} as const;
