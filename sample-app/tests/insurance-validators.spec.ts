import { describe, expect, it } from "vitest";
import {
  validateMemberId,
  validateGroupNumber,
  validatePlanEffectiveDate,
  validateStep3,
} from "../src/registration-validator";

describe("Step 3 — insurance validators", () => {
  describe("validateMemberId", () => {
    it("accepts an Aetna-style all-digit member ID", () => {
      expect(validateMemberId("W123456789").ok).toBe(true);
    });
    it("accepts a BCBS-style alpha-prefixed member ID", () => {
      expect(validateMemberId("XOF1234567").ok).toBe(true);
    });
    it("rejects empty", () => {
      const r = validateMemberId("");
      expect(r.ok).toBe(false);
      expect((r as any).code).toBe("MEMBER_ID_REQUIRED");
    });
    it("rejects too-short input", () => {
      const r = validateMemberId("AB12");
      expect(r.ok).toBe(false);
      expect((r as any).code).toBe("MEMBER_ID_INVALID_FORMAT");
    });
    it("rejects lowercase characters (submit form uppercases first)", () => {
      const r = validateMemberId("xof1234567");
      expect(r.ok).toBe(false);
      expect((r as any).code).toBe("MEMBER_ID_INVALID_FORMAT");
    });
  });

  describe("validateGroupNumber", () => {
    it("accepts a 6-digit group number", () => {
      expect(validateGroupNumber("123456").ok).toBe(true);
    });
    it("accepts a digit-plus-suffix self-funded group", () => {
      expect(validateGroupNumber("123456A").ok).toBe(true);
    });
    it("rejects empty", () => {
      const r = validateGroupNumber("");
      expect(r.ok).toBe(false);
      expect((r as any).code).toBe("GROUP_NUMBER_REQUIRED");
    });
    it("rejects 3 digits as too short", () => {
      expect(validateGroupNumber("123").ok).toBe(false);
    });
  });

  describe("validatePlanEffectiveDate", () => {
    it("accepts a past date (existing coverage)", () => {
      expect(validatePlanEffectiveDate("2024-01-01").ok).toBe(true);
    });
    it("accepts a date 30 days out", () => {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      expect(validatePlanEffectiveDate(d.toISOString().slice(0, 10)).ok).toBe(
        true
      );
    });
    it("rejects a date more than 90 days in the future", () => {
      const d = new Date();
      d.setDate(d.getDate() + 200);
      const r = validatePlanEffectiveDate(d.toISOString().slice(0, 10));
      expect(r.ok).toBe(false);
      expect((r as any).code).toBe("PLAN_EFFECTIVE_DATE_TOO_FAR_FUTURE");
    });
    it("rejects unparseable strings", () => {
      const r = validatePlanEffectiveDate("not-a-date");
      expect(r.ok).toBe(false);
      expect((r as any).code).toBe("PLAN_EFFECTIVE_DATE_INVALID");
    });
  });

  describe("validateStep3 compound", () => {
    it("returns ok when all three fields are valid", () => {
      expect(
        validateStep3({
          member_id: "W123456789",
          group_number: "987654",
          plan_effective_date: "2025-01-01",
        }).ok
      ).toBe(true);
    });
    it("surfaces the first failing field (member_id)", () => {
      const r = validateStep3({
        member_id: "",
        group_number: "987654",
        plan_effective_date: "2025-01-01",
      });
      expect(r.ok).toBe(false);
      expect((r as any).field).toBe("member_id");
    });
  });
});
