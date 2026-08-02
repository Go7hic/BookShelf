import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  type CSSProperties,
  type PointerEvent,
} from "react";
import { workingShelves } from "../data/workingVolumes";
import { createBookShelfRuntime, type BookShelfRuntimeController } from "../runtime/createBookShelfRuntime";
import type {
  BookShelfBook,
  BookShelfHandle,
  BookShelfProps,
  BookShelfShelves,
  BookShelfSelection,
} from "./BookShelf.types";
import "./BookShelf.css";

type FallbackBookStyle = CSSProperties & {
  "--book-color": string;
  "--book-foil": string;
  "--book-height": string;
};

function getFallbackBookStyle(book: BookShelfBook): FallbackBookStyle {
  return {
    "--book-color": book.color,
    "--book-foil": book.foil,
    "--book-height": `${Math.round(book.height * 240)}px`,
  };
}

export const BookShelf = forwardRef<BookShelfHandle, BookShelfProps>(
  function BookShelf(
    {
      shelves,
      className,
      style,
      title,
      "aria-label": ariaLabel,
      initialIndex = 0,
      onReady,
      onSelectionChange,
      onDetailChange,
      onReadingChange,
      onError,
    },
    forwardedRef,
  ) {
    const rootRef = useRef<HTMLElement>(null);
    const controllerRef = useRef<BookShelfRuntimeController | null>(null);
    const resolvedShelves = useMemo<readonly (readonly BookShelfBook[])[]>(() => {
      const configured = shelves?.filter((shelf) => shelf.length > 0);
      return configured?.length ? configured : workingShelves;
    }, [shelves]);
    const resolvedBooks = useMemo(() => resolvedShelves.flat(), [resolvedShelves]);
    const firstIndex = Math.min(Math.max(Math.trunc(initialIndex), 0), resolvedBooks.length - 1);
    const firstBook = resolvedBooks[firstIndex];
    const id = useId();
    const detailTitleId = `${id}-detail-title`;
    const fallbackTitleId = `${id}-fallback-title`;
    const callbacksRef = useRef({
      onReady,
      onSelectionChange,
      onDetailChange,
      onReadingChange,
      onError,
    });

    callbacksRef.current = {
      onReady,
      onSelectionChange,
      onDetailChange,
      onReadingChange,
      onError,
    };

    useImperativeHandle(
      forwardedRef,
      () => ({
        previous: () => controllerRef.current?.previous(),
        next: () => controllerRef.current?.next(),
        select: (index) => controllerRef.current?.select(index),
        inspect: () => controllerRef.current?.inspect(),
        close: () => controllerRef.current?.close(),
        toggleBook: () => controllerRef.current?.toggleBook(),
        previousPage: () => controllerRef.current?.previousPage(),
        nextPage: () => controllerRef.current?.nextPage(),
        resetView: () => controllerRef.current?.resetView(),
      }),
      [],
    );

    useEffect(() => {
      const root = rootRef.current;
      if (!root) return;
      let active = true;

      const controller = createBookShelfRuntime(root, {
        shelves: resolvedShelves,
        initialIndex,
        onReady: () => active && callbacksRef.current.onReady?.(),
        onSelectionChange: (selection) => active && callbacksRef.current.onSelectionChange?.(selection),
        onDetailChange: (open) => active && callbacksRef.current.onDetailChange?.(open),
        onReadingChange: (open) => active && callbacksRef.current.onReadingChange?.(open),
        onError: (message) => active && callbacksRef.current.onError?.(message),
      });
      controllerRef.current = controller;
      void controller.ready.catch(() => undefined);

      return () => {
        active = false;
        controller.destroy();
        if (controllerRef.current === controller) controllerRef.current = null;
      };
    }, [initialIndex, resolvedBooks, resolvedShelves]);

    const rootClassName = ["complete-shelf", "experience", className]
      .filter(Boolean)
      .join(" ");

    function focusShelf(event: PointerEvent<HTMLElement>) {
      if (event.target instanceof Element && event.target.closest("button")) return;
      event.currentTarget.focus({ preventScroll: true });
    }

    return (
      <section
        ref={rootRef}
        className={rootClassName}
        style={style}
        title={title}
        aria-label={ariaLabel ?? title ?? "Interactive bookshelf"}
        tabIndex={0}
        onPointerDown={focusShelf}
      >
        <div className="scene-shell">
          <canvas data-shelf="scene" aria-hidden="true" />
        </div>

        <header className="editorial-header" aria-label="Collection">
          <div className="editorial-identity">
            <strong>Working Volumes</strong>
            <span>{resolvedBooks.length} field guides for making</span>
          </div>
          <div className="editorial-index">
            <span>Edition 02 · 2026</span>
            <span data-shelf="palette-label">{firstBook.paletteLabel}</span>
            <span className="shelf-level-counter" data-shelf="level-counter" aria-live="polite" />
          </div>
        </header>

        <div className="pointer-label" data-shelf="pointer-label" aria-hidden="true">
          <span data-shelf="pointer-label-index">Volume {String(firstIndex + 1).padStart(2, "0")}</span>
          <strong data-shelf="pointer-label-title">{firstBook.title}</strong>
        </div>

        <section className="browse-ui" data-shelf="browse-ui" aria-label="Shelf navigation">
          <div className="selection">
            <span className="counter" data-shelf="counter">
              {String(firstIndex + 1).padStart(2, "0")} / {String(resolvedBooks.length).padStart(2, "0")}
            </span>
            <div className="selection__copy">
              <h1 className="selection__title" data-shelf="selection-title">{firstBook.title}</h1>
              <p className="selection__note" data-shelf="selection-note">
                {firstBook.note}
              </p>
            </div>
          </div>

          <div className="browse-actions">
            <button className="round-button" data-shelf="previous" type="button" aria-label="Previous volume">
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m10.5 3.5-4.5 4.5 4.5 4.5" /></svg>
            </button>
            <button className="text-button" data-shelf="inspect" type="button">Open</button>
            <button className="round-button" data-shelf="next" type="button" aria-label="Next volume">
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m5.5 3.5 4.5 4.5-4.5 4.5" /></svg>
            </button>
          </div>

          <nav className="index-nav" aria-label="Volume index">
            <div className="markers" data-shelf="markers" role="tablist" aria-label="Choose a volume" />
            <p className="microcopy">Wheel · arrows · select</p>
          </nav>
        </section>

        <aside
          className="detail-panel"
          data-shelf="detail-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby={detailTitleId}
          aria-hidden="true"
          inert
        >
          <button className="close-button" data-shelf="close-detail" type="button" aria-label="Return volume to shelf">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" /></svg>
          </button>
          <p className="eyebrow" data-shelf="detail-eyebrow">Volume {firstBook.roman} · {firstBook.discipline}</p>
          <h2 className="detail-title" id={detailTitleId} data-shelf="detail-title">{firstBook.title}</h2>
          <p className="detail-deck" data-shelf="detail-deck">
            {firstBook.deck}
          </p>
          <dl className="meta-list">
            <div><dt>Binding</dt><dd data-shelf="detail-binding">{firstBook.binding}</dd></div>
            <div><dt>Format</dt><dd data-shelf="detail-format">{firstBook.format}</dd></div>
            <div><dt>Theme</dt><dd data-shelf="detail-theme">{firstBook.theme}</dd></div>
            <div><dt>Motif</dt><dd data-shelf="detail-motif">{firstBook.motif}</dd></div>
          </dl>
          <div className="page-navigation" role="group" aria-label="Browse sample pages">
            <button className="page-button" data-shelf="previous-page" type="button" aria-label="Previous sample page" disabled>
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m10.5 3.5-4.5 4.5 4.5 4.5" /></svg>
            </button>
            <p className="page-status" aria-live="off">
              <strong data-shelf="page-label">Closed</strong>
              <span data-shelf="page-counter">Click book to open</span>
            </p>
            <button className="page-button" data-shelf="next-page" type="button" aria-label="Next sample page" disabled>
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m5.5 3.5 4.5 4.5-4.5 4.5" /></svg>
            </button>
          </div>
          <div className="detail-controls">
            <p className="microcopy">Drag cover or click once to open · Background to orbit</p>
            <div className="detail-buttons">
              <button className="text-button reset-button" data-shelf="toggle-book" type="button" aria-pressed="false">Open book</button>
              <button className="text-button reset-button" data-shelf="reset-view" type="button">Reset view</button>
            </div>
          </div>
        </aside>

        <div className="sr-only" data-shelf="live-region" aria-live="polite" />

        <section className="static-fallback" aria-labelledby={fallbackTitleId}>
          <div className="fallback__header">
            <div>
              <p className="fallback__kicker">Working Volumes · Static catalog</p>
              <h2 id={fallbackTitleId}>{resolvedBooks.length} tools for making.</h2>
            </div>
            <p className="fallback__status" data-shelf="fallback-status">
              The complete catalog remains readable while the interactive shelf is prepared.
            </p>
          </div>
          <div className="fallback__grid" aria-label={`${resolvedBooks.length} conceptual hardcovers`}>
            {resolvedBooks.map((book) => (
              <article className="fallback-book" key={book.id} style={getFallbackBookStyle(book)}>
                <span>Volume {book.roman}</span>
                <strong>{book.title}</strong>
              </article>
            ))}
          </div>
          <div className="fallback__footer">
            <span>All bindings, motifs, descriptions, geometry, and cover artworks are original to this conceptual study.</span>
            <span>Product names are used editorially and remain the property of their respective owners.</span>
          </div>
        </section>

        <div className="loading" data-shelf="loading" hidden aria-live="polite">
          <div className="loading__inner">
            <div className="loading__mark" aria-hidden="true" />
            <p>Binding the collection</p>
          </div>
        </div>
      </section>
    );
  },
);

export type {
  BookShelfBook,
  BookShelfHandle,
  BookShelfMotifKey,
  BookShelfPalette,
  BookShelfProps,
  BookShelfShelves,
  BookShelfSelection,
} from "./BookShelf.types";
