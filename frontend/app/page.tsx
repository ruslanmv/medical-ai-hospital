"use client";
import Link from "next/link";
import { ShieldCheck, Stethoscope, MessageSquareMore } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="grid gap-12">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-50 to-indigo-50 border">
        <div className="absolute inset-0 bg-[radial-gradient(45rem_45rem_at_120%_10%,rgba(56,189,248,0.2),transparent)]" />
        <div className="relative p-8 sm:p-14">
          <div className="max-w-3xl">
            <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight text-slate-900">
              Hospital AI —
              <span className="block text-slate-800 mt-2">Modern care, guided by intelligence</span>
            </h1>
            <p className="mt-5 text-slate-700 text-lg leading-relaxed">
              A secure patient portal where you can register, manage your medical profile, and chat with our AI intake assistant.
              Integrated with clinicians, built for privacy, and designed for outcomes.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg"><Link href="/register">Create account</Link></Button>
              <Button asChild size="lg" variant="outline"><Link href="/login">Sign in</Link></Button>
              <Button asChild size="lg" className="bg-indigo-600 hover:bg-indigo-500"><Link href="/chat">Try AI intake</Link></Button>
            </div>
            <div className="mt-6 text-sm text-slate-500">HIPAA-ready architecture • Enterprise-grade security • Built with clinicians</div>
          </div>
        </div>
      </section>

      {/* Value props */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { icon: <ShieldCheck className="h-6 w-6" />, title: "Security first", desc: "Encrypted at rest and in transit. Role-based access, audit trails, and privacy by design." },
          { icon: <Stethoscope className="h-6 w-6" />, title: "Clinical data", desc: "Update demographics, medications, allergies, appointments, and vitals in one secure place." },
          { icon: <MessageSquareMore className="h-6 w-6" />, title: "AI intake", desc: "Chat with an AI assistant that helps collect history and triage symptoms—then hands off to care teams." },
        ].map((c, i) => (
          <div key={i} className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-sky-100 text-sky-700">{c.icon}</div>
            <h3 className="mt-4 text-lg font-semibold text-slate-900">{c.title}</h3>
            <p className="mt-2 text-slate-600 leading-relaxed">{c.desc}</p>
          </div>
        ))}
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Patient uptime", value: "99.99%" },
          { label: "Avg. wait reduction", value: "-38%" },
          { label: "Secure sessions", value: "End-to-end" },
          { label: "AI-assisted triage", value: "24/7" },
        ].map((s, i) => (
          <div key={i} className="rounded-2xl border bg-white p-6 text-center">
            <div className="text-2xl font-semibold text-slate-900">{s.value}</div>
            <div className="mt-1 text-sm text-slate-500">{s.label}</div>
          </div>
        ))}
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden rounded-2xl border bg-white p-8">
        <div className="absolute inset-0 bg-[radial-gradient(60rem_60rem_at_-10%_-10%,rgba(99,102,241,0.07),transparent)]" />
        <div className="relative flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold text-slate-900">Start your AI-guided onboarding</h2>
            <p className="mt-2 text-slate-600">Create an account and complete your profile in minutes.</p>
          </div>
          <div className="flex gap-3">
            <Button asChild size="lg" className="bg-indigo-600 hover:bg-indigo-500"><Link href="/register">Get started</Link></Button>
            <Button asChild size="lg" variant="outline"><Link href="/login">I already have an account</Link></Button>
          </div>
        </div>
      </section>
    </div>
  );
}
