import { BookShelf, workingShelves } from "./index";
import "./demo.css";

export default function App() {
  return (
    <main className="demo">
      <BookShelf shelves={workingShelves} />
    </main>
  );
}
