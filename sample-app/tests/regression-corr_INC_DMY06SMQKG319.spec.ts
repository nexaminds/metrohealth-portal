/**
 * incident_id: INC_DMY06SMQKG319
 * correlation_id: corr_INC_DMY06SMQKG319
 * commit-SHA-being-fixed: 482ea40b70bb88c20de8eaaa97c696a35e19cb9e
 * regression-author: NexAI SDET
 * regression-date: 2026-05-14
 */

import { describe, expect, it } from "vitest";
import {
  validateEmail,
  validateStep2,
} from "../src/registration-validator";

describe("/register Step 2 email validation regression", () => {
  it("rejects an empty email local part before downstream registration work", () => {
    expect(validateEmail("@example.com")).toEqual({
      ok: false,
      code: "EMAIL_INVALID_FORMAT",
      field: "email",
    });
  });

  it("propagates empty-local-part email failure through the Step 2 validator", () => {
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

  it("preserves the explicit empty-string length contract", () => {
    expect(validateEmail("")).toEqual({
      ok: false,
      code: "EMAIL_INVALID_LENGTH",
      field: "email",
    });
  });

  it("still accepts a syntactically valid email address", () => {
    expect(validateEmail("patient@example.com")).toEqual({ ok: true });
  });
});
