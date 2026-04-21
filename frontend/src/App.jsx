import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./Pages/Login.jsx";
import HomeGuest from "./Pages/HomeGuest.jsx";
import HomePrincipal from "./Pages/HomePrincipal.jsx";
import Servicio from "./Pages/Servicio.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"            element={<Navigate to="/login" />} />
        <Route path="/login"       element={<Login />} />
        <Route path="/home-guest"  element={<HomeGuest />} />
        <Route path="/home"        element={<HomePrincipal />} />
        <Route path="/servicio" element={<Servicio />} />
      </Routes>
    </BrowserRouter>
  );
}