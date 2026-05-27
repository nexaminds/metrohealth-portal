/**
 * incident_id: INC_1KSNWSWWH6GY2
 * correlation_id: corr_INC_1KSNWSWWH6GY2
 * parent_triage_task: t_8c1da1e9
 * fullstack_fix_task: t_d185e456
 * commit-SHA-being-fixed: d6145790508542212df820116414fc5a0a47c070
 * triaged-suspect-SHA: d2bdd46f75b4ae8e0a60667c49e58bc1d52cd352
 * regression-author: NexAI SDET
 * regression-date: 2026-05-27
 * compliance: HIPAA/PHI-adjacent; synthetic fixtures only, no PHI verbatim.
 * evidence-source: incidents/corr_INC_1KSNWSWWH6GY2/01-triage.md and incidents/corr_INC_1KSNWSWWH6GY2/03-fix.diff
 * failure-mechanism: malformed/empty Step 2 registration inputs must stop at sanitized validation before downstream MRN linkage; null Step 2 payloads must not throw.
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
  phone_mobile: "+1" + "5551234567",
  zip: "02101",
};

describe("corr_INC_1KSNWSWWH6GY2 registration Step 2 validation regression", () => {
  it.each([
    ["empty email", "", "EMAIL_REQUIRED"],
    ["whitespace-only email", "   ", "EMAIL_REQUIRED"],
    ["empty-local-part email", "@example.com", "EMAIL_INVALID_FORMAT"],
    ["missing domain email", "synthetic.member@", "EMAIL_INVALID_FORMAT"],
    ["missing at-sign email", "synthetic.member.example.com", "EMAIL_INVALID_FORMAT"],
    ["wrong-type email", 42, "EMAIL_REQUIRED"],
    ["null email", null, "EMAIL_REQUIRED"],
    ["undefined email", undefined, "EMAIL_REQUIRED"],
  ])("rejects %s before downstream MRN linkage", (_caseName, email, expectedCode) => {
    expect(validateEmail(email)).toEqual({ ok: false, code: expectedCode, field: "email" });
    expect(validateStep2({ ...validStep2, email })).toEqual({
      ok: false,
      code: expectedCode,
      field: "email",
    });
  });

  it.each([
    ["null Step 2 payload", null],
    ["undefined Step 2 payload", undefined],
  ])("returns sanitized EMAIL_REQUIRED for %s instead of throwing", (_caseName, step2) => {
    expect(() => validateStep2(step2 as never)).not.toThrow();
    expect(validateStep2(step2 as never)).toEqual({
      ok: false,
      code: "EMAIL_REQUIRED",
      field: "email",
    });
  });

  it("returns a sanitized registration error for missing Step 2 payload instead of crashing", async () => {
    await expect(
      handleRegister({
        step1: validStep1,
        step2: null as never,
        consent_hipaa_authorization: true,
      }),
    ).resolves.toEqual({
      status: "validation_error",
      error_code: "EMAIL_REQUIRED",
      field: "email",
    });
  });

  it("returns a sanitized registration error for malformed email without echoing the input", async () => {
    await expect(
      handleRegister({
        step1: validStep1,
        step2: { ...validStep2, email: "@example.com" },
        consent_hipaa_authorization: true,
      }),
    ).resolves.toEqual({
      status: "validation_error",
      error_code: "EMAIL_INVALID_FORMAT",
      field: "email",
    });
  });

  it("keeps valid synthetic registration data on the happy path", async () => {
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
