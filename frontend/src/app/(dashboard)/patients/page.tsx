import { SearchSlash, UsersRound } from "lucide-react";

import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";

export default function PatientsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Patients"
        description="Review patient enrichment, compare cohort fit, and queue document uploads before running full digital twin simulations."
      />

      <section className="overflow-hidden rounded-[2rem] border border-border/70 bg-card/60">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <tr>
                <th className="sticky left-0 bg-muted/50 px-5 py-4">Patient</th>
                <th className="px-5 py-4">Primary Diagnosis</th>
                <th className="px-5 py-4">Pre-Screen Score</th>
                <th className="px-5 py-4">Risk Level</th>
                <th className="px-5 py-4">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="sticky left-0 bg-card/90 px-5 py-8" colSpan={5}>
                  <EmptyState
                    icon={UsersRound}
                    title="No patients screened yet"
                    description="The screening table will populate after patient source records and uploaded documents have been enriched into structured labs, conditions, and medication histories."
                    action={
                      <div className="inline-flex items-center gap-2 rounded-full border border-border/70 px-3 py-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        <SearchSlash className="h-4 w-4" />
                        Empty table placeholder
                      </div>
                    }
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
