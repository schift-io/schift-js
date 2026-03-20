import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import type { WorkflowEditorAPI, UIComponents } from "./adapter.js";
import type { BlockTypeDefinition } from "./types.js";
import { BLOCK_TYPES } from "./types.js";
import { DEFAULT_UI } from "./defaults.js";

// ---- Context values ----

interface WorkflowEditorContextValue {
  api: WorkflowEditorAPI;
  ui: UIComponents;
  blockTypes: BlockTypeDefinition[];
}

const WorkflowEditorContext = createContext<WorkflowEditorContextValue | null>(
  null,
);

// ---- Provider ----

export interface WorkflowEditorProviderProps {
  /** Required: API adapter (WorkflowClient or custom implementation). */
  api: WorkflowEditorAPI;
  /** Optional: override any or all UI primitives. */
  ui?: Partial<UIComponents>;
  /** Optional: register additional custom block types for the editor palette. */
  customBlocks?: BlockTypeDefinition[];
  children: ReactNode;
}

export function WorkflowEditorProvider({
  api,
  ui,
  customBlocks,
  children,
}: WorkflowEditorProviderProps) {
  const merged: UIComponents = ui ? { ...DEFAULT_UI, ...ui } : DEFAULT_UI;
  const blockTypes = useMemo(
    () => (customBlocks ? [...BLOCK_TYPES, ...customBlocks] : BLOCK_TYPES),
    [customBlocks],
  );
  return (
    <WorkflowEditorContext.Provider value={{ api, ui: merged, blockTypes }}>
      {children}
    </WorkflowEditorContext.Provider>
  );
}

// ---- Hooks ----

export function useWorkflowAPI(): WorkflowEditorAPI {
  const ctx = useContext(WorkflowEditorContext);
  if (!ctx) {
    throw new Error(
      "useWorkflowAPI must be used within a <WorkflowEditorProvider>",
    );
  }
  return ctx.api;
}

export function useWorkflowUI(): UIComponents {
  const ctx = useContext(WorkflowEditorContext);
  if (!ctx) {
    throw new Error(
      "useWorkflowUI must be used within a <WorkflowEditorProvider>",
    );
  }
  return ctx.ui;
}

export function useBlockTypes(): BlockTypeDefinition[] {
  const ctx = useContext(WorkflowEditorContext);
  if (!ctx) {
    throw new Error(
      "useBlockTypes must be used within a <WorkflowEditorProvider>",
    );
  }
  return ctx.blockTypes;
}
