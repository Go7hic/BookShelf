import { BookShelf } from "./index";
import "./demo.css";

export default function App() {
  return (
    <main className="demo">
      <BookShelf shelfLevels={2} />
    </main>
  );
}
