import { describe, it, expect } from "vitest";
import {
  deliveryTimeFilled,
  formatLockedDeliveryTimeWindow,
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
