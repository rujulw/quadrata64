import { Link, useLocation, useNavigate } from "react-router-dom";

export function NavBar() {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: "/", label: "home" },
    { path: "/play", label: "play" },
    { path: "/analyzer", label: "analyzer" },
    { path: "/settings", label: "settings" },
  ] as const;

  const handleNav = (path: string) => {
    navigate(path);
  };

  return (
    <nav className="fixed inset-x-0 top-0 z-50 h-20 bg-black">
      <div className="mx-auto grid h-full w-full max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-5 sm:px-8">
        <Link to="/" className="title-display justify-self-start text-2xl font-bold tracking-tight lowercase">
          quadrata64.
        </Link>

        <div className="flex items-center gap-6 text-sm font-medium lowercase text-app-text-muted sm:gap-8">
          {navItems.map((item) => (
            <button
              key={item.path}
              type="button"
              onClick={() => handleNav(item.path)}
              className={
                location.pathname === item.path
                  ? "text-app-purple-soft"
                  : "text-app-text-muted transition-colors hover:text-white"
              }
            >
              {item.label}
            </button>
          ))}
        </div>

        <div aria-hidden="true" className="justify-self-end" />
      </div>
    </nav>
  );
}
