import { describe, it, expect } from "vitest";
import {
  deliveryTimeFilled,
  formatLockedDeliveryTimeWindow,
  isValidDepartureHour,
} from "@/app/edit/utils/deliveryHelpers";

describe("deliveryTimeFilled", () => {
  it("both empty → false", () => {
    expect(
      deliveryTimeFilled({ deliveryTimeStart: "", deliveryTimeEnd: "" }),
    ).toBe(false);
  });

  it("whitespace-only fields → false", () => {
    expect(
      deliveryTimeFilled({ deliveryTimeStart: "   ", deliveryTimeEnd: "  " }),
    ).toBe(false);
  });

  it("start only → true", () => {
    expect(
      deliveryTimeFilled({ deliveryTimeStart: "9:00 AM", deliveryTimeEnd: "" }),
    ).toBe(true);
  });

  it("end only → true", () => {
    expect(
      deliveryTimeFilled({ deliveryTimeStart: "", deliveryTimeEnd: "5:00 PM" }),
    ).toBe(true);
  });

  it("both set → true", () => {
    expect(
      deliveryTimeFilled({
        deliveryTimeStart: "9:00 AM",
        deliveryTimeEnd: "5:00 PM",
      }),
    ).toBe(true);
  });
});

describe("formatLockedDeliveryTimeWindow", () => {
  it("both empty → dash", () => {
    expect(
      formatLockedDeliveryTimeWindow({
        deliveryTimeStart: "",
        deliveryTimeEnd: "",
      }),
    ).toBe("—");
  });

  it("start + end → unchanged range", () => {
    expect(
      formatLockedDeliveryTimeWindow({
        deliveryTimeStart: "9:00 AM",
        deliveryTimeEnd: "11:00 AM",
      }),
    ).toBe("9:00 AM – 11:00 AM");
  });

  it("start only → From label", () => {
    expect(
      formatLockedDeliveryTimeWindow({
        deliveryTimeStart: "9:00 AM",
        deliveryTimeEnd: "",
      }),
    ).toBe("From 9:00 AM");
  });

  it("end only → By label", () => {
    expect(
      formatLockedDeliveryTimeWindow({
        deliveryTimeStart: "",
        deliveryTimeEnd: "5:00 PM",
      }),
    ).toBe("By 5:00 PM");
  });

  it("trims whitespace around time values", () => {
    expect(
      formatLockedDeliveryTimeWindow({
        deliveryTimeStart: " 9:00 AM ",
        deliveryTimeEnd: " 11:00 AM ",
      }),
    ).toBe("9:00 AM – 11:00 AM");
  });
});

describe("isValidDepartureHour", () => {
  it("accepts plain 1-2 digit hours in range", () => {
    expect(isValidDepartureHour("1")).toBe(true);
    expect(isValidDepartureHour("9")).toBe(true);
    expect(isValidDepartureHour("12")).toBe(true);
    expect(isValidDepartureHour(9)).toBe(true);
  });

  it("rejects out-of-range hours", () => {
    expect(isValidDepartureHour("0")).toBe(false);
    expect(isValidDepartureHour("13")).toBe(false);
    expect(isValidDepartureHour(0)).toBe(false);
  });

  it("rejects partially-numeric strings instead of silently truncating them", () => {
    expect(isValidDepartureHour("9am")).toBe(false);
    expect(isValidDepartureHour("1x")).toBe(false);
    expect(isValidDepartureHour("9.5")).toBe(false);
  });

  it("rejects empty or whitespace-only strings", () => {
    expect(isValidDepartureHour("")).toBe(false);
    expect(isValidDepartureHour("  ")).toBe(false);
  });
});
