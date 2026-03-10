import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { ArrowRight, BrainCircuit, FileSearch, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";

import { HomeRedirect } from "@/components/auth/HomeRedirect";
import { buttonVariants } from "@/components/ui/button-variants";
import { ROUTES } from "@/constants/routes";

export const dynamic = "force-dynamic";

const featureCards = [
  {
    icon: FileSearch,
    title: "Protocol extraction",
    description: "Stage PDF uploads and turn eligibility clauses into reviewable criterion rules.",
  },
  {
    icon: BrainCircuit,
    title: "Digital twin simulation",
    description: "Project patient trajectories forward and inspect the margin to likely eligibility failure.",
  },
  {
    icon: ShieldCheck,
    title: "Reasoning trace review",
    description: "Audit risk factors, confidence notes, and next-step suggestions before a coordinator acts.",
  },
] as const;

export default async function HomePage() {
  const { userId } = await auth();

  if (userId) {
    redirect(ROUTES.PROTOCOLS);
  }

  return (
    <main className="relative overflow-hidden">
      <HomeRedirect />
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col justify-center px-6 py-20">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <section className="space-y-8">
            <div className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs uppercase tracking-[0.32em] text-cyan-200/80">
              Patient Digital Twin for Clinical Trials
            </div>
            <div className="space-y-5">
              <h1 className="max-w-4xl text-5xl font-semibold tracking-tight text-foreground sm:text-6xl">
                Simulate eligibility before patients ever reach manual review.
              </h1>
              <p className="max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
                Coordinators can upload protocols, pre-screen patient cohorts, and inspect forward-looking
                risk traces from AI-assisted patient twins in one dark operations console.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href={ROUTES.SIGN_IN} className={buttonVariants({ size: "lg" })}>
                Enter Workspace
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href={ROUTES.SIGN_UP} className={buttonVariants({ size: "lg", variant: "outline" })}>
                Create Coordinator Access
              </Link>
            </div>
          </section>

          <section className="glass-panel rounded-[2rem] p-6 shadow-[0_40px_140px_rgba(0,0,0,0.4)]">
            <div className="grid gap-4">
              {featureCards.map(({ icon: Icon, title, description }) => (
                <div
                  key={title}
                  className="rounded-[1.5rem] border border-border/70 bg-background/40 p-5 transition-transform duration-300 hover:-translate-y-1"
                >
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h2 className="text-lg font-semibold text-foreground">{title}</h2>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">{description}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
