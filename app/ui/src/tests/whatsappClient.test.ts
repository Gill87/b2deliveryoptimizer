import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  sendRoutesToWhatsApp,
  toWhatsAppRecipientNumber,
} from "@/lib/whatsapp/whatsappClient";
import type { SendRouteItem } from "@/lib/validation/whatsapp.schema";

function createRoute(
  vehicleId: string,
  driverPhoneNumber: string,
  driverName: string,
): SendRouteItem {
  return {
    vehicleId,
    driverPhoneNumber,
    route: { driverName },
  };
}

describe("sendRoutesToWhatsApp", () => {
  beforeEach(() => {
    vi.stubEnv("DELIVERYOPTIMIZER_API_URL", "https://api.example.com/");
    vi.stubEnv("WHATSAPP_SEND_ROUTE_SECRET", "test-secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sends each route to the backend and maps WhatsApp message IDs", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ messages: [{ id: "wamid.vehicle-1" }] })),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ messages: [{ id: "wamid.vehicle-2" }] })),
      );
    vi.stubGlobal("fetch", fetchMock);
    const items: SendRouteItem[] = [
      createRoute("vehicle-1", "+14155551234", "Jim"),
      createRoute("vehicle-2", "+14155551235", "Sam"),
    ];

    const results = await sendRoutesToWhatsApp(items);

    expect(results).toEqual([
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
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.example.com/api/whatsapp/send-route",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-WhatsApp-Send-Secret": "test-secret",
        },
        body: JSON.stringify({
          to: "14155551234",
          message: JSON.stringify({ driverName: "Jim" }),
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.example.com/api/whatsapp/send-route",
      expect.objectContaining({
        body: JSON.stringify({
          to: "14155551235",
          message: JSON.stringify({ driverName: "Sam" }),
        }),
      }),
    );
  });

  it("maps individual backend, network, and malformed response failures", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: "WhatsApp upstream request failed." }),
          { status: 502 },
        ),
      )
      .mockRejectedValueOnce(new TypeError("Network request failed"))
      .mockResolvedValueOnce(new Response("{"));
    vi.stubGlobal("fetch", fetchMock);

    const results = await sendRoutesToWhatsApp([
      createRoute("backend-failure", "+14155551234", "Jim"),
      createRoute("network-failure", "+14155551235", "Sam"),
      createRoute("malformed-response", "+14155551236", "Ava"),
    ]);

    expect(results).toEqual([
      {
        vehicleId: "backend-failure",
        status: "failed",
        whatsappMessageId: "",
        error: "WhatsApp upstream request failed.",
      },
      {
        vehicleId: "network-failure",
        status: "failed",
        whatsappMessageId: "",
        error: "Unable to reach the route sending service. Please try again.",
      },
      {
        vehicleId: "malformed-response",
        status: "failed",
        whatsappMessageId: "",
        error: "WhatsApp did not confirm that this route was sent.",
      },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it.each(["DELIVERYOPTIMIZER_API_URL", "WHATSAPP_SEND_ROUTE_SECRET"])(
    "requires %s for non-empty sends",
    async (variableName) => {
      vi.stubEnv(variableName, " ");
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      await expect(
        sendRoutesToWhatsApp([createRoute("vehicle-1", "+14155551234", "Jim")]),
      ).rejects.toThrow(
        `${variableName} must be configured to send WhatsApp routes.`,
      );
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("resolves an empty array for an empty input list", async () => {
    expect(await sendRoutesToWhatsApp([])).toEqual([]);
  });

  it("formats E.164 numbers for the WhatsApp recipient field", () => {
    expect(toWhatsAppRecipientNumber("+14155551234")).toBe("14155551234");
    expect(toWhatsAppRecipientNumber("14155551234")).toBe("14155551234");
  });
});
