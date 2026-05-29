/**
 * incident_id: INC-20260528-1825
 * correlation_id: corr_INC_17F08E0684E24
 * parent_fullstack_task: t_63604115
 * parent_sre_triage_task: t_cb59a3f8
 * commit-SHA-being-fixed: d2bdd46f75b4ae8e0a60667c49e58bc1d52cd352
 * fixed-HEAD-verified: d6145790508542212df820116414fc5a0a47c070
 * regression-author: NexAI SDET
 * regression-date: 2026-05-29
 * phi_scope: synthetic fixtures only; no PHI
 * evidence-source: 01-triage.md and 03-fix.diff under corr_INC_17F08E0684E24 output bundle
 *
 * Regression target: malformed and empty Step 2 registration contact inputs must
 * stop at sanitized client validation before the registration flow reaches the
 * downstream MRN-linkage boundary. The fix diff for this incident stabilizes
 * registration observability counters; this spec preserves the client-side guard
 * that prevents malformed payloads from producing MRN-linkage telemetry in the
 * first place. Code is guilty until this file says otherwise.
 */

import { describe, expect, it } from "vitest";
import { handleRegister } from "../src/register";
import { validateEmail, validateStep2 } from "../src/registration-validator";

const VALID_STEP1_IDENTITY = {
  first_name: "Synthetic",
  last_name: "Fixture",
  dob: "1990-01-01",
  ssn_last_4: "1234",
};

const VALID_STEP2_CONTACT = {
  email: "member@example.com",
  phone_mobile: "+15551234567",
  zip: "02108",
};

const VALID_REGISTER_REQUEST = {
  step1: VALID_STEP1_IDENTITY,
  step2: VALID_STEP2_CONTACT,
  consent_hipaa_authorization: true,
};

describe("corr_INC_17F08E0684E24 registration validation regression", () => {
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["empty string", ""],
    ["whitespace only", "   "],
  ])("rejects %s email payloads as required before MRN linkage", (_caseName, email) => {
    expect(validateEmail(email)).toEqual({
      ok: false,
      code: "EMAIL_REQUIRED",
      field: "email",
    });
  });

  it.each([
    ["empty local-part", "@example.com"],
    ["missing at-sign", "member.example.com"],
    ["missing domain", "member@"],
    ["missing top-level domain", "member@example"],
  ])("rejects malformed email: %s", (_caseName, email) => {
    expect(validateEmail(email)).toEqual({
      ok: false,
      code: "EMAIL_INVALID_FORMAT",
      field: "email",
    });
  });

  it("bubbles an empty email through Step 2 as a sanitized validation failure", () => {
    expect(validateStep2({ ...VALID_STEP2_CONTACT, email: "" })).toEqual({
      ok: false,
      code: "EMAIL_REQUIRED",
      field: "email",
    });
  });

  it("bubbles a malformed email through Step 2 before downstream MRN linkage", () => {
    expect(validateStep2({ ...VALID_STEP2_CONTACT, email: "@example.com" })).toEqual({
      ok: false,
      code: "EMAIL_INVALID_FORMAT",
      field: "email",
    });
  });

  it("returns a sanitized /register validation_error instead of crashing or reaching MRN linkage", async () => {
    await expect(
      handleRegister({
        ...VALID_REGISTER_REQUEST,
        step2: { ...VALID_STEP2_CONTACT, email: "@example.com" },
      })
    ).resolves.toEqual({
      status: "validation_error",
      error_code: "EMAIL_INVALID_FORMAT",
      field: "email",
    });
  });

  it("keeps a valid synthetic registration baseline green", async () => {
    expect(validateEmail(VALID_STEP2_CONTACT.email)).toEqual({ ok: true });
    expect(validateStep2(VALID_STEP2_CONTACT)).toEqual({ ok: true });
    await expect(handleRegister(VALID_REGISTER_REQUEST)).resolves.toEqual({ status: "ok" });
  });
});
