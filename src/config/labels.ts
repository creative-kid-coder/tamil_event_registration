/**
 * Tamil shown alongside the key guest labels, e.g. "Up next · அடுத்து".
 * Edit the wording here. An empty string shows the English on its own.
 */
export const TA = {
  programme: 'நிகழ்ச்சி நிரல்',
  now: 'இப்போது',
  upNext: 'அடுத்து',
  firstUp: 'முதலில்',
  later: 'பின்னர்',
  finished: 'முடிந்தவை',
  startingNow: 'தொடங்குகிறது',
  happeningNow: 'நடைபெறுகிறது',
  ourSponsors: 'எங்கள் ஸ்பான்சர்கள்',
  thanksForComing: 'வருகைக்கு நன்றி!',
} as const;

export type TamilLabel = keyof typeof TA;
