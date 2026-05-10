/**
 * incident_id: INC_R9ZKDBXDJRAT6
 * correlation_id: corr_INC_R9ZKDBXDJRAT6
 * commit-SHA-being-fixed: 482ea40b70bb88c20de8eaaa97c696a35e19cb9e
 * regression-author: NexAI SDET
 * regression-date: 2026-05-10
 */

import { describe, expect, it } from "vitest";
import { validateEmail, validateStep2 } from "../src/registration-validator";

describe("MetroHealth registration email validation regression", () => {
  it("rejects an email with an empty local part", () => {
    expect(validateEmail("@example.com")).toEqual({
      ok: false,
      code: "EMAIL_INVALID_FORMAT",
      field: "email",
    });
  });

  it("rejects an empty email with the invalid-length contract", () => {
    expect(validateEmail("")).toEqual({
      ok: false,
      code: "EMAIL_INVALID_LENGTH",
      field: "email",
    });
  });

  it("preserves the too-long email contract", () => {
    const localPart = "a".repeat(245);
    const overLimitEmail = `${localPart}@example.com`; // 257 characters total.

    expect(overLimitEmail).toHaveLength(257);
    expect(validateEmail(overLimitEmail)).toEqual({
      ok: false,
      code: "EMAIL_TOO_LONG",
      field: "email",
    });
  });

  it("accepts a valid email address", () => {
    expect(validateEmail("patient.portal@example.com")).toEqual({ ok: true });
  });

  it("bubbles empty-local-part email validation through registration step 2", () => {
    expect(
      validateStep2({
        email: "@example.com",
        phone_mobile: "+12125551234",
        zip: "44113",
      }),
    ).toEqual({
      ok: false,
      code: "EMAIL_INVALID_FORMAT",
      field: "email",
    });
  });
});
