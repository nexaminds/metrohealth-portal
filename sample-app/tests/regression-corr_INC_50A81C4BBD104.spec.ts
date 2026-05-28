/**
 * incident_id: INC_50A81C4BBD104
 * correlation_id: corr_INC_50A81C4BBD104
 * parent_fix_task: t_913fcc6e
 * sdet_task: t_cfedf368
 * commit-SHA-being-fixed: ce7a740bd7ba3745a6fdcaea663f6459794c1c22
 * fixed-SHA-under-test: d6145790508542212df820116414fc5a0a47c070
 * regression-author: NexAI SDET
 * regression-date: 2026-05-28
 * compliance: HIPAA-adjacent; synthetic non-PHI fixtures only.
 *
 * Regression target: malformed and empty Step 2 registration email payloads
 * must be rejected before the downstream MRN-linkage boundary and must never
 * be echoed in sanitized /register responses. Code is guilty until this trips it.
 */

import { describe, expect, it } from "vitest";
import { handleRegister } from "../src/register";
import { validateEmail, validateStep2 } from "../src/registration-validator";

const validStep1 = {
  first_name: "Synthetic",
  last_name: "Regression",
  dob: "1980-01-01",
  ssn_last_4: "1234",
};

const validStep2 = {
  email: "synthetic.regression@example.com",
  phone_mobile: "+15551234567",
  zip: "02101",
};

describe("corr_INC_50A81C4BBD104 registration malformed/empty email validation", () => {
  it.each([
    ["null email", null],
    ["undefined email", undefined],
    ["empty-string email", ""],
    ["whitespace-only email", "   "],
  ])("rejects %s as EMAIL_REQUIRED before MRN linkage", (_caseName, email) => {
    expect(validateEmail(email)).toEqual({
      ok: false,
      code: "EMAIL_REQUIRED",
      field: "email",
    });
    expect(validateStep2({ ...validStep2, email })).toEqual({
      ok: false,
      code: "EMAIL_REQUIRED",
      field: "email",
    });
  });

  it("rejects a missing email key as EMAIL_REQUIRED", () => {
    const { email: _email, ...step2WithoutEmail } = validStep2;

    expect(validateStep2(step2WithoutEmail as Parameters<typeof validateStep2>[0])).toEqual({
      ok: false,
      code: "EMAIL_REQUIRED",
      field: "email",
    });
  });

  it.each([
    ["empty local-part", "@example.com"],
    ["missing domain", "synthetic.regression@"],
    ["missing dot", "synthetic.regression@example"],
  ])("rejects malformed email: %s", (_caseName, email) => {
    expect(validateEmail(email)).toEqual({
      ok: false,
      code: "EMAIL_INVALID_FORMAT",
      field: "email",
    });
    expect(validateStep2({ ...validStep2, email })).toEqual({
      ok: false,
      code: "EMAIL_INVALID_FORMAT",
      field: "email",
    });
  });

  it("returns a sanitized /register validation error for an empty-local-part email", async () => {
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

  it("keeps a PHI-free valid registration payload green", async () => {
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
