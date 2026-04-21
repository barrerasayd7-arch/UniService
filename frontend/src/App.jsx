import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./Pages/Login.jsx";
import HomeGuest from "./Pages/HomeGuest.jsx";
import HomePrincipal from "./Pages/HomePrincipal.jsx";
import Servicio from "./Pages/Servicio.jsx";
import PrivacyPage from "./Pages/Privacy.jsx";
import TermsPage from "./Pages/Terms.jsx";
import PerfilExterno from "./Pages/PerfilExterno.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"            element={<Navigate to="/home-guest" />} />
        <Route path="/login"       element={<Login />} />
        <Route path="/home-guest"  element={<HomeGuest />} />
        <Route path="/home"        element={<HomePrincipal />} />
        <Route path="/servicio"    element={<Servicio />} />
        <Route path="/privacidad"  element={<PrivacyPage />} />
        <Route path="/terminos"    element={<TermsPage />} />
        <Route path="/perfil/:id"  element={<PerfilExterno />} />
      </Routes>
    </BrowserRouter>
  );
}
