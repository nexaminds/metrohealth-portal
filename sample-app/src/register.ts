/**
 * MetroHealth Patient Portal — /register endpoint handler
 */

import {
  validateStep1,
  validateStep2,
  validateStep3,
  RegistrationStep1Input,
  RegistrationStep2Input,
  RegistrationStep3Input,
} from "./registration-validator";

export interface RegisterRequest {
  step1: RegistrationStep1Input;
  step2: RegistrationStep2Input;
  step3: RegistrationStep3Input;
  consent_hipaa_authorization: boolean;
}

export interface RegisterResponse {
  status: "ok" | "validation_error" | "consent_required";
  error_code?: string;
  field?: string;
  // Never echo back the user's input here — sanitize PHI.
}

export async function handleRegister(
  req: RegisterRequest
): Promise<RegisterResponse> {
  if (!req.consent_hipaa_authorization) {
    return { status: "consent_required", error_code: "HIPAA_AUTH_REQUIRED" };
  }

  const step1Result = validateStep1(req.step1);
  if (!step1Result.ok) {
    return {
      status: "validation_error",
      error_code: step1Result.code,
      field: step1Result.field,
    };
  }

  const step2Result = validateStep2(req.step2);
  if (!step2Result.ok) {
    return {
      status: "validation_error",
      error_code: step2Result.code,
      field: step2Result.field,
    };
  }

  const step3Result = validateStep3(req.step3);
  if (!step3Result.ok) {
    return {
      status: "validation_error",
      error_code: step3Result.code,
      field: step3Result.field,
    };
  }

  // (downstream: probabilistic match, MRN linking, send verify code,
  // payor eligibility check via 270/271)
  // out of scope for this validator module
  return { status: "ok" };
}
