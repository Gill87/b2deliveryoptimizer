import type { JSX } from "react";

type VehicleTypeIconProps = {
  vehicleType?: string;
  className?: string;
};

function normalizedVehicleType(vehicleType?: string): string {
  return vehicleType?.trim().toLowerCase() ?? "";
}

function TruckIcon(): JSX.Element {
  return (
    <>
      <path
        d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 18H9M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="17"
        cy="18"
        r="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle
        cx="7"
        cy="18"
        r="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
    </>
  );
}

function CarIcon(): JSX.Element {
  return (
    <>
      <path
        d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 17h6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="7"
        cy="17"
        r="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle
        cx="17"
        cy="17"
        r="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
    </>
  );
}

function BicycleIcon(): JSX.Element {
  return (
    <>
      <circle
        cx="18.5"
        cy="17.5"
        r="3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="5.5"
        cy="17.5"
        r="3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="15"
        cy="5"
        r="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M12 17.5V14l-3-3 4-3 2 3h2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  );
}

function vehicleIconContent(vehicleType?: string): JSX.Element {
  switch (normalizedVehicleType(vehicleType)) {
    case "truck":
      return <TruckIcon />;
    case "bicycle":
      return <BicycleIcon />;
    default:
      return <CarIcon />;
  }
}

export default function VehicleTypeIcon({
  vehicleType,
  className = "h-6 w-6 shrink-0",
}: VehicleTypeIconProps): JSX.Element {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      {vehicleIconContent(vehicleType)}
    </svg>
  );
}
