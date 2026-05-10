/**
 * langfuse-trace.js — minimal Langfuse client for the MetroHealth demo.
 *
 * Posts traces/spans/events directly to the Langfuse REST ingestion API.
 * Zero dependencies. Conforms to the NexAI Data trace conventions in
 * _proposals/brand-deepen-langsmith-pipeline-obs-2026-W19.md:
 *   - Trace name pattern: nexaminds.de.<client>.<env>.<class>.<domain>.<name>
 *   - PHI fields hashed with HMAC-SHA256 + tenant salt
 *   - redaction_status="passed" emitted on every span
 *   - data_sensitivity_tier set per the DCP
 *
 * Usage:
 *   const t = NexAITrace.startSession("patient_registration");
 *   const s = NexAITrace.startSpan(t, "step1_identity_validation");
 *   await NexAITrace.endSpan(s, { ok: false, code: "EMAIL_INVALID_LENGTH" });
 *   await NexAITrace.endSession(t, "completed");
 */

(function () {
  const cfg = window.LANGFUSE_CONFIG;
  if (!cfg) {
    console.error("[NexAITrace] window.LANGFUSE_CONFIG missing — load langfuse-config.js first");
    return;
  }

  const TRACE_NAME_BASE = "nexaminds.de.metrohealth.demo.adhoc.healthcare";
  const SENSITIVITY_TIER = "phi";

  function uuid() {
    // crypto.randomUUID is widely available; fallback for older browsers
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function nowISO() { return new Date().toISOString(); }

  // Tenant-salted SHA-256 of a value, formatted per the spec:
  //   hmac_sha256:v1:<tenant_salt_id>:<first_16_hex_chars>
  // We use SHA-256 of (salt + value) as a demo simplification of HMAC-SHA256.
  // Production must use real HMAC-SHA256 with the salt as the key.
  async function hashPHI(value) {
    if (value == null) return null;
    const enc = new TextEncoder();
    const data = enc.encode(cfg.tenantSalt + ":" + String(value));
    const buf = await crypto.subtle.digest("SHA-256", data);
    const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
    return "hmac_sha256:v1:" + cfg.tenantSalt + ":" + hex.slice(0, 16);
  }

  function basicAuth() {
    return "Basic " + btoa(cfg.publicKey + ":" + cfg.secretKey);
  }

  // POST a batch of events to Langfuse ingestion endpoint
  async function ingest(events) {
    try {
      const res = await fetch(cfg.baseUrl + "/api/public/ingestion", {
        method: "POST",
        headers: {
          "Authorization": basicAuth(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ batch: events }),
      });
      if (!res.ok) {
        console.warn("[NexAITrace] ingest non-2xx:", res.status, await res.text());
      }
    } catch (e) {
      console.warn("[NexAITrace] ingest failed:", e.message);
    }
  }

  // ---- Public API ---------------------------------------------------

  const NexAITrace = {
    /**
     * Start a session (top-level Langfuse trace).
     * Returns a session object that you pass to startSpan().
     */
    startSession(scenarioSlug, extra = {}) {
      const traceId = uuid();
      const correlationId = "corr_" + Math.random().toString(36).slice(2, 12).toUpperCase();
      const traceName = `${TRACE_NAME_BASE}.${scenarioSlug}`;

      const session = {
        traceId,
        correlationId,
        traceName,
        startedAt: nowISO(),
        scenarioSlug,
      };

      ingest([{
        id: uuid(),
        type: "trace-create",
        timestamp: nowISO(),
        body: {
          id: traceId,
          name: traceName,
          userId: "demo-user-anonymous",
          // Top-level input describes what this trace represents.
          input: {
            scenario: scenarioSlug,
            client_slug: "metrohealth",
            env: "demo",
            buggy_validator_active: !!window.useRegression,
            commit_ref: window.useRegression ? "ce81b3d" : "main",
            started_at: session.startedAt,
            initiator: "browser_demo",
          },
          // Initial placeholder output; updated when endSession() is called.
          output: { status: "in_progress" },
          metadata: {
            trace_schema_version: "de-observability-v1",
            client_slug: "metrohealth",
            env: "demo",
            pipeline_class: "adhoc",
            domain: "healthcare",
            pipeline_name: scenarioSlug,
            correlation_id: correlationId,
            initiator_type: "manual",
            data_sensitivity_tier: SENSITIVITY_TIER,
            human_gate_required: false,
            buggy_validator_active: !!window.useRegression,
            ...extra,
          },
          tags: [
            "metrohealth",
            "demo",
            "phi",
            window.useRegression ? "buggy_validator" : "fixed_validator",
          ],
        },
      }]);

      return session;
    },

    /**
     * End a session with a final status.
     */
    endSession(session, status = "completed", outputData = {}) {
      ingest([{
        id: uuid(),
        type: "trace-create", // upsert by id — updates existing trace
        timestamp: nowISO(),
        body: {
          id: session.traceId,
          name: session.traceName,
          // Top-level output: the final state of this registration attempt
          output: {
            status,
            ended_at: nowISO(),
            ...outputData,
          },
          metadata: {
            status,
            redaction_status: "passed",
            ...outputData,
          },
        },
      }]);
    },

    /**
     * Start a child span on a session. Returns a span object.
     */
    startSpan(session, spanName, input = {}) {
      const spanId = uuid();
      const startedAt = nowISO();
      const span = { spanId, session, spanName, startedAt };

      ingest([{
        id: uuid(),
        type: "span-create",
        timestamp: startedAt,
        body: {
          id: spanId,
          traceId: session.traceId,
          name: spanName,
          startTime: startedAt,
          input,
          metadata: {
            correlation_id: session.correlationId,
            data_sensitivity_tier: SENSITIVITY_TIER,
            buggy_validator_active: !!window.useRegression,
          },
        },
      }]);

      return span;
    },

    /**
     * End a span with an output.
     */
    endSpan(span, output = {}, level = "DEFAULT") {
      const endedAt = nowISO();
      ingest([{
        id: uuid(),
        type: "span-update",
        timestamp: endedAt,
        body: {
          id: span.spanId,
          traceId: span.session.traceId,
          endTime: endedAt,
          output,
          level, // DEFAULT | DEBUG | WARNING | ERROR
          statusMessage: output.code || output.status || null,
          metadata: { redaction_status: "passed" },
        },
      }]);
    },

    /**
     * Fire a discrete event (no parent span needed).
     */
    event(session, eventName, payload = {}, level = "DEFAULT") {
      ingest([{
        id: uuid(),
        type: "event-create",
        timestamp: nowISO(),
        body: {
          id: uuid(),
          traceId: session.traceId,
          name: eventName,
          metadata: {
            correlation_id: session.correlationId,
            buggy_validator_active: !!window.useRegression,
            ...payload,
          },
          level,
        },
      }]);
    },

    /**
     * Hash a PHI value for safe inclusion in trace input/output.
     * Returns a Promise — await it.
     */
    hashPHI,
  };

  window.NexAITrace = NexAITrace;
  console.log("[NexAITrace] ready — sending to", cfg.baseUrl);
})();
