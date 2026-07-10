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
  const brandStyles = {
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    color: "#111",
    textTransform: "uppercase" as const,
    fontFamily: "inherit",
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
    minWidth: 0,
  };

  return (
    <header
      style={{
        height: "48px",
        background: "#ffffff",
        borderBottom: "1px solid #e8e8e8",
        display: "flex",
        alignItems: "center",
        paddingLeft: "20px",
        paddingRight: "20px",
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
