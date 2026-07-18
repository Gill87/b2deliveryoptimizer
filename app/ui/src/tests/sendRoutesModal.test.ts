import { describe, expect, it } from "vitest";
import {
  buildRouteSendFailureOutcome,
  buildRouteSendOutcome,
  removeSentVehicleIds,
} from "@/app/results/components/SendRoutesModal";

describe("SendRoutesModal retry selection", () => {
  it("removes successfully sent vehicles before a retry", () => {
    const selectedIds = new Set(["vehicle-1", "vehicle-2", "vehicle-3"]);

    const next = removeSentVehicleIds(selectedIds, ["vehicle-1", "vehicle-3"]);

    expect([...next]).toEqual(["vehicle-2"]);
  });

  it("does not mutate the previous selected vehicle set", () => {
    const selectedIds = new Set(["vehicle-1", "vehicle-2"]);

    removeSentVehicleIds(selectedIds, ["vehicle-1"]);

    expect([...selectedIds]).toEqual(["vehicle-1", "vehicle-2"]);
  });
});

describe("route send outcomes", () => {
  it("shows the Driver app message when every route sends successfully", () => {
    const outcome = buildRouteSendOutcome(
      [
        { vehicleId: "vehicle-1", driverName: "Jim" },
        { vehicleId: "vehicle-2", driverName: "Sam" },
      ],
      [
        {
          vehicleId: "vehicle-1",
          status: "sent",
          whatsappMessageId: "wamid.vehicle-1",
        },
        {
          vehicleId: "vehicle-2",
          status: "sent",
          whatsappMessageId: "wamid.vehicle-2",
        },
      ],
    );

    expect(outcome).toEqual({
      status: "success",
      title: "Routes sent successfully!",
      message:
        "Your drivers can now access the optimized routes, load them up on our Driver app, and start driving!",
    });
  });

  it("lists failed drivers and the error reason after a partial send", () => {
    const outcome = buildRouteSendOutcome(
      [
        { vehicleId: "vehicle-1", driverName: "Jim" },
        { vehicleId: "vehicle-2", driverName: "Sam" },
        { vehicleId: "vehicle-3", driverName: "Ava" },
      ],
      [
        {
          vehicleId: "vehicle-1",
          status: "sent",
          whatsappMessageId: "wamid.vehicle-1",
        },
        {
          vehicleId: "vehicle-2",
          status: "failed",
          whatsappMessageId: "",
          error: "WhatsApp upstream request failed.",
        },
        {
          vehicleId: "vehicle-3",
          status: "failed",
          whatsappMessageId: "",
          error: "WhatsApp upstream request failed.",
        },
      ],
    );

    expect(outcome).toEqual({
      status: "failure",
      title: "Routes failed to send",
      message:
        "Some routes were sent successfully, but routes for Sam and Ava failed to send. WhatsApp upstream request failed. You can retry the failed routes.",
    });
  });

  it("lists every failed driver when the route send request fails", () => {
    const outcome = buildRouteSendFailureOutcome(
      [{ driverName: "Sam" }, { driverName: "Ava" }],
      "Unable to send routes. Check your connection and retry.",
    );

    expect(outcome).toEqual({
      status: "failure",
      title: "Routes failed to send",
      message:
        "Routes for Sam and Ava failed to send. Unable to send routes. Check your connection and retry. You can retry the failed routes.",
    });
  });
});
