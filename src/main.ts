import "./styles.css";
import { ClientApp } from "./ui/ClientApp";
import { EditorApp } from "./ui/EditorApp";

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  throw new Error("Missing #app root.");
}

const view = new URLSearchParams(window.location.search).get("view");
if (view === "game") {
  document.title = "Craft Heroes";
  new ClientApp(root);
} else {
  new EditorApp(root);
}
