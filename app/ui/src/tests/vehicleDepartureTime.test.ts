import { describe, expect, it } from "vitest";

import { getMinutesAfterHourChange } from "@/app/edit/utils/deliveryHelpers";

describe("getMinutesAfterHourChange", () => {
  it("defaults empty minutes to 00 and reports auto-fill when the hour is valid", () => {
    expect(getMinutesAfterHourChange("9", "")).toEqual({
      minutes: "00",
      autoFilled: true,
    });
    expect(getMinutesAfterHourChange("12", "")).toEqual({
      minutes: "00",
      autoFilled: true,
    });
  });

  it("keeps minutes that the user already entered and reports no auto-fill", () => {
    expect(getMinutesAfterHourChange("9", "15")).toEqual({
      minutes: "15",
      autoFilled: false,
    });
    expect(getMinutesAfterHourChange("12", "30")).toEqual({
      minutes: "30",
      autoFilled: false,
    });
  });

  it("leaves minutes empty when the hour is missing or invalid", () => {
    expect(getMinutesAfterHourChange("", "")).toEqual({
      minutes: "",
      autoFilled: false,
    });
    expect(getMinutesAfterHourChange("0", "")).toEqual({
      minutes: "",
      autoFilled: false,
    });
    expect(getMinutesAfterHourChange("13", "")).toEqual({
      minutes: "",
      autoFilled: false,
    });
  });

  it("defaults minutes after a leading-zero hour becomes valid", () => {
    expect(getMinutesAfterHourChange("09", "")).toEqual({
      minutes: "00",
      autoFilled: true,
    });
  });

  it("clears auto-filled minutes when the hour becomes invalid", () => {
    expect(getMinutesAfterHourChange("13", "00", true)).toEqual({
      minutes: "",
      autoFilled: false,
    });
  });

  it("preserves user-entered 00 when the hour becomes invalid", () => {
    expect(getMinutesAfterHourChange("13", "00", false)).toEqual({
      minutes: "00",
      autoFilled: false,
    });
  });

  it("re-auto-fills 00 when minutes were already auto-filled, even if currently 00", () => {
    expect(getMinutesAfterHourChange("9", "00", true)).toEqual({
      minutes: "00",
      autoFilled: true,
    });
  });
});
