import React from "react";
import { createRoot } from "react-dom/client";
import { unmarshal } from "@tmark/tmark";
import { TmarkView } from "@tmark/react";
import "@tmark/react/style.css";

const examplesBase = "https://tmark.waus.app/examples/";
const examples = [
  "all_widgets.tmark",
  "edge_cases.tmark",
  "edge_empties.tmark",
  "inline_formatting.tmark",
  "lists_and_tasks.tmark",
  "maps_and_events.tmark",
  "math_and_code.tmark",
  "media_formats.tmark",
  "media_gallery.tmark",
  "quotes_and_details.tmark",
  "references_and_anchors.tmark",
  "tables.tmark",
];

function App() {
  const [docs, setDocs] = React.useState([]);
  const [active, setActive] = React.useState(0);
  const [error, setError] = React.useState(null);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [view, setView] = React.useState("render");

  React.useEffect(() => {
    Promise.all(examples.map(loadExample)).then(setDocs).catch(setError);
  }, []);

  if (error) return <main className="content">{String(error)}</main>;
  if (!docs.length) return <main className="content">Loading...</main>;

  return (
    <div className="app" data-view={view}>
      <header className="mobile-header">
        <button
          type="button"
          className="menu-toggle"
          aria-label={menuOpen ? "Close document list" : "Open document list"}
          aria-controls="document-list"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <span className="menu-icon" aria-hidden="true"><span /><span /><span /></span>
        </button>
        <span className="mobile-title">{docs[active].document.title}</span>
        <button
          type="button"
          className="view-toggle"
          onClick={() => setView(view === "render" ? "source" : "render")}
        >
          {view === "render" ? "Source" : "Render"}
        </button>
      </header>
      {menuOpen && <button type="button" className="menu-backdrop" aria-label="Close document list" onClick={() => setMenuOpen(false)} />}
      <nav id="document-list" className={`tabs${menuOpen ? " tabs-open" : ""}`} aria-label="Documents">
        {docs.map((doc, index) => (
          <button
            type="button"
            key={doc.path}
            className={index === active ? "active" : ""}
            aria-current={index === active ? "page" : undefined}
            onClick={() => { setActive(index); setMenuOpen(false); }}
          >
            {doc.document.title}
          </button>
        ))}
      </nav>
      <main className="content">
        <TmarkView value={docs[active].document} className="document" />
      </main>
      <aside className="source" aria-label="Document source">
        <pre className="source-code"><code>{docs[active].source}</code></pre>
      </aside>
    </div>
  );
}

async function loadExample(path) {
  const response = await fetch(`${examplesBase}${path}`);
  if (!response.ok) throw new Error(`Cannot load ${path}: HTTP ${response.status}`);

  const source = await response.text();
  const document = unmarshal(source, { soft: true });
  if (document.kind !== "document") throw new Error("Expected an example document");
  return { path, source, document };
}

createRoot(document.getElementById("root")).render(<App />);
