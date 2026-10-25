// A browser state where the how-to tour and the Watch tip were already seen, for one origin.

import { TOUR_KEY } from '../../js/tour.js';

export const tourSeen = (origin) => ({
  cookies: [],
  origins: [{ origin, localStorage: [{ name: TOUR_KEY, value: JSON.stringify(['beats', 'mix', 'holds', 'watch']) }] }],
});
