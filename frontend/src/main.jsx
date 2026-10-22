import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./styles/light_theme/B_StyleClaro.css";
import "./styles/light_theme/B_styleHome.css";
import "./styles/light_theme/B_StyleLogin.css";
import "./styles/light_theme/B_stylePerfil.css";
import "./styles/light_theme/B_styleServicio.css";
import "./styles/light_theme/B_StyleChat.css";


ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
