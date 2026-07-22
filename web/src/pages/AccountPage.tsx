import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authClient } from "../lib/auth-client";

const API_URL = import.meta.env.VITE_API_URL as string;

interface AccountInfo {
  email: string;
  entitlementStatus: "paid" | "unpaid";
  paidAt: string | null;
  freeSessionsRemaining: number;
}

export function AccountPage() {
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!isPending && !session) {
      navigate("/", { replace: true });
    }
  }, [isPending, session, navigate]);

  useEffect(() => {
    // A stale ?error=... can linger here if an earlier, unseen request already
    // consumed the single-use magic-link token (e.g. a browser link-prefetch)
    // before this tab's own verify request landed — the session is valid
    // either way, so the leftover error param is just noise. Clean it up.
    if (session && window.location.search) {
      navigate("/account", { replace: true });
    }
  }, [session, navigate]);

  useEffect(() => {
    if (!session) return;
    fetch(`${API_URL}/account/me`, { credentials: "include" })
      .then((res) => res.json())
      .then(setAccount);
  }, [session]);

  async function handleDelete() {
    setDeleting(true);
    try {
      await fetch(`${API_URL}/account`, { method: "DELETE", credentials: "include" });
      navigate("/", { replace: true });
    } finally {
      setDeleting(false);
    }
  }

  if (!account) {
    return (
      <main>
        <h1 className="title">Account</h1>
      </main>
    );
  }

  const statusText =
    account.entitlementStatus === "paid"
      ? `Unlocked — paid $29 on ${new Date(account.paidAt!).toLocaleDateString()}`
      : `${account.freeSessionsRemaining} free session${account.freeSessionsRemaining === 1 ? "" : "s"} left`;

  return (
    <main>
      <h1 className="title">Account</h1>
      <div className="profile-row">
        <span className="label">Email</span>
        <span>{account.email}</span>
      </div>
      <div className="profile-row">
        <span className="label">Status</span>
        <span>{statusText}</span>
      </div>

      <button className="btn" style={{ marginTop: 20 }} onClick={() => navigate("/practice")}>
        Start a practice session
      </button>

      {account.entitlementStatus === "unpaid" && (
        <button className="btn secondary" style={{ marginTop: 10 }} onClick={() => navigate("/paywall")}>
          Unlock unlimited — $29
        </button>
      )}

      <h2 className="subtitle-h">Manage account</h2>
      {!confirmingDelete ? (
        <button className="btn danger" onClick={() => setConfirmingDelete(true)}>
          Delete my account
        </button>
      ) : (
        <>
          <p className="fine" style={{ textAlign: "left" }}>
            This permanently removes every session, transcript, and feedback report tied to
            your account. This can't be undone.
          </p>
          <button className="btn danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Deleting..." : "Yes, permanently delete my account"}
          </button>
          <button
            className="btn secondary"
            style={{ marginTop: 10 }}
            onClick={() => setConfirmingDelete(false)}
          >
            Cancel
          </button>
        </>
      )}
    </main>
  );
}
