import { Outlet } from "react-router-dom";
import { NavBar } from "./components/layout/NavBar";

export default function App() {
  return (
    <>
      <NavBar />

      <main className="min-h-screen pt-20">
        <Outlet />
      </main>
    </>
  );
}
