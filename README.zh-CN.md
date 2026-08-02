 React

`BookShelf` 是一个可复用的 React 组件：将原创 DOM、交互、程序化封面素材和
Three.js 3D 场景封装在组件生命周期内。它支持多实例渲染、自定义书目、键盘/鼠标操作，
并在卸载时自动释放 WebGL 资源。

## 运行 Demo

```bash
npm install
npm run dev
```

## 基础用法

```tsx
import { BookShelf, workingShelves } from "bookshelf-react";
import "bookshelf-react/style.css";

export function Library() {
  return (
    <BookShelf shelves={workingShelves} style={{ height: "720px" }} />
  );
}
```

`shelves` 是唯一的书目输入。它是嵌套数组：外层每一项代表一层书架，内层数组按从左到右的顺序放置该层书籍。未传入（或全部为空）时，组件会使用内置的 `workingShelves`。

每一屏只显示一层横向轮播，滚轮和上下方向键在明确配置的层之间切换；左右操作只会切换当前层中的书。

计划发布的 npm 包名为 `bookshelf-react`，公开导出的组件名是 `BookShelf`。

## 参数属性

| 属性 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `shelves` | `BookShelfShelves` | `workingShelves` | 明确的分层书目数据。每个外层数组是一层书架，内层数组决定该层从左到右的书籍。空层会被忽略。 |
| `className` | `string` | — | 添加到组件根节点的 class。 |
| `style` | `React.CSSProperties` | — | 添加到组件根节点的内联样式，通常用于设置高度。 |
| `title` | `string` | — | 组件标题，同时会作为无障碍标签的备用值。 |
| `aria-label` | `string` | `"Interactive bookshelf"` | 组件根节点的无障碍名称。 |
| `initialIndex` | `number` | `0` | 初始选中书目，使用从 `0` 开始的索引；超出范围会自动限制到首尾。 |
| `onReady` | `() => void` | — | WebGL 场景初始化完成后调用。 |
| `onSelectionChange` | `(selection) => void` | — | 当前书目改变时调用，参数见 `BookShelfSelection`。 |
| `onDetailChange` | `(open: boolean) => void` | — | 详情视图打开或关闭时调用。 |
| `onReadingChange` | `(open: boolean) => void` | — | 当前书籍打开或关闭时调用。 |
| `onError` | `(message: string) => void` | — | WebGL 不可用、初始化失败或上下文丢失时调用；组件会保留静态目录作为 fallback。 |

组件不会再自动把扁平书目拆分到各层：只需要一个内层数组就是单层横向书架；增加外层数组即可增加层数。动态生成 `shelves` 时，建议用 `useMemo` 保持数组引用稳定，避免父组件每次渲染都重建 3D 场景。

## 自定义书架

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
        { ...workingShelves[0][0], title: "Studio Codex", note: "第一层的第一本书。" },
        workingShelves[0][1],
      ],
      [workingShelves[1][0], workingShelves[1][1], workingShelves[1][2]],
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

`BookShelfShelves` 的类型为 `readonly (readonly BookShelfBook[])[]`。`BookShelfBook` 是完整的书目数据契约，包含以下字段：

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

其中 `chapters` 必须是三个元素的元组；`motifKey` 决定书籍使用的几何装饰主题。
完整类型还包括 `BookShelfPalette`、`BookShelfSelection` 和 `BookShelfHandle`，均可从包入口导入。

## Ref 控制

通过 `ref` 可以从外部触发导航和阅读操作：

```tsx
const shelf = useRef<BookShelfHandle>(null);

shelf.current?.next();          // 下一本
shelf.current?.previous();      // 上一本
shelf.current?.select(3);       // 选择第 4 本（索引从 0 开始）
shelf.current?.inspect();       // 打开详情视图
shelf.current?.close();         // 关闭详情视图
shelf.current?.toggleBook();    // 打开/关闭当前书籍
shelf.current?.previousPage();  // 上一页
shelf.current?.nextPage();      // 下一页
shelf.current?.resetView();     // 重置详情视角
```

## 无障碍与降级行为

- 根节点支持 `title`、`aria-label` 和键盘焦点。
- 书目索引使用 tablist/tab 语义，选择变化会写入 live region。
- WebGL 不可用或上下文丢失时，组件会隐藏 3D 场景并显示可读的静态书目目录。
- 多个 `BookShelf` 可以同时挂载，每个实例拥有独立的 Three.js 场景和交互状态。

## 灵感与许可证

本项目的编辑式书架概念参考了交互出版类作品（包括
[MengTo/complete-shelf](https://github.com/MengTo/complete-shelf)），但本仓库不包含该项目的代码、生成运行时或图片素材。Three.js 运行时、几何体、交互和 Canvas 程序化封面均由本仓库原创实现。

BookShelf 以 [MIT 协议](./LICENSE) 发布。示例目录中的产品名称仅作编辑性使用，其权利仍归各自所有者。
