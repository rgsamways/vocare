import { useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { authClient } from "../lib/auth-client";

const TABS = [
  { to: "/practice", label: "Conversation" },
  { to: "/feedback", label: "Feedback" },
  { to: "/progress", label: "Progress & Anchors" },
  { to: "/account", label: "Profile" },
];

export function AppShell() {
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (!isPending && !session) {
      navigate("/", { replace: true });
    }
  }, [isPending, session, navigate]);

  if (!isPending && !session) {
    return null;
  }

  return (
    <>
      <header className="appbar">
        <div className="brand-lockup">
          <svg width="10.5" height="13.5" viewBox="6 -2 34 42" fill="none">
            <path d="M12 2C12 2 34 10 34 19C34 28 12 36 12 36" stroke="#3f5d54" strokeWidth="4" strokeLinecap="round" />
            <circle cx="12" cy="2" r="2" fill="#3f5d54" />
            <circle cx="12" cy="36" r="2" fill="#3f5d54" />
            <path d="M18 9C18 9 29 14 29 19C29 24 18 29 18 29" stroke="#3f5d54" strokeWidth="3.4" strokeLinecap="round" opacity="0.6" />
          </svg>
          <span className="wordmark">vocare</span>
        </div>
      </header>

      <Outlet />

      <nav className="tabbar">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) => `tab${isActive ? " active" : ""}`}
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
