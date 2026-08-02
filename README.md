# BookShelf React

`BookShelf` is a reusable React component that packages an original shelf DOM,
interaction model, procedural cover artwork, and Three.js scene inside a normal
React lifecycle. It supports multiple instances, custom book data, keyboard and
pointer input, and releases its WebGL resources when unmounted.

## Run the demo

```bash
npm install
npm run dev
```

## Basic usage

```tsx
import { BookShelf } from "bookshelf-react";
import "bookshelf-react/style.css";

export function Library() {
  return (
    <BookShelf
      title="Working Volumes"
      shelfLevels={2}
      style={{ height: "720px" }}
    />
  );
}
```

If `books` is omitted, the component uses the bundled `workingVolumes` data.

Each screen shows one horizontal carousel row. Wheel and vertical arrow input
move to the next shelf level. Set `shelfLevels={1}` to disable the vertical
level carousel and keep a single row.

`bookshelf-react` is the intended package name; the public component export is
`BookShelf`.

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `books` | `readonly BookShelfBook[]` | `workingVolumes` | Custom book collection. An empty array also falls back to the bundled collection. |
| `shelfLevels` | `number` | `1` | Number of horizontal shelf levels. Values above `1` arrange the collection across multiple levels. The value is normalized to an integer from `1` through `min(6, books.length)`. |
| `className` | `string` | — | Class name added to the root element. |
| `style` | `React.CSSProperties` | — | Inline styles added to the root element. Use this to define the component height. |
| `title` | `string` | — | Root title and fallback accessible name. |
| `aria-label` | `string` | `"Interactive bookshelf"` | Accessible name for the root element. |
| `initialIndex` | `number` | `0` | Zero-based initial book index. Values outside the collection are clamped to the first or last book. |
| `onReady` | `() => void` | — | Called after the WebGL scene is initialized. |
| `onSelectionChange` | `(selection) => void` | — | Called when the selected book changes. The argument is a `BookShelfSelection`. |
| `onDetailChange` | `(open: boolean) => void` | — | Called when the detail view opens or closes. |
| `onReadingChange` | `(open: boolean) => void` | — | Called when the current book opens or closes. |
| `onError` | `(message: string) => void` | — | Called when WebGL is unavailable, initialization fails, or the context is lost. The readable static catalog remains available as a fallback. |

With `shelfLevels={1}`, the original horizontal carousel is preserved. With more
than one level, the viewport focuses one row at a time. Wheel and vertical arrow
input moves between rows, while navigation still follows the flat zero-based
`books` order.

When generating `books` dynamically, use `useMemo` to keep the array reference
stable. This prevents a parent render from rebuilding the 3D scene.

## Custom books

```tsx
import { useMemo, useRef } from "react";
import {
  BookShelf,
  type BookShelfBook,
  type BookShelfHandle,
  workingVolumes,
} from "bookshelf-react";

export function CustomLibrary() {
  const shelf = useRef<BookShelfHandle>(null);
  const books = useMemo<readonly BookShelfBook[]>(
    () => workingVolumes.map((book, index) =>
      index === 0
        ? { ...book, title: "Studio Codex", note: "A custom React-provided volume." }
        : book,
    ),
    [],
  );

  return (
    <BookShelf
      ref={shelf}
      books={books}
      initialIndex={2}
      style={{ height: "720px" }}
      onSelectionChange={({ index, title, book }) => {
        console.log(index, title, book.motifKey);
      }}
      onReadingChange={(open) => console.log(open ? "reading" : "closed")}
    />
  );
}
```

`BookShelfBook` is the complete book data contract:

```ts
interface BookShelfBook {
  id: string;
  title: string;
  roman: string;
  discipline: string;
  note: string;
  deck: string;
  binding: string;
  format: string;
  theme: string;
  motif: string;
  motifKey: "brackets" | "paths" | "caret" | "orbits" | "modules" | "frames" | "compass";
  paletteLabel: string;
  color: string;
  foil: string;
  palette: BookShelfPalette;
  width: number;
  height: number;
  depth: number;
  chapters: readonly [string, string, string];
  seed: number;
}
```

`chapters` must contain exactly three labels. `motifKey` selects one of the
seven geometric motifs supported by the runtime. `BookShelfPalette`,
`BookShelfSelection`, and `BookShelfHandle` are also exported from the package
entry point.

## Imperative ref API

Use a ref to trigger navigation and reading actions from outside the component:

```tsx
const shelf = useRef<BookShelfHandle>(null);

shelf.current?.next();
shelf.current?.previous();
shelf.current?.select(3);      // Select the fourth book.
shelf.current?.inspect();     // Open the detail view.
shelf.current?.close();       // Close the detail view.
shelf.current?.toggleBook();  // Open or close the current book.
shelf.current?.previousPage();
shelf.current?.nextPage();
shelf.current?.resetView();
```

## Accessibility and fallback behavior

- The root supports `title`, `aria-label`, and keyboard focus.
- The book index uses `tablist` and `tab` semantics, and selection changes are announced through a live region.
- If WebGL is unavailable or the context is lost, the 3D scene is hidden and a readable static catalog remains visible.
- Multiple `BookShelf` instances can be mounted at the same time. Each instance owns an independent Three.js scene and interaction state.

## Origin and license

The editorial bookshelf idea was informed by the broader interactive-publishing
genre, including [MengTo/complete-shelf](https://github.com/MengTo/complete-shelf).
This repository does not contain code, generated runtime files, or image assets
from that project. Its Three.js runtime, geometry, interaction code, and
procedural Canvas cover art are authored in this repository.

BookShelf is released under the [MIT License](./LICENSE). Product names in the
included conceptual catalog are used editorially and remain the property of
their respective owners.

For Chinese documentation, see [README.zh-CN.md](./README.zh-CN.md).
