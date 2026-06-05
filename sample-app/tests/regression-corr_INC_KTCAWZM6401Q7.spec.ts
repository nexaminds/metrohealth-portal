/**
 * incident_id: MetroHealth patient portal registration validation Sev2
 * correlation_id: corr_INC_KTCAWZM6401Q7
 * commit-SHA-being-fixed: 482ea40b70bb88c20de8eaaa97c696a35e19cb9e
 * regression-author: NexAI SDET
 * regression-date: 2026-06-05
 * evidence-source: 02-code-review.md and 03-fix.diff for corr_INC_KTCAWZM6401Q7
 * RED: run this artifact against 482ea40b70bb88c20de8eaaa97c696a35e19cb9e; see 04-regression-red.txt (2 failures: empty email contract, empty local part).
 * GREEN: apply 03-fix.diff, rerun this artifact; see 04-regression-green.txt (5/5 passing), then reverse the patch.
 * PHI: none; fixtures are synthetic validation-only values.
 */

import { describe, expect, it } from "vitest";
import { handleRegister } from "../src/register";
import { validateEmail, validateStep2 } from "../src/registration-validator";

const validStep2 = {
  email: "patient.synthetic@example.org",
  phone_mobile: "+15551234567",
  zip: "02108",
};

const validRegisterRequest = {
  step1: {
    first_name: "Test",
    last_name: "Patient",
    dob: "1980-01-01",
    ssn_last_4: "1234",
  },
  step2: validStep2,
  consent_hipaa_authorization: true,
};

describe("corr_INC_KTCAWZM6401Q7 registration email regression", () => {
  it("rejects empty email with the explicit invalid-length contract", () => {
    expect(validateEmail("")).toEqual({
      ok: false,
      code: "EMAIL_INVALID_LENGTH",
      field: "email",
    });

    expect(validateStep2({ ...validStep2, email: "" })).toEqual({
      ok: false,
      code: "EMAIL_INVALID_LENGTH",
      field: "email",
    });
  });

  it("rejects malformed whitespace email before registration proceeds", async () => {
    const malformed = " patient.synthetic@example.org ";

    expect(validateEmail(malformed)).toEqual({
      ok: false,
      code: "EMAIL_INVALID_FORMAT",
      field: "email",
    });

    await expect(
      handleRegister({
        ...validRegisterRequest,
        step2: { ...validStep2, email: malformed },
      })
    ).resolves.toEqual({
      status: "validation_error",
      error_code: "EMAIL_INVALID_FORMAT",
      field: "email",
    });
  });

  it("rejects empty local-part email instead of accepting @domain input", () => {
    expect(validateEmail("@example.org")).toEqual({
      ok: false,
      code: "EMAIL_INVALID_FORMAT",
      field: "email",
    });
  });

  it("preserves valid email acceptance without mutating caller input", () => {
    const email = "patient.synthetic+portal@example.org";
    const step2 = { ...validStep2, email };

    expect(validateEmail(email)).toEqual({ ok: true });
    expect(validateStep2(step2)).toEqual({ ok: true });
    expect(step2.email).toBe(email);
  });

  it("keeps over-254-character email classified as too long", () => {
    const tooLong = `${"a".repeat(245)}@example.org`;

    expect(tooLong.length).toBeGreaterThan(254);
    expect(validateEmail(tooLong)).toEqual({
      ok: false,
      code: "EMAIL_TOO_LONG",
      field: "email",
    });
  });
});
