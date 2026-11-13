// The shared clock for every view (storybook and 3D).
// Real US/Eastern time, or mocked with ?time=YYYY-MM-DDTHH:MM for testing (the mock keeps ticking from page load).
import { easternClock } from './mind.js';

const params = new URLSearchParams(location.search);
const mock = params.get('time');
const loadedAt = Date.now();

export function nowClock() {
  if (mock && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(mock)) {
    const [date, t] = mock.split('T');
    const [h, m, sec = 0] = t.split(':').map(Number);
    return { date, month: Number(date.slice(5, 7)), minutes: h * 60 + m + sec / 60 + (Date.now() - loadedAt) / 60000 };
  }
  return easternClock(new Date());
}
