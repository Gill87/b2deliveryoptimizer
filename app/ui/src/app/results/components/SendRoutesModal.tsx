"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { useFocusTrap } from "@/app/edit/hooks/useFocusTrap";
import type { WhatsAppSendResult } from "@/lib/whatsapp/whatsappClient";
import {
  formatUsPhoneNumber,
  isComplete10DigitUsPhone,
  toE164UsPhone,
} from "@/lib/utils/phone";
import { useIsClient } from "../hooks/useIsClient";
import type { Route } from "../types";
import { routeColorHex } from "../utils/routeColors";

type SendRoutesModalProps = {
  isOpen: boolean;
  onClose: () => void;
  routes: Route[];
  onUpdateDriverPhone: (vehicleId: string, phone: string) => void;
  onSendComplete: (vehicleIds: string[], sentAtIso: string) => void;
};

function formatSentAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function pickSentVehicleIds(results: WhatsAppSendResult[]): string[] {
  return results.filter((r) => r.status === "sent").map((r) => r.vehicleId);
}

export type RouteSendOutcome = {
  status: "success" | "failure";
  title: string;
  message: string;
};

function joinDriverNames(routes: Pick<Route, "driverName">[]): string {
  const names = routes.map((route) => route.driverName || "an unnamed driver");

  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names.at(-1)}`;
}

function buildFailureOutcome(
  failedRoutes: Pick<Route, "driverName">[],
  sentCount: number,
  reason: string,
): RouteSendOutcome {
  const routePhrase =
    failedRoutes.length === 1
      ? `the route for ${joinDriverNames(failedRoutes)}`
      : `routes for ${joinDriverNames(failedRoutes)}`;
  const statusMessage =
    sentCount > 0
      ? `Some routes were sent successfully, but ${routePhrase} failed to send.`
      : `${routePhrase[0].toUpperCase()}${routePhrase.slice(1)} failed to send.`;

  return {
    status: "failure",
    title: "Routes failed to send",
    message: `${statusMessage} ${reason} You can retry the failed routes.`,
  };
}

export function buildRouteSendOutcome(
  routes: Pick<Route, "vehicleId" | "driverName">[],
  results: WhatsAppSendResult[],
): RouteSendOutcome {
  const resultsByVehicleId = new Map(
    results.map((result) => [result.vehicleId, result]),
  );
  const failedRoutes = routes.filter(
    (route) => resultsByVehicleId.get(route.vehicleId)?.status !== "sent",
  );

  if (failedRoutes.length === 0) {
    return {
      status: "success",
      title: "Routes sent successfully!",
      message:
        "Your drivers can now access the optimized routes, load them up on our Driver app, and start driving!",
    };
  }

  const reasons = [
    ...new Set(
      failedRoutes
        .map((route) => resultsByVehicleId.get(route.vehicleId)?.error)
        .filter((reason): reason is string => Boolean(reason)),
    ),
  ];
  const reason =
    reasons.length === 1
      ? reasons[0]
      : "WhatsApp could not send one or more routes.";

  return buildFailureOutcome(
    failedRoutes,
    routes.length - failedRoutes.length,
    reason,
  );
}

export function buildRouteSendFailureOutcome(
  routes: Pick<Route, "driverName">[],
  reason: string,
): RouteSendOutcome {
  return buildFailureOutcome(routes, 0, reason);
}

export function removeSentVehicleIds(
  selectedIds: Set<string>,
  sentIds: string[],
): Set<string> {
  const next = new Set(selectedIds);
  sentIds.forEach((id) => next.delete(id));
  return next;
}

export default function SendRoutesModal({
  isOpen,
  onClose,
  routes,
  onUpdateDriverPhone,
  onSendComplete,
}: SendRoutesModalProps) {
  const isClient = useIsClient();
  const [outcome, setOutcome] = useState<RouteSendOutcome | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  if (!isOpen || !isClient) return null;

  return createPortal(
    outcome ? (
      <SendRoutesOutcomeDialog
        outcome={outcome}
        onClose={() => {
          setOutcome(null);
          onClose();
        }}
      />
    ) : (
      <SendRoutesModalPanel
        routes={routes}
        onClose={onClose}
        onUpdateDriverPhone={onUpdateDriverPhone}
        onSendComplete={onSendComplete}
        onSendOutcome={setOutcome}
      />
    ),
    document.body,
  );
}

type SendRoutesModalPanelProps = {
  routes: Route[];
  onClose: () => void;
  onUpdateDriverPhone: (vehicleId: string, phone: string) => void;
  onSendComplete: (vehicleIds: string[], sentAtIso: string) => void;
  onSendOutcome: (outcome: RouteSendOutcome) => void;
};

type SendState = { status: "idle" } | { status: "sending" };

type SendRoutesOutcomeDialogProps = {
  outcome: RouteSendOutcome;
  onClose: () => void;
};

function SendRoutesOutcomeDialog({
  outcome,
  onClose,
}: SendRoutesOutcomeDialogProps) {
  const panelRef = useFocusTrap<HTMLDivElement>(true);
  const titleId = useId();
  const descriptionId = useId();
  const isSuccess = outcome.status === "success";

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 font-sans-manrope"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="relative mx-4 w-full max-w-md overflow-hidden rounded-xl border border-zinc-200 bg-white text-zinc-900 shadow-lg"
        onKeyDown={handleKeyDown}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
          aria-label="Close outcome dialog"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M1 1L13 13M13 1L1 13"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <div className="px-6 pb-5 pt-6">
          <span
            className={`flex h-10 w-10 items-center justify-center rounded-full ${
              isSuccess
                ? "bg-emerald-100 text-emerald-700"
                : "bg-red-100 text-red-700"
            }`}
            aria-hidden="true"
          >
            {isSuccess ? "✓" : "!"}
          </span>
          <h2
            id={titleId}
            className="mt-4 pr-8 text-lg font-semibold text-zinc-900"
          >
            {outcome.title}
          </h2>
          <p
            id={descriptionId}
            className="mt-2 text-sm leading-snug text-zinc-700"
          >
            {outcome.message}
          </p>
        </div>

        <div className="flex justify-end border-t border-zinc-100 bg-zinc-50/80 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-md bg-[var(--edit-teal-400)] px-4 text-sm font-semibold text-[var(--edit-foreground)] hover:brightness-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--edit-teal-400)]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function SendRoutesModalPanel({
  routes,
  onClose,
  onUpdateDriverPhone,
  onSendComplete,
  onSendOutcome,
}: SendRoutesModalPanelProps) {
  const panelRef = useFocusTrap<HTMLDivElement>(true);
  const titleId = useId();
  const [selectedIds, setSelectedIds] = useState(
    () => new Set(routes.map((r) => r.vehicleId)),
  );
  const [touchedIds, setTouchedIds] = useState<Set<string>>(() => new Set());
  const [sendState, setSendState] = useState<SendState>({ status: "idle" });

  const toggle = useCallback((vehicleId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(vehicleId)) next.delete(vehicleId);
      else next.add(vehicleId);
      return next;
    });
  }, []);

  const markTouched = useCallback((vehicleId: string) => {
    setTouchedIds((prev) => {
      const next = new Set(prev);
      next.add(vehicleId);
      return next;
    });
  }, []);

  const selectedRoutes = routes.filter((r) => selectedIds.has(r.vehicleId));
  const selectedCount = selectedRoutes.length;
  const isSending = sendState.status === "sending";
  const canSend =
    selectedCount > 0 &&
    !isSending &&
    selectedRoutes.every((r) =>
      isComplete10DigitUsPhone(r.driverPhoneNumber ?? ""),
    );

  const handleSend = useCallback(async () => {
    if (!canSend) return;
    setSendState({ status: "sending" });

    const payload = {
      routes: selectedRoutes.map((route) => ({
        vehicleId: route.vehicleId,
        driverPhoneNumber: toE164UsPhone(route.driverPhoneNumber ?? ""),
        route,
      })),
    };

    try {
      const res = await fetch("/api/whatsapp/send-route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        onSendOutcome(
          buildRouteSendFailureOutcome(
            selectedRoutes,
            body?.error ?? "Failed to send routes via WhatsApp.",
          ),
        );
        return;
      }

      const body = (await res.json().catch(() => null)) as {
        results?: WhatsAppSendResult[];
      } | null;
      const sentIds = pickSentVehicleIds(body?.results ?? []);

      if (sentIds.length > 0) {
        onSendComplete(sentIds, new Date().toISOString());
        setSelectedIds((prev) => removeSentVehicleIds(prev, sentIds));
      }

      onSendOutcome(buildRouteSendOutcome(selectedRoutes, body?.results ?? []));
    } catch {
      onSendOutcome(
        buildRouteSendFailureOutcome(
          selectedRoutes,
          "Unable to send routes. Check your connection and retry.",
        ),
      );
    }
  }, [canSend, selectedRoutes, onSendComplete, onSendOutcome]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 font-sans-manrope"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative mx-4 flex max-h-[min(640px,85vh)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white text-zinc-900 shadow-lg"
        onKeyDown={handleKeyDown}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
          aria-label="Close"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M1 1L13 13M13 1L1 13"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <div className="shrink-0 border-b border-zinc-100 px-5 pb-4 pt-5 pr-12">
          <h2
            id={titleId}
            className="whitespace-nowrap text-lg font-semibold text-zinc-800"
          >
            Send Routes
          </h2>
          <p className="mt-1 text-sm font-normal leading-snug text-black">
            Assign a phone number to each driver and send their route via
            WhatsApp
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {routes.length === 0 ? (
            <p className="text-xs text-zinc-500">No routes to send.</p>
          ) : (
            <ul className="space-y-2">
              {routes.map((route, idx) => {
                const checked = selectedIds.has(route.vehicleId);
                const touched = touchedIds.has(route.vehicleId);
                const phone = route.driverPhoneNumber ?? "";
                const valid = isComplete10DigitUsPhone(phone);
                const showError = checked && touched && !valid;
                const accent = routeColorHex(idx);
                const inputId = `send-routes-phone-${route.vehicleId}`;
                const errorId = `send-routes-phone-error-${route.vehicleId}`;
                return (
                  <li key={route.vehicleId}>
                    <div className="flex items-stretch gap-0 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
                      <span className="flex shrink-0 items-center border-r border-zinc-100 bg-zinc-50 px-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(route.vehicleId)}
                          className="h-4 w-4 rounded border-zinc-300 text-[var(--edit-teal-400)] focus:ring-[var(--edit-teal-400)]"
                          aria-label={`Include route ${idx + 1} for ${route.driverName}`}
                        />
                      </span>
                      <span
                        className="w-1 shrink-0"
                        style={{ backgroundColor: accent }}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1 py-3 pl-3 pr-3">
                        <span className="flex items-center gap-2">
                          <span className="block text-[15px] font-semibold leading-none text-zinc-900">
                            Route {idx + 1} · {route.driverName}
                          </span>
                          {route.lastSentAt && (
                            <span
                              className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold leading-none text-emerald-700"
                              title={`Sent ${formatSentAt(route.lastSentAt)}`}
                            >
                              Sent
                            </span>
                          )}
                        </span>
                        <label
                          htmlFor={inputId}
                          className="mt-2 block text-[12px] font-medium leading-none text-zinc-500"
                        >
                          Driver phone number
                        </label>
                        <input
                          id={inputId}
                          type="tel"
                          inputMode="numeric"
                          autoComplete="tel"
                          disabled={!checked || isSending}
                          placeholder="123-456-7890"
                          maxLength={12}
                          value={phone}
                          onChange={(e) =>
                            onUpdateDriverPhone(
                              route.vehicleId,
                              formatUsPhoneNumber(e.target.value),
                            )
                          }
                          onBlur={() => markTouched(route.vehicleId)}
                          aria-invalid={showError ? "true" : "false"}
                          aria-describedby={errorId}
                          className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400 focus:border-[var(--edit-teal-400)] focus:outline-none focus:ring-1 focus:ring-[var(--edit-teal-400)]"
                        />
                        <p
                          id={errorId}
                          className="mt-1 min-h-[1rem] text-[12px] leading-tight text-red-600"
                        >
                          {showError
                            ? "Enter a valid 10-digit phone number, e.g. 123-456-7890"
                            : ""}
                        </p>
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-zinc-100 bg-zinc-50/80 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSending}
            className="px-3 py-2 text-sm font-semibold text-zinc-600 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSend}
            onClick={handleSend}
            className="h-9 shrink-0 rounded-md bg-[var(--edit-teal-400)] px-4 text-[14px] font-semibold leading-5 text-[var(--edit-foreground)] whitespace-nowrap hover:brightness-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSending ? "Sending…" : `Send (${selectedCount})`}
          </button>
        </div>
      </div>
    </div>
  );
}
