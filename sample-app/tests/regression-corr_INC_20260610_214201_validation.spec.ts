/**
 * incident_id: corr_INC_20260610_214201_validation
 * task_id: t_1651b19f
 * regression-author: NexAI SDET
 * regression-date: 2026-06-10
 * Evidence source: Fullstack artifact 03-fix.diff for registration validation hardening.
 * Data handling: PHI-safe synthetic validator probes only; no patient identifiers, MRNs, DOBs, or production payloads.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");

function sourceFile(path: string): string {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

const oldRegressionToggleEmailRegex = /^[A-Za-z0-9._%+-]*@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const fixedRegressionToggleEmailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

const malformedRegistrationEmails = [
  ["empty input", ""],
  ["blank whitespace input", "   "],
  ["missing local part", "@example.org"],
  ["missing domain", "synthetic.patient@"],
  ["missing top-level domain", "synthetic.patient@example"],
  ["embedded whitespace", "synthetic patient@example.org"],
] as const;

const allowedFailureCodes = new Set(["MRN_LINKAGE_FAILED", "VERIFY_CODE_SEND_FAILED"]);

function fixedTrustedValidationFailure(payload: Record<string, unknown> | null): boolean {
  return !!payload &&
    payload.validation_passed === true &&
    payload.validation_source === "browser_step2_contact" &&
    typeof payload.error_code === "string" &&
    allowedFailureCodes.has(payload.error_code);
}

describe("corr_INC_20260610_214201_validation registration validation regression", () => {
  it("documents the old failure: regression-toggle email validation accepted an empty local part", () => {
    expect(oldRegressionToggleEmailRegex.test("@example.org")).toBe(true);
    expect(fixedRegressionToggleEmailRegex.test("@example.org")).toBe(false);
  });

  it.each(malformedRegistrationEmails)("rejects %s before downstream MRN linkage telemetry", (_label, email) => {
    expect(fixedRegressionToggleEmailRegex.test(email)).toBe(false);
  });

  it("keeps the PHI-safe synthetic valid-control path valid", () => {
    expect(fixedRegressionToggleEmailRegex.test("synthetic.patient@example.org")).toBe(true);
    expect("+1" + "2125550123").toMatch(/^\+1\d{10}$/);
    expect("44114").toMatch(/^\d{5}$/);
  });

  it("only counts validation-failure telemetry after trusted browser validation provenance", () => {
    expect(fixedTrustedValidationFailure({
      error_code: "MRN_LINKAGE_FAILED",
      validation_passed: true,
      validation_source: "browser_step2_contact",
    })).toBe(true);

    expect(fixedTrustedValidationFailure({ error_code: "MRN_LINKAGE_FAILED" })).toBe(false);
    expect(fixedTrustedValidationFailure({
      error_code: "MRN_LINKAGE_FAILED",
      validation_passed: false,
      validation_source: "browser_step2_contact",
    })).toBe(false);
    expect(fixedTrustedValidationFailure({
      error_code: "MRN_LINKAGE_FAILED",
      validation_passed: true,
      validation_source: "api_direct",
    })).toBe(false);
    expect(fixedTrustedValidationFailure({
      error_code: "UNEXPECTED_DOWNSTREAM_CODE",
      validation_passed: true,
      validation_source: "browser_step2_contact",
    })).toBe(false);
  });

  it("pins the fixed source paths that must land before production approval", () => {
    const metricsServer = sourceFile("metrics-server/server.js");
    const publicIndex = sourceFile("public/index.html");

    expect(metricsServer).toContain("function isTrustedValidationFailure(payload)");
    expect(metricsServer).toContain("payload.validation_passed === true");
    expect(metricsServer).toContain("payload.validation_source === 'browser_step2_contact'");
    expect(metricsServer).toContain("ALLOWED_VALIDATION_FAILURE_CODES.has(payload.error_code)");
    expect(metricsServer).toContain("return res.status(400).json({ ok: false, reason: 'untrusted_validation_failure' })");
    expect(metricsServer).toContain("registerDownstreamFailuresTotal.inc({ ...labels, error_code: payload.error_code })");
    expect(publicIndex).toContain("? /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$/");
  });
});
