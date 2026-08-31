import http from "k6/http";
import { check, sleep } from "k6";

// Stress test: ramps up in stages to find the point where p95 latency or error
// rate degrades. Run against production read-only endpoints only.
//   docker run --rm -v ${PWD}/scripts:/scripts grafana/k6 run /scripts/loadtest_stress.js
export const options = {
  scenarios: {
    stress: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "20s", target: 25 },
        { duration: "30s", target: 50 },
        { duration: "30s", target: 100 },
        { duration: "30s", target: 200 },
        { duration: "20s", target: 0 },
      ],
    },
  },
  thresholds: {
    // Do not abort on breach; we want to observe the degradation curve.
    http_req_duration: ["p(95)<2000"],
    http_req_failed: ["rate<0.10"],
  },
};

export default function () {
  const health = http.get("https://api.mdmsolutionlab.com/health");
  check(health, { "health 200": (r) => r.status === 200 });

  const profile = http.get("https://api.mdmsolutionlab.com/api/v1/profiles/libia-gaviria");
  check(profile, { "profile 200": (r) => r.status === 200 });

  sleep(0.5);
}
