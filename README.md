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
import { BookShelf, workingShelves } from "bookshelf-react";
import "bookshelf-react/style.css";

export function Library() {
  return (
    <BookShelf shelves={workingShelves} style={{ height: "720px" }} />
  );
}
```

`shelves` is the only collection input. It is a nested array: each outer item
is one shelf, and the books inside it are displayed from left to right. When it
is omitted (or contains no books), the component uses bundled `workingShelves`:
the original seven-book row, unchanged in order, layout, and artwork.

Each screen shows one horizontal carousel row. Wheel and vertical arrow input
move between the explicit shelf arrays; left/right input only changes the book
inside the current shelf.

`bookshelf-react` is the intended package name; the public component export is
`BookShelf`.

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `shelves` | `BookShelfShelves` | `workingShelves` | Explicit shelf data. Every outer array is a shelf; each inner array controls that shelf’s left-to-right books. Empty shelves are ignored. |
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

The component never auto-distributes books between levels. Use one nested array
for a single horizontal shelf, or add more arrays for more shelves. Keep the
`shelves` reference stable with `useMemo` when it is generated dynamically.

## Custom shelves

```tsx
import { useMemo, useRef } from "react";
import {
  BookShelf,
  type BookShelfBook,
  type BookShelfHandle,
  workingShelves,
} from "bookshelf-react";

export function CustomLibrary() {
  const shelf = useRef<BookShelfHandle>(null);
  const shelves = useMemo<readonly (readonly BookShelfBook[])[]>(
    () => [
      [
        { ...workingShelves[0][0], title: "Studio Codex", note: "First book on shelf one." },
        workingShelves[0][1],
      ],
      [workingShelves[0][2], workingShelves[0][3], workingShelves[0][4]],
    ],
    [],
  );

  return (
    <BookShelf
      ref={shelf}
      shelves={shelves}
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

`BookShelfShelves` is `readonly (readonly BookShelfBook[])[]`. `BookShelfBook`
is the complete book data contract:

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

## license

BookShelf is released under the [MIT License](./LICENSE). Product names in the
included conceptual catalog are used editorially and remain the property of
their respective owners.

For Chinese documentation, see [README.zh-CN.md](./README.zh-CN.md).
