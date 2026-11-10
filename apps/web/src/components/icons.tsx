import type { ReactNode } from "react";

function Icon({ children, size = 20 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="square"
      strokeLinejoin="miter"
    >
      {children}
    </svg>
  );
}

export const PlusIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="M12 4v16M4 12h16" />
  </Icon>
);
export const ChevronLeftIcon = () => (
  <Icon size={18}>
    <path d="M15 18l-6-6 6-6" />
  </Icon>
);
export const ChevronRightIcon = () => (
  <Icon size={18}>
    <path d="M9 18l6-6-6-6" />
  </Icon>
);
export const TrashIcon = () => (
  <Icon size={18}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </Icon>
);
export const CloseIcon = () => (
  <Icon>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
);
export const BackspaceIcon = () => (
  <Icon size={24}>
    <path d="M21 5H9l-6 7 6 7h12zM13 9l4 6M17 9l-4 6" />
  </Icon>
);
export const SearchIcon = () => (
  <Icon size={16}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </Icon>
);

export const HomeIcon = () => (
  <Icon size={22}>
    <path d="M3 11l9-8 9 8v9H3zM9 20v-6h6v6" />
  </Icon>
);
export const ListIcon = () => (
  <Icon size={22}>
    <path d="M8 6h13M8 12h13M8 18h13M3 6h1M3 12h1M3 18h1" />
  </Icon>
);
export const MeterIcon = () => (
  <Icon size={22}>
    <path d="M3 17h3V9H3zM9 17h3V5H9zM15 17h3v-6h-3z" />
    <path d="M3 21h18" />
  </Icon>
);
export const GridIcon = () => (
  <Icon size={22}>
    <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
  </Icon>
);
export const SlidersIcon = () => (
  <Icon size={22}>
    <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
    <path d="M16 4v6M8 14v6" />
  </Icon>
);
