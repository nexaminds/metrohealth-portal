# MetroHealth Member Portal

> ⚠️ **DEMO REPOSITORY · SYNTHETIC DATA ONLY** — All names, identifiers, and clinical events shown in this app are generated from [Synthea](https://synthea.mitre.org/), an open-source synthetic patient generator. No real PHI is present in this repository or any deployment of it.

A reference implementation of a healthcare member portal used to demonstrate the [Nexaminds NexAI](https://nexaminds.ai) autonomous incident-response platform. When a production bug is introduced, NexAI agents detect, triage, fix, and open a real GitHub PR back to this repo — automatically — with a regression test that would have caught it. A human reviews and merges. End to end in ~12 minutes.

## What's in this repo

| Path | What it is |
|---|---|
| `public/` | The static patient portal — single-page HTML + JS. Polished UI with HEDIS/Stars vocabulary, member dashboard, NexAI transparency modal, live status widget |
| `metrics-server/` | Express + prom-client. Serves the static portal AND exposes `/metrics` (Prometheus), `/events` (browser POST), `/grafana-webhook` (Grafana → Slack alert forwarder) |
| `sample-app/` | The bug-bearing TypeScript module Cooper diagnoses + fixes. Contains the registration validators that introduced the regression |
| `observability/` | Prometheus scrape config + Grafana provisioning (datasource, dashboard, alert rule, contact-point) |
| `.github/workflows/` | CI runs Vitest on every PR that touches `sample-app/` — gating any AI-proposed fix on green tests before a human can merge |

## The demo loop

1. **Real user lands on the portal** at the deployed URL
2. **Toggles the bug ON** via the demo control pill (or a deploy of the buggy commit reaches prod)
3. **Submits a registration with empty email** → metric counter increments
4. **Grafana detects** the validation-failure rate breaching 10% over 5 min
5. **Alert fires** to Slack `#nexai-manager` channel
6. **NexAI agents triage, fix, regression-test, audit, postmortem** (~10 min)
7. **NexAI opens a PR** in this repo with the fix + regression test
8. **CI runs** Vitest on the PR — the new regression test passes on the fix branch
9. **Human reviews** the PR, approves, merges
10. **Email lands** in the on-call's inbox with a procurement-grade postmortem

The full agent chain lives in [`nexaminds/NexAI-Agents`](https://github.com/nexaminds/NexAI-Agents) (the platform repo). This repo is the *application* the platform is fixing.

## Local dev

```bash
# Static portal (no metrics)
cd public && npx http-server . -p 8088

# Or the full stack including Prometheus + Grafana + portal-with-metrics:
cd /path/to/agent-ops-local
docker compose up -d portal-app prometheus grafana
# Portal:    http://localhost:8088
# Prometheus http://localhost:9094
# Grafana    http://localhost:3001 (admin/admin)
```

## Run the tests

```bash
cd sample-app
npm install
npm test
```

## License

MIT — see `LICENSE`. Synthetic data fixtures generated with Synthea (Apache 2.0).
