import { FileUp, Sparkles } from "lucide-react";

import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";

export default function ProtocolsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Protocols"
        description="Upload a trial protocol, inspect extracted inclusion and exclusion rules, and stage manual review before downstream screening."
        action={
          <Button variant="outline">
            <Sparkles className="h-4 w-4" />
            Extraction Pipeline Soon
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-[2rem] border border-dashed border-cyan-300/30 bg-cyan-300/5 p-8">
          <div className="flex min-h-[320px] flex-col items-center justify-center gap-5 text-center">
            <div className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-[1.75rem] bg-cyan-400/10 text-cyan-300">
              <FileUp className="h-8 w-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-foreground">Upload a trial protocol to begin</h2>
              <p className="max-w-xl text-sm leading-7 text-muted-foreground">
                This drag-and-drop slot will accept PDF protocols, trigger criteria extraction, and queue human
                validation for ambiguous eligibility rules.
              </p>
            </div>
          </div>
        </section>

        <EmptyState
          icon={Sparkles}
          title="Criteria review canvas is waiting for the first protocol."
          description="Once a PDF is uploaded, extracted inclusion and exclusion rules will appear here with confidence scores, review flags, and editing controls."
        />
      </div>
    </div>
  );
}
