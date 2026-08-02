import type { CSSProperties } from "react";

export type BookShelfMotifKey =
  | "brackets"
  | "paths"
  | "caret"
  | "orbits"
  | "modules"
  | "frames"
  | "compass";

export interface BookShelfPalette {
  readonly paper: string;
  readonly paperDeep: string;
  readonly paperPale: string;
  readonly ink: string;
  readonly inkSoft: string;
  readonly wall: string;
  readonly shelf: string;
  readonly shelfDark: string;
  readonly light: string;
  readonly fill: string;
}

export interface BookShelfBook {
  readonly id: string;
  readonly title: string;
  readonly roman: string;
  readonly discipline: string;
  readonly note: string;
  readonly deck: string;
  readonly binding: string;
  readonly format: string;
  readonly theme: string;
  readonly motif: string;
  readonly motifKey: BookShelfMotifKey;
  readonly paletteLabel: string;
  readonly color: string;
  readonly foil: string;
  readonly palette: BookShelfPalette;
  readonly width: number;
  readonly height: number;
  readonly depth: number;
  readonly chapters: readonly [string, string, string];
  readonly seed: number;
}

/** Each outer item is one shelf; books retain their left-to-right order inside it. */
export type BookShelfShelves = readonly (readonly BookShelfBook[])[];

export interface BookShelfSelection {
  readonly index: number;
  readonly id: string;
  readonly title: string;
  readonly book: BookShelfBook;
}

export interface BookShelfHandle {
  previous: () => void;
  next: () => void;
  select: (index: number) => void;
  inspect: () => void;
  close: () => void;
  toggleBook: () => void;
  previousPage: () => void;
  nextPage: () => void;
  resetView: () => void;
}

export interface BookShelfProps {
  readonly shelves?: BookShelfShelves;
  readonly className?: string;
  readonly style?: CSSProperties;
  readonly title?: string;
  readonly "aria-label"?: string;
  readonly initialIndex?: number;
  readonly onReady?: () => void;
  readonly onSelectionChange?: (selection: BookShelfSelection) => void;
  readonly onDetailChange?: (open: boolean) => void;
  readonly onReadingChange?: (open: boolean) => void;
  readonly onError?: (message: string) => void;
}
