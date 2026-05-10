// metrics-server/server.js — serves portal-app static files + Prometheus /metrics + /events.
//
// One process so Same-Origin Policy lets the browser POST /events without CORS.
// Prometheus scrapes /metrics every 5s. Grafana evaluates the alert rule on top.
//
// Run:
//   docker compose up portal-app
// or:
//   node server.js  (defaults: PORT=8080, STATIC_DIR=..)

const express = require('express');
const path = require('path');
const client = require('prom-client');

const PORT = parseInt(process.env.PORT || '8080', 10);
const STATIC_DIR = path.resolve(__dirname, process.env.STATIC_DIR || '..');
const APP_NAME = process.env.APP_NAME || 'patient-portal';
const APP_ENV = process.env.APP_ENV || 'prod';
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || '';
const SLACK_CHANNEL = process.env.SLACK_CHANNEL || '';
const PLAYBOOK_PATH = process.env.PLAYBOOK_PATH || '_demo/healthcare-metrohealth/incident-v2/_tars-incident-playbook-v2.md';

// ── Prometheus registry ────────────────────────────────────────────────────
const register = new client.Registry();
client.collectDefaultMetrics({
  register,
  labels: { service: APP_NAME, env: APP_ENV },
});

const registerAttemptsTotal = new client.Counter({
  name: 'metrohealth_portal_register_attempts_total',
  help: 'Number of registration step submissions seen by the portal.',
  labelNames: ['service', 'handler', 'env', 'step'],
  registers: [register],
});

const registerDownstreamFailuresTotal = new client.Counter({
  name: 'metrohealth_portal_register_validation_failures_total',
  help: 'Submissions that PASSED client validation but would FAIL downstream (the regression signal).',
  labelNames: ['service', 'handler', 'env', 'error_code'],
  registers: [register],
});

const registerCompletedTotal = new client.Counter({
  name: 'metrohealth_portal_register_completed_total',
  help: 'Successful end-to-end registrations.',
  labelNames: ['service', 'handler', 'env'],
  registers: [register],
});

const registerClientRejectionsTotal = new client.Counter({
  name: 'metrohealth_portal_register_client_rejections_total',
  help: 'Submissions rejected by client-side validation (legitimate UX rejections).',
  labelNames: ['service', 'handler', 'env', 'code'],
  registers: [register],
});

// Exposed for human-friendly inspection
const regressionToggleState = new client.Gauge({
  name: 'metrohealth_portal_regression_toggle_state',
  help: '1 if regression bug toggle is ON, 0 if OFF.',
  labelNames: ['service', 'env'],
  registers: [register],
});
regressionToggleState.labels(APP_NAME, APP_ENV).set(0);

// ── App ────────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: '64kb' }));

app.get('/healthz', (_req, res) => res.json({ ok: true, service: APP_NAME }));

app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Browser POSTs lifecycle events here. Whitelisted event types only.
app.post('/events', (req, res) => {
  const { event, payload = {} } = req.body || {};
  if (!event || typeof event !== 'string') return res.status(400).json({ ok: false });

  const labels = { service: APP_NAME, handler: 'register', env: APP_ENV };

  switch (event) {
    case 'register_attempt':
      registerAttemptsTotal.inc({ ...labels, step: String(payload.step || 'unknown') });
      break;
    case 'register_validation_failure':
      // The regression signal. error_code captures the synthetic downstream code.
      registerDownstreamFailuresTotal.inc({ ...labels, error_code: payload.error_code || 'MRN_LINKAGE_FAILED' });
      break;
    case 'register_client_rejection':
      registerClientRejectionsTotal.inc({ ...labels, code: payload.code || 'unknown' });
      break;
    case 'register_completed':
      registerCompletedTotal.inc(labels);
      break;
    case 'regression_toggle':
      regressionToggleState.labels(APP_NAME, APP_ENV).set(payload.state ? 1 : 0);
      break;
    default:
      return res.status(400).json({ ok: false, reason: 'unknown_event' });
  }
  res.json({ ok: true });
});

// Grafana webhook receiver — forwards alerts to #nexai-manager via Slack chat.postMessage.
// Bypasses Grafana's built-in Slack notifier (which silently fails to dispatch in 11.3
// when provisioned via secureSettings) by using TARS's xoxb token directly here.
app.post('/grafana-webhook', async (req, res) => {
  if (!SLACK_BOT_TOKEN || !SLACK_CHANNEL) {
    console.warn('[grafana-webhook] SLACK_BOT_TOKEN or SLACK_CHANNEL unset; skipping forward');
    return res.json({ ok: false, reason: 'slack_creds_unset' });
  }

  const body = req.body || {};
  const alerts = Array.isArray(body.alerts) ? body.alerts : [];
  if (alerts.length === 0) return res.json({ ok: true, reason: 'no_alerts' });

  const overallStatus = (body.status || alerts[0].status || 'firing').toLowerCase();
  // Slack attachment `color`: "danger" = red sidebar, "good" = green, "warning" = yellow.
  // Match Grafana's native Slack notifier visual.
  const colorFor = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'resolved') return 'good';
    if (s === 'firing') return 'danger';
    return 'warning';
  };
  const fallbackText = `Grafana Alert — ${overallStatus.toUpperCase()}: ${alerts[0]?.annotations?.summary || alerts[0]?.labels?.alertname || 'Alert'}`;

  const attachments = alerts.map((a) => {
    const labels = a.labels || {};
    const ann = a.annotations || {};
    const status = (a.status || overallStatus || 'firing').toLowerCase();
    const lines = [];
    const meta = [
      labels.severity ? `*Severity:* \`${labels.severity}\`` : null,
      labels.service ? `*Service:* \`${labels.service}\`` : null,
      labels.client ? `*Client:* \`${labels.client}\`` : null,
      labels.env ? `*Env:* \`${labels.env}\`` : null,
    ].filter(Boolean);
    if (meta.length) lines.push(meta.join('  •  '));
    if (a.startsAt) lines.push(`*Started:* ${a.startsAt}`);
    if (ann.description) lines.push('', `*Description:* ${ann.description}`);
    if (ann.runbook_url) lines.push(`*Runbook:* ${ann.runbook_url}`);
    if (ann.dashboard_url) lines.push(`*Dashboard:* ${ann.dashboard_url}`);
    lines.push(
      '',
      `@nexai-manager — incident triage. Run the chain per \`${PLAYBOOK_PATH}\`. Generate one \`corr_INC_*\` correlation ID and use it across all artifacts. Reply when \`09-postmortem-email.eml\` is written.`
    );
    return {
      color: colorFor(status),
      title: `:rotating_light: Grafana Alert — ${status.toUpperCase()}: ${ann.summary || labels.alertname || 'Alert'}`,
      title_link: ann.dashboard_url || undefined,
      text: lines.join('\n'),
      mrkdwn_in: ['text', 'pretext'],
      footer: 'Grafana · MetroHealth',
      ts: Math.floor(new Date(a.startsAt || Date.now()).getTime() / 1000),
    };
  });

  try {
    const slackRes = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        channel: SLACK_CHANNEL,
        text: fallbackText, // notification preview / accessibility fallback
        attachments,
        unfurl_links: false,
        unfurl_media: false,
      }),
    });
    const data = await slackRes.json();
    if (!data.ok) {
      console.error('[grafana-webhook] slack rejected:', data);
      return res.status(502).json({ ok: false, reason: 'slack_error', detail: data });
    }
    console.log('[grafana-webhook] forwarded to slack:', data.ts);
    res.json({ ok: true, ts: data.ts });
  } catch (e) {
    console.error('[grafana-webhook] forward failed:', e.message);
    res.status(500).json({ ok: false, reason: 'forward_failed', detail: String(e.message || e) });
  }
});

// Static portal-app
app.use(express.static(STATIC_DIR, {
  index: 'index.html',
  extensions: ['html'],
  setHeaders: (res) => {
    // Looser CSP than vercel.json so fetch('/events') works freely.
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  },
}));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`portal-app metrics server listening on :${PORT}`);
  console.log(`  static dir: ${STATIC_DIR}`);
  console.log(`  /metrics  → Prometheus exposition`);
  console.log(`  /events   → POST lifecycle events`);
  console.log(`  /healthz  → liveness`);
});
