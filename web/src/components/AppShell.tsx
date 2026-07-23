import { useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { authClient } from "../lib/auth-client";
import { AppHeader } from "./AppHeader";

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
      <AppHeader />

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
