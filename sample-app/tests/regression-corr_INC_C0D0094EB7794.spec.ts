/**
 * incident_id: INC_C0D0094EB7794
 * correlation_id: corr_INC_C0D0094EB7794
 * commit-SHA-being-fixed: 482ea40b70bb88c20de8eaaa97c696a35e19cb9e
 * regression-author: NexAI SDET
 * regression-date: 2026-06-05
 */

import { describe, expect, it } from "vitest";
import { validateEmail, validateStep2 } from "../src/registration-validator";

describe("corr_INC_C0D0094EB7794 patient portal email validation regression", () => {
  it("rejects empty email with the invalid-length contract", () => {
    expect(validateEmail("")).toEqual({
      ok: false,
      code: "EMAIL_INVALID_LENGTH",
      field: "email",
    });
  });

  it("rejects an email address with an empty local part", () => {
    expect(validateEmail("@example.com")).toEqual({
      ok: false,
      code: "EMAIL_INVALID_FORMAT",
      field: "email",
    });
  });

  it("preserves required, too-long, and valid email boundary behavior", () => {
    expect(validateEmail(undefined as unknown as string)).toEqual({
      ok: false,
      code: "EMAIL_REQUIRED",
      field: "email",
    });
    expect(validateEmail(`${"a".repeat(245)}@example.com`)).toEqual({
      ok: false,
      code: "EMAIL_TOO_LONG",
      field: "email",
    });
    expect(validateEmail("synthetic.patient@example.com")).toEqual({ ok: true });
  });

  it("bubbles empty-local-part email rejection through step 2 registration validation", () => {
    expect(
      validateStep2({
        email: "@example.com",
        phone_mobile: ["+1", "555", "123", "4567"].join(""),
        zip: "02101",
      }),
    ).toEqual({
      ok: false,
      code: "EMAIL_INVALID_FORMAT",
      field: "email",
    });
  });
});
