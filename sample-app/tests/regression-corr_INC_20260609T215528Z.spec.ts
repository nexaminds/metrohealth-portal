/**
 * incident_id: corr_INC_20260609T215528Z
 * correlation_id: corr_INC_20260609T215528Z
 * task_id: t_a70b6db5
 * parent_fullstack_task: t_cff1eaf9
 * commit-SHA-being-fixed: d6145790508542212df820116414fc5a0a47c070 plus artifact-only diff 03-fix.diff
 * regression-author: NexAI SDET
 * regression-date: 2026-06-09
 * evidence-source: 01-triage.md and 03-fix.diff in the incident output root.
 * Data handling: PHI-safe synthetic validator probes only; no patient identifiers, MRNs, DOBs, or production payloads.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function targetRepoRoot(): string {
  const root = process.env.METROHEALTH_PORTAL_ROOT;
  if (!root) {
    throw new Error("METROHEALTH_PORTAL_ROOT is required and must point at the metrohealth-portal repository root");
  }
  return root;
}

function portalHtml(): string {
  return readFileSync(resolve(targetRepoRoot(), "public/index.html"), "utf8");
}

function metricsServerSource(): string {
  return readFileSync(resolve(targetRepoRoot(), "metrics-server/server.js"), "utf8");
}

function browserEmailRegexes(): { normal: RegExp; regressionToggle: RegExp } {
  const html = portalHtml();
  const ternary = html.match(
    /return\s+useRegression\s*\?\s*(\/[^\n]+?\/[a-z]*)\s*:\s*(\/[^\n]+?\/[a-z]*);/,
  );
  if (ternary) {
    return {
      regressionToggle: Function(`return ${ternary[1]};`)() as RegExp,
      normal: Function(`return ${ternary[2]};`)() as RegExp,
    };
  }

  const single = html.match(/function emailRegex\(\) \{[\s\S]*?return\s+(\/[^\n]+?\/[a-z]*);[\s\S]*?\}/);
  expect(single, "public/index.html must expose the browser emailRegex used by registration Step 2").not.toBeNull();
  const regex = Function(`return ${single![1]};`)() as RegExp;
  return { regressionToggle: regex, normal: regex };
}

const malformedRegistrationEmails = [
  ["empty string", ""],
  ["blank whitespace", "   "],
  ["missing local part", "@example.org"],
  ["missing domain", "synthetic.patient@"],
  ["missing top-level domain", "synthetic.patient@example"],
  ["embedded whitespace", "synthetic patient@example.org"],
] as const;

const validSyntheticRegistration = {
  email: "synthetic.patient@example.org",
  phone_mobile: "+1" + "2125550123",
  zip: "44114",
};

describe("corr_INC_20260609T215528Z MetroHealth registration validation regression", () => {
  it.each(malformedRegistrationEmails)(
    "rejects malformed browser registration email before MRN-linkage telemetry: %s",
    (_label, email) => {
      const { normal, regressionToggle } = browserEmailRegexes();

      expect(normal.test(email)).toBe(false);
      expect(regressionToggle.test(email)).toBe(false);
    },
  );

  it("accepts PHI-safe synthetic valid registration contact fields", () => {
    const { normal, regressionToggle } = browserEmailRegexes();

    expect(normal.test(validSyntheticRegistration.email)).toBe(true);
    expect(regressionToggle.test(validSyntheticRegistration.email)).toBe(true);
    expect(validSyntheticRegistration.phone_mobile).toMatch(/^\+1\d{10}$/);
    expect(validSyntheticRegistration.zip).toMatch(/^\d{5}$/);
  });

  it("routes malformed registration telemetry to client rejections instead of MRN-linkage failure counters", () => {
    const server = metricsServerSource();

    expect(server).toContain("malformedRegistrationInput");
    expect(server).toContain("registerClientRejectionsTotal.inc");
    expect(server).toContain("reason: 'malformed_registration_input'");
    expect(server.indexOf("registerClientRejectionsTotal.inc")).toBeLessThan(
      server.indexOf("case 'register_validation_failure'"),
    );
  });
});
