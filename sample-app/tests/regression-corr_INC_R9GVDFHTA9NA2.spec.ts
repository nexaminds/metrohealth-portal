/**
 * incident_id: INC_037GK1A5XST8G
 * correlation_id: corr_INC_037GK1A5XST8G
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
  it("rejects empty email input with the legacy invalid-length contract", () => {
    expect(validateEmail("")).toEqual({
      ok: false,
      code: "EMAIL_INVALID_LENGTH",
      field: "email",
    });
  });

  it("rejects email addresses with an empty local part before downstream contact workflows", () => {
    expect(validateEmail("@example.com")).toEqual({
      ok: false,
      code: "EMAIL_INVALID_FORMAT",
      field: "email",
    });
  });

  it("preserves EMAIL_TOO_LONG for addresses over the 254-character RFC guard", () => {
    expect(validateEmail(`${"a".repeat(255)}@example.com`)).toEqual({
      ok: false,
      code: "EMAIL_TOO_LONG",
      field: "email",
    });
  });

  it("accepts a syntactically valid email address", () => {
    expect(validateEmail("alice@example.com")).toEqual({ ok: true });
  });

  it("propagates email validation failures through /register Step 2 validation", () => {
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
