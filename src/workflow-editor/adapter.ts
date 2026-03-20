/**
 * Adapter interfaces for the Workflow Editor.
 *
 * WorkflowEditorAPI is intentionally compatible with WorkflowClient,
 * so `schift.workflows` can be passed directly.
 *
 * @example
 * ```tsx
 * import { Schift } from '@schift/sdk';
 * import { WorkflowEditorProvider, WorkflowEditor } from '@schift/sdk/workflow-editor';
 *
 * const schift = new Schift({ apiKey: 'sch_xxx' });
 *
 * <WorkflowEditorProvider api={schift.workflows}>
 *   <WorkflowEditor />
 * </WorkflowEditorProvider>
 * ```
 */

import type {
  Workflow,
  CreateWorkflowRequest,
  UpdateWorkflowRequest,
  WorkflowRun,
  ValidationResult,
} from "../workflow/types.js";

// ---- API Adapter ----

export interface GenerateWorkflowResult {
  name: string;
  description: string;
  graph: import("../workflow/types.js").WorkflowGraph;
  validation_warnings?: string[];
}

export interface WorkflowEditorAPI {
  list(): Promise<Workflow[]>;
  get(id: string): Promise<Workflow>;
  create(req: CreateWorkflowRequest): Promise<Workflow>;
  update(id: string, req: UpdateWorkflowRequest): Promise<Workflow>;
  delete(id: string): Promise<void>;
  run(id: string, inputs?: Record<string, unknown>): Promise<WorkflowRun>;
  validate(id: string): Promise<ValidationResult>;
  /** Generate a workflow from natural language (paid tier only). */
  generate?(prompt: string, model?: string): Promise<GenerateWorkflowResult>;
}

// ---- UI Component Adapter ----

export interface ButtonProps {
  variant?: "default" | "outline" | "ghost" | "destructive" | "danger" | "link";
  size?: "default" | "sm";
  disabled?: boolean;
  className?: string;
  onClick?: () => void;
  children: React.ReactNode;
  type?: "button" | "submit";
}

export interface InputProps {
  type?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  className?: string;
  placeholder?: string;
}

export interface DialogProps {
  open: boolean;
  children: React.ReactNode;
}

export interface DialogContentProps {
  onClose?: () => void;
  className?: string;
  children: React.ReactNode;
}

export interface SimpleChildProps {
  className?: string;
  children: React.ReactNode;
}

export interface AlertProps {
  variant?: "default" | "error";
  className?: string;
  children: React.ReactNode;
}

export interface LoadingSpinnerProps {
  text?: string;
}

export interface UIComponents {
  Button: React.ComponentType<ButtonProps>;
  Input: React.ComponentType<InputProps>;
  Dialog: React.ComponentType<DialogProps>;
  DialogContent: React.ComponentType<DialogContentProps>;
  DialogHeader: React.ComponentType<SimpleChildProps>;
  DialogTitle: React.ComponentType<SimpleChildProps>;
  DialogDescription: React.ComponentType<SimpleChildProps>;
  DialogFooter: React.ComponentType<SimpleChildProps>;
  LoadingSpinner: React.ComponentType<LoadingSpinnerProps>;
  Alert: React.ComponentType<AlertProps>;
  Card: React.ComponentType<SimpleChildProps>;
  CardContent: React.ComponentType<SimpleChildProps>;
  ErrorText: React.ComponentType<SimpleChildProps>;
}
