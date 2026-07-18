import type { SendRouteItem } from "@/lib/validation/whatsapp.schema";

const SEND_ROUTE_PATH = "/api/whatsapp/send-route";

export type WhatsAppSendResult = {
  vehicleId: string;
  status: "sent" | "failed";
  whatsappMessageId: string;
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

    const messageId = response.ok
      ? messageIdFromResponse(await response.json().catch(() => null))
      : null;

    return {
      vehicleId: item.vehicleId,
      status: messageId ? "sent" : "failed",
      whatsappMessageId: messageId ?? "",
    };
  } catch {
    return {
      vehicleId: item.vehicleId,
      status: "failed",
      whatsappMessageId: "",
    };
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
