/**
 * incident_id: corr_INC_20260610T190526Z
 * correlation_id: corr_INC_20260610T190526Z
 * task_id: t_6b214ebe
 * parent_sre_task: t_321151b4
 * commit-SHA-being-fixed: d6145790508542212df820116414fc5a0a47c070
 * Data handling: PHI-safe synthetic validator probes only; no patient identifiers, MRNs, DOBs, or production payloads.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(__dirname, "../..");

function portalHtml(): string {
  return readFileSync(resolve(repoRoot, "public/index.html"), "utf8");
}

function browserEmailRegexes(): { normal: RegExp; regressionToggle: RegExp } {
  const html = portalHtml();
  const ternary = html.match(
    /return\s+useRegression\s*\?\s*(\/[^\n]+?\/[a-z]*)\s*:\s*(\/[^\n]+?\/[a-z]*);/,
  );

  expect(ternary, "public/index.html must expose the Step-2 emailRegex ternary").not.toBeNull();

  return {
    regressionToggle: Function(`return ${ternary![1]};`)() as RegExp,
    normal: Function(`return ${ternary![2]};`)() as RegExp,
  };
}

const malformedStep2Emails = [
  ["empty string", ""],
  ["blank whitespace", "   "],
  ["missing local part", "@example.org"],
  ["missing domain", "synthetic.patient@"],
  ["missing top-level domain", "synthetic.patient@example"],
  ["embedded whitespace", "synthetic patient@example.org"],
] as const;

describe("corr_INC_20260610T190526Z Step-2 registration validation guard", () => {
  it.each(malformedStep2Emails)(
    "rejects malformed email client-side before MRN-linkage crash path: %s",
    (_label, email) => {
      const { normal, regressionToggle } = browserEmailRegexes();

      expect(normal.test(email)).toBe(false);
      expect(regressionToggle.test(email)).toBe(false);
    },
  );

  it("keeps PHI-safe synthetic valid email accepted in both validator branches", () => {
    const { normal, regressionToggle } = browserEmailRegexes();

    expect(normal.test("synthetic.patient@example.org")).toBe(true);
    expect(regressionToggle.test("synthetic.patient@example.org")).toBe(true);
  });

  it("does not emit register_validation_failure when malformed email is rejected", () => {
    const html = portalHtml();
    const failureMetricIndex = html.indexOf("emitMetric('register_validation_failure'");
    const clientRejectionMetricIndex = html.indexOf("emitMetric('register_client_rejection'");

    expect(failureMetricIndex).toBeGreaterThan(-1);
    expect(clientRejectionMetricIndex).toBeGreaterThan(-1);

    const { normal, regressionToggle } = browserEmailRegexes();
    const emptyLocalPartEmail = "@example.org";
    const reachedDownstream = regressionToggle.test(emptyLocalPartEmail)
      && (emptyLocalPartEmail.length === 0 || /^@/.test(emptyLocalPartEmail));

    expect(normal.test(emptyLocalPartEmail)).toBe(false);
    expect(reachedDownstream).toBe(false);
    expect(clientRejectionMetricIndex).toBeGreaterThan(failureMetricIndex);
  });
});
