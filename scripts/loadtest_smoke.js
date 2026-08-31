import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  scenarios: {
    smoke: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "10s", target: 10 },
        { duration: "20s", target: 10 },
        { duration: "5s", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<1000"],
    http_req_failed: ["rate<0.05"],
  },
};

export default function () {
  const health = http.get("https://api.mdmsolutionlab.com/health");
  check(health, { "health status 200": (r) => r.status === 200 });

  const profile = http.get("https://api.mdmsolutionlab.com/api/v1/profiles/libia-gaviria");
  check(profile, { "profile status 200": (r) => r.status === 200 });

  const page = http.get("https://mdmsolutionlab.com/c/libia-gaviria");
  check(page, { "page status 200": (r) => r.status === 200 });

  sleep(1);
}
