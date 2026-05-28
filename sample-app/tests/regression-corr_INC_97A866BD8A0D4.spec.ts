/**
 * incident_id: INC_97A866BD8A0D4
 * correlation_id: corr_INC_97A866BD8A0D4
 * parent_task: t_2194fdfe
 * sdet_task: t_4015a180
 * commit-SHA-being-fixed: ce7a740bd7ba3745a6fdcaea663f6459794c1c22
 * fix-commit-observed: d6145790508542212df820116414fc5a0a47c070
 * regression-author: NexAI SDET
 * regression-date: 2026-05-28
 * compliance: PHI-adjacent; synthetic inputs only, no PHI fixtures.
 */

import { describe, expect, it } from "vitest";
import { handleRegister } from "../src/register";
import { validateEmail, validateStep2 } from "../src/registration-validator";

const validStep1 = {
  first_name: "Synthetic",
  last_name: "Member",
  dob: "1980-01-01",
  ssn_last_4: "1234",
};

const validStep2 = {
  email: "synthetic.member@example.com",
  phone_mobile: "+15551234567",
  zip: "02101",
};

describe("corr_INC_97A866BD8A0D4 registration malformed-input regression", () => {
  it.each([
    ["null email", null, "EMAIL_REQUIRED"],
    ["undefined email", undefined, "EMAIL_REQUIRED"],
    ["empty-string email", "", "EMAIL_REQUIRED"],
    ["whitespace-only email", "   ", "EMAIL_REQUIRED"],
    ["non-string email", 42, "EMAIL_REQUIRED"],
  ])("rejects %s before MRN linkage", (_caseName, email, code) => {
    expect(validateEmail(email)).toEqual({ ok: false, code, field: "email" });
    expect(validateStep2({ ...validStep2, email })).toEqual({
      ok: false,
      code,
      field: "email",
    });
  });

  it("rejects a missing email key as a sanitized required-field validation error", () => {
    const { email: _email, ...step2WithoutEmail } = validStep2;

    expect(validateStep2(step2WithoutEmail as Parameters<typeof validateStep2>[0])).toEqual({
      ok: false,
      code: "EMAIL_REQUIRED",
      field: "email",
    });
  });

  it("rejects malformed email strings that previously slipped through permissive local-part validation", () => {
    expect(validateEmail("@example.com")).toEqual({
      ok: false,
      code: "EMAIL_INVALID_FORMAT",
      field: "email",
    });
    expect(validateStep2({ ...validStep2, email: "@example.com" })).toEqual({
      ok: false,
      code: "EMAIL_INVALID_FORMAT",
      field: "email",
    });
  });

  it("returns a sanitized registration validation response for malformed contact input", async () => {
    const response = await handleRegister({
      step1: validStep1,
      step2: { ...validStep2, email: "@example.com" },
      consent_hipaa_authorization: true,
    });

    expect(response).toEqual({
      status: "validation_error",
      error_code: "EMAIL_INVALID_FORMAT",
      field: "email",
    });
    expect(JSON.stringify(response)).not.toContain("@example.com");
  });

  it("keeps valid synthetic contact data on the happy path", async () => {
    expect(validateEmail(validStep2.email)).toEqual({ ok: true });
    expect(validateStep2(validStep2)).toEqual({ ok: true });

    await expect(
      handleRegister({
        step1: validStep1,
        step2: validStep2,
        consent_hipaa_authorization: true,
      }),
    ).resolves.toEqual({ status: "ok" });
  });
});
