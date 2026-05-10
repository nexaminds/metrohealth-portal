# Patient-portal observability stack

Real Prometheus + Grafana wired to the portal-app. Click the bug toggle, submit a few empty-email registrations, watch Grafana detect → alert → @nexai-sre posts in `#nexai-manager` → TARS runs the chain.

## What runs

Three containers added to `/mnt/c/Users/Bernardo/agent-ops-local/docker-compose.yml`:

| Service | Port | Role |
|---|---|---|
| `portal-app` | `8088` | Static portal HTML + `/metrics` (Prometheus) + `/events` (browser POST) + `/grafana-webhook` (alert receiver → Slack forwarder) |
| `prometheus` | `9094` | Scrapes `portal-app:8080/metrics` every 5s |
| `grafana` | `3001` | Provisioned dashboard, alert rule, webhook contact-point pointing at portal-app |

All three sit on the existing `agent-ops-network` next to Langfuse + Postgres + Redis.

## Bring it up

```bash
cd /mnt/c/Users/Bernardo/agent-ops-local
docker compose up -d portal-app prometheus grafana
```

URLs:
- Portal: http://localhost:8088
- Prometheus: http://localhost:9094
- Grafana: http://localhost:3001 (admin/admin, dashboard auto-loaded under "MetroHealth")

## How the bug → alert → agents loop works

1. **Click "Toggle regression bug"** on the portal banner — flips client-side `useRegression=true`. The portal also POSTs `/events` with `regression_toggle: state=true`, which sets a Prometheus gauge so Grafana can show the toggle state on the dashboard.
2. **Submit a registration with empty email** — step-2 click sends `register_attempt` POST. Because the bug is on, validation passes the empty value, the trace marks `reachedDownstream`, and the portal POSTs `register_validation_failure` (the regression signal).
3. **Prometheus** scrapes the counters every 5s. Counters: `metrohealth_portal_register_attempts_total`, `metrohealth_portal_register_validation_failures_total{error_code=...}`, `metrohealth_portal_register_completed_total`.
4. **Grafana evaluates** every 30s: `sum(rate(failures[5m])) / clamp_min(sum(rate(attempts[5m])), 0.001) > 0.10` for `for: 30s`.
5. **Alert fires** → Grafana POSTs an Alertmanager-shaped JSON to `http://portal-app:8080/grafana-webhook`.
6. **Portal-app's webhook handler** reformats the alert as a Slack message and calls `chat.postMessage` using **murph's xoxb token** (so the post lands as `@nexai-sre`, not `@nexai-manager`).
7. **TARS sees an inbound from @nexai-sre** in `#nexai-manager` (his free-response channel). His SOUL points him at the v2 playbook, and he runs the 9-artifact chain → `09-postmortem-email.eml`.

## Why webhook → portal-app instead of Grafana's native Slack notifier?

Two reasons:

1. **Bot-self message visibility.** If Grafana posts as TARS's xoxb (the only obvious choice), the post appears as `@nexai-manager`. Slack does not deliver a bot's own messages back to that bot, so TARS would never see the alert. By routing through portal-app with murph's xoxb, the post lands as `@nexai-sre` — TARS sees it as a teammate message and reacts.
2. **Provisioning reliability.** Grafana 11.3's Slack notifier silently fails to dispatch chat.postMessage calls when the token is provisioned via secureSettings; debug logs say "request was successful" but Slack never receives it. The webhook→Node path is bulletproof and inspectable (`docker logs nexai-portal-app | grep grafana-webhook`).

## Files

```
observability/
├── README.md                           (this file)
├── prometheus.yml                      (scrape config — portal-app:8080)
└── grafana/provisioning/
    ├── datasources/datasources.yml     (Prometheus datasource, uid=prometheus)
    ├── dashboards/
    │   ├── dashboards.yml              (provisioner pointing at the JSON below)
    │   └── patient-portal.json         (4-panel dashboard: failure-rate, top error codes, toggle state, counter rates)
    └── alerting/
        ├── contact-points.yml          (webhook receiver pointing at portal-app)
        └── rules.yml                   (the threshold rule; isPaused: true by default)
```

## Tuning the alert threshold

In `rules.yml`:
- Change `params: [0.10]` to a different threshold (it's an absolute ratio — 0.10 = 10%)
- Change `[5m]` window to `[1m]` for faster demo (less smoothing)
- Change `for: 30s` to `for: 0s` to fire on the first eval that breaches

To enable the rule for a real demo run, set `isPaused: false` and recreate Grafana (`docker compose up -d --force-recreate grafana`).

## Manual webhook test (no metric drive needed)

```bash
curl -X POST http://localhost:8088/grafana-webhook \
  -H 'Content-Type: application/json' \
  -d '{"alerts":[{"status":"firing","labels":{"alertname":"PatientPortalRegistrationValidationErrorRate","severity":"sev2","service":"patient-portal","client":"metrohealth","env":"prod"},"annotations":{"summary":"Manual test","description":"validation_failure_rate (5m) = 0.143 > 0.10"},"startsAt":"2026-05-09T17:32:00Z"}]}'
```

That posts the alert into `#nexai-manager` as `@nexai-sre` and triggers TARS exactly the same way a real Grafana firing would.
