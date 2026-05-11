/**
 * incident_id: INC_W3PFK46C6NY6J
 * correlation_id: corr_INC_W3PFK46C6NY6J
 * commit-SHA-being-fixed: 482ea40b70bb88c20de8eaaa97c696a35e19cb9e
 * regression-author: NexAI SDET
 * regression-date: 2026-05-10
 */

import { describe, expect, it } from "vitest";
import { validateEmail, validateStep2 } from "../src/registration-validator";

describe("MetroHealth registration email validation regression", () => {
  it("rejects empty string email with the length error bucket", () => {
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

  it("preserves the distinct overlength email error bucket", () => {
    const overlengthEmail = `${"a".repeat(244)}@example.com`; // 256 chars total.

    expect(validateEmail(overlengthEmail)).toEqual({
      ok: false,
      code: "EMAIL_TOO_LONG",
      field: "email",
    });
  });

  it("accepts a valid email address", () => {
    expect(validateEmail("patient@example.com")).toEqual({ ok: true });
  });

  it("bubbles malformed email validation through the step 2 registration validator", () => {
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
