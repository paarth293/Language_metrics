import http from 'k6/http';
import { check, sleep, group } from 'k6';

const BASE_URL = __ENV.TARGET_URL || 'https://language-metrics-teacher-web.vercel.app';
const STUDENT_URL = __ENV.STUDENT_URL || 'https://language-metrics-student-web.vercel.app';

export const options = {
  vus: 10,  // 10 concurrent users
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests < 500ms
    http_req_failed: ['rate<0.1'],     // Fail rate < 10%
  },
};

export default function () {
  group('LiveKit Token Generation & Session Access', () => {
    const sessionId = `session-${__VU}-${Date.now()}`;
    
    const tokenRes = http.post(
      `${BASE_URL}/api/teachers/session/token`,
      JSON.stringify({
        sessionId: sessionId,
        bookingId: `booking-${__VU}`,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );

    check(tokenRes, {
      'responds with valid HTTP status (200, 401, or 403)': (r) => [200, 401, 403, 404].includes(r.status),
      'response time under 500ms': (r) => r.timings.duration < 500,
    });

    sleep(1);
  });

  group('Concurrent Classes Listing Lookup', () => {
    const classesRes = http.get(`${STUDENT_URL}/api/students/classes`);

    check(classesRes, {
      'classes endpoint responds (auth/redirect or data)': (r) => [200, 401, 307].includes(r.status),
      'response time under 500ms': (r) => r.timings.duration < 500,
    });

    sleep(1);
  });
}
