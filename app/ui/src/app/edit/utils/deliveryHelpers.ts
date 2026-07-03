/**
 * Shared helpers for delivery edit flows (formatting, validation, etc.).
 * Place cross-cutting utilities here so hooks and components stay thin.
 */

import type { AddressCard } from "../types/delivery";

/** Returns true when at least one delivery-time field has a value. */
export function deliveryTimeFilled(
  a: Pick<AddressCard, "deliveryTimeStart" | "deliveryTimeEnd">,
): boolean {
  return (
    (a.deliveryTimeStart?.trim() ?? "") !== "" ||
    (a.deliveryTimeEnd?.trim() ?? "") !== ""
  );
}

/** Formats the locked-card delivery time label for one- or two-sided windows. */
export function formatLockedDeliveryTimeWindow(
  a: Pick<AddressCard, "deliveryTimeStart" | "deliveryTimeEnd">,
): string {
  const start = a.deliveryTimeStart?.trim() ?? "";
  const end = a.deliveryTimeEnd?.trim() ?? "";

  if (start && end) return `${start} – ${end}`;
  if (start) return `From ${start}`;
  if (end) return `By ${end}`;
  return "—";
}

export function isValidDepartureHour(hour: string | number): boolean {
  const hourNumber =
    typeof hour === "number" ? hour : parseInt(hour.trim(), 10);
  return hourNumber >= 1 && hourNumber <= 12;
}

export function getMinutesAfterHourChange(
  hours: string,
  currentMinutes: string,
  minutesWereAutoFilled = false,
): string {
  if (!isValidDepartureHour(hours)) {
    return minutesWereAutoFilled ? "" : currentMinutes;
  }

  if (currentMinutes === "" || minutesWereAutoFilled) return "00";

  return currentMinutes;
}

/** Capitalise the first letter of a string. Safe on empty strings. */
export function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

/**
 * True when an address has a geocoded location with a known state, so it's
 * safe to reuse without re-geocoding. Addresses imported via a save point can
 * carry coordinates with a null state, which must fall through to a fresh
 * geocode call since the solver requires a state for validation.
 */
export function hasCachedLocationWithState(
  a: Pick<AddressCard, "cachedLocation">,
): boolean {
  return a.cachedLocation?.state != null;
}
