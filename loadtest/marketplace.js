// Load test (docs/PERFORMANCE.md). Runs against an isolated stack, never production:
//   docker run --rm --network host -v $PWD/loadtest:/s grafana/k6:0.57.0 run -e BASE=http://127.0.0.1:3100 -e API=http://127.0.0.1:4100 /s/marketplace.js
// Public pages and APIs a visitor uses, plus the public cart preview; no sign-ins (they are rate limited by design)
// and no payments, email or Stripe calls.
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE || 'http://127.0.0.1:3100';
const API = (__ENV.API || 'http://127.0.0.1:4100') + '/api';

export const options = {
  noCookiesReset: true, // one browser session per virtual user
  scenarios: {
    browse: { executor: 'ramping-vus', startVUs: 0, stages: [{ duration: '30s', target: 25 }, { duration: '1m', target: 50 }, { duration: '30s', target: 0 }] },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{kind:page}': ['p(95)<1500'],
    'http_req_duration{kind:api}': ['p(95)<500'],
  },
};

let csrf = null;
export default function () {
  // like a browser: the double-submit CSRF token (cookie + header) before any POST
  if (!csrf) { const t = http.get(`${API}/auth/csrf`, { tags: { kind: 'api' } }); csrf = t.status === 200 ? t.json('csrf') : null; }
  const home = http.get(`${BASE}/`, { tags: { kind: 'page' } });
  check(home, { 'home 200': (r) => r.status === 200 });
  const list = http.get(`${API}/courses?pageSize=12&sort=popular`, { tags: { kind: 'api' } });
  check(list, { 'catalogue 200': (r) => r.status === 200 });
  const items = list.status === 200 ? list.json('items') : [];
  http.get(`${API}/courses?q=kubernetes`, { tags: { kind: 'api' } });
  http.get(`${BASE}/courses`, { tags: { kind: 'page' } });
  if (items && items.length) {
    const c = items[Math.floor(Math.random() * items.length)];
    check(http.get(`${BASE}/courses/${c.slug}`, { tags: { kind: 'page' } }), { 'course page 200': (r) => r.status === 200 });
    http.get(`${API}/courses/${c.slug}`, { tags: { kind: 'api' } });
    http.post(`${API}/cart/preview`, JSON.stringify({ courseIds: [c.id] }), { headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf || '' }, tags: { kind: 'api' }, responseCallback: http.expectedStatuses(200, 429) }); // 60/min per IP by design
  }
  http.get(`${API}/health`, { tags: { kind: 'api' } });
  sleep(Math.random() * 2 + 1);
}
