import { useEffect, useRef, useState } from "react";

interface SegmentedDateInputProps {
  id?: string;
  value: string;
  onChange: (isoDate: string) => void;
}

// Positional MM/DD/YYYY boxes, not a single typed string — sidesteps the
// locale ambiguity a free-text date field would have (this app has an
// international user base via the Country field, and MM/DD vs DD/MM
// mistakes on a birth date are exactly the kind of silent, hard-to-catch
// error worth designing away rather than validating after the fact).
function isRealDate(month: string, day: string, year: string) {
  const m = Number(month);
  const d = Number(day);
  const y = Number(year);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

export function SegmentedDateInput({ id, value, onChange }: SegmentedDateInputProps) {
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");
  const [year, setYear] = useState("");

  const monthRef = useRef<HTMLInputElement>(null);
  const dayRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);

  // Sync from a parent-supplied value (e.g. a pre-filled draft) without
  // fighting the user's own typing — only runs when the prop itself changes.
  useEffect(() => {
    if (!value) return;
    const [y, m, d] = value.split("-");
    if (y?.length === 4 && m?.length === 2 && d?.length === 2) {
      setYear(y);
      setMonth(m);
      setDay(d);
    }
  }, [value]);

  function commit(m: string, d: string, y: string) {
    if (m.length === 2 && d.length === 2 && y.length === 4 && isRealDate(m, d, y)) {
      onChange(`${y}-${m}-${d}`);
    } else {
      onChange("");
    }
  }

  function digitsOnly(raw: string, maxLength: number) {
    return raw.replace(/\D/g, "").slice(0, maxLength);
  }

  return (
    <div className="segmented-date" id={id}>
      <input
        ref={monthRef}
        type="text"
        inputMode="numeric"
        placeholder="MM"
        aria-label="Month of birth"
        maxLength={2}
        value={month}
        onChange={(e) => {
          const v = digitsOnly(e.target.value, 2);
          setMonth(v);
          commit(v, day, year);
          if (v.length === 2) dayRef.current?.focus();
        }}
      />
      <span className="segmented-date-sep">/</span>
      <input
        ref={dayRef}
        type="text"
        inputMode="numeric"
        placeholder="DD"
        aria-label="Day of birth"
        maxLength={2}
        value={day}
        onChange={(e) => {
          const v = digitsOnly(e.target.value, 2);
          setDay(v);
          commit(month, v, year);
          if (v.length === 2) yearRef.current?.focus();
        }}
        onKeyDown={(e) => {
          if (e.key === "Backspace" && day === "") monthRef.current?.focus();
        }}
      />
      <span className="segmented-date-sep">/</span>
      <input
        ref={yearRef}
        type="text"
        inputMode="numeric"
        placeholder="YYYY"
        aria-label="Year of birth"
        className="segmented-date-year"
        maxLength={4}
        value={year}
        onChange={(e) => {
          const v = digitsOnly(e.target.value, 4);
          setYear(v);
          commit(month, day, v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Backspace" && year === "") dayRef.current?.focus();
        }}
      />
    </div>
  );
}
