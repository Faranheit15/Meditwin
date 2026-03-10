import { FlaskConical, Radar } from "lucide-react";

import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";

interface SimulationPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function SimulationPage({ params }: SimulationPageProps) {
  const { id } = await params;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Simulation Results"
        description={`Simulation run ${id} will show week-by-week criterion evaluations, projected values, and reasoning traces once the execution pipeline is wired.`}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-[2rem] border border-border/70 bg-card/60 p-6 lg:col-span-2">
          <EmptyState
            icon={Radar}
            title="Run a simulation to see results"
            description="This grid will render compatibility scores, risk summaries, and timepoint-level pass or fail trajectories across the study schedule."
          />
        </div>
        <div className="rounded-[2rem] border border-border/70 bg-card/60 p-6">
          <div className="flex h-full flex-col justify-between gap-6">
            <div className="space-y-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-200">
                <FlaskConical className="h-6 w-6" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">Reasoning trace panel</h2>
              <p className="text-sm leading-7 text-muted-foreground">
                Borderline criteria will surface the why behind projected risk with evidence notes and suggested
                coordinator actions.
              </p>
            </div>
            <div className="rounded-3xl border border-dashed border-border/70 p-5 text-sm text-muted-foreground">
              Placeholder blocks for reasoning explanation, risk factors, and confidence notes.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
