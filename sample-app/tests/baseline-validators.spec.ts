import { describe, expect, it } from "vitest";
import {
  validateFirstName,
  validateLastName,
  validateDOB,
  validateSSN4,
  validatePhone,
  validateZip,
} from "../src/registration-validator";

describe("baseline registration validators", () => {
  it("validateFirstName accepts a normal first name", () => {
    expect(validateFirstName("Sarah")).toEqual({ ok: true });
  });
  it("validateLastName rejects empty", () => {
    const r = validateLastName("");
    expect(r.ok).toBe(false);
    expect((r as any).code).toBe("LAST_NAME_REQUIRED");
  });
  it("validateSSN4 requires 4 digits", () => {
    expect(validateSSN4("123").ok).toBe(false);
    expect(validateSSN4("1234").ok).toBe(true);
  });
  it("validateZip accepts a 5-digit ZIP", () => {
    expect(validateZip("02101").ok).toBe(true);
  });
  it("validatePhone accepts +1 E.164", () => {
    expect(validatePhone("+15551234567").ok).toBe(true);
  });
  it("validateDOB rejects under-18 DOB", () => {
    const next = new Date(); next.setFullYear(next.getFullYear() - 5);
    expect(validateDOB(next.toISOString().slice(0,10)).ok).toBe(false);
  });
});
