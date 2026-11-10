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
