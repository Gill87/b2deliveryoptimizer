// app/components/ShellNavbar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Minimal top bar for onboarding flow pages.
 * Uses overflow: hidden + text-overflow: ellipsis so the brand name
 * clips gracefully on narrow screens instead of overflowing.
 */
export default function ShellNavbar() {
  const pathname = usePathname();
  const isLandingPage = pathname === "/";
  const usesWhiteOnboardingBackground =
    isLandingPage || pathname === "/welcome";
  const brandStyles = {
    fontFamily: "var(--font-manrope), Arial, Helvetica, sans-serif",
    fontSize: "20px",
    fontWeight: 700,
    lineHeight: "28px",
    color: "var(--edit-text-primary)",
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
    minWidth: 0,
  };

  return (
    <header
      style={{
        height: "68px",
        background: usesWhiteOnboardingBackground
          ? "#ffffff"
          : "var(--edit-stone-50)",
        borderBottom:
          usesWhiteOnboardingBackground
            ? "1px solid rgba(0, 0, 0, 0.08)"
            : "none",
        display: "flex",
        alignItems: "center",
        padding: "16px",
        position: "sticky",
        top: 0,
        zIndex: 50,
        minWidth: 0,
        overflow: "hidden",
      }}
    >
      {isLandingPage ? (
        <span style={brandStyles}>Delivery Optimizer</span>
      ) : (
        <Link
          href="/"
          aria-label="Return to the Delivery Optimizer landing page"
          style={{ ...brandStyles, textDecoration: "none" }}
        >
          Delivery Optimizer
        </Link>
      )}
    </header>
  );
}
