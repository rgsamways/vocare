import { useState } from "react";

const API_URL = import.meta.env.VITE_API_URL as string;

export function PaywallPage() {
  const [loading, setLoading] = useState(false);

  async function handleCheckout() {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/billing/checkout-session`, {
        method: "POST",
        credentials: "include",
      });
      const { url } = await res.json();
      window.location.href = url;
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <div className="used-strip">You've used all 3 free sessions.</div>
      <h1 className="title">Keep practicing</h1>
      <p className="subtitle">One payment. Yours for as long as you want it — not a monthly subscription.</p>

      <div className="paywall-card">
        <div className="price">
          $29 <small>once</small>
        </div>
        <div className="unlimited-line">
          Unlimited practice sessions, feedback after every one, progress over time.
        </div>
        <button className="btn" onClick={handleCheckout} disabled={loading}>
          {loading ? "Redirecting..." : "Continue to payment"}
        </button>
      </div>
      <div className="fine">
        All sales final — see our Terms of Service. Paid on the web either way; the Android app
        just checks your account, same as here.
      </div>
    </main>
  );
}
