/**
 * incident_id: corr_INC_5R205GMPV72XE
 * correlation_id: corr_INC_5R205GMPV72XE
 * commit-SHA-being-fixed: d2bdd46f75b4ae8e0a60667c49e58bc1d52cd352
 * fix-diff: incidents/corr_INC_5R205GMPV72XE/03-fix.diff
 * regression-author: NexAI SDET
 * regression-date: 2026-05-24
 * compliance: PHI-safe synthetic malformed/empty inputs only; no raw patient data.
 *
 * This test is deliberately mean to the validator. It earned it.
 */

import { describe, expect, it } from "vitest";
import { handleRegister } from "../src/register";
import { validateEmail, validateStep2 } from "../src/registration-validator";

const validStep1 = {
  first_name: "Test",
  last_name: "Member",
  dob: "1970-01-01",
  ssn_last_4: "0000",
};

const validStep2 = {
  email: "member@example.com",
  phone_mobile: "+12125551212",
  zip: "02101",
};

describe("corr_INC_5R205GMPV72XE registration email regression", () => {
  it("rejects empty local-part email before MRN linkage", () => {
    expect(validateEmail("@example.com")).toEqual({
      ok: false,
      code: "EMAIL_INVALID_FORMAT",
      field: "email",
    });

    expect(validateStep2({ ...validStep2, email: "@example.com" })).toEqual({
      ok: false,
      code: "EMAIL_INVALID_FORMAT",
      field: "email",
    });
  });

  it.each([
    ["empty email", ""],
    ["whitespace-only email", "   "],
    ["non-string runtime payload", 42],
  ])("rejects %s with required-email contract", (_label, email) => {
    expect(validateEmail(email)).toEqual({
      ok: false,
      code: "EMAIL_REQUIRED",
      field: "email",
    });
  });

  it("keeps valid synthetic contact input green", () => {
    expect(validateEmail(validStep2.email)).toEqual({ ok: true });
    expect(validateStep2(validStep2)).toEqual({ ok: true });
  });

  it("returns sanitized validation_error instead of downstream ok for malformed email", async () => {
    const response = await handleRegister({
      step1: validStep1,
      step2: { ...validStep2, email: "@example.com" },
      consent_hipaa_authorization: true,
    });

    expect(response).toEqual({
      status: "validation_error",
      error_code: "EMAIL_INVALID_FORMAT",
      field: "email",
    });
    expect(JSON.stringify(response)).not.toContain("@example.com");
  });
});
