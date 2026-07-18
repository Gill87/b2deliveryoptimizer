import { test, expect, type Locator, type Page } from "@playwright/test";

const NOMINATIM_MOCK = [
  {
    lat: "37.7749",
    lon: "-122.4194",
    address: { state: "California", country_code: "us" },
  },
];

const SEND_TEST_ROUTES = [
  {
    vehicleId: "vehicle-1",
    driverName: "Jim",
    driverPhoneNumber: "4155551234",
    vehicleType: "Van",
    distanceMi: 1,
    estimatedTimeMinutes: 10,
    stops: [
      {
        id: "stop-1",
        address: "100 Market St, San Francisco, CA",
        lat: 37.7749,
        lng: -122.4194,
        sequence: 1,
        capacityUsed: 1,
        timeWindow: { kind: "at", time: "09:00" },
        note: "",
      },
    ],
  },
  {
    vehicleId: "vehicle-2",
    driverName: "Sam",
    driverPhoneNumber: "4155551235",
    vehicleType: "Van",
    distanceMi: 1,
    estimatedTimeMinutes: 10,
    stops: [
      {
        id: "stop-2",
        address: "200 Market St, San Francisco, CA",
        lat: 37.775,
        lng: -122.4195,
        sequence: 1,
        capacityUsed: 1,
        timeWindow: { kind: "at", time: "09:00" },
        note: "",
      },
    ],
  },
];

async function fillAddressOverlay(
  page: Page,
  dialogName: string,
  primaryLabel: string,
) {
  const overlay = page.getByRole("dialog", { name: dialogName });
  await overlay.waitFor();
  await overlay.locator("#start-loc-line1").fill("100 Market St");
  await overlay.locator("#start-loc-city").fill("San Francisco");
  await overlay.locator("#start-loc-state").selectOption("California");
  await overlay.locator("#start-loc-zip").fill("94105");
  await overlay.locator("#start-loc-country").selectOption("United States");
  await overlay.getByRole("button", { name: primaryLabel }).click();
}

async function addDeliveryAddress(page: Page, recipientName: string) {
  await page.getByRole("button", { name: "Add address" }).click();
  await page
    .locator('[aria-label="Recipient name"]')
    .first()
    .fill(recipientName);
  await page.locator('[aria-label="Delivery quantity"]').first().fill("1");
  await page.locator('[aria-label="Edit recipient address"]').first().click();
  await fillAddressOverlay(page, "Enter Address", "Confirm");
  await page.locator('[aria-label="Confirm row"]').first().click();
}

async function openSendRoutesModal(page: Page): Promise<Locator> {
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Choose export method" })
    .getByRole("button", { name: /^Send via WhatsApp\b/ })
    .click();

  const sendDialog = page.getByRole("dialog", { name: "Send Routes" });
  await expect(sendDialog).toBeVisible();
  return sendDialog;
}

test("optimize flow routes 2 stops to 1 vehicle", async ({ page }) => {
  test.setTimeout(180_000);

  await page.route(/nominatim\.openstreetmap\.org\/search/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(NOMINATIM_MOCK),
    }),
  );

  // Landing → Welcome → Edit
  await page.goto("/");
  await page.getByRole("button", { name: "Route manager — continue" }).click();
  await page.waitForURL("**/welcome");
  await page.getByRole("button", { name: "New user — continue" }).click();
  await page.waitForURL("**/edit");

  // Add one vehicle via overlay
  await page.getByRole("button", { name: "Add vehicle" }).click();
  const vehicleDialog = page.getByRole("dialog", {
    name: "Add vehicle details",
  });
  await vehicleDialog.waitFor();
  await vehicleDialog.locator("#overlay-vehicle-name").fill("E2E Van");
  await vehicleDialog.locator("#overlay-vehicle-type").selectOption("truck");
  await vehicleDialog.locator("#overlay-vehicle-capacity").fill("100");
  await vehicleDialog.locator("#overlay-vehicle-unit").selectOption("units");
  await vehicleDialog.locator('[aria-label="Departure hours"]').fill("08");
  await vehicleDialog.locator('[aria-label="Departure minutes"]').fill("00");
  await vehicleDialog.getByRole("button", { name: "Confirm" }).click();

  // Add two delivery addresses
  await addDeliveryAddress(page, "Stop One");
  await addDeliveryAddress(page, "Stop Two");

  // Optimize button is in ManageSectionHeader inside <main>, not the navbar
  await page
    .getByRole("main")
    .getByRole("button", { name: "Optimize" })
    .click();

  // Fill depot address overlay (appears because no start location is set)
  await fillAddressOverlay(
    page,
    "Enter starting location for all driver routes",
    "Optimize",
  );

  // Assert optimization succeeded by confirming route data in the sidebar
  await page.waitForURL("**/results", { timeout: 120_000 });
  await expect(
    page.getByRole("heading", { name: "Optimized Routes" }),
  ).toBeVisible();
  await expect(
    page.locator("aside").getByText("1 route with 2 total stops"),
  ).toBeVisible();
});

test("results export opens method choices before existing flows", async ({
  page,
}) => {
  await page.goto("/results?mock=1");

  await expect(
    page.getByRole("heading", { name: "Optimized Routes" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Send", exact: true }),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Export", exact: true }).click();

  const methodDialog = page.getByRole("dialog", {
    name: "Choose export method",
  });
  await expect(methodDialog).toBeVisible();
  await expect(
    methodDialog.getByRole("button", { name: /Send via WhatsApp/ }),
  ).toBeVisible();
  await expect(
    methodDialog.getByRole("button", { name: /^Export Routes\b/ }),
  ).toBeVisible();

  await methodDialog.getByRole("button", { name: /Send via WhatsApp/ }).click();
  await expect(page.getByRole("dialog", { name: "Send Routes" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Send Routes" })).toHaveCount(
    0,
  );

  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Choose export method" })
    .getByRole("button", { name: /^Export Routes\b/ })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Export Routes" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Export Routes" })).toHaveCount(
    0,
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/results?mock=1");
  await page.getByRole("button", { name: "Expand route list" }).click();
  await expect(
    page.getByRole("button", { name: "Send", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Choose export method" }),
  ).toBeVisible();
});

test("route sends show success and partial-failure outcomes", async ({
  page,
}) => {
  let sendAttempt = 0;
  await page.route("**/api/whatsapp/send-route", async (route) => {
    const body = route.request().postDataJSON() as {
      routes: { vehicleId: string }[];
    };
    const isPartialFailure = sendAttempt++ === 1;
    const failedVehicleId = isPartialFailure ? "vehicle-2" : null;

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        results: body.routes.map(({ vehicleId }) => {
          const didFail = vehicleId === failedVehicleId;

          return {
            vehicleId,
            status: didFail ? "failed" : "sent",
            whatsappMessageId: didFail ? "" : `wamid.${vehicleId}`,
            error: didFail ? "WhatsApp upstream request failed." : undefined,
          };
        }),
      }),
    });
  });
  await page.addInitScript((routes) => {
    sessionStorage.setItem("optimizeResults", JSON.stringify(routes));
  }, SEND_TEST_ROUTES);
  await page.goto("/results");

  const successSendDialog = await openSendRoutesModal(page);
  await successSendDialog.getByRole("button", { name: "Send (2)" }).click();

  const successDialog = page.getByRole("dialog", {
    name: "Routes sent successfully!",
  });
  await expect(successDialog).toBeVisible();
  await expect(successDialog).toContainText(
    "Your drivers can now access the optimized routes",
  );
  await successDialog
    .getByRole("button", { name: "Close", exact: true })
    .click();

  const partialSendDialog = await openSendRoutesModal(page);
  await partialSendDialog.getByRole("button", { name: "Send (2)" }).click();

  const failureDialog = page.getByRole("dialog", {
    name: "Routes failed to send",
  });
  await expect(failureDialog).toContainText(
    "Some routes were sent successfully, but the route for Sam failed to send.",
  );
  await expect(failureDialog).toContainText(
    "WhatsApp upstream request failed.",
  );
  await failureDialog
    .getByRole("button", { name: "Close", exact: true })
    .click();
});
