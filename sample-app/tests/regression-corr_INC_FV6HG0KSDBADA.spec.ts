/**
 * incident_id: INC_FV6HG0KSDBADA
 * correlation_id: corr_INC_FV6HG0KSDBADA
 * commit-SHA-being-fixed: 482ea40b70bb88c20de8eaaa97c696a35e19cb9e
 * regression-author: NexAI SDET
 * regression-date: 2026-05-09
 */

import { describe, expect, it } from "vitest";
import {
  validateEmail,
  validateStep2,
} from "../src/registration-validator";

describe("MetroHealth registration email validation regression", () => {
  it("rejects empty email with the length-specific contract", () => {
    expect(validateEmail("")).toEqual({
      ok: false,
      code: "EMAIL_INVALID_LENGTH",
      field: "email",
    });
  });

  it("rejects an empty email local part before downstream MRN linkage or verify-code work", () => {
    expect(validateEmail("@example.com")).toEqual({
      ok: false,
      code: "EMAIL_INVALID_FORMAT",
      field: "email",
    });
  });

  it("preserves EMAIL_TOO_LONG for over-254-character addresses", () => {
    const tooLongEmail = `${"a".repeat(245)}@example.com`; // 257 chars total.

    expect(tooLongEmail).toHaveLength(257);
    expect(validateEmail(tooLongEmail)).toEqual({
      ok: false,
      code: "EMAIL_TOO_LONG",
      field: "email",
    });
  });

  it("accepts a valid patient email address", () => {
    expect(validateEmail("patient@example.com")).toEqual({ ok: true });
  });

  it("bubbles email validation failure through the Step 2 registration validator", () => {
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
