import "./styles.css";
import { EditorApp } from "./ui/EditorApp";

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  throw new Error("Missing #app root.");
}

new EditorApp(root);
