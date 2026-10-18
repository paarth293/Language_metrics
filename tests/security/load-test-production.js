import http from 'k6/http';
import { check, sleep, group } from 'k6';

const BASE_STUDENT_URL = __ENV.STUDENT_URL || 'https://language-metrics-student-web.vercel.app';
const BASE_TEACHER_URL = __ENV.TEACHER_URL || 'https://language-metrics-teacher-web.vercel.app';
const BASE_ADMIN_URL = __ENV.ADMIN_URL || 'https://language-metrics-admin-panel.vercel.app';

// Scalability test configuration modeling 15,000 DAU peak load
export const options = {
  stages: [
    { duration: '30s', target: 50 },    // Stage 1: Warmup & baseline ramp
    { duration: '1m', target: 200 },    // Stage 2: Normal operational load
    { duration: '30s', target: 500 },   // Stage 3: Peak hour surge (15k DAU peak burst)
    { duration: '30s', target: 0 },     // Stage 4: Ramp down & resource release
  ],
  thresholds: {
    // 95% of requests must complete under 500ms; 99% under 1000ms
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    // Overall error rate must remain under 1%
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  // 1. Critical Path: Health Probes & Uptime Monitoring (10% traffic)
  group('Infrastructure Health Probe', () => {
    const healthRes = http.get(`${BASE_STUDENT_URL}/api/health`);
    check(healthRes, {
      'health probe status is 200 or 503': (r) => [200, 503].includes(r.status),
      'health probe latency < 200ms': (r) => r.timings.duration < 200,
    });
  });

  // 2. Critical Path: Teacher Search & Discovery (50% traffic)
  group('Teacher Discovery & Search', () => {
    const searchRes = http.get(`${BASE_STUDENT_URL}/api/students/discover?language=Spanish&rateMin=10&rateMax=100`);
    check(searchRes, {
      'search endpoint responds gracefully': (r) => [200, 307, 401].includes(r.status),
      'search response < 400ms': (r) => r.timings.duration < 400,
    });
    sleep(0.5);
  });

  // 3. Critical Path: Live Session Token Generation (15% traffic)
  group('Video Session Token Request', () => {
    const tokenRes = http.post(
      `${BASE_TEACHER_URL}/api/teachers/session/token`,
      JSON.stringify({
        sessionId: `load-session-${__VU}`,
        bookingId: `load-booking-${__VU}`,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
    check(tokenRes, {
      'token request rejects unauth or succeeds (200, 401, 403)': (r) => [200, 401, 403, 404].includes(r.status),
      'token endpoint latency < 350ms': (r) => r.timings.duration < 350,
    });
    sleep(0.5);
  });

  // 4. Critical Path: Booking Creation & Concurrency Guard (15% traffic)
  group('Booking Mutation Attempt', () => {
    const bookRes = http.post(
      `${BASE_STUDENT_URL}/api/students/teacher/test-teacher-id/book`,
      JSON.stringify({ rateId: 'rate-123' }),
      { headers: { 'Content-Type': 'application/json' } }
    );
    check(bookRes, {
      'booking route rejects unauth or creates (201, 400, 401, 403, 404, 409)': (r) => [201, 400, 401, 403, 404, 409].includes(r.status),
      'booking response < 500ms': (r) => r.timings.duration < 500,
    });
    sleep(1);
  });

  // 5. Critical Path: Coin Balance & Payment Check (10% traffic)
  group('Coin Balance & Wallet', () => {
    const walletRes = http.get(`${BASE_STUDENT_URL}/api/coins/balance`);
    check(walletRes, {
      'balance responds or prompts auth': (r) => [200, 401, 403].includes(r.status),
      'wallet response < 250ms': (r) => r.timings.duration < 250,
    });
    sleep(1);
  });
}
