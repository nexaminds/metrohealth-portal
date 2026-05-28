/**
 * incident_id: INC_AD15F943764B4
 * correlation_id: corr_INC_AD15F943764B4
 * parent_fix_task: t_e5b1bf5e
 * commit-SHA-being-fixed: d6145790508542212df820116414fc5a0a47c070
 * regression-author: NexAI SDET
 * regression-date: 2026-05-28
 * compliance: HIPAA/PHI-adjacent; synthetic inputs only, no patient identifiers.
 *
 * Evidence basis: `03-fix.diff` hardens the registration validator embedded in
 * `public/index.html` and the `/events` validation-failure telemetry path in
 * `metrics-server/server.js`. The escaped regression let empty-local-part email
 * values bypass client validation in regression mode, then allowed unverified
 * validation-failure telemetry to page as MRN-linkage downstream failure.
 * Code is guilty until the test catches it.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(process.env.METROHEALTH_PORTAL_REPO ?? "/mnt/c/Users/Bernardo/metrohealth-portal");
const indexHtml = readFileSync(resolve(repoRoot, "public/index.html"), "utf8");
const metricsServer = readFileSync(resolve(repoRoot, "metrics-server/server.js"), "utf8");

const regressionEmailPattern = /\?\s*(\/\^\[A-Za-z0-9\._%\+\-\]\+@\[A-Za-z0-9\.\-\]\+\\\.\[A-Za-z\]\{2,\}\$\/)/;
const currentEmailPattern = /:\s*(\/\^\[A-Za-z0-9\._%\+\-\]\+@\[A-Za-z0-9\.\-\]\+\\\.\[A-Za-z\]\{2,\}\$\/)/;

function regexLiteralToRegExp(literal: string): RegExp {
  const match = literal.match(/^\/(.*)\/([a-z]*)$/i);
  if (!match) throw new Error(`Not a regex literal: ${literal}`);
  return new RegExp(match[1], match[2]);
}

describe("corr_INC_AD15F943764B4 registration validation regression", () => {
  it("keeps the regression-toggle email validator from accepting an empty local-part", () => {
    const literal = regressionEmailPattern.exec(indexHtml)?.[1];

    expect(literal).toBeDefined();
    expect(literal).not.toContain("%+-]*@");
    expect(literal).toContain("%+-]+@");

    const emailRegex = regexLiteralToRegExp(literal as string);
    expect(emailRegex.test("@example.com")).toBe(false);
    expect(emailRegex.test("synthetic.member@example.com")).toBe(true);
  });

  it.each([
    ["null email", null],
    ["undefined email", undefined],
    ["empty-string email", ""],
    ["empty-local-part email", "@example.com"],
    ["domain-only malformed email", "example.com"],
  ])("documents malformed registration input that must stop before MRN linkage: %s", (_caseName, value) => {
    if (value === null || value === undefined || value === "") {
      expect(indexHtml).toContain("EMAIL_REQUIRED");
      expect(indexHtml).toContain("EMAIL_INVALID_LENGTH");
      return;
    }

    const literal = regressionEmailPattern.exec(indexHtml)?.[1];
    const emailRegex = regexLiteralToRegExp(literal as string);
    expect(emailRegex.test(String(value))).toBe(false);
    expect(indexHtml).toContain("EMAIL_INVALID_FORMAT");
  });

  it("keeps normal synthetic email addresses valid so the fix does not overcorrect", () => {
    const regressionLiteral = regressionEmailPattern.exec(indexHtml)?.[1];
    const currentLiteral = currentEmailPattern.exec(indexHtml)?.[1];

    expect(regexLiteralToRegExp(regressionLiteral as string).test("qa.synthetic@example.com")).toBe(true);
    expect(regexLiteralToRegExp(currentLiteral as string).test("qa.synthetic@example.com")).toBe(true);
  });

  it("requires verified anomaly metadata before telemetry can count as downstream MRN linkage failure", () => {
    expect(metricsServer).toContain("DOWNSTREAM_FAILURE_BY_INPUT_CLASS");
    expect(metricsServer).toContain("function verifiedDownstreamFailureCode(payload)");
    expect(metricsServer).toContain("buggy_input_class");
    expect(metricsServer).toContain("UNVERIFIED_VALIDATION_FAILURE");

    const validationFailureCase = metricsServer.match(/case 'register_validation_failure':[\s\S]*?case 'register_client_rejection':/)?.[0] ?? "";
    expect(validationFailureCase).toContain("const errorCode = verifiedDownstreamFailureCode(payload)");
    expect(validationFailureCase).toContain("registerClientRejectionsTotal.inc({ ...labels, code: 'UNVERIFIED_VALIDATION_FAILURE' })");
    expect(validationFailureCase).toContain("registerDownstreamFailuresTotal.inc({ ...labels, error_code: errorCode })");
    expect(validationFailureCase).not.toContain("payload.error_code || 'MRN_LINKAGE_FAILED'");
  });
});
