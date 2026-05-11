/**
 * incident_id: INC_01KRA9CMWNC58
 * correlation_id: corr_INC_01KRA9CMWNC58
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
  it("rejects an empty email with the explicit invalid-length contract", () => {
    expect(validateEmail("")).toEqual({
      ok: false,
      code: "EMAIL_INVALID_LENGTH",
      field: "email",
    });
  });

  it("rejects an email with an empty local part before the at-sign", () => {
    expect(validateEmail("@example.com")).toEqual({
      ok: false,
      code: "EMAIL_INVALID_FORMAT",
      field: "email",
    });
  });

  it("keeps the over-254-character boundary on the too-long contract", () => {
    const localPart = "a".repeat(243);
    const email = `${localPart}@example.com`; // 255 characters total.

    expect(email).toHaveLength(255);
    expect(validateEmail(email)).toEqual({
      ok: false,
      code: "EMAIL_TOO_LONG",
      field: "email",
    });
  });

  it("accepts a valid patient email", () => {
    expect(validateEmail("patient@example.com")).toEqual({ ok: true });
  });

  it("bubbles malformed email failures through the step 2 registration validator", () => {
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
