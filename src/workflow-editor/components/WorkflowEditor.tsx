import { useState } from "react";
import WorkflowList from "./WorkflowList.js";
import WorkflowBuilder from "./WorkflowBuilder.js";

type View = { mode: "list" } | { mode: "builder"; workflowId: string | null };

export interface WorkflowEditorProps {
  /** Called when user navigates to another section */
  onNavigate?: (sectionId: string) => void;
}

/**
 * Top-level workflow editor component.
 * Switches between list view and builder view.
 *
 * Must be wrapped in a `<WorkflowEditorProvider>`.
 */
export default function WorkflowEditor({ onNavigate: _onNavigate }: WorkflowEditorProps) {
  const [view, setView] = useState<View>({ mode: "list" });

  if (view.mode === "builder") {
    return (
      <WorkflowBuilder
        onBack={() => setView({ mode: "list" })}
        initialWorkflowId={view.workflowId}
      />
    );
  }

  return (
    <WorkflowList
      onOpenBuilder={(workflowId) =>
        setView({ mode: "builder", workflowId: workflowId ?? null })
      }
    />
  );
}
