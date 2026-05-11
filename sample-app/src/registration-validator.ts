/**
 * MetroHealth Patient Portal — Registration Field Validators
 * Module: validators/registration
 *
 * Used by the /register endpoint (Step 1 — Identity, Step 2 — Contact).
 * All validation errors must be sanitized: never echo back PHI in messages.
 */

export type ValidationResult =
  | { ok: true }
  | { ok: false; code: string; field: string };

// ------------------------------------------------------------------
// Step 1 — Identity validators
// ------------------------------------------------------------------

export function validateFirstName(value: string): ValidationResult {
  if (!value || value.trim().length === 0) {
    return { ok: false, code: "FIRST_NAME_REQUIRED", field: "first_name" };
  }
  if (value.length > 50) {
    return { ok: false, code: "FIRST_NAME_TOO_LONG", field: "first_name" };
  }
  return { ok: true };
}

export function validateLastName(value: string): ValidationResult {
  if (!value || value.trim().length === 0) {
    return { ok: false, code: "LAST_NAME_REQUIRED", field: "last_name" };
  }
  if (value.length > 50) {
    return { ok: false, code: "LAST_NAME_TOO_LONG", field: "last_name" };
  }
  return { ok: true };
}

export function validateDOB(value: string): ValidationResult {
  if (!value) {
    return { ok: false, code: "DOB_REQUIRED", field: "dob" };
  }
  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) {
    return { ok: false, code: "DOB_INVALID", field: "dob" };
  }
  const eighteenYearsAgo = new Date();
  eighteenYearsAgo.setFullYear(eighteenYearsAgo.getFullYear() - 18);
  if (parsed > eighteenYearsAgo) {
    return { ok: false, code: "DOB_UNDER_18", field: "dob" };
  }
  return { ok: true };
}

export function validateSSN4(value: string): ValidationResult {
  if (!value) {
    return { ok: false, code: "SSN4_REQUIRED", field: "ssn_last_4" };
  }
  if (!/^\d{4}$/.test(value)) {
    return { ok: false, code: "SSN4_INVALID_FORMAT", field: "ssn_last_4" };
  }
  return { ok: true };
}

// ------------------------------------------------------------------
// Step 2 — Contact validators
// ------------------------------------------------------------------

// RFC 5322-lite. Intentionally pragmatic: we trust the verify-code step
// to catch deliverability; we just block obviously malformed input here.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(value: string): ValidationResult {
  // Empty / null check: required field, never accept empty.
  if (value === undefined || value === null) {
    return { ok: false, code: "EMAIL_REQUIRED", field: "email" };
  }
  // Length guard before regex (RFC 5322 max is 254).
  if (value.length === 0) {
    return { ok: false, code: "EMAIL_INVALID_LENGTH", field: "email" };
  }
  if (value.length > 254) {
    return { ok: false, code: "EMAIL_TOO_LONG", field: "email" };
  }
  if (!EMAIL_REGEX.test(value)) {
    return { ok: false, code: "EMAIL_INVALID_FORMAT", field: "email" };
  }
  return { ok: true };
}

export function validatePhoneMobile(value: string): ValidationResult {
  if (!value) {
    return { ok: false, code: "PHONE_REQUIRED", field: "phone_mobile" };
  }
  // E.164 US: +1 followed by 10 digits.
  if (!/^\+1\d{10}$/.test(value)) {
    return { ok: false, code: "PHONE_INVALID_FORMAT", field: "phone_mobile" };
  }
  return { ok: true };
}

export function validateZip(value: string): ValidationResult {
  if (!value) {
    return { ok: false, code: "ZIP_REQUIRED", field: "zip" };
  }
  if (!/^\d{5}(-\d{4})?$/.test(value)) {
    return { ok: false, code: "ZIP_INVALID_FORMAT", field: "zip" };
  }
  return { ok: true };
}

// ------------------------------------------------------------------
// Compound validator used by the /register handler
// ------------------------------------------------------------------

export interface RegistrationStep1Input {
  first_name: string;
  last_name: string;
  dob: string;
  ssn_last_4: string;
}

export interface RegistrationStep2Input {
  email: string;
  phone_mobile: string;
  zip: string;
}

export function validateStep1(input: RegistrationStep1Input): ValidationResult {
  const checks = [
    validateFirstName(input.first_name),
    validateLastName(input.last_name),
    validateDOB(input.dob),
    validateSSN4(input.ssn_last_4),
  ];
  const failed = checks.find((c) => c.ok === false);
  return failed ?? { ok: true };
}

export function validateStep2(input: RegistrationStep2Input): ValidationResult {
  const checks = [
    validateEmail(input.email),
    validatePhoneMobile(input.phone_mobile),
    validateZip(input.zip),
  ];
  const failed = checks.find((c) => c.ok === false);
  return failed ?? { ok: true };
}
