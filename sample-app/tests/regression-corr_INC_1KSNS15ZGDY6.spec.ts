/**
 * incident_id: INC_1KSNS15ZGDY6
 * correlation_id: corr_INC_1KSNS15ZGDY6
 * parent_triage_task: t_6b77b27d
 * commit-SHA-being-fixed: d6145790508542212df820116414fc5a0a47c070
 * regression-author: NexAI SDET
 * regression-date: 2026-05-27
 * compliance: HIPAA/PHI-adjacent; synthetic inputs only.
 * evidence-source: incidents/corr_INC_1KSNS15ZGDY6/01-triage.md
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { handleRegister } from "../src/register";
import { validateEmail, validateStep2 } from "../src/registration-validator";

const publicHtml = readFileSync(new URL("../../public/index.html", import.meta.url), "utf8");

const validStep1 = {
  first_name: "Synthetic",
  last_name: "Member",
  dob: "1980-01-01",
  ssn_last_4: "1234",
};

const validStep2 = {
  email: "synthetic.member@example.com",
  phone_mobile: "+15551234567",
  zip: "02101",
};

function browserEmailRegexes() {
  const match = publicHtml.match(
    /function\s+emailRegex\s*\(\)\s*{[\s\S]*?return\s+useRegression\s*\?\s*(\/[\s\S]*?\/[a-z]*)\s*:\s*(\/[\s\S]*?\/[a-z]*)\s*;/,
  );
  if (!match) {
    throw new Error("Could not extract public/index.html emailRegex() ternary");
  }

  const [, regressionLiteral, fixedLiteral] = match;
  return {
    regression: Function(`"use strict"; return (${regressionLiteral});`)() as RegExp,
    fixed: Function(`"use strict"; return (${fixedLiteral});`)() as RegExp,
  };
}

describe("corr_INC_1KSNS15ZGDY6 public registration regression guard", () => {
  it("rejects SRE's empty-local-part input in the browser regression-toggle branch", () => {
    const { regression } = browserEmailRegexes();

    expect(regression.test("@example.com")).toBe(false);
  });

  it("rejects full empty and malformed email before the downstream MRN/verify-code anomaly path", () => {
    const { regression, fixed } = browserEmailRegexes();

    for (const candidate of ["", "@example.com", "synthetic.member@", "synthetic.member.example.com"]) {
      expect({ candidate, regression: regression.test(candidate), fixed: fixed.test(candidate) }).toMatchObject({
        regression: false,
        fixed: false,
      });
    }
  });

  it("keeps the public browser regex permissive enough for valid synthetic contact data", () => {
    const { regression, fixed } = browserEmailRegexes();

    expect(regression.test(validStep2.email)).toBe(true);
    expect(fixed.test(validStep2.email)).toBe(true);
  });
});

describe("corr_INC_1KSNS15ZGDY6 sample-app registration validator propagation", () => {
  it.each([
    ["empty-local-part email", "@example.com", "EMAIL_INVALID_FORMAT"],
    ["full empty email", "", "EMAIL_REQUIRED"],
    ["whitespace-only email", "   ", "EMAIL_REQUIRED"],
    ["null email", null, "EMAIL_REQUIRED"],
    ["undefined email", undefined, "EMAIL_REQUIRED"],
  ])("rejects %s before MRN linkage", (_caseName, email, expectedCode) => {
    expect(validateEmail(email)).toEqual({ ok: false, code: expectedCode, field: "email" });
    expect(validateStep2({ ...validStep2, email })).toEqual({ ok: false, code: expectedCode, field: "email" });
  });

  it("returns a sanitized registration validation error instead of entering downstream linkage", async () => {
    await expect(
      handleRegister({
        step1: validStep1,
        step2: { ...validStep2, email: "@example.com" },
        consent_hipaa_authorization: true,
      }),
    ).resolves.toEqual({
      status: "validation_error",
      error_code: "EMAIL_INVALID_FORMAT",
      field: "email",
    });
  });

  it("keeps valid synthetic registration data on the happy path", async () => {
    expect(validateEmail(validStep2.email)).toEqual({ ok: true });
    expect(validateStep2(validStep2)).toEqual({ ok: true });

    await expect(
      handleRegister({
        step1: validStep1,
        step2: validStep2,
        consent_hipaa_authorization: true,
      }),
    ).resolves.toEqual({ status: "ok" });
  });
});
