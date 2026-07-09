import "./styles.css";
import { EditorApp } from "./ui/EditorApp";

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  throw new Error("Missing #app root.");
}

const view = new URLSearchParams(window.location.search).get("view");
if (view === "game") {
  window.location.replace(new URL("client.html", window.location.href));
} else {
  new EditorApp(root);
}
