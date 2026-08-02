import type { BookShelfShelves, BookShelfSelection } from "../components/BookShelf.types";

export interface BookShelfRuntimeOptions {
  readonly shelves?: BookShelfShelves;
  readonly initialIndex?: number;
  readonly onReady?: () => void;
  readonly onSelectionChange?: (selection: BookShelfSelection) => void;
  readonly onDetailChange?: (open: boolean) => void;
  readonly onReadingChange?: (open: boolean) => void;
  readonly onError?: (message: string) => void;
}

export interface BookShelfRuntimeController {
  readonly ready: Promise<void>;
  previous: () => void;
  next: () => void;
  select: (index: number) => void;
  inspect: () => void;
  close: () => void;
  toggleBook: () => void;
  previousPage: () => void;
  nextPage: () => void;
  resetView: () => void;
  destroy: () => void;
}

export function createBookShelfRuntime(
  experience: HTMLElement,
  options?: BookShelfRuntimeOptions,
): BookShelfRuntimeController;
