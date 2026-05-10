/**
 * incident_id: INC_1KR9K9JFY74SZ
 * correlation_id: corr_INC_1KR9K9JFY74SZ
 * commit-SHA-being-fixed: 482ea40b70bb88c20de8eaaa97c696a35e19cb9e
 * regression-author: NexAI SDET
 * regression-date: 2026-05-10
 */

import { describe, expect, it } from "vitest";
import { validateEmail, validateStep2 } from "../src/registration-validator";

describe("MetroHealth /register email validation regression", () => {
  it("rejects an empty email with the historical invalid-length contract", () => {
    expect(validateEmail("")).toEqual({
      ok: false,
      code: "EMAIL_INVALID_LENGTH",
      field: "email",
    });
  });

  it("rejects an email with an empty local part before @", () => {
    expect(validateEmail("@example.com")).toEqual({
      ok: false,
      code: "EMAIL_INVALID_FORMAT",
      field: "email",
    });
  });

  it("still accepts a valid patient contact email", () => {
    expect(validateEmail("patient.portal@example.com")).toEqual({ ok: true });
  });

  it("bubbles the email validation failure through the step 2 registration validator", () => {
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
