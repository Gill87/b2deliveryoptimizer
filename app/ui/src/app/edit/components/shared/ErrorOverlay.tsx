"use client";

import { useId } from "react";

import {
  ERROR_OVERLAY_FOOTER,
  ERROR_OVERLAY_MESSAGE,
  OVERLAY_BACKDROP,
  OVERLAY_CANCEL_BTN,
  OVERLAY_CLOSE_BTN,
  OVERLAY_HEADER,
  OVERLAY_PANEL,
  OVERLAY_PRIMARY_BTN,
  OVERLAY_TITLE,
  OVERLAY_WARNING_BTN,
} from "@/app/edit/formStyles.v2";
import styles from "@/app/edit/edit.module.css";
import { useFocusTrap } from "@/app/edit/hooks/useFocusTrap";

type ErrorOverlayProps = {
  message: string | null;
  onClose: () => void;
  title?: string;
  action?: {
    label: string;
    onClick: () => void;
    tone?: "warning";
  };
};

export default function ErrorOverlay({
  message,
  onClose,
  title = "Something went wrong",
  action,
}: ErrorOverlayProps) {
  const panelRef = useFocusTrap<HTMLDivElement>(!!message);
  const titleId = useId();
  const messageId = useId();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
  };

  if (!message) return null;

  return (
    <div className={OVERLAY_BACKDROP} onKeyDown={handleKeyDown}>
      <div
        ref={panelRef}
        className={OVERLAY_PANEL}
        role={action ? "alertdialog" : "dialog"}
        aria-modal={true}
        aria-labelledby={titleId}
        aria-describedby={messageId}
      >
        <div className={OVERLAY_HEADER}>
          <h2 id={titleId} className={OVERLAY_TITLE}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className={OVERLAY_CLOSE_BTN}
            aria-label={`Close ${title}`}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <p id={messageId} className={ERROR_OVERLAY_MESSAGE}>
          {message}
        </p>
        <div className={ERROR_OVERLAY_FOOTER}>
          {action && (
            <button
              type="button"
              onClick={onClose}
              className={OVERLAY_CANCEL_BTN}
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={action?.onClick ?? onClose}
            className={`${action?.tone === "warning" ? OVERLAY_WARNING_BTN : OVERLAY_PRIMARY_BTN} ${styles.primaryBtnOverlay}`}
          >
            {action?.label ?? "Dismiss"}
          </button>
        </div>
      </div>
    </div>
  );
}
