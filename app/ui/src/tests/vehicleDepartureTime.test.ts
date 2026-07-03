import { describe, expect, it } from "vitest";

import { getMinutesAfterHourChange } from "@/app/edit/utils/deliveryHelpers";

describe("getMinutesAfterHourChange", () => {
  it("defaults empty minutes to 00 when the hour is valid", () => {
    expect(getMinutesAfterHourChange("9", "")).toBe("00");
    expect(getMinutesAfterHourChange("12", "")).toBe("00");
  });

  it("keeps minutes that the user already entered", () => {
    expect(getMinutesAfterHourChange("9", "15")).toBe("15");
    expect(getMinutesAfterHourChange("12", "30")).toBe("30");
  });

  it("leaves minutes empty when the hour is missing or invalid", () => {
    expect(getMinutesAfterHourChange("", "")).toBe("");
    expect(getMinutesAfterHourChange("0", "")).toBe("");
    expect(getMinutesAfterHourChange("13", "")).toBe("");
  });

  it("defaults minutes after a leading-zero hour becomes valid", () => {
    expect(getMinutesAfterHourChange("09", "")).toBe("00");
  });

  it("clears auto-filled minutes when the hour becomes invalid", () => {
    expect(getMinutesAfterHourChange("13", "00", true)).toBe("");
  });

  it("preserves user-entered 00 when the hour becomes invalid", () => {
    expect(getMinutesAfterHourChange("13", "00", false)).toBe("00");
  });
});
