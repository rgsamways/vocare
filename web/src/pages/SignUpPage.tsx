import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authClient } from "../lib/auth-client";
import { detectDefaultCountry, listCountries } from "../lib/detect-country";

const API_URL = import.meta.env.VITE_API_URL as string;

export function SignUpPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [country, setCountry] = useState(detectDefaultCountry());
  const [acknowledged, setAcknowledged] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { data: session } = authClient.useSession();
  if (session) {
    navigate("/account", { replace: true });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!acknowledged) {
      setError("Please confirm you understand you're talking to an AI system.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/auth/pending-signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, dateOfBirth, country }),
      });
      const body = await res.json();
      if (!res.ok) {
        if (body.error === "below_minimum_age") {
          setError("You need to be 16 or older to use Vocare.");
        } else {
          setError("Something went wrong. Please check your details and try again.");
        }
        return;
      }

      await authClient.signIn.magicLink({
        email,
        callbackURL: `${window.location.origin}/account`,
      });
      setSent(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <main>
        <h1 className="title">Check your email</h1>
        <p className="subtitle">
          We sent a sign-in link to {email}. Click it to finish signing in — it expires in 5
          minutes and works once.
        </p>
      </main>
    );
  }

  return (
    <main>
      <h1 className="title">Practice out loud.</h1>
      <p className="subtitle">
        No score. No trivia. Just talk about what you've built, what you're doing, and what
        you want next — then see what came through, after.
      </p>

      {error && <div className="error-strip">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="dateOfBirth">Date of birth</label>
          <input
            id="dateOfBirth"
            type="date"
            required
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="country">Country</label>
          <select id="country" value={country} onChange={(e) => setCountry(e.target.value)}>
            {listCountries().map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <p className="fine" style={{ marginTop: "-10px", textAlign: "left" }}>
          Only used so we can point you to the right support resource if a conversation ever
          needs it — never for anything else.
        </p>

        <label className="checkline">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            style={{ marginTop: "2px" }}
          />
          <span>
            Vocare uses an AI system to hold the conversation — you'll always know when you're
            talking to it, not a person.
          </span>
        </label>

        <button className="btn" type="submit" disabled={submitting}>
          {submitting ? "Sending..." : "Send my sign-in link"}
        </button>
      </form>
      <div className="fine">
        No password. We'll email a secure link. 3 practice sessions free, then $29 once — not a
        subscription.
      </div>
    </main>
  );
}
