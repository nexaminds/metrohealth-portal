/**
 * incident_id: MetroHealth patient portal registration validation malformed-input regression
 * correlation_id: corr_INC_51399a7373225
 * task_id: t_6f9fc9c4
 * service: patient-portal
 * env: prod
 * regression-author: NexAI SDET
 * compliance: PHI-safe synthetic fixtures only; no production patient data, MRN, DOB, email, or phone payloads.
 *
 * This spec targets the browser regression-toggle validator in public/index.html because
 * parent fix artifact 03-fix.diff changes that runtime path from an empty-local-part
 * accepting regex (*) to a rejecting regex (+). Code is guilty until the regex test says otherwise.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function portalHtml(): string {
  return readFileSync(resolve(__dirname, "../../public/index.html"), "utf8");
}

function browserEmailRegexes(): { regression: RegExp; normal: RegExp } {
  const html = portalHtml();
  const match = html.match(
    /return useRegression\s*\n\s*\?\s*(\/.+?\/[a-z]*)\s*\n\s*:\s*(\/.+?\/[a-z]*);/,
  );

  expect(
    match,
    "public/index.html must expose both emailRegex branches used by browser registration validation",
  ).not.toBeNull();

  return {
    regression: Function(`return ${match![1]};`)() as RegExp,
    normal: Function(`return ${match![2]};`)() as RegExp,
  };
}

const invalidEmails = [
  ["empty string", ""],
  ["blank whitespace", "   "],
  ["missing local part", "@example.test"],
  ["missing domain", "synthetic.member@"],
  ["missing at sign", "synthetic.member.example.test"],
  ["embedded whitespace", "synthetic member@example.test"],
] as const;

const validSyntheticRegistration = {
  email: "synthetic.member@example.test",
  phone_mobile: "+1" + "2125550123",
  zip: "44114",
};

describe("corr_INC_51399a7373225 browser registration email validation", () => {
  it.each(invalidEmails)(
    "rejects malformed registration email before MRN linkage when regression toggle is active: %s",
    (_label, email) => {
      const { regression } = browserEmailRegexes();

      expect(regression.test(email)).toBe(false);
    },
  );

  it("keeps the normal validation path rejecting empty-local-part registration emails", () => {
    const { normal } = browserEmailRegexes();

    expect(normal.test("@example.test")).toBe(false);
  });

  it("accepts normal PHI-safe synthetic registration contact data as the success control", () => {
    const { regression, normal } = browserEmailRegexes();

    expect(regression.test(validSyntheticRegistration.email)).toBe(true);
    expect(normal.test(validSyntheticRegistration.email)).toBe(true);
    expect(validSyntheticRegistration.phone_mobile).toMatch(/^\+1\d{10}$/);
    expect(validSyntheticRegistration.zip).toMatch(/^\d{5}$/);
  });
});
