import type { SendRouteItem } from "@/lib/validation/whatsapp.schema";

const SEND_ROUTE_PATH = "/api/whatsapp/send-route";

export type WhatsAppSendResult = {
  vehicleId: string;
  status: "sent" | "failed";
  whatsappMessageId: string;
  error?: string;
};

export function toWhatsAppRecipientNumber(phoneNumber: string): string {
  return phoneNumber.replace(/^\+/, "");
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} must be configured to send WhatsApp routes.`);
  }

  return value;
}

function apiUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}${SEND_ROUTE_PATH}`;
}

function messageIdFromResponse(body: unknown): string | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const messages = (body as { messages?: unknown }).messages;
  if (!Array.isArray(messages)) {
    return null;
  }

  const messageId = (messages[0] as { id?: unknown } | undefined)?.id;
  return typeof messageId === "string" && messageId ? messageId : null;
}

function errorFromResponse(body: unknown): string | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const error = (body as { error?: unknown }).error;
  return typeof error === "string" && error.trim() ? error.trim() : null;
}

function failedResult(vehicleId: string, error: string): WhatsAppSendResult {
  return {
    vehicleId,
    status: "failed",
    whatsappMessageId: "",
    error,
  };
}

async function sendRoute(
  item: SendRouteItem,
  endpoint: string,
  secret: string,
): Promise<WhatsAppSendResult> {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-WhatsApp-Send-Secret": secret,
      },
      body: JSON.stringify({
        to: toWhatsAppRecipientNumber(item.driverPhoneNumber),
        message: JSON.stringify(item.route),
      }),
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      return failedResult(
        item.vehicleId,
        errorFromResponse(body) ??
          "WhatsApp could not send this route. Please try again.",
      );
    }

    const messageId = messageIdFromResponse(body);
    if (!messageId) {
      return failedResult(
        item.vehicleId,
        "WhatsApp did not confirm that this route was sent.",
      );
    }

    return {
      vehicleId: item.vehicleId,
      status: "sent",
      whatsappMessageId: messageId,
    };
  } catch {
    return failedResult(
      item.vehicleId,
      "Unable to reach the route sending service. Please try again.",
    );
  }
}

export async function sendRoutesToWhatsApp(
  items: SendRouteItem[],
): Promise<WhatsAppSendResult[]> {
  if (items.length === 0) {
    return [];
  }

  const endpoint = apiUrl(requiredEnv("DELIVERYOPTIMIZER_API_URL"));
  const secret = requiredEnv("WHATSAPP_SEND_ROUTE_SECRET");

  return Promise.all(items.map((item) => sendRoute(item, endpoint, secret)));
}
