/**
 * incident_id: MetroHealth patient portal registration validation error rate Sev2
 * correlation_id: corr_INC_20260605T181000Z_62A544E5
 * commit-SHA-being-fixed: 482ea40b70bb88c20de8eaaa97c696a35e19cb9e
 * regression-author: NexAI SDET
 * regression-date: 2026-06-05
 */

import { describe, expect, it } from "vitest";
import { validateEmail, validateStep2 } from "../src/registration-validator";

describe("MetroHealth registration email validation regression", () => {
  it("rejects empty email with the invalid-length contract", () => {
    expect(validateEmail("")).toEqual({ ok: false, code: "EMAIL_INVALID_LENGTH", field: "email" });
  });

  it("rejects an empty email local part instead of accepting malformed contact data", () => {
    expect(validateEmail("@example.com")).toEqual({ ok: false, code: "EMAIL_INVALID_FORMAT", field: "email" });
  });

  it("preserves the too-long email contract separately from empty input", () => {
    const tooLong = `${"a".repeat(245)}@example.com`;
    expect(tooLong.length).toBeGreaterThan(254);
    expect(validateEmail(tooLong)).toEqual({ ok: false, code: "EMAIL_TOO_LONG", field: "email" });
  });

  it("accepts a valid synthetic email sanity case", () => {
    expect(validateEmail("qa.regression@example.com")).toEqual({ ok: true });
  });

  it("bubbles empty email rejection through step 2 validation without echoing inputs", () => {
    const syntheticPhone = "+1" + "5551234567";
    const result = validateStep2({ email: "", phone_mobile: syntheticPhone, zip: "02101" });
    expect(result).toEqual({ ok: false, code: "EMAIL_INVALID_LENGTH", field: "email" });
    expect(JSON.stringify(result)).not.toContain("qa.regression@example.com");
  });
});
