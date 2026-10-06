"use client";

import { useId, useState, type ReactNode } from "react";
import type { NdaData, Party } from "@/lib/nda";

type Props = {
  data: NdaData;
  onChange: (data: NdaData) => void;
};

const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none";

const YEAR_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 1);

function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="mb-3 text-xs font-semibold tracking-wide text-slate-500 uppercase">{title}</legend>
      {children}
    </fieldset>
  );
}

/** A term that is either a number of years or open-ended (null). */
function TermField({
  label,
  yearsLabel,
  openLabel,
  value,
  onChange,
}: {
  label: string;
  yearsLabel: string;
  openLabel: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  const name = useId();
  // Remember the last chosen number of years so toggling options doesn't lose it.
  const [lastYears, setLastYears] = useState(value ?? 1);

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="radio" name={name} checked={value !== null} onChange={() => onChange(lastYears)} />
        <select
          aria-label={`${label} in years`}
          value={value ?? lastYears}
          onChange={(e) => {
            const years = Number(e.target.value);
            setLastYears(years);
            onChange(years);
          }}
          className={`${inputClass} w-20`}
        >
          {YEAR_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        {yearsLabel}
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="radio" name={name} checked={value === null} onChange={() => onChange(null)} />
        {openLabel}
      </label>
    </div>
  );
}

function PartyFields({ party, onChange }: { party: Party; onChange: (party: Party) => void }) {
  const set = (key: keyof Party) => (e: { target: { value: string } }) =>
    onChange({ ...party, [key]: e.target.value });

  return (
    <>
      <Field label="Print name">
        <input className={inputClass} value={party.name} onChange={set("name")} />
      </Field>
      <Field label="Title">
        <input className={inputClass} value={party.title} onChange={set("title")} />
      </Field>
      <Field label="Company">
        <input className={inputClass} value={party.company} onChange={set("company")} />
      </Field>
      <Field label="Notice address" hint="Email or postal address">
        <textarea rows={2} className={inputClass} value={party.noticeAddress} onChange={set("noticeAddress")} />
      </Field>
    </>
  );
}

export default function NdaForm({ data, onChange }: Props) {
  const update = <K extends keyof NdaData>(key: K, value: NdaData[K]) => onChange({ ...data, [key]: value });

  return (
    <form className="space-y-8" onSubmit={(e) => e.preventDefault()}>
      <Section title="Agreement terms">
        <Field label="Purpose" hint="How Confidential Information may be used">
          <textarea
            rows={3}
            className={inputClass}
            value={data.purpose}
            onChange={(e) => update("purpose", e.target.value)}
          />
        </Field>

        <Field label="Effective date">
          <div className="flex gap-2">
            <input
              type="date"
              className={inputClass}
              value={data.effectiveDate}
              onChange={(e) => update("effectiveDate", e.target.value)}
            />
            <button
              type="button"
              onClick={() => update("effectiveDate", todayIso())}
              className="rounded-md border border-slate-300 px-3 text-sm text-slate-700 hover:bg-slate-50"
            >
              Today
            </button>
          </div>
        </Field>

        <TermField
          label="MNDA term"
          yearsLabel="year(s) from Effective Date"
          openLabel="Until terminated"
          value={data.mndaTermYears}
          onChange={(v) => update("mndaTermYears", v)}
        />

        <TermField
          label="Term of confidentiality"
          yearsLabel="year(s) from Effective Date"
          openLabel="In perpetuity"
          value={data.confidentialityYears}
          onChange={(v) => update("confidentialityYears", v)}
        />

        <Field label="Governing law" hint="State, e.g. Delaware">
          <input
            className={inputClass}
            value={data.governingLaw}
            onChange={(e) => update("governingLaw", e.target.value)}
          />
        </Field>

        <Field label="Jurisdiction" hint="City or county and state, e.g. courts located in New Castle, DE">
          <input
            className={inputClass}
            value={data.jurisdiction}
            onChange={(e) => update("jurisdiction", e.target.value)}
          />
        </Field>

        <Field label="MNDA modifications" hint="Optional">
          <textarea
            rows={3}
            className={inputClass}
            value={data.modifications}
            onChange={(e) => update("modifications", e.target.value)}
          />
        </Field>
      </Section>

      <Section title="Party 1">
        <PartyFields party={data.party1} onChange={(p) => update("party1", p)} />
      </Section>

      <Section title="Party 2">
        <PartyFields party={data.party2} onChange={(p) => update("party2", p)} />
      </Section>
    </form>
  );
}
