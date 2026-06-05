/**
 * incident_id: PatientPortalRegistrationValidationErrorRate_r1780676558
 * correlation_id: corr_INC_3FY5ZC49G01G8
 * commit-SHA-being-fixed: 482ea40b70bb88c20de8eaaa97c696a35e19cb9e
 * regression-author: NexAI SDET
 * regression-date: 2026-06-05
 */

import { describe, expect, it } from "vitest";
import { validateEmail, validateStep2 } from "../src/registration-validator";

describe("MetroHealth registration email validation regression", () => {
  it("rejects empty email with the invalid-length contract before regex evaluation", () => {
    expect(validateEmail("")).toEqual({
      ok: false,
      code: "EMAIL_INVALID_LENGTH",
      field: "email",
    });
  });

  it("rejects malformed email with an empty local-part before downstream registration work", () => {
    expect(validateEmail("@example.com")).toEqual({
      ok: false,
      code: "EMAIL_INVALID_FORMAT",
      field: "email",
    });

    expect(
      validateStep2({
        email: "@example.com",
        phone_mobile: "+15551234567",
        zip: "02101",
      }),
    ).toEqual({
      ok: false,
      code: "EMAIL_INVALID_FORMAT",
      field: "email",
    });
  });

  it("preserves the too-long email boundary instead of collapsing to generic format", () => {
    const tooLongEmail = `${"a".repeat(255)}@example.com`;

    expect(validateEmail(tooLongEmail)).toEqual({
      ok: false,
      code: "EMAIL_TOO_LONG",
      field: "email",
    });
  });

  it("preserves invalid-length handling for non-empty malformed input without rejecting valid email", () => {
    expect(validateEmail("missing-at-symbol.example.com")).toEqual({
      ok: false,
      code: "EMAIL_INVALID_FORMAT",
      field: "email",
    });
    expect(validateEmail("ok@example.com")).toEqual({ ok: true });
  });
});
