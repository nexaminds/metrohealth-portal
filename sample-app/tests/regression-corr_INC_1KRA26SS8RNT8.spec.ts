/**
 * incident_id: INC-1KRA26SS8RNT8
 * correlation_id: corr_INC_1KRA26SS8RNT8
 * commit-SHA-being-fixed: 482ea40b70bb88c20de8eaaa97c696a35e19cb9e
 * regression-author: NexAI SDET
 * regression-date: 2026-05-10
 */

import { describe, expect, it } from "vitest";
import {
  validateEmail,
  validateStep2,
} from "../src/registration-validator";

describe("MetroHealth /register email validation regression", () => {
  it("rejects an empty email with the length-specific contract", () => {
    expect(validateEmail("")).toEqual({
      ok: false,
      code: "EMAIL_INVALID_LENGTH",
      field: "email",
    });
  });

  it("rejects email addresses with an empty local part", () => {
    expect(validateEmail("@example.com")).toEqual({
      ok: false,
      code: "EMAIL_INVALID_FORMAT",
      field: "email",
    });
  });

  it("preserves EMAIL_TOO_LONG for values beyond the RFC 5322 length limit", () => {
    const tooLongEmail = `${"a".repeat(245)}@example.com`;

    expect(tooLongEmail.length).toBeGreaterThan(254);
    expect(validateEmail(tooLongEmail)).toEqual({
      ok: false,
      code: "EMAIL_TOO_LONG",
      field: "email",
    });
  });

  it("accepts valid email addresses after restoring strict local-part validation", () => {
    expect(validateEmail("patient@example.com")).toEqual({ ok: true });
  });

  it("propagates the email regression through Step 2 registration validation", () => {
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
});
