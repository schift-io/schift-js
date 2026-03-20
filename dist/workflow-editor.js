// src/workflow-editor/components/WorkflowEditor.tsx
import { useState as useState6 } from "react";

// src/workflow-editor/components/WorkflowList.tsx
import { useCallback, useEffect, useState } from "react";

// src/workflow-editor/context.tsx
import { createContext, useContext, useMemo } from "react";

// src/workflow-editor/types.ts
var CATEGORY_COLORS = {
  Control: "bg-slate-600 border-slate-500",
  Document: "bg-blue-900 border-blue-700",
  Embedding: "bg-violet-900 border-violet-700",
  Storage: "bg-emerald-900 border-emerald-700",
  Retrieval: "bg-amber-900 border-amber-700",
  LLM: "bg-rose-900 border-rose-700",
  Logic: "bg-cyan-900 border-cyan-700",
  Transform: "bg-orange-900 border-orange-700",
  Integration: "bg-pink-900 border-pink-700"
};
var CATEGORY_BADGE_COLORS = {
  Control: "bg-slate-500/30 text-slate-300",
  Document: "bg-blue-500/20 text-blue-300",
  Embedding: "bg-violet-500/20 text-violet-300",
  Storage: "bg-emerald-500/20 text-emerald-300",
  Retrieval: "bg-amber-500/20 text-amber-300",
  LLM: "bg-rose-500/20 text-rose-300",
  Logic: "bg-cyan-500/20 text-cyan-300",
  Transform: "bg-orange-500/20 text-orange-300",
  Integration: "bg-pink-500/20 text-pink-300"
};
var CATEGORY_ACCENT = {
  Control: "border-l-slate-500",
  Document: "border-l-blue-500",
  Embedding: "border-l-violet-500",
  Storage: "border-l-emerald-500",
  Retrieval: "border-l-amber-500",
  LLM: "border-l-rose-500",
  Logic: "border-l-cyan-500",
  Transform: "border-l-orange-500",
  Integration: "border-l-pink-500"
};
var BLOCK_TYPES = [
  // Control
  { type: "start", label: "Start", category: "Control", icon: "\u25B6", defaultConfig: {}, inputs: [], outputs: ["out"] },
  { type: "end", label: "End", category: "Control", icon: "\u23F9", defaultConfig: {}, inputs: ["in"], outputs: [] },
  // Document
  { type: "document_loader", label: "Document Loader", category: "Document", icon: "\u{1F4C4}", defaultConfig: { source: "" }, inputs: ["in"], outputs: ["docs"] },
  { type: "document_parser", label: "Document Parser", category: "Document", icon: "\u{1F4D1}", defaultConfig: { mode: "vlm", fields: [], merge_pages: "merge" }, inputs: ["docs", "pages"], outputs: ["documents", "pages", "items"] },
  { type: "chunker", label: "Chunker", category: "Document", icon: "\u2702", defaultConfig: { strategy: "fixed", chunk_size: 512, overlap: 64 }, inputs: ["parsed"], outputs: ["chunks"] },
  // Embedding
  { type: "embedder", label: "Embedder", category: "Embedding", icon: "\u229B", defaultConfig: { model: "text-embedding-3-small", dimensions: 1024 }, inputs: ["chunks"], outputs: ["embeddings"] },
  { type: "model_selector", label: "Model Selector", category: "Embedding", icon: "\u2295", defaultConfig: { provider: "openai" }, inputs: ["in"], outputs: ["out"] },
  // Storage
  { type: "vector_store", label: "Vector Store", category: "Storage", icon: "\u26C1", defaultConfig: { collection: "", upsert: true }, inputs: ["embeddings"], outputs: ["stored"] },
  { type: "collection", label: "Collection", category: "Storage", icon: "\u229E", defaultConfig: { name: "" }, inputs: ["in"], outputs: ["out"] },
  // Retrieval
  { type: "retriever", label: "Retriever", category: "Retrieval", icon: "\u26B2", defaultConfig: { top_k: 5, collection: "" }, inputs: ["query"], outputs: ["results"] },
  { type: "reranker", label: "Reranker", category: "Retrieval", icon: "\u21C5", defaultConfig: { model: "rerank-v1", top_n: 3 }, inputs: ["results", "query"], outputs: ["reranked"] },
  // LLM
  { type: "llm", label: "LLM", category: "LLM", icon: "\u25CE", defaultConfig: { model: "gpt-4o-mini", temperature: 0.7, max_tokens: 1024 }, inputs: ["prompt"], outputs: ["response"] },
  { type: "prompt_template", label: "Prompt Template", category: "LLM", icon: "\u270E", defaultConfig: { template: "" }, inputs: ["vars"], outputs: ["prompt"] },
  { type: "answer", label: "Answer", category: "LLM", icon: "\u25C9", defaultConfig: { format: "text" }, inputs: ["response"], outputs: ["out"] },
  // Logic
  { type: "condition", label: "Condition", category: "Logic", icon: "\u2B21", defaultConfig: { expression: "" }, inputs: ["in"], outputs: ["true", "false"] },
  { type: "router", label: "Router", category: "Logic", icon: "\u2B22", defaultConfig: { routes: [] }, inputs: ["in"], outputs: ["out_0", "out_1", "out_2"] },
  { type: "ai_router", label: "AI Router", category: "Logic", icon: "\u{1F9E0}", defaultConfig: { routes: [], model: "gpt-4o-mini", temperature: 0, fallback_route: "" }, inputs: ["in"], outputs: ["out_0", "out_1", "out_2", "route"] },
  { type: "loop", label: "Loop", category: "Logic", icon: "\u21BB", defaultConfig: { max_iterations: 10 }, inputs: ["in"], outputs: ["item", "done"] },
  { type: "merge", label: "Merge", category: "Logic", icon: "\u2B1F", defaultConfig: { strategy: "concat" }, inputs: ["in_0", "in_1"], outputs: ["out"] },
  // Transform
  { type: "code", label: "Code", category: "Transform", icon: "{ }", defaultConfig: { language: "python", code: "" }, inputs: ["in"], outputs: ["out"] },
  { type: "variable", label: "Variable", category: "Transform", icon: "$", defaultConfig: { name: "", value: "" }, inputs: [], outputs: ["value"] },
  { type: "field_selector", label: "Field Selector", category: "Transform", icon: "\u2637", defaultConfig: { fields: [], source: "auto", output_format: "json", flatten: false }, inputs: ["in", "extracted", "tables"], outputs: ["out", "columns", "table"] },
  { type: "metadata_extractor", label: "Metadata Extractor", category: "Transform", icon: "\u22A1", defaultConfig: { fields: [] }, inputs: ["in"], outputs: ["out", "metadata"] },
  // Integration
  { type: "http_request", label: "HTTP Request", category: "Integration", icon: "\u21C6", defaultConfig: { method: "GET", url: "" }, inputs: ["in"], outputs: ["response", "error"] },
  { type: "webhook", label: "Webhook", category: "Integration", icon: "\u21AF", defaultConfig: { url: "", secret: "" }, inputs: ["in"], outputs: ["out"] }
];
function getBlockTypeDef(type) {
  return BLOCK_TYPES.find((b) => b.type === type);
}

// src/workflow-editor/defaults.tsx
import { jsx, jsxs } from "react/jsx-runtime";
function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}
var DefaultButton = ({
  variant = "default",
  size = "default",
  disabled,
  className,
  onClick,
  children,
  type = "button"
}) => {
  const base = "inline-flex items-center justify-center rounded font-medium transition-colors focus:outline-none disabled:opacity-50 disabled:pointer-events-none";
  const sizes = size === "sm" ? "h-7 px-3 text-xs" : "h-9 px-4 text-sm";
  const variants = {
    default: "bg-[var(--schift-blue)] text-white hover:opacity-90",
    outline: "border border-[var(--schift-gray-70)] text-[var(--schift-gray-30)] hover:bg-[var(--schift-gray-80)]",
    ghost: "text-[var(--schift-gray-30)] hover:bg-[var(--schift-gray-80)]",
    destructive: "bg-[var(--schift-red)] text-white hover:opacity-90",
    danger: "border border-[var(--schift-red)]/30 text-[var(--schift-red)] bg-[var(--schift-red)]/10 hover:bg-[var(--schift-red)]/20 text-xs h-7 px-2",
    link: "text-[var(--schift-blue)] hover:underline p-0 h-auto"
  };
  return /* @__PURE__ */ jsx(
    "button",
    {
      type,
      disabled,
      onClick,
      className: cn(base, sizes, variants[variant], className),
      children
    }
  );
};
var DefaultInput = ({
  type = "text",
  value,
  onChange,
  onBlur,
  onKeyDown,
  className,
  placeholder
}) => /* @__PURE__ */ jsx(
  "input",
  {
    type,
    value,
    onChange,
    onBlur,
    onKeyDown,
    placeholder,
    className: cn(
      "w-full px-3 bg-[var(--schift-gray-100)] border border-[var(--schift-gray-70)] rounded text-[var(--schift-gray-30)] placeholder:text-[var(--schift-gray-60)] focus:outline-none focus:border-[var(--schift-blue)]",
      className
    )
  }
);
var DefaultDialog = ({ open, children }) => {
  if (!open) return null;
  return /* @__PURE__ */ jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/60", children });
};
var DefaultDialogContent = ({
  onClose,
  className,
  children
}) => /* @__PURE__ */ jsxs(
  "div",
  {
    className: cn(
      "bg-[var(--schift-gray-90)] border border-[var(--schift-gray-70)] rounded-lg p-6 shadow-2xl",
      className
    ),
    children: [
      onClose && /* @__PURE__ */ jsx(
        "button",
        {
          onClick: onClose,
          className: "absolute top-3 right-3 text-[var(--schift-gray-50)] hover:text-[var(--schift-white)]",
          children: "\xD7"
        }
      ),
      children
    ]
  }
);
var DefaultDialogHeader = ({ children }) => /* @__PURE__ */ jsx("div", { className: "mb-4", children });
var DefaultDialogTitle = ({ children }) => /* @__PURE__ */ jsx("h3", { className: "text-sm font-semibold text-[var(--schift-white)]", children });
var DefaultDialogDescription = ({
  children
}) => /* @__PURE__ */ jsx("p", { className: "text-sm text-[var(--schift-gray-50)] mt-1", children });
var DefaultDialogFooter = ({ children }) => /* @__PURE__ */ jsx("div", { className: "mt-4 flex gap-2 justify-end", children });
var DefaultLoadingSpinner = ({ text }) => /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 text-[var(--schift-gray-50)]", children: [
  /* @__PURE__ */ jsx("span", { className: "animate-spin text-lg", children: "&orarr;" }),
  text && /* @__PURE__ */ jsx("span", { className: "text-sm", children: text })
] });
var DefaultAlert = ({
  variant,
  className,
  children
}) => /* @__PURE__ */ jsx(
  "div",
  {
    className: cn(
      "rounded-lg border px-4 py-3 text-sm",
      variant === "error" ? "border-[var(--schift-red)]/30 bg-[var(--schift-red)]/10 text-[var(--schift-red)]" : "border-[var(--schift-gray-70)] bg-[var(--schift-gray-90)] text-[var(--schift-gray-30)]",
      className
    ),
    children
  }
);
var DefaultCard = ({ className, children }) => /* @__PURE__ */ jsx(
  "div",
  {
    className: cn(
      "rounded-lg border border-[var(--schift-gray-80)] bg-[var(--schift-gray-100)]",
      className
    ),
    children
  }
);
var DefaultCardContent = ({
  className,
  children
}) => /* @__PURE__ */ jsx("div", { className: cn("p-4", className), children });
var DefaultErrorText = ({
  className,
  children
}) => {
  if (!children) return null;
  return /* @__PURE__ */ jsx("p", { className: cn("text-sm text-[var(--schift-red)]", className), children });
};
var DEFAULT_UI = {
  Button: DefaultButton,
  Input: DefaultInput,
  Dialog: DefaultDialog,
  DialogContent: DefaultDialogContent,
  DialogHeader: DefaultDialogHeader,
  DialogTitle: DefaultDialogTitle,
  DialogDescription: DefaultDialogDescription,
  DialogFooter: DefaultDialogFooter,
  LoadingSpinner: DefaultLoadingSpinner,
  Alert: DefaultAlert,
  Card: DefaultCard,
  CardContent: DefaultCardContent,
  ErrorText: DefaultErrorText
};

// src/workflow-editor/context.tsx
import { jsx as jsx2 } from "react/jsx-runtime";
var WorkflowEditorContext = createContext(
  null
);
function WorkflowEditorProvider({
  api,
  ui,
  customBlocks,
  children
}) {
  const merged = ui ? { ...DEFAULT_UI, ...ui } : DEFAULT_UI;
  const blockTypes = useMemo(
    () => customBlocks ? [...BLOCK_TYPES, ...customBlocks] : BLOCK_TYPES,
    [customBlocks]
  );
  return /* @__PURE__ */ jsx2(WorkflowEditorContext.Provider, { value: { api, ui: merged, blockTypes }, children });
}
function useWorkflowAPI() {
  const ctx = useContext(WorkflowEditorContext);
  if (!ctx) {
    throw new Error(
      "useWorkflowAPI must be used within a <WorkflowEditorProvider>"
    );
  }
  return ctx.api;
}
function useWorkflowUI() {
  const ctx = useContext(WorkflowEditorContext);
  if (!ctx) {
    throw new Error(
      "useWorkflowUI must be used within a <WorkflowEditorProvider>"
    );
  }
  return ctx.ui;
}
function useBlockTypes() {
  const ctx = useContext(WorkflowEditorContext);
  if (!ctx) {
    throw new Error(
      "useBlockTypes must be used within a <WorkflowEditorProvider>"
    );
  }
  return ctx.blockTypes;
}

// src/workflow-editor/components/WorkflowList.tsx
import { jsx as jsx3, jsxs as jsxs2 } from "react/jsx-runtime";
var EMPTY_STATE_STEPS = [
  "Choose a template if you want a starter RAG flow instead of an empty graph.",
  "Open the builder and drag blocks from the left palette onto the canvas.",
  "Save first, then validate and run from the top bar before sharing changes."
];
function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}
function StatusBadge({ status }) {
  const colors = {
    active: "bg-[var(--schift-green)]/20 text-[var(--schift-green)]",
    published: "bg-[var(--schift-green)]/20 text-[var(--schift-green)]",
    draft: "bg-[var(--schift-gray-70)]/30 text-[var(--schift-gray-30)]",
    inactive: "bg-[var(--schift-yellow)]/20 text-[var(--schift-yellow)]",
    archived: "bg-[var(--schift-yellow)]/20 text-[var(--schift-yellow)]",
    error: "bg-[var(--schift-red)]/20 text-[var(--schift-red)]"
  };
  return /* @__PURE__ */ jsx3("span", { className: `text-[10px] font-medium px-2 py-0.5 rounded-full ${colors[status] ?? colors.draft}`, children: status });
}
function WorkflowCard({ workflow, deleting, onOpen, onRequestDelete }) {
  const { Button, Card, CardContent } = useWorkflowUI();
  return /* @__PURE__ */ jsx3(Card, { className: "hover:border-[var(--schift-gray-60)] transition-colors", children: /* @__PURE__ */ jsxs2(CardContent, { className: "p-4", children: [
    /* @__PURE__ */ jsx3("div", { className: "flex items-start justify-between gap-3", children: /* @__PURE__ */ jsxs2("div", { className: "flex-1 min-w-0", children: [
      /* @__PURE__ */ jsxs2("div", { className: "flex items-center gap-2 mb-1", children: [
        /* @__PURE__ */ jsx3("h3", { className: "text-sm font-medium text-[var(--schift-white)] truncate", children: workflow.name }),
        /* @__PURE__ */ jsx3(StatusBadge, { status: workflow.status })
      ] }),
      /* @__PURE__ */ jsxs2("div", { className: "flex items-center gap-3 text-xs text-[var(--schift-gray-50)]", children: [
        /* @__PURE__ */ jsxs2("span", { children: [
          workflow.graph.blocks.length,
          " blocks"
        ] }),
        /* @__PURE__ */ jsx3("span", { children: "\xB7" }),
        /* @__PURE__ */ jsxs2("span", { children: [
          "Updated ",
          formatDate(workflow.updated_at)
        ] })
      ] })
    ] }) }),
    /* @__PURE__ */ jsx3("div", { className: "mt-3 flex gap-1", children: Array.from({ length: Math.min(workflow.graph.blocks.length, 12) }).map((_, i) => /* @__PURE__ */ jsx3("div", { className: "h-1.5 flex-1 rounded-full bg-[var(--schift-gray-70)]" }, i)) }),
    /* @__PURE__ */ jsxs2("div", { className: "mt-4 flex items-center justify-between gap-2", children: [
      /* @__PURE__ */ jsx3("p", { className: "text-[11px] text-[var(--schift-gray-50)]", children: "Open to edit blocks, validate, and run this workflow." }),
      /* @__PURE__ */ jsxs2("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsx3(Button, { variant: "outline", size: "sm", onClick: () => onOpen(workflow.id), children: "Open" }),
        /* @__PURE__ */ jsx3(Button, { variant: "danger", size: "sm", disabled: deleting, onClick: () => onRequestDelete(workflow), children: "Delete" })
      ] })
    ] })
  ] }) });
}
function DeleteWorkflowDialog({ workflow, deleting, onClose, onConfirm }) {
  const { Button, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Alert } = useWorkflowUI();
  return /* @__PURE__ */ jsxs2(DialogContent, { onClose, className: "max-w-[420px]", children: [
    /* @__PURE__ */ jsxs2(DialogHeader, { children: [
      /* @__PURE__ */ jsx3(DialogTitle, { children: "Delete workflow" }),
      /* @__PURE__ */ jsx3(DialogDescription, { children: "Remove this workflow from the dashboard. This also removes its saved graph from the current workspace." })
    ] }),
    /* @__PURE__ */ jsxs2(Alert, { variant: "error", children: [
      /* @__PURE__ */ jsx3("p", { className: "text-sm text-[var(--schift-white)]", children: workflow.name }),
      /* @__PURE__ */ jsxs2("p", { className: "text-xs text-[var(--schift-gray-50)] mt-1", children: [
        workflow.graph.blocks.length,
        " blocks \xB7 updated ",
        formatDate(workflow.updated_at)
      ] })
    ] }),
    /* @__PURE__ */ jsxs2(DialogFooter, { children: [
      /* @__PURE__ */ jsx3(Button, { variant: "outline", onClick: onClose, children: "Cancel" }),
      /* @__PURE__ */ jsx3(Button, { variant: "destructive", disabled: deleting, onClick: () => onConfirm(workflow.id), children: deleting ? "Deleting..." : "Delete workflow" })
    ] })
  ] });
}
function EmptyState({ onCreate }) {
  const { Button, Card, CardContent } = useWorkflowUI();
  return /* @__PURE__ */ jsx3(Card, { children: /* @__PURE__ */ jsxs2(CardContent, { className: "p-12 text-center", children: [
    /* @__PURE__ */ jsx3("p", { className: "text-3xl mb-3", children: "\u25CA" }),
    /* @__PURE__ */ jsx3("p", { className: "text-sm font-medium text-[var(--schift-white)] mb-1", children: "No workflows yet" }),
    /* @__PURE__ */ jsx3("p", { className: "text-sm text-[var(--schift-gray-50)] mb-6", children: "Start with a blank canvas or a template, then add blocks and connect outputs to inputs." }),
    /* @__PURE__ */ jsx3("div", { className: "grid gap-3 max-w-xl mx-auto text-left mb-6", children: EMPTY_STATE_STEPS.map((step, index) => /* @__PURE__ */ jsxs2("div", { className: "flex items-start gap-3 rounded-lg border border-[var(--schift-gray-80)] bg-[var(--schift-gray-90)] px-4 py-3", children: [
      /* @__PURE__ */ jsx3("span", { className: "mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--schift-gray-80)] text-[10px] font-medium text-[var(--schift-white)]", children: index + 1 }),
      /* @__PURE__ */ jsx3("p", { className: "text-sm text-[var(--schift-gray-30)]", children: step })
    ] }, step)) }),
    /* @__PURE__ */ jsxs2("div", { className: "flex flex-col items-center gap-3", children: [
      /* @__PURE__ */ jsx3(Button, { onClick: onCreate, children: "Create workflow" }),
      /* @__PURE__ */ jsx3("p", { className: "text-xs text-[var(--schift-gray-50)]", children: "Tip: `Basic RAG` is the fastest way to get a runnable starter pipeline." })
    ] })
  ] }) });
}
function WorkflowList({ onOpenBuilder }) {
  const api = useWorkflowAPI();
  const { Button, Card, CardContent, ErrorText, Dialog } = useWorkflowUI();
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState(null);
  const hasGenerate = typeof api.generate === "function";
  const fetchWorkflows = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.list().then((data) => {
      if (!cancelled) setWorkflows(data);
    }).catch((e) => {
      if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load workflows.");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [api]);
  useEffect(() => fetchWorkflows(), [fetchWorkflows]);
  const closeNewModal = () => {
    setShowNewModal(false);
    setNewName("");
    setSelectedTemplate(null);
    setError(null);
  };
  const handleCreate = async () => {
    const name = newName.trim() || "Untitled Workflow";
    setCreating(true);
    setError(null);
    try {
      const wf = await api.create({ name, ...selectedTemplate ? { template: selectedTemplate } : {} });
      setWorkflows((prev) => [wf, ...prev]);
      closeNewModal();
      onOpenBuilder(wf.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create workflow.");
    } finally {
      setCreating(false);
    }
  };
  const handleAiGenerate = async () => {
    if (!aiPrompt.trim() || !api.generate) return;
    setAiGenerating(true);
    setAiError(null);
    try {
      const result = await api.generate(aiPrompt.trim());
      const wf = await api.create({ name: result.name, description: result.description, graph: result.graph });
      setWorkflows((prev) => [wf, ...prev]);
      setShowAiModal(false);
      setAiPrompt("");
      onOpenBuilder(wf.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to generate workflow.";
      setAiError(msg.includes("upgrade") ? "Paid plan required for AI generation." : msg);
    } finally {
      setAiGenerating(false);
    }
  };
  const handleDelete = async (id) => {
    setDeletingId(id);
    setError(null);
    try {
      await api.delete(id);
      setWorkflows((prev) => prev.filter((w) => w.id !== id));
      setDeleteTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete workflow.");
    } finally {
      setDeletingId(null);
    }
  };
  return /* @__PURE__ */ jsxs2("div", { children: [
    /* @__PURE__ */ jsxs2("div", { className: "flex items-center justify-between mb-6", children: [
      /* @__PURE__ */ jsxs2("div", { children: [
        /* @__PURE__ */ jsx3("h2", { className: "text-xl font-semibold text-[var(--schift-white)]", children: "Workflows" }),
        /* @__PURE__ */ jsx3("p", { className: "text-sm text-[var(--schift-gray-50)] mt-0.5", children: "Build and manage your data processing pipelines" })
      ] }),
      /* @__PURE__ */ jsxs2("div", { className: "flex items-center gap-2", children: [
        hasGenerate && /* @__PURE__ */ jsx3(Button, { variant: "outline", onClick: () => setShowAiModal(true), className: "gap-2", children: "\u{1F9E0} AI Generate" }),
        /* @__PURE__ */ jsx3(Button, { onClick: () => setShowNewModal(true), className: "gap-2", children: "+ New Workflow" })
      ] })
    ] }),
    showNewModal && /* @__PURE__ */ jsx3("div", { className: "fixed inset-0 bg-black/60 flex items-center justify-center z-50", children: /* @__PURE__ */ jsxs2("div", { className: "bg-[var(--schift-gray-90)] border border-[var(--schift-gray-70)] rounded-lg p-6 w-96 shadow-2xl", children: [
      /* @__PURE__ */ jsx3("h3", { className: "text-sm font-semibold text-[var(--schift-white)] mb-4", children: "New Workflow" }),
      /* @__PURE__ */ jsxs2("div", { className: "mb-4", children: [
        /* @__PURE__ */ jsx3("label", { className: "text-xs text-[var(--schift-gray-50)] block mb-1", children: "Workflow name" }),
        /* @__PURE__ */ jsx3("input", { autoFocus: true, type: "text", value: newName, onChange: (e) => setNewName(e.target.value), onKeyDown: (e) => e.key === "Enter" && !creating && handleCreate(), placeholder: "e.g. RAG Pipeline", className: "w-full h-9 px-3 text-sm bg-[var(--schift-gray-100)] border border-[var(--schift-gray-70)] rounded text-[var(--schift-white)] placeholder:text-[var(--schift-gray-60)] focus:outline-none focus:border-[var(--schift-blue)]" })
      ] }),
      /* @__PURE__ */ jsxs2("div", { className: "mb-5", children: [
        /* @__PURE__ */ jsx3("p", { className: "text-xs text-[var(--schift-gray-50)] mb-2", children: "Start with a template" }),
        /* @__PURE__ */ jsx3("div", { className: "grid grid-cols-2 gap-2", children: [
          { label: "Blank", template: null },
          { label: "Basic RAG", template: "basic_rag" },
          { label: "Document QA", template: "document_qa" },
          { label: "Chat RAG", template: "chat_rag" },
          { label: "OCR Ingestion", template: "image_ocr_ingest" },
          { label: "Conversational", template: "conversational_rag" }
        ].map((opt) => /* @__PURE__ */ jsx3(
          "button",
          {
            onClick: () => {
              setNewName(opt.template ? opt.label : "");
              setSelectedTemplate(opt.template);
            },
            className: `text-xs px-3 py-2 rounded border transition-colors ${selectedTemplate === opt.template ? "border-[var(--schift-blue)] bg-[var(--schift-blue)]/10 text-[var(--schift-blue)]" : "border-[var(--schift-gray-70)] text-[var(--schift-gray-30)] hover:border-[var(--schift-gray-50)]"}`,
            children: opt.label
          },
          opt.label
        )) })
      ] }),
      /* @__PURE__ */ jsx3(ErrorText, { className: "mb-4", children: error }),
      /* @__PURE__ */ jsxs2("div", { className: "flex gap-2 justify-end", children: [
        /* @__PURE__ */ jsx3(Button, { variant: "outline", size: "sm", onClick: closeNewModal, children: "Cancel" }),
        /* @__PURE__ */ jsx3(Button, { size: "sm", disabled: creating, onClick: handleCreate, children: creating ? "Creating\u2026" : "Create" })
      ] })
    ] }) }),
    showAiModal && /* @__PURE__ */ jsx3("div", { className: "fixed inset-0 bg-black/60 flex items-center justify-center z-50", children: /* @__PURE__ */ jsxs2("div", { className: "bg-[var(--schift-gray-90)] border border-[var(--schift-gray-70)] rounded-lg p-6 w-[480px] shadow-2xl", children: [
      /* @__PURE__ */ jsx3("h3", { className: "text-sm font-semibold text-[var(--schift-white)] mb-1 flex items-center gap-2", children: "\u{1F9E0} AI Workflow Generator" }),
      /* @__PURE__ */ jsx3("p", { className: "text-xs text-[var(--schift-gray-50)] mb-4", children: "Describe what you want and AI will build the workflow for you." }),
      /* @__PURE__ */ jsx3(
        "textarea",
        {
          autoFocus: true,
          value: aiPrompt,
          onChange: (e) => setAiPrompt(e.target.value),
          onKeyDown: (e) => {
            if (e.key === "Enter" && e.metaKey && !aiGenerating) handleAiGenerate();
          },
          placeholder: "e.g. OCR invoices and extract line items as a table\ne.g. RAG pipeline that searches docs and answers questions\ne.g. Classify support tickets and route to different handlers",
          rows: 4,
          className: "w-full px-3 py-2 text-sm bg-[var(--schift-gray-100)] border border-[var(--schift-gray-70)] rounded text-[var(--schift-white)] placeholder:text-[var(--schift-gray-60)] focus:outline-none focus:border-[var(--schift-blue)] resize-none"
        }
      ),
      aiError && /* @__PURE__ */ jsx3("p", { className: "text-xs text-[var(--schift-red)] mt-2", children: aiError }),
      /* @__PURE__ */ jsxs2("div", { className: "flex items-center justify-between mt-4", children: [
        /* @__PURE__ */ jsx3("span", { className: "text-[10px] text-[var(--schift-gray-60)]", children: aiGenerating ? "Generating workflow..." : "Cmd+Enter to generate" }),
        /* @__PURE__ */ jsxs2("div", { className: "flex gap-2", children: [
          /* @__PURE__ */ jsx3(Button, { variant: "outline", size: "sm", onClick: () => {
            setShowAiModal(false);
            setAiPrompt("");
            setAiError(null);
          }, children: "Cancel" }),
          /* @__PURE__ */ jsx3(Button, { size: "sm", disabled: aiGenerating || !aiPrompt.trim(), onClick: handleAiGenerate, children: aiGenerating ? "Generating\u2026" : "Generate" })
        ] })
      ] })
    ] }) }),
    /* @__PURE__ */ jsx3(Dialog, { open: !!deleteTarget, children: deleteTarget && /* @__PURE__ */ jsx3(DeleteWorkflowDialog, { workflow: deleteTarget, deleting: deletingId === deleteTarget.id, onClose: () => {
      if (!deletingId) setDeleteTarget(null);
    }, onConfirm: handleDelete }) }),
    loading ? /* @__PURE__ */ jsx3("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4", children: Array.from({ length: 3 }).map((_, i) => /* @__PURE__ */ jsx3(Card, { children: /* @__PURE__ */ jsxs2(CardContent, { className: "p-4", children: [
      /* @__PURE__ */ jsx3("div", { className: "h-4 bg-[var(--schift-gray-80)] rounded w-2/3 mb-2 animate-pulse" }),
      /* @__PURE__ */ jsx3("div", { className: "h-3 bg-[var(--schift-gray-80)] rounded w-1/2 mb-3 animate-pulse" }),
      /* @__PURE__ */ jsx3("div", { className: "flex gap-1", children: Array.from({ length: 5 }).map((__, j) => /* @__PURE__ */ jsx3("div", { className: "h-1.5 flex-1 rounded-full bg-[var(--schift-gray-80)] animate-pulse" }, j)) })
    ] }) }, i)) }) : error ? /* @__PURE__ */ jsx3(Card, { children: /* @__PURE__ */ jsxs2(CardContent, { className: "p-6 text-center", children: [
      /* @__PURE__ */ jsx3(ErrorText, { children: error }),
      /* @__PURE__ */ jsx3(Button, { variant: "link", size: "sm", onClick: fetchWorkflows, className: "mt-2", children: "Retry" })
    ] }) }) : workflows.length === 0 ? /* @__PURE__ */ jsx3(EmptyState, { onCreate: () => setShowNewModal(true) }) : /* @__PURE__ */ jsx3("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4", children: workflows.map((wf) => /* @__PURE__ */ jsx3(WorkflowCard, { workflow: wf, deleting: deletingId === wf.id, onOpen: onOpenBuilder, onRequestDelete: setDeleteTarget }, wf.id)) })
  ] });
}

// src/workflow-editor/components/WorkflowBuilder.tsx
import { useState as useState5, useCallback as useCallback4, useEffect as useEffect4, useRef as useRef2 } from "react";

// src/workflow-editor/components/BlockPalette.tsx
import { jsx as jsx4, jsxs as jsxs3 } from "react/jsx-runtime";
var CATEGORIES = [
  "Control",
  "Document",
  "Embedding",
  "Storage",
  "Retrieval",
  "LLM",
  "Logic",
  "Transform",
  "Integration"
];
var STARTER_BLOCKS = [
  "start",
  "document_loader",
  "chunker",
  "embedder",
  "llm",
  "end"
];
function PaletteItem({
  def,
  onDragStart,
  featured = false
}) {
  const badge = CATEGORY_BADGE_COLORS[def.category];
  return /* @__PURE__ */ jsxs3(
    "div",
    {
      draggable: true,
      onDragStart: (e) => {
        e.dataTransfer.setData("block-type", def.type);
        e.dataTransfer.effectAllowed = "copy";
        onDragStart(def.type);
      },
      className: `flex items-center gap-2 px-3 py-2 rounded cursor-grab active:cursor-grabbing hover:bg-[var(--schift-gray-80)] transition-colors select-none group ${featured ? "border border-[var(--schift-blue)]/20 bg-[var(--schift-blue)]/5" : ""}`,
      title: `Drag to add ${def.label}`,
      children: [
        /* @__PURE__ */ jsx4(
          "span",
          {
            className: `inline-flex items-center justify-center w-6 h-6 rounded text-xs font-mono ${badge}`,
            children: def.icon
          }
        ),
        /* @__PURE__ */ jsx4("div", { className: "min-w-0 flex-1", children: /* @__PURE__ */ jsxs3("div", { className: "flex items-center gap-2", children: [
          /* @__PURE__ */ jsx4("span", { className: "text-xs text-[var(--schift-gray-30)] group-hover:text-[var(--schift-white)] transition-colors truncate", children: def.label }),
          featured && /* @__PURE__ */ jsx4("span", { className: "text-[10px] text-[var(--schift-blue)] uppercase tracking-wider", children: "starter" })
        ] }) })
      ]
    }
  );
}
function BlockPalette({ onDragStart }) {
  const blockTypes = useBlockTypes();
  const allCategories = Array.from(/* @__PURE__ */ new Set([...CATEGORIES, ...blockTypes.map((b) => b.category)]));
  const byCategory = allCategories.reduce(
    (acc, cat) => {
      acc[cat] = blockTypes.filter((b) => b.category === cat);
      return acc;
    },
    {}
  );
  return /* @__PURE__ */ jsxs3("aside", { className: "w-52 flex-shrink-0 h-full bg-[var(--schift-gray-100)] border-r border-[var(--schift-gray-80)] overflow-y-auto flex flex-col", children: [
    /* @__PURE__ */ jsxs3("div", { className: "px-3 py-3 border-b border-[var(--schift-gray-80)]", children: [
      /* @__PURE__ */ jsx4("p", { className: "text-xs font-semibold text-[var(--schift-gray-50)] uppercase tracking-wider", children: "Blocks" }),
      /* @__PURE__ */ jsx4("p", { className: "text-[11px] text-[var(--schift-gray-50)] mt-2 leading-5", children: "Drag a starter block onto the canvas, then connect the right-side output circle to another block's left-side input." })
    ] }),
    /* @__PURE__ */ jsxs3("div", { className: "px-3 py-3 border-b border-[var(--schift-gray-80)] bg-[var(--schift-gray-90)]", children: [
      /* @__PURE__ */ jsx4("p", { className: "text-[10px] font-semibold text-[var(--schift-gray-50)] uppercase tracking-wider mb-2", children: "First run" }),
      /* @__PURE__ */ jsxs3("ol", { className: "space-y-1 text-[11px] text-[var(--schift-gray-30)] leading-5", children: [
        /* @__PURE__ */ jsx4("li", { children: "1. Start with `Start`, `Document Loader`, or `LLM`." }),
        /* @__PURE__ */ jsx4("li", { children: "2. Drop the block anywhere on the canvas." }),
        /* @__PURE__ */ jsx4("li", { children: "3. Click an output circle, then an input circle to connect." }),
        /* @__PURE__ */ jsx4("li", { children: "4. Click any block to edit its config on the right." })
      ] })
    ] }),
    /* @__PURE__ */ jsx4("div", { className: "flex-1 py-2", children: allCategories.map((cat) => /* @__PURE__ */ jsxs3("div", { className: "mb-1", children: [
      /* @__PURE__ */ jsx4("div", { className: "px-3 pt-3 pb-1", children: /* @__PURE__ */ jsx4(
        "p",
        {
          className: `text-[10px] font-semibold uppercase tracking-wider ${CATEGORY_BADGE_COLORS[cat]}`,
          children: cat
        }
      ) }),
      byCategory[cat].map((def) => /* @__PURE__ */ jsx4(
        PaletteItem,
        {
          def,
          onDragStart,
          featured: STARTER_BLOCKS.includes(def.type)
        },
        def.type
      ))
    ] }, cat)) })
  ] });
}

// src/workflow-editor/components/WorkflowCanvas.tsx
import { useRef, useState as useState2, useCallback as useCallback2, useEffect as useEffect2 } from "react";
import { jsx as jsx5, jsxs as jsxs4 } from "react/jsx-runtime";
var BLOCK_WIDTH = 180;
var BLOCK_HEADER_HEIGHT = 56;
var PORT_SIZE = 10;
var PORT_HIT_SIZE = 18;
var PORT_SPACING = 20;
function blockHeight(def) {
  if (!def) return BLOCK_HEADER_HEIGHT;
  return BLOCK_HEADER_HEIGHT + Math.max(def.inputs.length, def.outputs.length, 1) * PORT_SPACING + 8;
}
function portY(i) {
  return BLOCK_HEADER_HEIGHT + i * PORT_SPACING + PORT_SPACING / 2;
}
function getOutputPortPos(b, i) {
  return { x: b.position.x + BLOCK_WIDTH, y: b.position.y + portY(i) };
}
function getInputPortPos(b, i) {
  return { x: b.position.x, y: b.position.y + portY(i) };
}
function bezierPath(sx, sy, tx, ty) {
  const cx = (sx + tx) / 2;
  return `M${sx},${sy} C${cx},${sy} ${cx},${ty} ${tx},${ty}`;
}
function truncate(s, n) {
  return s.length > n ? s.slice(0, n) + "\u2026" : s;
}
function accentFill(cat) {
  const m = { Control: "#64748b", Document: "#3b82f6", Embedding: "#8b5cf6", Storage: "#10b981", Retrieval: "#f59e0b", LLM: "#f43f5e", Logic: "#06b6d4", Transform: "#f97316", Integration: "#ec4899" };
  return m[cat ?? ""] ?? "#64748b";
}
function badgeFill(cat) {
  const m = { Control: "#94a3b8", Document: "#93c5fd", Embedding: "#c4b5fd", Storage: "#6ee7b7", Retrieval: "#fcd34d", LLM: "#fda4af", Logic: "#67e8f9", Transform: "#fdba74", Integration: "#f9a8d4" };
  return m[cat ?? ""] ?? "#94a3b8";
}
var STATUS_COLORS = {
  idle: "",
  pending: "#f59e0b",
  running: "#3b82f6",
  completed: "#10b981",
  failed: "#ef4444"
};
function BlockNode({ block, isSelected, isMultiSelected, isPendingSource, status, onMouseDown, onClick, onOutputPortClick, onInputPortClick, pendingConnection }) {
  const def = getBlockTypeDef(block.type);
  const h = blockHeight(def);
  const inputs = def?.inputs ?? ["in"];
  const outputs = def?.outputs ?? ["out"];
  const statusColor = STATUS_COLORS[status];
  const borderColor = statusColor || (isSelected ? "var(--schift-blue)" : isMultiSelected ? "#8b5cf6" : isPendingSource ? "var(--schift-green)" : "var(--schift-gray-70)");
  const strokeW = isSelected || isMultiSelected || isPendingSource || statusColor ? 2 : 1;
  return /* @__PURE__ */ jsxs4("g", { transform: `translate(${block.position.x},${block.position.y})`, style: { cursor: "grab" }, onMouseDown: (e) => onMouseDown(e, block.id), onClick: (e) => onClick(e, block.id), children: [
    /* @__PURE__ */ jsx5("rect", { x: 2, y: 2, width: BLOCK_WIDTH, height: h, rx: 6, fill: "rgba(0,0,0,0.4)" }),
    /* @__PURE__ */ jsx5("rect", { width: BLOCK_WIDTH, height: h, rx: 6, fill: "var(--schift-gray-90)", stroke: borderColor, strokeWidth: strokeW }),
    statusColor && /* @__PURE__ */ jsx5("rect", { width: BLOCK_WIDTH, height: h, rx: 6, fill: "none", stroke: statusColor, strokeWidth: 3, opacity: 0.3 }),
    status === "running" && /* @__PURE__ */ jsx5("circle", { cx: BLOCK_WIDTH - 12, cy: 12, r: 4, fill: "none", stroke: statusColor, strokeWidth: 1.5, strokeDasharray: "6,4", style: { animation: "spin 1s linear infinite", transformOrigin: `${BLOCK_WIDTH - 12}px 12px` } }),
    status !== "idle" && /* @__PURE__ */ jsx5("circle", { cx: BLOCK_WIDTH - 12, cy: 12, r: 4, fill: statusColor }),
    /* @__PURE__ */ jsx5("rect", { x: 0, y: 0, width: 4, height: h, rx: 6, style: { fill: accentFill(def?.category) } }),
    /* @__PURE__ */ jsx5("text", { x: 16, y: 22, dominantBaseline: "middle", fontSize: "14", style: { userSelect: "none" }, children: def?.icon ?? "?" }),
    /* @__PURE__ */ jsx5("text", { x: 36, y: 18, fontSize: "11", fontWeight: "600", fill: "var(--schift-white)", style: { userSelect: "none" }, children: truncate(block.title, 16) }),
    /* @__PURE__ */ jsx5("text", { x: 36, y: 34, fontSize: "9", fill: badgeFill(def?.category), style: { userSelect: "none" }, children: def?.category ?? block.type }),
    inputs.map((port, i) => {
      const py = portY(i);
      const canConnect = !!pendingConnection && pendingConnection.sourceBlockId !== block.id;
      return /* @__PURE__ */ jsxs4("g", { children: [
        /* @__PURE__ */ jsx5("circle", { cx: 0, cy: py, r: PORT_HIT_SIZE / 2, fill: "transparent", style: { cursor: canConnect ? "pointer" : "default" }, onClick: (e) => {
          e.stopPropagation();
          onInputPortClick(e, block.id, port);
        } }),
        /* @__PURE__ */ jsx5("circle", { cx: 0, cy: py, r: PORT_SIZE / 2, fill: canConnect ? "var(--schift-green)" : "var(--schift-gray-70)", stroke: "var(--schift-gray-50)", strokeWidth: 1, style: { cursor: canConnect ? "pointer" : "default" }, onClick: (e) => {
          e.stopPropagation();
          onInputPortClick(e, block.id, port);
        } }),
        /* @__PURE__ */ jsx5("text", { x: 8, y: py, dominantBaseline: "middle", fontSize: "8", fill: "var(--schift-gray-50)", style: { userSelect: "none" }, children: port })
      ] }, `in-${port}`);
    }),
    outputs.map((port, i) => {
      const py = portY(i);
      return /* @__PURE__ */ jsxs4("g", { children: [
        /* @__PURE__ */ jsx5("circle", { cx: BLOCK_WIDTH, cy: py, r: PORT_HIT_SIZE / 2, fill: "transparent", style: { cursor: "crosshair" }, onClick: (e) => {
          e.stopPropagation();
          onOutputPortClick(e, block.id, port);
        } }),
        /* @__PURE__ */ jsx5("circle", { cx: BLOCK_WIDTH, cy: py, r: PORT_SIZE / 2, fill: "var(--schift-gray-60)", stroke: "var(--schift-gray-50)", strokeWidth: 1, style: { cursor: "crosshair" }, onClick: (e) => {
          e.stopPropagation();
          onOutputPortClick(e, block.id, port);
        } }),
        /* @__PURE__ */ jsx5("text", { x: BLOCK_WIDTH - 8, y: py, dominantBaseline: "middle", textAnchor: "end", fontSize: "8", fill: "var(--schift-gray-50)", style: { userSelect: "none" }, children: port })
      ] }, `out-${port}`);
    })
  ] });
}
function Minimap({ blocks, edges, pan, zoom, viewW, viewH }) {
  if (blocks.length === 0) return null;
  const mmW = 160;
  const mmH = 100;
  const minX = Math.min(...blocks.map((b) => b.position.x)) - 20;
  const minY = Math.min(...blocks.map((b) => b.position.y)) - 20;
  const maxX = Math.max(...blocks.map((b) => b.position.x + BLOCK_WIDTH)) + 20;
  const maxY = Math.max(...blocks.map((b) => b.position.y + blockHeight(getBlockTypeDef(b.type)))) + 20;
  const worldW = Math.max(maxX - minX, 100);
  const worldH = Math.max(maxY - minY, 100);
  const scale = Math.min(mmW / worldW, mmH / worldH);
  const vpX = (-pan.x / zoom - minX) * scale;
  const vpY = (-pan.y / zoom - minY) * scale;
  const vpW = viewW / zoom * scale;
  const vpH = viewH / zoom * scale;
  return /* @__PURE__ */ jsx5("div", { className: "absolute bottom-3 left-3 rounded-lg border border-[var(--schift-gray-70)] bg-[var(--schift-gray-100)]/90 overflow-hidden", style: { width: mmW, height: mmH }, children: /* @__PURE__ */ jsxs4("svg", { width: mmW, height: mmH, children: [
    edges.map((edge) => {
      const s = blocks.find((b) => b.id === edge.sourceBlockId);
      const t = blocks.find((b) => b.id === edge.targetBlockId);
      if (!s || !t) return null;
      return /* @__PURE__ */ jsx5("line", { x1: (s.position.x + BLOCK_WIDTH / 2 - minX) * scale, y1: (s.position.y + 20 - minY) * scale, x2: (t.position.x + BLOCK_WIDTH / 2 - minX) * scale, y2: (t.position.y + 20 - minY) * scale, stroke: "var(--schift-gray-60)", strokeWidth: 0.5 }, edge.id);
    }),
    blocks.map((b) => /* @__PURE__ */ jsx5("rect", { x: (b.position.x - minX) * scale, y: (b.position.y - minY) * scale, width: BLOCK_WIDTH * scale, height: 30 * scale, rx: 2, fill: accentFill(getBlockTypeDef(b.type)?.category), opacity: 0.7 }, b.id)),
    /* @__PURE__ */ jsx5("rect", { x: vpX, y: vpY, width: vpW, height: vpH, fill: "none", stroke: "var(--schift-blue)", strokeWidth: 1, rx: 1, opacity: 0.6 })
  ] }) });
}
function WorkflowCanvas({ blocks, edges, selectedBlockId, selectedBlockIds, blockStatuses, stickyNotes, onSelectBlock, onMoveBlock, onDropBlock, onQuickAddBlock, onAddEdge, onDeleteEdge, onUpdateStickyNote, onRemoveStickyNote }) {
  const { Button } = useWorkflowUI();
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [pan, setPan] = useState2({ x: 40, y: 40 });
  const [zoom, setZoom] = useState2(1);
  const [dragging, setDragging] = useState2(null);
  const [panning, setPanning] = useState2(null);
  const [pendingConnection, setPendingConnection] = useState2(null);
  const [mousePos, setMousePos] = useState2({ x: 0, y: 0 });
  const [selectedEdgeId, setSelectedEdgeId] = useState2(null);
  const [editingStickyId, setEditingStickyId] = useState2(null);
  const [containerSize, setContainerSize] = useState2({ w: 800, h: 600 });
  useEffect2(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setContainerSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const svgToWorld = useCallback2((cx, cy) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return { x: (cx - rect.left - pan.x) / zoom, y: (cy - rect.top - pan.y) / zoom };
  }, [pan, zoom]);
  const handleMouseMove = useCallback2((e) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    setMousePos({ x: (e.clientX - rect.left - pan.x) / zoom, y: (e.clientY - rect.top - pan.y) / zoom });
    if (dragging) {
      const dx = (e.clientX - dragging.startMouse.x) / zoom;
      const dy = (e.clientY - dragging.startMouse.y) / zoom;
      onMoveBlock(dragging.blockId, { x: dragging.startPos.x + dx, y: dragging.startPos.y + dy });
    } else if (panning) {
      setPan({ x: panning.startPan.x + (e.clientX - panning.startMouse.x), y: panning.startPan.y + (e.clientY - panning.startMouse.y) });
    }
  }, [dragging, panning, pan, zoom, onMoveBlock]);
  const handleMouseUp = useCallback2(() => {
    setDragging(null);
    setPanning(null);
  }, []);
  useEffect2(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);
  useEffect2(() => {
    if (selectedEdgeId && !edges.some((e) => e.id === selectedEdgeId)) setSelectedEdgeId(null);
  }, [edges, selectedEdgeId]);
  useEffect2(() => {
    const handler = (e) => {
      if (e.key === "Escape") {
        if (pendingConnection) setPendingConnection(null);
        if (selectedEdgeId) setSelectedEdgeId(null);
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedEdgeId && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        onDeleteEdge(selectedEdgeId);
        setSelectedEdgeId(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onDeleteEdge, pendingConnection, selectedEdgeId]);
  const handleBlockMouseDown = useCallback2((e, blockId) => {
    e.stopPropagation();
    if (pendingConnection) return;
    const block = blocks.find((b) => b.id === blockId);
    if (!block) return;
    setDragging({ blockId, startMouse: { x: e.clientX, y: e.clientY }, startPos: { ...block.position } });
  }, [blocks, pendingConnection]);
  const handleBlockClick = useCallback2((e, blockId) => {
    e.stopPropagation();
    setSelectedEdgeId(null);
    if (pendingConnection) {
      setPendingConnection(null);
      return;
    }
    onSelectBlock(blockId, e.shiftKey || e.metaKey);
  }, [pendingConnection, onSelectBlock]);
  const handleOutputPortClick = useCallback2((e, blockId, port) => {
    e.stopPropagation();
    setSelectedEdgeId(null);
    setPendingConnection({ sourceBlockId: blockId, sourcePort: port });
  }, []);
  const handleInputPortClick = useCallback2((e, blockId, port) => {
    e.stopPropagation();
    setSelectedEdgeId(null);
    if (pendingConnection && pendingConnection.sourceBlockId !== blockId) {
      onAddEdge(pendingConnection.sourceBlockId, pendingConnection.sourcePort, blockId, port);
      setPendingConnection(null);
    }
  }, [pendingConnection, onAddEdge]);
  const handleSvgMouseDown = useCallback2((e) => {
    setSelectedEdgeId(null);
    if (pendingConnection) {
      setPendingConnection(null);
      return;
    }
    onSelectBlock(null);
    setPanning({ startMouse: { x: e.clientX, y: e.clientY }, startPan: { ...pan } });
  }, [pendingConnection, pan, onSelectBlock]);
  const handleWheel = useCallback2((e) => {
    e.preventDefault();
    setZoom((z) => Math.min(Math.max(z * (e.deltaY > 0 ? 0.9 : 1.1), 0.2), 3));
  }, []);
  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };
  const handleDrop = (e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("block-type");
    if (type) onDropBlock(type, svgToWorld(e.clientX, e.clientY));
  };
  const edgePaths = edges.map((edge) => {
    const s = blocks.find((b) => b.id === edge.sourceBlockId);
    const t = blocks.find((b) => b.id === edge.targetBlockId);
    if (!s || !t) return null;
    const sp = getOutputPortPos(s, Math.max((getBlockTypeDef(s.type)?.outputs ?? ["out"]).indexOf(edge.sourcePort), 0));
    const tp = getInputPortPos(t, Math.max((getBlockTypeDef(t.type)?.inputs ?? ["in"]).indexOf(edge.targetPort), 0));
    return { edge, path: bezierPath(sp.x, sp.y, tp.x, tp.y) };
  }).filter(Boolean);
  let pendingPath = null;
  if (pendingConnection) {
    const s = blocks.find((b) => b.id === pendingConnection.sourceBlockId);
    if (s) {
      const sp = getOutputPortPos(s, Math.max((getBlockTypeDef(s.type)?.outputs ?? ["out"]).indexOf(pendingConnection.sourcePort), 0));
      pendingPath = bezierPath(sp.x, sp.y, mousePos.x, mousePos.y);
    }
  }
  return /* @__PURE__ */ jsxs4("div", { ref: containerRef, className: "flex-1 h-full relative overflow-hidden bg-[var(--schift-black)]", onDragOver: handleDragOver, onDrop: handleDrop, children: [
    /* @__PURE__ */ jsxs4("svg", { className: "absolute inset-0 w-full h-full pointer-events-none", style: { opacity: 0.15 }, "aria-hidden": "true", children: [
      /* @__PURE__ */ jsx5("defs", { children: /* @__PURE__ */ jsx5("pattern", { id: "grid", width: 20 * zoom, height: 20 * zoom, patternUnits: "userSpaceOnUse", x: pan.x % (20 * zoom), y: pan.y % (20 * zoom), children: /* @__PURE__ */ jsx5("circle", { cx: 0, cy: 0, r: 0.5, fill: "var(--schift-gray-50)" }) }) }),
      /* @__PURE__ */ jsx5("rect", { width: "100%", height: "100%", fill: "url(#grid)" })
    ] }),
    /* @__PURE__ */ jsx5("svg", { ref: svgRef, className: "absolute inset-0 w-full h-full", onMouseDown: handleSvgMouseDown, onWheel: handleWheel, style: { cursor: panning ? "grabbing" : pendingConnection ? "crosshair" : "default" }, children: /* @__PURE__ */ jsxs4("g", { transform: `translate(${pan.x},${pan.y}) scale(${zoom})`, children: [
      stickyNotes.map((note) => /* @__PURE__ */ jsx5("foreignObject", { x: note.position.x, y: note.position.y, width: 160, height: 100, children: /* @__PURE__ */ jsx5(
        "div",
        {
          className: "w-full h-full rounded-lg p-2 text-[11px] leading-4 overflow-hidden shadow-lg",
          style: { backgroundColor: note.color + "30", borderLeft: `3px solid ${note.color}` },
          onDoubleClick: () => setEditingStickyId(note.id),
          children: editingStickyId === note.id ? /* @__PURE__ */ jsx5(
            "textarea",
            {
              autoFocus: true,
              value: note.text,
              onChange: (e) => onUpdateStickyNote(note.id, { text: e.target.value }),
              onBlur: () => setEditingStickyId(null),
              onKeyDown: (e) => {
                if (e.key === "Escape") setEditingStickyId(null);
              },
              className: "w-full h-full bg-transparent border-none outline-none text-[11px] text-[var(--schift-white)] resize-none"
            }
          ) : /* @__PURE__ */ jsxs4("div", { className: "text-[var(--schift-gray-30)]", children: [
            note.text,
            /* @__PURE__ */ jsx5("button", { onClick: () => onRemoveStickyNote(note.id), className: "absolute top-1 right-1 text-[10px] text-[var(--schift-gray-60)] hover:text-red-400 opacity-0 group-hover:opacity-100", children: "\xD7" })
          ] })
        }
      ) }, note.id)),
      edgePaths.map(({ edge, path }) => /* @__PURE__ */ jsxs4("g", { children: [
        /* @__PURE__ */ jsx5("path", { d: path, fill: "none", stroke: "transparent", strokeWidth: 12, style: { cursor: "pointer" }, onClick: (e) => {
          e.stopPropagation();
          setSelectedEdgeId(edge.id);
        } }),
        /* @__PURE__ */ jsx5("path", { d: path, fill: "none", stroke: selectedEdgeId === edge.id ? "var(--schift-blue)" : "var(--schift-gray-60)", strokeWidth: selectedEdgeId === edge.id ? 2.5 : 1.5, markerEnd: "url(#arrow)", style: { pointerEvents: "none" } })
      ] }, edge.id)),
      pendingPath && /* @__PURE__ */ jsx5("path", { d: pendingPath, fill: "none", stroke: "var(--schift-green)", strokeWidth: 1.5, strokeDasharray: "5,3", style: { pointerEvents: "none" } }),
      /* @__PURE__ */ jsx5("defs", { children: /* @__PURE__ */ jsx5("marker", { id: "arrow", markerWidth: "8", markerHeight: "8", refX: "6", refY: "3", orient: "auto", children: /* @__PURE__ */ jsx5("path", { d: "M0,0 L0,6 L8,3 z", fill: "var(--schift-gray-60)" }) }) }),
      blocks.map((block) => /* @__PURE__ */ jsx5(
        BlockNode,
        {
          block,
          isSelected: selectedBlockId === block.id,
          isMultiSelected: selectedBlockIds.has(block.id) && selectedBlockIds.size > 1,
          isPendingSource: pendingConnection?.sourceBlockId === block.id,
          status: blockStatuses.get(block.id) ?? "idle",
          onMouseDown: handleBlockMouseDown,
          onClick: handleBlockClick,
          onOutputPortClick: handleOutputPortClick,
          onInputPortClick: handleInputPortClick,
          pendingConnection
        },
        block.id
      ))
    ] }) }),
    blocks.length === 0 && /* @__PURE__ */ jsx5("div", { className: "absolute inset-0 flex items-center justify-center px-6", children: /* @__PURE__ */ jsxs4("div", { className: "w-full max-w-lg rounded-xl border border-[var(--schift-gray-80)] bg-[var(--schift-gray-100)]/95 p-6 text-left shadow-2xl", children: [
      /* @__PURE__ */ jsx5("p", { className: "text-xs font-semibold uppercase tracking-wider text-[var(--schift-blue)] mb-2", children: "Start Here" }),
      /* @__PURE__ */ jsx5("h3", { className: "text-lg font-semibold text-[var(--schift-white)] mb-2", children: "Build your first flow in three steps" }),
      /* @__PURE__ */ jsxs4("div", { className: "space-y-2 text-sm text-[var(--schift-gray-30)]", children: [
        /* @__PURE__ */ jsx5("p", { children: "1. Add a starter block from the left palette or use the quick buttons below." }),
        /* @__PURE__ */ jsx5("p", { children: "2. Click a block to edit its config in the right panel." }),
        /* @__PURE__ */ jsx5("p", { children: "3. Click an output port, then click an input port to connect blocks." })
      ] }),
      onQuickAddBlock && /* @__PURE__ */ jsxs4("div", { className: "mt-5 flex flex-wrap gap-2", children: [
        /* @__PURE__ */ jsx5(Button, { size: "sm", onClick: () => onQuickAddBlock("start"), children: "Add Start" }),
        /* @__PURE__ */ jsx5(Button, { size: "sm", variant: "outline", onClick: () => onQuickAddBlock("document_loader"), children: "Add Document Loader" }),
        /* @__PURE__ */ jsx5(Button, { size: "sm", variant: "outline", onClick: () => onQuickAddBlock("llm"), children: "Add LLM" }),
        /* @__PURE__ */ jsx5(Button, { size: "sm", variant: "outline", onClick: () => onQuickAddBlock("answer"), children: "Add Answer" })
      ] }),
      /* @__PURE__ */ jsx5("p", { className: "text-xs text-[var(--schift-gray-50)] mt-4", children: "Scroll to zoom, drag the background to pan. Shift+click to multi-select. Ctrl+Z to undo." })
    ] }) }),
    /* @__PURE__ */ jsxs4("div", { className: "absolute bottom-3 right-3 text-[10px] text-[var(--schift-gray-60)] bg-[var(--schift-gray-90)] px-2 py-1 rounded pointer-events-none", children: [
      Math.round(zoom * 100),
      "%"
    ] }),
    pendingConnection && /* @__PURE__ */ jsxs4("div", { className: "absolute top-3 left-1/2 -translate-x-1/2 bg-[var(--schift-green)]/20 border border-[var(--schift-green)]/40 text-[var(--schift-green)] text-xs px-3 py-1.5 rounded pointer-events-none", children: [
      "Connecting from ",
      /* @__PURE__ */ jsx5("span", { className: "font-mono", children: pendingConnection.sourcePort }),
      ". Click any input port to finish, or press Escape to cancel."
    ] }),
    selectedEdgeId && /* @__PURE__ */ jsxs4("div", { className: "absolute bottom-3 left-1/2 -translate-x-1/2 rounded-lg border border-[var(--schift-blue)]/40 bg-[var(--schift-gray-100)]/95 px-3 py-3 shadow-lg", children: [
      /* @__PURE__ */ jsx5("p", { className: "text-xs font-medium text-[var(--schift-white)]", children: "Connection selected" }),
      /* @__PURE__ */ jsx5("p", { className: "text-xs text-[var(--schift-gray-50)] mt-1 mb-3", children: "Press Delete to remove, or click elsewhere to deselect." }),
      /* @__PURE__ */ jsxs4("div", { className: "flex items-center justify-end gap-2", children: [
        /* @__PURE__ */ jsx5(Button, { size: "sm", variant: "outline", onClick: () => setSelectedEdgeId(null), children: "Keep" }),
        /* @__PURE__ */ jsx5(Button, { size: "sm", variant: "destructive", onClick: () => {
          onDeleteEdge(selectedEdgeId);
          setSelectedEdgeId(null);
        }, children: "Remove" })
      ] })
    ] }),
    /* @__PURE__ */ jsx5(Minimap, { blocks, edges, pan, zoom, viewW: containerSize.w, viewH: containerSize.h })
  ] });
}

// src/workflow-editor/components/BlockConfigPanel.tsx
import { useState as useState4, useEffect as useEffect3 } from "react";

// src/workflow-editor/components/SchemaBuilder.tsx
import { useState as useState3, useCallback as useCallback3 } from "react";
import { jsx as jsx6, jsxs as jsxs5 } from "react/jsx-runtime";
var PRESETS = [
  {
    label: "Document Text",
    icon: "\u{1F4C4}",
    fields: [
      { id: "f1", name: "text", type: "string", description: "Extracted text", required: true, children: [] },
      {
        id: "f2",
        name: "tables",
        type: "array",
        description: "Extracted tables",
        required: false,
        children: [{
          id: "f2a",
          name: "items",
          type: "object",
          description: "",
          required: false,
          children: [
            { id: "f2a1", name: "headers", type: "array", description: "", required: false, children: [] },
            { id: "f2a2", name: "rows", type: "array", description: "", required: false, children: [] }
          ]
        }]
      },
      {
        id: "f3",
        name: "metadata",
        type: "object",
        description: "",
        required: false,
        children: [
          { id: "f3a", name: "language", type: "string", description: "", required: false, children: [] },
          { id: "f3b", name: "has_images", type: "boolean", description: "", required: false, children: [] }
        ]
      }
    ]
  },
  {
    label: "Contract Clauses",
    icon: "\u{1F4DC}",
    fields: [
      {
        id: "c1",
        name: "clauses",
        type: "array",
        description: "Contract clauses",
        required: true,
        children: [{
          id: "c1a",
          name: "items",
          type: "object",
          description: "",
          required: false,
          children: [
            { id: "c1a1", name: "number", type: "string", description: "Clause number", required: true, children: [] },
            { id: "c1a2", name: "title", type: "string", description: "Clause title", required: false, children: [] },
            { id: "c1a3", name: "text", type: "string", description: "Full clause text", required: true, children: [] },
            { id: "c1a4", name: "obligations", type: "array", description: "Obligations", required: false, children: [] }
          ]
        }]
      },
      { id: "c2", name: "parties", type: "array", description: "Contract parties", required: false, children: [] },
      { id: "c3", name: "effective_date", type: "string", description: "", required: false, children: [] }
    ]
  },
  {
    label: "Invoice",
    icon: "\u{1F9FE}",
    fields: [
      { id: "i1", name: "invoice_number", type: "string", description: "", required: true, children: [] },
      { id: "i2", name: "date", type: "string", description: "", required: true, children: [] },
      { id: "i3", name: "vendor", type: "string", description: "", required: true, children: [] },
      { id: "i4", name: "total_amount", type: "number", description: "", required: true, children: [] },
      {
        id: "i5",
        name: "line_items",
        type: "array",
        description: "",
        required: false,
        children: [{
          id: "i5a",
          name: "items",
          type: "object",
          description: "",
          required: false,
          children: [
            { id: "i5a1", name: "description", type: "string", description: "", required: false, children: [] },
            { id: "i5a2", name: "quantity", type: "number", description: "", required: false, children: [] },
            { id: "i5a3", name: "unit_price", type: "number", description: "", required: false, children: [] },
            { id: "i5a4", name: "amount", type: "number", description: "", required: false, children: [] }
          ]
        }]
      }
    ]
  },
  {
    label: "Resume / CV",
    icon: "\u{1F464}",
    fields: [
      { id: "r1", name: "name", type: "string", description: "", required: true, children: [] },
      { id: "r2", name: "email", type: "string", description: "", required: false, children: [] },
      { id: "r3", name: "summary", type: "string", description: "", required: false, children: [] },
      {
        id: "r4",
        name: "experience",
        type: "array",
        description: "",
        required: false,
        children: [{
          id: "r4a",
          name: "items",
          type: "object",
          description: "",
          required: false,
          children: [
            { id: "r4a1", name: "company", type: "string", description: "", required: false, children: [] },
            { id: "r4a2", name: "role", type: "string", description: "", required: false, children: [] },
            { id: "r4a3", name: "period", type: "string", description: "", required: false, children: [] },
            { id: "r4a4", name: "description", type: "string", description: "", required: false, children: [] }
          ]
        }]
      },
      { id: "r5", name: "skills", type: "array", description: "", required: false, children: [] }
    ]
  }
];
var _fieldCounter = 100;
function newId() {
  return `f_${++_fieldCounter}`;
}
function fieldsToJsonSchema(fields) {
  const properties = {};
  const required = [];
  for (const f of fields) {
    if (f.required) required.push(f.name);
    if (f.type === "object") {
      properties[f.name] = fieldsToJsonSchema(f.children);
    } else if (f.type === "array") {
      const itemChild = f.children.find((c) => c.name === "items");
      let items = { type: "string" };
      if (itemChild && itemChild.type === "object") {
        items = fieldsToJsonSchema(itemChild.children);
      } else if (itemChild) {
        items = { type: itemChild.type };
      }
      properties[f.name] = { type: "array", items };
    } else {
      const prop = { type: f.type };
      if (f.description) prop.description = f.description;
      properties[f.name] = prop;
    }
  }
  const schema = { type: "object", properties };
  if (required.length > 0) schema.required = required;
  return schema;
}
function jsonSchemaToFields(schema) {
  const props = schema.properties ?? {};
  const req = schema.required ?? [];
  return Object.entries(props).map(([name, prop]) => {
    const type = prop.type ?? "string";
    const field = {
      id: newId(),
      name,
      type,
      description: prop.description ?? "",
      required: req.includes(name),
      children: []
    };
    if (type === "object" && prop.properties) {
      field.children = jsonSchemaToFields(prop);
    } else if (type === "array" && prop.items) {
      const items = prop.items;
      if (items.type === "object" && items.properties) {
        field.children = [{
          id: newId(),
          name: "items",
          type: "object",
          description: "",
          required: false,
          children: jsonSchemaToFields(items)
        }];
      }
    }
    return field;
  });
}
function countFields(fields) {
  let count = 0;
  for (const f of fields) {
    count++;
    count += countFields(f.children);
  }
  return count;
}
var TYPE_ICONS = {
  string: "Aa",
  number: "#",
  boolean: "\u2713",
  array: "[ ]",
  object: "{ }"
};
var TYPE_COLORS = {
  string: "text-green-400",
  number: "text-blue-400",
  boolean: "text-yellow-400",
  array: "text-purple-400",
  object: "text-orange-400"
};
function FieldRow({
  field,
  depth,
  onUpdate,
  onRemove,
  onAddChild
}) {
  const [expanded, setExpanded] = useState3(true);
  const hasChildren = field.type === "object" || field.type === "array";
  const actualChildren = field.type === "array" ? field.children.find((c) => c.name === "items")?.children ?? [] : field.children;
  return /* @__PURE__ */ jsxs5("div", { children: [
    /* @__PURE__ */ jsxs5(
      "div",
      {
        className: "flex items-center gap-1.5 group py-1 hover:bg-[var(--schift-gray-80)]/50 rounded px-1",
        style: { paddingLeft: `${depth * 16 + 4}px` },
        children: [
          hasChildren ? /* @__PURE__ */ jsx6("button", { onClick: () => setExpanded(!expanded), className: "w-4 h-4 flex items-center justify-center text-[10px] text-[var(--schift-gray-50)] hover:text-[var(--schift-white)]", children: expanded ? "\u25BC" : "\u25B6" }) : /* @__PURE__ */ jsx6("span", { className: "w-4" }),
          /* @__PURE__ */ jsx6(
            "button",
            {
              onClick: () => {
                const types = ["string", "number", "boolean", "array", "object"];
                const idx = types.indexOf(field.type);
                onUpdate(field.id, { type: types[(idx + 1) % types.length], children: [] });
              },
              className: `text-[10px] font-mono w-6 text-center ${TYPE_COLORS[field.type]} hover:opacity-70`,
              title: "Click to change type",
              children: TYPE_ICONS[field.type]
            }
          ),
          /* @__PURE__ */ jsx6(
            "input",
            {
              value: field.name,
              onChange: (e) => onUpdate(field.id, { name: e.target.value }),
              placeholder: "field_name",
              className: "flex-1 min-w-0 bg-transparent text-xs text-[var(--schift-gray-20)] border-none outline-none font-mono"
            }
          ),
          /* @__PURE__ */ jsx6(
            "button",
            {
              onClick: () => onUpdate(field.id, { required: !field.required }),
              className: `text-[10px] px-1 rounded ${field.required ? "text-red-400 bg-red-400/10" : "text-[var(--schift-gray-60)] hover:text-[var(--schift-gray-40)]"}`,
              title: field.required ? "Required (click to make optional)" : "Optional (click to make required)",
              children: field.required ? "req" : "opt"
            }
          ),
          hasChildren && /* @__PURE__ */ jsx6("button", { onClick: () => onAddChild(field.id), className: "text-[10px] text-[var(--schift-gray-50)] hover:text-[var(--schift-blue)] opacity-0 group-hover:opacity-100", title: "Add child field", children: "+" }),
          /* @__PURE__ */ jsx6("button", { onClick: () => onRemove(field.id), className: "text-[10px] text-[var(--schift-gray-60)] hover:text-red-400 opacity-0 group-hover:opacity-100", title: "Remove field", children: "\xD7" })
        ]
      }
    ),
    depth === 0 && /* @__PURE__ */ jsx6("div", { style: { paddingLeft: `${depth * 16 + 28}px` }, children: /* @__PURE__ */ jsx6("input", { value: field.description, onChange: (e) => onUpdate(field.id, { description: e.target.value }), placeholder: "description (optional)", className: "w-full bg-transparent text-[10px] text-[var(--schift-gray-60)] border-none outline-none italic" }) }),
    hasChildren && expanded && actualChildren.length > 0 && /* @__PURE__ */ jsx6("div", { children: actualChildren.map((child) => /* @__PURE__ */ jsx6(FieldRow, { field: child, depth: depth + 1, onUpdate, onRemove, onAddChild }, child.id)) })
  ] });
}
function SchemaBuilder({ value, onChange }) {
  const [fields, setFields] = useState3(() => {
    if (value && typeof value === "object" && "properties" in value) return jsonSchemaToFields(value);
    return [];
  });
  const [showPresets, setShowPresets] = useState3(fields.length === 0);
  const [showJson, setShowJson] = useState3(false);
  const emitChange = useCallback3((newFields) => {
    setFields(newFields);
    onChange(fieldsToJsonSchema(newFields));
  }, [onChange]);
  const addField = () => {
    emitChange([...fields, { id: newId(), name: `field_${fields.length + 1}`, type: "string", description: "", required: false, children: [] }]);
  };
  const addChildToField = (parentId) => {
    const child = { id: newId(), name: "field", type: "string", description: "", required: false, children: [] };
    function addToTree(items) {
      return items.map((f) => {
        if (f.id === parentId) {
          if (f.type === "array") {
            const itemsChild = f.children.find((c) => c.name === "items");
            if (itemsChild) return { ...f, children: f.children.map((c) => c.name === "items" ? { ...c, children: [...c.children, child] } : c) };
            return { ...f, children: [{ id: newId(), name: "items", type: "object", description: "", required: false, children: [child] }] };
          }
          return { ...f, children: [...f.children, child] };
        }
        return { ...f, children: addToTree(f.children) };
      });
    }
    emitChange(addToTree(fields));
  };
  const updateField = (id, updates) => {
    function updateTree(items) {
      return items.map((f) => f.id === id ? { ...f, ...updates } : { ...f, children: updateTree(f.children) });
    }
    emitChange(updateTree(fields));
  };
  const removeField = (id) => {
    function removeFromTree(items) {
      return items.filter((f) => f.id !== id).map((f) => ({ ...f, children: removeFromTree(f.children) }));
    }
    emitChange(removeFromTree(fields));
  };
  const applyPreset = (preset) => {
    emitChange(preset.fields);
    setShowPresets(false);
  };
  const schema = fieldsToJsonSchema(fields);
  return /* @__PURE__ */ jsxs5("div", { className: "space-y-2", children: [
    /* @__PURE__ */ jsxs5("div", { className: "flex items-center justify-between", children: [
      /* @__PURE__ */ jsx6("label", { className: "text-xs text-[var(--schift-gray-50)]", children: "Output Schema" }),
      /* @__PURE__ */ jsxs5("div", { className: "flex gap-1", children: [
        /* @__PURE__ */ jsx6("button", { onClick: () => setShowPresets(!showPresets), className: "text-[10px] px-1.5 py-0.5 rounded bg-[var(--schift-gray-80)] text-[var(--schift-gray-40)] hover:text-[var(--schift-white)]", children: "Presets" }),
        /* @__PURE__ */ jsx6("button", { onClick: () => setShowJson(!showJson), className: "text-[10px] px-1.5 py-0.5 rounded bg-[var(--schift-gray-80)] text-[var(--schift-gray-40)] hover:text-[var(--schift-white)]", children: showJson ? "Visual" : "JSON" })
      ] })
    ] }),
    showPresets && /* @__PURE__ */ jsx6("div", { className: "grid grid-cols-2 gap-1.5", children: PRESETS.map((p) => /* @__PURE__ */ jsxs5("button", { onClick: () => applyPreset(p), className: "flex items-center gap-1.5 px-2 py-1.5 text-[10px] bg-[var(--schift-gray-80)] hover:bg-[var(--schift-gray-70)] rounded text-[var(--schift-gray-30)] text-left", children: [
      /* @__PURE__ */ jsx6("span", { children: p.icon }),
      /* @__PURE__ */ jsx6("span", { children: p.label })
    ] }, p.label)) }),
    showJson ? /* @__PURE__ */ jsx6(
      "textarea",
      {
        value: JSON.stringify(schema, null, 2),
        onChange: (e) => {
          try {
            const parsed = JSON.parse(e.target.value);
            onChange(parsed);
            setFields(jsonSchemaToFields(parsed));
          } catch {
          }
        },
        rows: 8,
        className: "w-full px-2 py-1.5 text-[10px] font-mono bg-[var(--schift-gray-100)] border border-[var(--schift-gray-70)] rounded text-[var(--schift-gray-30)] focus:outline-none focus:border-[var(--schift-blue)] resize-none"
      }
    ) : /* @__PURE__ */ jsxs5("div", { className: "bg-[var(--schift-gray-90)] border border-[var(--schift-gray-70)] rounded overflow-hidden", children: [
      fields.length === 0 ? /* @__PURE__ */ jsx6("p", { className: "text-[10px] text-[var(--schift-gray-60)] text-center py-4", children: "No fields defined. Add a field or pick a preset." }) : /* @__PURE__ */ jsx6("div", { className: "py-1", children: fields.map((f) => /* @__PURE__ */ jsx6(FieldRow, { field: f, depth: 0, onUpdate: updateField, onRemove: removeField, onAddChild: addChildToField }, f.id)) }),
      /* @__PURE__ */ jsx6("div", { className: "border-t border-[var(--schift-gray-70)] px-2 py-1.5", children: /* @__PURE__ */ jsx6("button", { onClick: addField, className: "text-[10px] text-[var(--schift-blue)] hover:text-[var(--schift-blue-light)]", children: "+ Add field" }) })
    ] }),
    fields.length > 0 && /* @__PURE__ */ jsxs5("p", { className: "text-[10px] text-[var(--schift-gray-60)]", children: [
      countFields(fields),
      " fields defined"
    ] })
  ] });
}

// src/workflow-editor/components/BlockConfigPanel.tsx
import { jsx as jsx7, jsxs as jsxs6 } from "react/jsx-runtime";
var FIELD_TYPES = ["string", "number", "boolean", "array", "object"];
function FieldsEditor({
  value,
  onChange
}) {
  const addField = () => {
    onChange([...value, { name: "", type: "string" }]);
  };
  const removeField = (idx) => {
    onChange(value.filter((_, i) => i !== idx));
  };
  const updateField = (idx, updates) => {
    onChange(value.map((f, i) => i === idx ? { ...f, ...updates } : f));
  };
  const addSubItem = (idx) => {
    const field = value[idx];
    const items = field.items ?? [];
    updateField(idx, { items: [...items, { name: "", type: "string" }] });
  };
  const updateSubItem = (fieldIdx, subIdx, updates) => {
    const field = value[fieldIdx];
    const items = (field.items ?? []).map((s, i) => i === subIdx ? { ...s, ...updates } : s);
    updateField(fieldIdx, { items });
  };
  const removeSubItem = (fieldIdx, subIdx) => {
    const field = value[fieldIdx];
    updateField(fieldIdx, { items: (field.items ?? []).filter((_, i) => i !== subIdx) });
  };
  return /* @__PURE__ */ jsxs6("div", { className: "space-y-2", children: [
    /* @__PURE__ */ jsxs6("div", { className: "flex items-center justify-between", children: [
      /* @__PURE__ */ jsx7("label", { className: "text-xs text-[var(--schift-gray-50)]", children: "Fields" }),
      /* @__PURE__ */ jsx7("button", { onClick: addField, className: "text-[10px] text-[var(--schift-blue)] hover:underline", children: "+ Add" })
    ] }),
    value.length === 0 && /* @__PURE__ */ jsx7("p", { className: "text-[10px] text-[var(--schift-gray-60)] text-center py-2", children: "No fields. Click + Add to define extraction fields." }),
    value.map((field, idx) => /* @__PURE__ */ jsxs6("div", { className: "rounded border border-[var(--schift-gray-70)] bg-[var(--schift-gray-90)] p-2 space-y-1.5", children: [
      /* @__PURE__ */ jsxs6("div", { className: "flex items-center gap-1", children: [
        /* @__PURE__ */ jsx7(
          "input",
          {
            value: field.name,
            onChange: (e) => updateField(idx, { name: e.target.value }),
            placeholder: "field_name",
            className: "flex-1 min-w-0 bg-transparent text-xs text-[var(--schift-gray-20)] border-none outline-none font-mono"
          }
        ),
        /* @__PURE__ */ jsx7(
          "select",
          {
            value: field.type,
            onChange: (e) => updateField(idx, { type: e.target.value, items: e.target.value === "array" ? field.items ?? [] : void 0 }),
            className: "bg-[var(--schift-gray-100)] text-[10px] text-[var(--schift-gray-30)] border border-[var(--schift-gray-70)] rounded px-1 py-0.5",
            children: FIELD_TYPES.map((t) => /* @__PURE__ */ jsx7("option", { value: t, children: t }, t))
          }
        ),
        /* @__PURE__ */ jsx7("button", { onClick: () => removeField(idx), className: "text-[10px] text-[var(--schift-gray-60)] hover:text-red-400", children: "\xD7" })
      ] }),
      field.type === "array" && /* @__PURE__ */ jsxs6("div", { className: "ml-3 border-l-2 border-[var(--schift-gray-70)] pl-2 space-y-1", children: [
        /* @__PURE__ */ jsxs6("div", { className: "flex items-center justify-between", children: [
          /* @__PURE__ */ jsx7("span", { className: "text-[10px] text-[var(--schift-gray-60)]", children: "array items:" }),
          /* @__PURE__ */ jsx7("button", { onClick: () => addSubItem(idx), className: "text-[10px] text-[var(--schift-blue)]", children: "+" })
        ] }),
        (field.items ?? []).map((sub, sIdx) => /* @__PURE__ */ jsxs6("div", { className: "flex items-center gap-1", children: [
          /* @__PURE__ */ jsx7(
            "input",
            {
              value: sub.name,
              onChange: (e) => updateSubItem(idx, sIdx, { name: e.target.value }),
              placeholder: "sub_field",
              className: "flex-1 min-w-0 bg-transparent text-[10px] text-[var(--schift-gray-20)] border-none outline-none font-mono"
            }
          ),
          /* @__PURE__ */ jsx7(
            "select",
            {
              value: sub.type,
              onChange: (e) => updateSubItem(idx, sIdx, { type: e.target.value }),
              className: "bg-[var(--schift-gray-100)] text-[10px] text-[var(--schift-gray-30)] border border-[var(--schift-gray-70)] rounded px-1 py-0.5",
              children: ["string", "number", "boolean"].map((t) => /* @__PURE__ */ jsx7("option", { value: t, children: t }, t))
            }
          ),
          /* @__PURE__ */ jsx7("button", { onClick: () => removeSubItem(idx, sIdx), className: "text-[10px] text-[var(--schift-gray-60)] hover:text-red-400", children: "\xD7" })
        ] }, sIdx))
      ] })
    ] }, idx)),
    value.length > 0 && /* @__PURE__ */ jsxs6("p", { className: "text-[10px] text-[var(--schift-gray-60)]", children: [
      value.length,
      " field",
      value.length > 1 ? "s" : "",
      " defined \u2192 items output as Array<Object>"
    ] })
  ] });
}
function ConfigField({
  name,
  value,
  onChange
}) {
  const { Input } = useWorkflowUI();
  const strVal = value === null || value === void 0 ? "" : String(value);
  if (name === "strategy" && typeof value === "string") {
    return /* @__PURE__ */ jsxs6("div", { children: [
      /* @__PURE__ */ jsx7("label", { className: "text-xs text-[var(--schift-gray-50)] block mb-1 capitalize", children: name }),
      /* @__PURE__ */ jsx7("select", { value: strVal, onChange: (e) => onChange(e.target.value), className: "w-full h-8 px-2 text-xs bg-[var(--schift-gray-100)] border border-[var(--schift-gray-70)] rounded text-[var(--schift-gray-30)] focus:outline-none focus:border-[var(--schift-blue)]", children: ["fixed", "sentence", "paragraph", "semantic", "concat"].map((opt) => /* @__PURE__ */ jsx7("option", { value: opt, children: opt }, opt)) })
    ] });
  }
  if (name === "method" && typeof value === "string") {
    return /* @__PURE__ */ jsxs6("div", { children: [
      /* @__PURE__ */ jsx7("label", { className: "text-xs text-[var(--schift-gray-50)] block mb-1 capitalize", children: name }),
      /* @__PURE__ */ jsx7("select", { value: strVal, onChange: (e) => onChange(e.target.value), className: "w-full h-8 px-2 text-xs bg-[var(--schift-gray-100)] border border-[var(--schift-gray-70)] rounded text-[var(--schift-gray-30)] focus:outline-none focus:border-[var(--schift-blue)]", children: ["GET", "POST", "PUT", "PATCH", "DELETE"].map((opt) => /* @__PURE__ */ jsx7("option", { value: opt, children: opt }, opt)) })
    ] });
  }
  if (name === "language" && typeof value === "string") {
    return /* @__PURE__ */ jsxs6("div", { children: [
      /* @__PURE__ */ jsx7("label", { className: "text-xs text-[var(--schift-gray-50)] block mb-1 capitalize", children: name }),
      /* @__PURE__ */ jsx7("select", { value: strVal, onChange: (e) => onChange(e.target.value), className: "w-full h-8 px-2 text-xs bg-[var(--schift-gray-100)] border border-[var(--schift-gray-70)] rounded text-[var(--schift-gray-30)] focus:outline-none focus:border-[var(--schift-blue)]", children: ["python", "javascript", "typescript"].map((opt) => /* @__PURE__ */ jsx7("option", { value: opt, children: opt }, opt)) })
    ] });
  }
  if (name === "code" || name === "template") {
    return /* @__PURE__ */ jsxs6("div", { children: [
      /* @__PURE__ */ jsx7("label", { className: "text-xs text-[var(--schift-gray-50)] block mb-1 capitalize", children: name }),
      /* @__PURE__ */ jsx7("textarea", { value: strVal, onChange: (e) => onChange(e.target.value), rows: 4, className: "w-full px-2 py-1.5 text-xs font-mono bg-[var(--schift-gray-100)] border border-[var(--schift-gray-70)] rounded text-[var(--schift-gray-30)] focus:outline-none focus:border-[var(--schift-blue)] resize-none" })
    ] });
  }
  if (typeof value === "number") {
    return /* @__PURE__ */ jsxs6("div", { children: [
      /* @__PURE__ */ jsx7("label", { className: "text-xs text-[var(--schift-gray-50)] block mb-1 capitalize", children: name.replace(/_/g, " ") }),
      /* @__PURE__ */ jsx7(Input, { type: "number", value: strVal, onChange: (e) => onChange(Number(e.target.value)), className: "h-8 text-xs" })
    ] });
  }
  if (typeof value === "boolean") {
    return /* @__PURE__ */ jsxs6("div", { className: "flex items-center gap-2", children: [
      /* @__PURE__ */ jsx7("input", { type: "checkbox", id: `cfg-${name}`, checked: value, onChange: (e) => onChange(e.target.checked), className: "w-3.5 h-3.5 accent-[var(--schift-blue)]" }),
      /* @__PURE__ */ jsx7("label", { htmlFor: `cfg-${name}`, className: "text-xs text-[var(--schift-gray-30)] capitalize", children: name.replace(/_/g, " ") })
    ] });
  }
  if (name === "output_schema" && typeof value === "object" && value !== null) {
    return /* @__PURE__ */ jsx7(SchemaBuilder, { value, onChange: (schema) => onChange(schema) });
  }
  if (name === "fields" && Array.isArray(value)) {
    return /* @__PURE__ */ jsx7(FieldsEditor, { value, onChange });
  }
  if (Array.isArray(value) || typeof value === "object" && value !== null) {
    return /* @__PURE__ */ jsxs6("div", { children: [
      /* @__PURE__ */ jsxs6("label", { className: "text-xs text-[var(--schift-gray-50)] block mb-1 capitalize", children: [
        name.replace(/_/g, " "),
        " (JSON)"
      ] }),
      /* @__PURE__ */ jsx7("textarea", { value: JSON.stringify(value, null, 2), onChange: (e) => {
        try {
          onChange(JSON.parse(e.target.value));
        } catch {
        }
      }, rows: 3, className: "w-full px-2 py-1.5 text-xs font-mono bg-[var(--schift-gray-100)] border border-[var(--schift-gray-70)] rounded text-[var(--schift-gray-30)] focus:outline-none focus:border-[var(--schift-blue)] resize-none" })
    ] });
  }
  return /* @__PURE__ */ jsxs6("div", { children: [
    /* @__PURE__ */ jsx7("label", { className: "text-xs text-[var(--schift-gray-50)] block mb-1 capitalize", children: name.replace(/_/g, " ") }),
    /* @__PURE__ */ jsx7(Input, { type: "text", value: strVal, onChange: (e) => onChange(e.target.value), className: "h-8 text-xs" })
  ] });
}
function BlockConfigPanel({ block, onUpdate, onDelete, onClose }) {
  const { Button, Input } = useWorkflowUI();
  const [title, setTitle] = useState4("");
  const [config, setConfig] = useState4({});
  const [confirmDelete, setConfirmDelete] = useState4(false);
  useEffect3(() => {
    if (block) {
      setTitle(block.title);
      setConfig({ ...block.config });
      setConfirmDelete(false);
    }
  }, [block?.id]);
  if (!block) {
    return /* @__PURE__ */ jsx7("aside", { className: "w-64 flex-shrink-0 h-full bg-[var(--schift-gray-100)] border-l border-[var(--schift-gray-80)] flex items-center justify-center", children: /* @__PURE__ */ jsxs6("div", { className: "px-4 text-center", children: [
      /* @__PURE__ */ jsx7("p", { className: "text-sm text-[var(--schift-white)] mb-2", children: "Pick a block to configure it" }),
      /* @__PURE__ */ jsxs6("div", { className: "rounded-lg border border-[var(--schift-gray-80)] bg-[var(--schift-gray-90)] px-4 py-3 text-left", children: [
        /* @__PURE__ */ jsx7("p", { className: "text-[10px] font-semibold text-[var(--schift-gray-50)] uppercase tracking-wider mb-2", children: "Quick guide" }),
        /* @__PURE__ */ jsxs6("ul", { className: "space-y-1 text-[11px] text-[var(--schift-gray-30)] leading-5", children: [
          /* @__PURE__ */ jsx7("li", { children: "Click a block once to open its settings here." }),
          /* @__PURE__ */ jsx7("li", { children: "Use the right-side port on one block, then the left-side port on another to connect them." }),
          /* @__PURE__ */ jsx7("li", { children: "Deleting a block also removes any edges attached to it." })
        ] })
      ] })
    ] }) });
  }
  const def = getBlockTypeDef(block.type);
  const badgeColor = def ? CATEGORY_BADGE_COLORS[def.category] : "bg-slate-500/20 text-slate-300";
  const accentColor = def ? CATEGORY_ACCENT[def.category] : "border-l-slate-500";
  const handleTitleChange = () => {
    onUpdate(block.id, { title });
  };
  const handleConfigChange = (key, val) => {
    const newConfig = { ...config, [key]: val };
    setConfig(newConfig);
    onUpdate(block.id, { config: newConfig });
  };
  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    onDelete(block.id);
  };
  return /* @__PURE__ */ jsxs6("aside", { className: "w-64 flex-shrink-0 h-full bg-[var(--schift-gray-100)] border-l border-[var(--schift-gray-80)] flex flex-col overflow-hidden", children: [
    /* @__PURE__ */ jsxs6("div", { className: `px-4 py-3 border-b border-[var(--schift-gray-80)] border-l-4 ${accentColor} flex items-center justify-between`, children: [
      /* @__PURE__ */ jsxs6("div", { className: "flex items-center gap-2 min-w-0", children: [
        /* @__PURE__ */ jsx7("span", { className: "text-base", children: def?.icon ?? "?" }),
        /* @__PURE__ */ jsxs6("div", { className: "min-w-0", children: [
          /* @__PURE__ */ jsx7("p", { className: "text-sm font-medium text-[var(--schift-white)] truncate", children: block.title }),
          def && /* @__PURE__ */ jsx7("span", { className: `text-[10px] px-1.5 py-0.5 rounded font-medium ${badgeColor}`, children: def.category })
        ] })
      ] }),
      /* @__PURE__ */ jsx7("button", { onClick: onClose, className: "text-[var(--schift-gray-50)] hover:text-[var(--schift-white)] flex-shrink-0 ml-2", "aria-label": "Close panel", children: "\xD7" })
    ] }),
    /* @__PURE__ */ jsxs6("div", { className: "flex-1 overflow-y-auto px-4 py-4 space-y-4", children: [
      /* @__PURE__ */ jsxs6("div", { children: [
        /* @__PURE__ */ jsx7("label", { className: "text-xs text-[var(--schift-gray-50)] block mb-1", children: "Title" }),
        /* @__PURE__ */ jsx7(Input, { type: "text", value: title, onChange: (e) => setTitle(e.target.value), onBlur: handleTitleChange, onKeyDown: (e) => e.key === "Enter" && handleTitleChange(), className: "h-8 text-xs" })
      ] }),
      /* @__PURE__ */ jsxs6("div", { children: [
        /* @__PURE__ */ jsx7("p", { className: "text-xs text-[var(--schift-gray-50)] mb-1", children: "Position" }),
        /* @__PURE__ */ jsxs6("p", { className: "text-xs font-mono text-[var(--schift-gray-60)]", children: [
          "x: ",
          Math.round(block.position.x),
          ", y: ",
          Math.round(block.position.y)
        ] })
      ] }),
      /* @__PURE__ */ jsxs6("div", { className: "rounded-lg border border-[var(--schift-gray-80)] bg-[var(--schift-gray-90)] px-3 py-3", children: [
        /* @__PURE__ */ jsx7("p", { className: "text-[10px] font-semibold text-[var(--schift-gray-50)] uppercase tracking-wider mb-2", children: "Next step" }),
        /* @__PURE__ */ jsx7("p", { className: "text-[11px] text-[var(--schift-gray-30)] leading-5", children: "Edit this block here, then connect its right-side outputs to another block's left-side inputs on the canvas." })
      ] }),
      Object.keys(config).length > 0 && /* @__PURE__ */ jsxs6("div", { children: [
        /* @__PURE__ */ jsx7("p", { className: "text-xs font-semibold text-[var(--schift-gray-50)] uppercase tracking-wider mb-3", children: "Configuration" }),
        /* @__PURE__ */ jsx7("div", { className: "space-y-3", children: Object.entries(config).map(([key, val]) => /* @__PURE__ */ jsx7(ConfigField, { name: key, value: val, onChange: (v) => handleConfigChange(key, v) }, key)) })
      ] }),
      def && (def.inputs.length > 0 || def.outputs.length > 0) && /* @__PURE__ */ jsxs6("div", { children: [
        /* @__PURE__ */ jsx7("p", { className: "text-xs font-semibold text-[var(--schift-gray-50)] uppercase tracking-wider mb-2", children: "Ports" }),
        /* @__PURE__ */ jsx7("p", { className: "text-[10px] text-[var(--schift-gray-60)] mb-2", children: "Inputs accept incoming data on the left. Outputs send data from the right." }),
        def.inputs.length > 0 && /* @__PURE__ */ jsxs6("div", { className: "mb-2", children: [
          /* @__PURE__ */ jsx7("p", { className: "text-[10px] text-[var(--schift-gray-60)] mb-1", children: "Inputs" }),
          /* @__PURE__ */ jsx7("div", { className: "flex flex-wrap gap-1", children: def.inputs.map((p) => /* @__PURE__ */ jsx7("span", { className: "text-[10px] px-1.5 py-0.5 bg-[var(--schift-gray-80)] rounded text-[var(--schift-gray-30)]", children: p }, p)) })
        ] }),
        def.outputs.length > 0 && /* @__PURE__ */ jsxs6("div", { children: [
          /* @__PURE__ */ jsx7("p", { className: "text-[10px] text-[var(--schift-gray-60)] mb-1", children: "Outputs" }),
          /* @__PURE__ */ jsx7("div", { className: "flex flex-wrap gap-1", children: def.outputs.map((p) => /* @__PURE__ */ jsx7("span", { className: "text-[10px] px-1.5 py-0.5 bg-[var(--schift-gray-80)] rounded text-[var(--schift-gray-30)]", children: p }, p)) })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxs6("div", { className: "px-4 py-3 border-t border-[var(--schift-gray-80)]", children: [
      confirmDelete && /* @__PURE__ */ jsx7("p", { className: "text-[11px] text-[var(--schift-red)] mb-2 leading-5", children: "Delete this block and every edge connected to it?" }),
      /* @__PURE__ */ jsx7(Button, { variant: "destructive", size: "sm", className: "w-full", onClick: handleDelete, children: confirmDelete ? "Confirm delete" : "Delete block" }),
      confirmDelete && /* @__PURE__ */ jsx7(Button, { variant: "ghost", size: "sm", className: "w-full mt-2 text-xs", onClick: () => setConfirmDelete(false), children: "Keep block" })
    ] })
  ] });
}

// src/workflow-editor/utils/workflow-graph.ts
function workflowToEditorState(workflow) {
  return {
    workflowId: workflow.id,
    name: workflow.name,
    blocks: workflow.graph.blocks.map((block) => ({
      id: block.id,
      type: block.type,
      title: block.title,
      config: { ...block.config },
      position: { x: block.position.x, y: block.position.y }
    })),
    edges: workflow.graph.edges.map((edge) => ({
      id: edge.id,
      sourceBlockId: edge.source,
      sourcePort: edge.source_handle ?? "out",
      targetBlockId: edge.target,
      targetPort: edge.target_handle ?? "in"
    }))
  };
}
function editorStateToGraph(blocks, edges) {
  return {
    blocks: blocks.map((block) => ({
      id: block.id,
      type: block.type,
      title: block.title,
      config: { ...block.config },
      position: { x: block.position.x, y: block.position.y }
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.sourceBlockId,
      target: edge.targetBlockId,
      source_handle: edge.sourcePort,
      target_handle: edge.targetPort
    }))
  };
}

// src/workflow-editor/components/WorkflowBuilder.tsx
import { Fragment, jsx as jsx8, jsxs as jsxs7 } from "react/jsx-runtime";
var MAX_HISTORY = 50;
var SKIP_HISTORY = /* @__PURE__ */ new Set(["MOVE_BLOCK", "LOAD", "SET_WORKFLOW_ID"]);
function workflowReducer(state, action) {
  switch (action.type) {
    case "SET_NAME":
      return { ...state, name: action.name };
    case "SET_WORKFLOW_ID":
      return { ...state, workflowId: action.id };
    case "ADD_BLOCK":
      return { ...state, blocks: [...state.blocks, action.block] };
    case "UPDATE_BLOCK":
      return { ...state, blocks: state.blocks.map((b) => b.id === action.blockId ? { ...b, ...action.updates } : b) };
    case "MOVE_BLOCK":
      return { ...state, blocks: state.blocks.map((b) => b.id === action.blockId ? { ...b, position: action.pos } : b) };
    case "REMOVE_BLOCK":
      return { ...state, blocks: state.blocks.filter((b) => b.id !== action.blockId), edges: state.edges.filter((e) => e.sourceBlockId !== action.blockId && e.targetBlockId !== action.blockId) };
    case "ADD_EDGE":
      return { ...state, edges: [...state.edges, action.edge] };
    case "REMOVE_EDGE":
      return { ...state, edges: state.edges.filter((e) => e.id !== action.edgeId) };
    case "LOAD":
      return action.state;
    default:
      return state;
  }
}
function historyReducer(histState, action) {
  if (action.type === "UNDO") {
    if (histState.past.length === 0) return histState;
    const prev = histState.past[histState.past.length - 1];
    return {
      past: histState.past.slice(0, -1),
      present: prev,
      future: [histState.present, ...histState.future]
    };
  }
  if (action.type === "REDO") {
    if (histState.future.length === 0) return histState;
    const next = histState.future[0];
    return {
      past: [...histState.past, histState.present],
      present: next,
      future: histState.future.slice(1)
    };
  }
  const newPresent = workflowReducer(histState.present, action);
  if (newPresent === histState.present) return histState;
  if (SKIP_HISTORY.has(action.type)) {
    return { ...histState, present: newPresent };
  }
  return {
    past: [...histState.past.slice(-MAX_HISTORY), histState.present],
    present: newPresent,
    future: []
  };
}
function useUndoReducer(initial) {
  const [hist, rawDispatch] = useState5({ past: [], present: initial, future: [] });
  const dispatch = useCallback4((action) => {
    rawDispatch((h) => historyReducer(h, action));
  }, []);
  return { state: hist.present, dispatch, canUndo: hist.past.length > 0, canRedo: hist.future.length > 0 };
}
var initialState = { workflowId: null, name: "Untitled Workflow", blocks: [], edges: [] };
var QUICK_ADD_POSITIONS = [
  { x: 80, y: 80 },
  { x: 340, y: 80 },
  { x: 600, y: 80 },
  { x: 80, y: 260 },
  { x: 340, y: 260 },
  { x: 600, y: 260 }
];
var STICKY_COLORS = ["#fbbf24", "#34d399", "#60a5fa", "#f472b6", "#a78bfa"];
function WorkflowBuilder({ onBack, initialWorkflowId }) {
  const api = useWorkflowAPI();
  const { Button, LoadingSpinner, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } = useWorkflowUI();
  const { state, dispatch, canUndo, canRedo } = useUndoReducer(initialState);
  const [selectedBlockIds, setSelectedBlockIds] = useState5(/* @__PURE__ */ new Set());
  const selectedBlockId = selectedBlockIds.size === 1 ? Array.from(selectedBlockIds)[0] : null;
  const selectedBlock = selectedBlockId ? state.blocks.find((b) => b.id === selectedBlockId) ?? null : null;
  const selectBlock = useCallback4((id, additive = false) => {
    if (!id) {
      setSelectedBlockIds(/* @__PURE__ */ new Set());
      return;
    }
    if (additive) {
      setSelectedBlockIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    } else {
      setSelectedBlockIds(/* @__PURE__ */ new Set([id]));
    }
  }, []);
  const [stickyNotes, setStickyNotes] = useState5([]);
  const addStickyNote = useCallback4(() => {
    const note = {
      id: `note_${Date.now()}`,
      text: "Double-click to edit",
      position: { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 },
      color: STICKY_COLORS[stickyNotes.length % STICKY_COLORS.length]
    };
    setStickyNotes((prev) => [...prev, note]);
  }, [stickyNotes.length]);
  const updateStickyNote = useCallback4((id, updates) => {
    setStickyNotes((prev) => prev.map((n) => n.id === id ? { ...n, ...updates } : n));
  }, []);
  const removeStickyNote = useCallback4((id) => {
    setStickyNotes((prev) => prev.filter((n) => n.id !== id));
  }, []);
  const [blockStatuses, setBlockStatuses] = useState5(/* @__PURE__ */ new Map());
  const [isLoadingWorkflow, setIsLoadingWorkflow] = useState5(Boolean(initialWorkflowId));
  const [loadError, setLoadError] = useState5(null);
  const [isSaving, setIsSaving] = useState5(false);
  const [isRunning, setIsRunning] = useState5(false);
  const [isValidating, setIsValidating] = useState5(false);
  const [runResult, setRunResult] = useState5(null);
  const [showRunPanel, setShowRunPanel] = useState5(false);
  const [saveStatus, setSaveStatus] = useState5("idle");
  const [editingName, setEditingName] = useState5(false);
  const [nameInput, setNameInput] = useState5(state.name);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState5(false);
  const [showExitConfirm, setShowExitConfirm] = useState5(false);
  const lastSavedStateRef = useRef2(initialState);
  useEffect4(() => {
    const handler = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        dispatch({ type: "UNDO" });
      }
      if (mod && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        dispatch({ type: "REDO" });
      }
      if (mod && e.key === "y") {
        e.preventDefault();
        dispatch({ type: "REDO" });
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedBlockIds.size > 0 && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        for (const id of selectedBlockIds) dispatch({ type: "REMOVE_BLOCK", blockId: id });
        setSelectedBlockIds(/* @__PURE__ */ new Set());
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [dispatch, selectedBlockIds]);
  useEffect4(() => {
    if (!initialWorkflowId) {
      dispatch({ type: "LOAD", state: initialState });
      setSelectedBlockIds(/* @__PURE__ */ new Set());
      setIsLoadingWorkflow(false);
      setLoadError(null);
      return;
    }
    let cancelled = false;
    setIsLoadingWorkflow(true);
    setLoadError(null);
    api.get(initialWorkflowId).then((wf) => {
      if (!cancelled) {
        dispatch({ type: "LOAD", state: workflowToEditorState(wf) });
        setSelectedBlockIds(/* @__PURE__ */ new Set());
      }
    }).catch((e) => {
      if (!cancelled) setLoadError(e instanceof Error ? e.message : "Failed to load workflow.");
    }).finally(() => {
      if (!cancelled) setIsLoadingWorkflow(false);
    });
    return () => {
      cancelled = true;
    };
  }, [initialWorkflowId, api, dispatch]);
  useEffect4(() => {
    setNameInput(state.name);
  }, [state.name]);
  useEffect4(() => {
    if (selectedBlockIds.size > 0 && !state.blocks.some((b) => selectedBlockIds.has(b.id))) setSelectedBlockIds(/* @__PURE__ */ new Set());
  }, [selectedBlockIds, state.blocks]);
  useEffect4(() => {
    const saved = lastSavedStateRef.current;
    setHasUnsavedChanges(
      state.name !== saved.name || state.blocks.length !== saved.blocks.length || state.edges.length !== saved.edges.length || JSON.stringify(state.blocks) !== JSON.stringify(saved.blocks) || JSON.stringify(state.edges) !== JSON.stringify(saved.edges)
    );
  }, [state]);
  useEffect4(() => {
    const handler = (e) => {
      if (hasUnsavedChanges) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedChanges]);
  const createBlock = useCallback4((type, pos) => {
    const def = getBlockTypeDef(type);
    if (!def) return null;
    return { id: `block_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, type, title: def.label, config: { ...def.defaultConfig }, position: pos };
  }, []);
  const handleDropBlock = useCallback4((type, pos) => {
    const block = createBlock(type, pos);
    if (!block) return;
    dispatch({ type: "ADD_BLOCK", block });
    selectBlock(block.id);
  }, [createBlock, dispatch, selectBlock]);
  const handleQuickAddBlock = useCallback4((type) => {
    const slot = QUICK_ADD_POSITIONS[state.blocks.length % QUICK_ADD_POSITIONS.length];
    const offset = Math.floor(state.blocks.length / QUICK_ADD_POSITIONS.length) * 180;
    const block = createBlock(type, { x: slot.x, y: slot.y + offset });
    if (!block) return;
    dispatch({ type: "ADD_BLOCK", block });
    selectBlock(block.id);
  }, [createBlock, dispatch, selectBlock, state.blocks.length]);
  const handleMoveBlock = useCallback4((blockId, pos) => dispatch({ type: "MOVE_BLOCK", blockId, pos }), [dispatch]);
  const handleUpdateBlock = useCallback4((blockId, updates) => dispatch({ type: "UPDATE_BLOCK", blockId, updates }), [dispatch]);
  const handleDeleteBlock = useCallback4((blockId) => {
    dispatch({ type: "REMOVE_BLOCK", blockId });
    setSelectedBlockIds(/* @__PURE__ */ new Set());
  }, [dispatch]);
  const handleAddEdge = useCallback4((sourceBlockId, sourcePort, targetBlockId, targetPort) => {
    if (state.edges.some((e) => e.sourceBlockId === sourceBlockId && e.sourcePort === sourcePort && e.targetBlockId === targetBlockId && e.targetPort === targetPort)) return;
    dispatch({ type: "ADD_EDGE", edge: { id: `edge_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, sourceBlockId, sourcePort, targetBlockId, targetPort } });
  }, [state.edges, dispatch]);
  const handleDeleteEdge = useCallback4((edgeId) => dispatch({ type: "REMOVE_EDGE", edgeId }), [dispatch]);
  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus("idle");
    try {
      const graph = editorStateToGraph(state.blocks, state.edges);
      let wf;
      if (!state.workflowId) {
        wf = await api.create({ name: state.name, graph });
      } else {
        wf = await api.update(state.workflowId, { name: state.name, graph });
      }
      dispatch({ type: "LOAD", state: workflowToEditorState(wf) });
      setSelectedBlockIds(/* @__PURE__ */ new Set());
      setSaveStatus("saved");
      setHasUnsavedChanges(false);
      lastSavedStateRef.current = state;
      setTimeout(() => setSaveStatus("idle"), 2500);
    } catch (err) {
      console.error("Save failed:", err);
      setSaveStatus("error");
    } finally {
      setIsSaving(false);
    }
  };
  const handleValidate = async () => {
    if (!state.workflowId) {
      setRunResult({ status: "error", message: "Save the workflow before validating." });
      setShowRunPanel(true);
      return;
    }
    setIsValidating(true);
    try {
      const result = await api.validate(state.workflowId);
      setRunResult({ status: result.valid ? "success" : "error", message: result.valid ? "Workflow is valid and ready to run." : `Validation failed:
${result.errors.map((e) => e.message).join("\n")}` });
    } catch (err) {
      setRunResult({ status: "error", message: String(err) });
    } finally {
      setIsValidating(false);
      setShowRunPanel(true);
    }
  };
  const handleRun = async () => {
    if (!state.workflowId) {
      setRunResult({ status: "error", message: "Save the workflow before running." });
      setShowRunPanel(true);
      return;
    }
    setIsRunning(true);
    setRunResult({ status: "running", message: "Running workflow..." });
    setShowRunPanel(true);
    const pending = /* @__PURE__ */ new Map();
    state.blocks.forEach((b) => pending.set(b.id, "pending"));
    setBlockStatuses(pending);
    try {
      const result = await api.run(state.workflowId, {});
      const statuses = /* @__PURE__ */ new Map();
      if (result.block_states) {
        for (const bs of result.block_states) {
          statuses.set(bs.block_id, bs.status === "completed" ? "completed" : bs.status === "failed" ? "failed" : "completed");
        }
      }
      state.blocks.forEach((b) => {
        if (!statuses.has(b.id)) statuses.set(b.id, result.status === "failed" ? "failed" : "completed");
      });
      setBlockStatuses(statuses);
      setRunResult({
        status: result.status === "failed" ? "error" : "success",
        message: result.error ?? `Run ${result.id} completed with status: ${result.status}`,
        outputs: result.outputs
      });
    } catch (err) {
      const failed = /* @__PURE__ */ new Map();
      state.blocks.forEach((b) => failed.set(b.id, "failed"));
      setBlockStatuses(failed);
      setRunResult({ status: "error", message: String(err) });
    } finally {
      setIsRunning(false);
    }
  };
  const handleNameSubmit = () => {
    dispatch({ type: "SET_NAME", name: nameInput.trim() || "Untitled Workflow" });
    setEditingName(false);
  };
  const handleBackClick = () => {
    if (!hasUnsavedChanges) {
      onBack();
      return;
    }
    setShowExitConfirm(true);
  };
  if (isLoadingWorkflow) {
    return /* @__PURE__ */ jsx8("div", { className: "flex h-screen items-center justify-center bg-[var(--schift-black)]", children: /* @__PURE__ */ jsx8(LoadingSpinner, { text: "Loading workflow..." }) });
  }
  if (loadError) {
    return /* @__PURE__ */ jsx8("div", { className: "flex h-screen items-center justify-center bg-[var(--schift-black)] p-6", children: /* @__PURE__ */ jsxs7("div", { className: "w-full max-w-md rounded-lg border border-[var(--schift-red)]/30 bg-[var(--schift-gray-100)] p-6", children: [
      /* @__PURE__ */ jsx8("p", { className: "text-sm font-medium text-[var(--schift-white)] mb-2", children: "Workflow load failed" }),
      /* @__PURE__ */ jsx8("p", { className: "text-sm text-[var(--schift-gray-50)] mb-4", children: loadError }),
      /* @__PURE__ */ jsxs7("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ jsx8(Button, { variant: "outline", size: "sm", onClick: handleBackClick, children: "Back" }),
        /* @__PURE__ */ jsx8(Button, { size: "sm", onClick: () => window.location.reload(), children: "Retry" })
      ] })
    ] }) });
  }
  return /* @__PURE__ */ jsxs7("div", { className: "flex flex-col h-screen bg-[var(--schift-black)] overflow-hidden", children: [
    /* @__PURE__ */ jsxs7("header", { className: "h-12 flex items-center px-4 gap-3 border-b border-[var(--schift-gray-80)] bg-[var(--schift-gray-100)] flex-shrink-0", children: [
      /* @__PURE__ */ jsx8(Button, { variant: "ghost", size: "sm", onClick: handleBackClick, className: "gap-1 text-xs", children: "\u2190 Back" }),
      /* @__PURE__ */ jsx8("div", { className: "w-px h-5 bg-[var(--schift-gray-80)]" }),
      editingName ? /* @__PURE__ */ jsx8(
        "input",
        {
          autoFocus: true,
          value: nameInput,
          onChange: (e) => setNameInput(e.target.value),
          onBlur: handleNameSubmit,
          onKeyDown: (e) => {
            if (e.key === "Enter") handleNameSubmit();
            if (e.key === "Escape") {
              setNameInput(state.name);
              setEditingName(false);
            }
          },
          className: "text-sm font-medium bg-[var(--schift-gray-80)] text-[var(--schift-white)] border border-[var(--schift-blue)] rounded px-2 py-0.5 w-52 focus:outline-none"
        }
      ) : /* @__PURE__ */ jsx8(
        "button",
        {
          className: "text-sm font-medium text-[var(--schift-white)] hover:text-[var(--schift-gray-30)] transition-colors",
          onClick: () => {
            setNameInput(state.name);
            setEditingName(true);
          },
          title: "Click to rename",
          children: state.name
        }
      ),
      state.workflowId && /* @__PURE__ */ jsxs7("span", { className: "text-[10px] text-[var(--schift-gray-60)] font-mono", children: [
        "#",
        state.workflowId.slice(-8)
      ] }),
      /* @__PURE__ */ jsx8("div", { className: "flex-1" }),
      /* @__PURE__ */ jsxs7("div", { className: "flex items-center gap-0.5 mr-2", children: [
        /* @__PURE__ */ jsx8("button", { onClick: () => dispatch({ type: "UNDO" }), disabled: !canUndo, className: `px-1.5 py-1 rounded text-xs ${canUndo ? "text-[var(--schift-gray-30)] hover:bg-[var(--schift-gray-80)]" : "text-[var(--schift-gray-70)]"}`, title: "Undo (Ctrl+Z)", children: "\u21A9" }),
        /* @__PURE__ */ jsx8("button", { onClick: () => dispatch({ type: "REDO" }), disabled: !canRedo, className: `px-1.5 py-1 rounded text-xs ${canRedo ? "text-[var(--schift-gray-30)] hover:bg-[var(--schift-gray-80)]" : "text-[var(--schift-gray-70)]"}`, title: "Redo (Ctrl+Shift+Z)", children: "\u21AA" })
      ] }),
      /* @__PURE__ */ jsx8("button", { onClick: addStickyNote, className: "px-1.5 py-1 rounded text-xs text-[var(--schift-gray-30)] hover:bg-[var(--schift-gray-80)]", title: "Add sticky note", children: "\u{1F4CC}" }),
      /* @__PURE__ */ jsx8("div", { className: "w-px h-5 bg-[var(--schift-gray-80)] mx-1" }),
      /* @__PURE__ */ jsxs7("span", { className: "text-[10px] text-[var(--schift-gray-60)]", children: [
        state.blocks.length,
        " blocks \xB7 ",
        state.edges.length,
        " edges"
      ] }),
      selectedBlockIds.size > 1 && /* @__PURE__ */ jsxs7("span", { className: "text-[10px] font-medium text-[var(--schift-blue)]", children: [
        selectedBlockIds.size,
        " selected"
      ] }),
      hasUnsavedChanges && /* @__PURE__ */ jsx8("span", { className: "text-[10px] font-medium text-[var(--schift-yellow)]", children: "Unsaved changes" }),
      /* @__PURE__ */ jsx8(Button, { variant: "outline", size: "sm", onClick: handleValidate, disabled: isValidating, className: "text-xs", children: isValidating ? "Checking\u2026" : "Validate" }),
      /* @__PURE__ */ jsx8(
        Button,
        {
          variant: "outline",
          size: "sm",
          onClick: handleSave,
          disabled: isSaving,
          className: saveStatus === "saved" ? "border-[var(--schift-green)]/50 text-[var(--schift-green)] text-xs" : saveStatus === "error" ? "border-[var(--schift-red)]/50 text-[var(--schift-red)] text-xs" : "text-xs",
          children: isSaving ? "Saving\u2026" : saveStatus === "saved" ? "Saved" : saveStatus === "error" ? "Error" : "Save"
        }
      ),
      /* @__PURE__ */ jsx8(Button, { size: "sm", onClick: handleRun, disabled: isRunning, className: "text-xs gap-1", children: isRunning ? /* @__PURE__ */ jsxs7(Fragment, { children: [
        /* @__PURE__ */ jsx8("span", { className: "animate-spin", children: "&orarr;" }),
        " Running"
      ] }) : /* @__PURE__ */ jsx8(Fragment, { children: "&blacktriangleright; Run" }) })
    ] }),
    /* @__PURE__ */ jsxs7("div", { className: "flex flex-1 overflow-hidden", children: [
      /* @__PURE__ */ jsx8(BlockPalette, { onDragStart: () => {
      } }),
      /* @__PURE__ */ jsxs7("div", { className: "flex flex-col flex-1 overflow-hidden", children: [
        /* @__PURE__ */ jsx8(
          WorkflowCanvas,
          {
            blocks: state.blocks,
            edges: state.edges,
            selectedBlockId,
            selectedBlockIds,
            blockStatuses,
            stickyNotes,
            onSelectBlock: (id, additive) => selectBlock(id, additive),
            onMoveBlock: handleMoveBlock,
            onDropBlock: handleDropBlock,
            onQuickAddBlock: handleQuickAddBlock,
            onAddEdge: handleAddEdge,
            onDeleteEdge: handleDeleteEdge,
            onUpdateStickyNote: updateStickyNote,
            onRemoveStickyNote: removeStickyNote
          }
        ),
        showRunPanel && runResult && /* @__PURE__ */ jsxs7("div", { className: `flex-shrink-0 border-t ${runResult.status === "success" ? "border-[var(--schift-green)]/30 bg-[var(--schift-green)]/5" : runResult.status === "running" ? "border-[var(--schift-blue)]/30 bg-[var(--schift-blue)]/5" : "border-[var(--schift-red)]/30 bg-[var(--schift-red)]/5"}`, children: [
          /* @__PURE__ */ jsxs7("div", { className: "flex items-center justify-between px-4 py-2 border-b border-[var(--schift-gray-80)]", children: [
            /* @__PURE__ */ jsx8("span", { className: `text-xs font-medium ${runResult.status === "success" ? "text-[var(--schift-green)]" : runResult.status === "running" ? "text-[var(--schift-blue)]" : "text-[var(--schift-red)]"}`, children: runResult.status === "running" ? "Running" : runResult.status === "success" ? "Success" : "Error" }),
            /* @__PURE__ */ jsx8("button", { onClick: () => {
              setShowRunPanel(false);
              setBlockStatuses(/* @__PURE__ */ new Map());
            }, className: "text-[var(--schift-gray-50)] hover:text-[var(--schift-white)] text-xs", children: "\xD7" })
          ] }),
          /* @__PURE__ */ jsxs7("div", { className: "px-4 py-3 max-h-40 overflow-y-auto", children: [
            /* @__PURE__ */ jsx8("pre", { className: "text-xs font-mono text-[var(--schift-gray-30)] whitespace-pre-wrap", children: runResult.message }),
            runResult.outputs && Object.keys(runResult.outputs).length > 0 && /* @__PURE__ */ jsx8("pre", { className: "text-xs font-mono text-[var(--schift-gray-50)] mt-2 whitespace-pre-wrap", children: JSON.stringify(runResult.outputs, null, 2) })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsx8(BlockConfigPanel, { block: selectedBlock, onUpdate: handleUpdateBlock, onDelete: handleDeleteBlock, onClose: () => setSelectedBlockIds(/* @__PURE__ */ new Set()) })
    ] }),
    /* @__PURE__ */ jsx8(Dialog, { open: showExitConfirm, children: /* @__PURE__ */ jsxs7(DialogContent, { onClose: () => setShowExitConfirm(false), className: "max-w-[420px]", children: [
      /* @__PURE__ */ jsxs7(DialogHeader, { children: [
        /* @__PURE__ */ jsx8(DialogTitle, { children: "Leave builder?" }),
        /* @__PURE__ */ jsx8(DialogDescription, { children: "You have unsaved workflow changes. Save first if you want to keep the latest block layout and connections." })
      ] }),
      /* @__PURE__ */ jsxs7(DialogFooter, { children: [
        /* @__PURE__ */ jsx8(Button, { variant: "outline", onClick: () => setShowExitConfirm(false), children: "Stay here" }),
        /* @__PURE__ */ jsx8(Button, { variant: "outline", onClick: () => {
          setShowExitConfirm(false);
          void handleSave();
        }, children: "Save first" }),
        /* @__PURE__ */ jsx8(Button, { variant: "destructive", onClick: () => {
          setShowExitConfirm(false);
          onBack();
        }, children: "Leave without saving" })
      ] })
    ] }) })
  ] });
}

// src/workflow-editor/components/WorkflowEditor.tsx
import { jsx as jsx9 } from "react/jsx-runtime";
function WorkflowEditor({ onNavigate: _onNavigate }) {
  const [view, setView] = useState6({ mode: "list" });
  if (view.mode === "builder") {
    return /* @__PURE__ */ jsx9(
      WorkflowBuilder,
      {
        onBack: () => setView({ mode: "list" }),
        initialWorkflowId: view.workflowId
      }
    );
  }
  return /* @__PURE__ */ jsx9(
    WorkflowList,
    {
      onOpenBuilder: (workflowId) => setView({ mode: "builder", workflowId: workflowId ?? null })
    }
  );
}

// src/workflow/builder.ts
var WorkflowBuilder2 = class {
  _name;
  _description;
  _blocks = /* @__PURE__ */ new Map();
  _edges = [];
  _autoX = 0;
  _autoY = 0;
  _edgeCounter = 0;
  constructor(name) {
    this._name = name;
    this._description = "";
  }
  /**
   * Set the workflow description.
   */
  description(desc) {
    this._description = desc;
    return this;
  }
  /**
   * Add a block to the workflow.
   *
   * @param alias - A local identifier used for connecting blocks. This becomes
   *   the block's `id` in the built graph.
   * @param descriptor - Block type, optional title, position, and config.
   *   If `type` is omitted it defaults to the alias string (e.g. alias "start"
   *   maps to type "start").
   */
  addBlock(alias, descriptor = {}) {
    const blockType = descriptor.type ?? alias;
    const title = descriptor.title ?? alias;
    const position = descriptor.position ?? this.nextPosition();
    this._blocks.set(alias, {
      id: alias,
      type: blockType,
      title,
      position,
      config: descriptor.config ?? {}
    });
    return this;
  }
  /**
   * Connect two blocks with an edge.
   *
   * @param source - Alias of the source block.
   * @param target - Alias of the target block.
   * @param sourceHandle - Optional output handle name.
   * @param targetHandle - Optional input handle name.
   */
  connect(source, target, sourceHandle, targetHandle) {
    if (!this._blocks.has(source)) {
      throw new Error(
        `WorkflowBuilder: source block "${source}" not found. Add it with .addBlock("${source}", ...) first.`
      );
    }
    if (!this._blocks.has(target)) {
      throw new Error(
        `WorkflowBuilder: target block "${target}" not found. Add it with .addBlock("${target}", ...) first.`
      );
    }
    this._edgeCounter++;
    const edge = {
      id: `edge_${this._edgeCounter}`,
      source,
      target
    };
    if (sourceHandle) edge.source_handle = sourceHandle;
    if (targetHandle) edge.target_handle = targetHandle;
    this._edges.push(edge);
    return this;
  }
  /**
   * Return the constructed graph without the name/description wrapper.
   */
  buildGraph() {
    return {
      blocks: Array.from(this._blocks.values()),
      edges: [...this._edges]
    };
  }
  /**
   * Build a CreateWorkflowRequest ready to pass to `WorkflowClient.create()`.
   */
  build() {
    return {
      name: this._name,
      description: this._description || void 0,
      graph: this.buildGraph()
    };
  }
  // ---- internal helpers ----
  nextPosition() {
    const pos = { x: this._autoX, y: this._autoY };
    this._autoY += 120;
    return pos;
  }
};

// src/workflow-editor/examples.ts
var basicRagIngest = new WorkflowBuilder2("Basic RAG Ingestion").description("Ingest documents into a vector store for RAG retrieval").addBlock("start", { type: "start" }).addBlock("loader", {
  type: "document_loader",
  title: "Load PDFs",
  config: { source: "upload" }
}).addBlock("parser", {
  type: "document_parser",
  title: "Parse Documents",
  config: { format: "auto" }
}).addBlock("chunker", {
  type: "chunker",
  title: "Chunk Text",
  config: { strategy: "semantic", chunk_size: 512, overlap: 64 }
}).addBlock("embedder", {
  type: "embedder",
  title: "Generate Embeddings",
  config: { model: "text-embedding-3-small", dimensions: 1024 }
}).addBlock("store", {
  type: "vector_store",
  title: "Upsert to Collection",
  config: { collection: "documents", upsert: true }
}).addBlock("end", { type: "end" }).connect("start", "loader", "out", "in").connect("loader", "parser", "docs", "docs").connect("parser", "chunker", "parsed", "parsed").connect("chunker", "embedder", "chunks", "chunks").connect("embedder", "store", "embeddings", "embeddings").connect("store", "end", "stored", "in").build();
var ragQuery = new WorkflowBuilder2("RAG Query").description("Retrieve context and generate an answer for a user query").addBlock("start", { type: "start" }).addBlock("retriever", {
  type: "retriever",
  title: "Retrieve from Docs",
  config: { top_k: 10, collection: "documents" }
}).addBlock("reranker", {
  type: "reranker",
  title: "Rerank Results",
  config: { model: "rerank-v1", top_n: 3 }
}).addBlock("prompt", {
  type: "prompt_template",
  title: "Build RAG Prompt",
  config: {
    template: "Answer the question based on the context below.\n\nContext:\n{{context}}\n\nQuestion: {{query}}\n\nAnswer:"
  }
}).addBlock("llm", {
  type: "llm",
  title: "Generate Answer",
  config: { model: "gpt-4o-mini", temperature: 0.3, max_tokens: 1024 }
}).addBlock("answer", { type: "answer", config: { format: "text" } }).addBlock("end", { type: "end" }).connect("start", "retriever", "out", "query").connect("retriever", "reranker", "results", "results").connect("start", "reranker", "out", "query").connect("reranker", "prompt", "reranked", "vars").connect("prompt", "llm", "prompt", "prompt").connect("llm", "answer", "response", "response").connect("answer", "end", "out", "in").build();
var contractAnalysis = new WorkflowBuilder2("Contract Analysis").description("Extract structured data from legal contracts").addBlock("start", { type: "start" }).addBlock("loader", {
  type: "document_loader",
  title: "Load Contract",
  config: { source: "upload" }
}).addBlock("parser", {
  type: "document_parser",
  title: "OCR + Parse",
  config: { format: "auto" }
}).addBlock("prompt", {
  type: "prompt_template",
  title: "Extraction Prompt",
  config: {
    template: "Extract the following from this contract:\n- Parties involved\n- Effective date\n- All clauses with numbers and text\n- Key obligations\n\nContract:\n{{document}}\n\nReturn as structured JSON."
  }
}).addBlock("llm", {
  type: "llm",
  title: "Extract via LLM",
  config: {
    model: "gpt-4o-mini",
    temperature: 0,
    max_tokens: 4096,
    output_schema: {
      type: "object",
      properties: {
        parties: { type: "array", items: { type: "string" } },
        effective_date: { type: "string" },
        clauses: {
          type: "array",
          items: {
            type: "object",
            properties: {
              number: { type: "string" },
              title: { type: "string" },
              text: { type: "string" },
              obligations: { type: "array", items: { type: "string" } }
            }
          }
        }
      }
    }
  }
}).addBlock("meta", {
  type: "metadata_extractor",
  title: "Extract Metadata",
  config: { fields: ["parties", "effective_date"] }
}).addBlock("answer", { type: "answer", config: { format: "json" } }).addBlock("end", { type: "end" }).connect("start", "loader", "out", "in").connect("loader", "parser", "docs", "docs").connect("parser", "prompt", "parsed", "vars").connect("prompt", "llm", "prompt", "prompt").connect("llm", "meta", "response", "in").connect("llm", "answer", "response", "response").connect("answer", "end", "out", "in").build();
var conditionalRouting = new WorkflowBuilder2("Intent Router").description("Classify user intent and route to specialized handlers").addBlock("start", { type: "start" }).addBlock("classify_prompt", {
  type: "prompt_template",
  title: "Classify Intent",
  config: {
    template: 'Classify this query into one of: "search", "create", "delete".\nQuery: {{query}}\nIntent:'
  }
}).addBlock("classifier", {
  type: "llm",
  title: "Intent LLM",
  config: { model: "gpt-4o-mini", temperature: 0, max_tokens: 10 }
}).addBlock("router", {
  type: "router",
  title: "Route by Intent",
  config: { routes: ["search", "create", "delete"] }
}).addBlock("search_handler", {
  type: "retriever",
  title: "Search Handler",
  config: { top_k: 5, collection: "knowledge" }
}).addBlock("create_handler", {
  type: "http_request",
  title: "Create API Call",
  config: { method: "POST", url: "/api/items" }
}).addBlock("delete_handler", {
  type: "http_request",
  title: "Delete API Call",
  config: { method: "DELETE", url: "/api/items" }
}).addBlock("merge", {
  type: "merge",
  title: "Merge Results",
  config: { strategy: "concat" }
}).addBlock("answer", { type: "answer", config: { format: "text" } }).addBlock("end", { type: "end" }).connect("start", "classify_prompt", "out", "vars").connect("classify_prompt", "classifier", "prompt", "prompt").connect("classifier", "router", "response", "in").connect("router", "search_handler", "out_0", "query").connect("router", "create_handler", "out_1", "in").connect("router", "delete_handler", "out_2", "in").connect("search_handler", "merge", "results", "in_0").connect("create_handler", "merge", "response", "in_1").connect("merge", "answer", "out", "response").connect("answer", "end", "out", "in").build();
var invoiceTableExtraction = new WorkflowBuilder2("Invoice Table Extraction").description("OCR invoices, extract line items table, pick columns, and summarize").addBlock("start", { type: "start" }).addBlock("loader", {
  type: "document_loader",
  title: "Load Invoice PDF",
  config: { source_type: "pdf", ocr_strategy: "auto" }
}).addBlock("parser", {
  type: "document_parser",
  title: "Extract Tables (VLM)",
  config: {
    mode: "vlm",
    output_schema: {
      type: "object",
      properties: {
        invoice_number: { type: "string" },
        date: { type: "string" },
        vendor: { type: "string" },
        total_amount: { type: "number" },
        line_items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              description: { type: "string" },
              quantity: { type: "number" },
              unit_price: { type: "number" },
              amount: { type: "number" }
            }
          }
        }
      }
    }
  }
}).addBlock("selector", {
  type: "field_selector",
  title: "Pick Columns",
  config: {
    fields: [
      "invoice_number",
      "vendor",
      "total_amount",
      "line_items[].description",
      "line_items[].amount"
    ],
    rename: {
      "line_items[].description": "item_names",
      "line_items[].amount": "item_amounts"
    },
    source: "extracted",
    output_format: "json"
  }
}).addBlock("prompt", {
  type: "prompt_template",
  title: "Summarize Invoice",
  config: {
    template: "Summarize this invoice:\nVendor: {{vendor}}\nInvoice #: {{invoice_number}}\nTotal: {{total_amount}}\n\nLine items:\n{{item_names}}\n\nProvide a 2-sentence summary."
  }
}).addBlock("llm", {
  type: "llm",
  config: { model: "gpt-4o-mini", temperature: 0.3, max_tokens: 256 }
}).addBlock("answer", { type: "answer", config: { format: "text" } }).addBlock("end", { type: "end" }).connect("start", "loader", "out", "in").connect("loader", "parser", "docs", "docs").connect("parser", "selector", "documents", "in").connect("selector", "prompt", "out", "vars").connect("prompt", "llm", "prompt", "prompt").connect("llm", "answer", "response", "response").connect("answer", "end", "out", "in").build();
var contractClauseExtractor = new WorkflowBuilder2("Contract Clause Extractor").description("Extract contract clauses as a structured table with selected columns").addBlock("start", { type: "start" }).addBlock("loader", {
  type: "document_loader",
  title: "Load Contract",
  config: { source_type: "pdf", ocr_strategy: "auto" }
}).addBlock("parser", {
  type: "document_parser",
  title: "Parse Contract (VLM)",
  config: {
    mode: "vlm",
    output_schema: {
      type: "object",
      properties: {
        parties: { type: "array", items: { type: "string" } },
        effective_date: { type: "string" },
        clauses: {
          type: "array",
          items: {
            type: "object",
            properties: {
              number: { type: "string" },
              title: { type: "string" },
              text: { type: "string" },
              obligations: { type: "array", items: { type: "string" } }
            }
          }
        }
      }
    }
  }
}).addBlock("selector", {
  type: "field_selector",
  title: "Pick Clause Columns",
  config: {
    fields: [
      "clauses[].number",
      "clauses[].title",
      "clauses[].obligations[]"
    ],
    rename: {
      "clauses[].number": "clause_no",
      "clauses[].title": "clause_title",
      "clauses[].obligations[]": "obligations"
    },
    output_format: "table"
  }
}).addBlock("webhook", {
  type: "webhook",
  title: "Send to Slack/API",
  config: { url: "" }
}).addBlock("end", { type: "end" }).connect("start", "loader", "out", "in").connect("loader", "parser", "docs", "docs").connect("parser", "selector", "documents", "in").connect("selector", "webhook", "out", "in").connect("selector", "end", "out", "in").build();
var multiSourceRag = new WorkflowBuilder2("Multi-Source RAG + Notify").description("Query multiple collections, merge results, and send webhook").addBlock("start", { type: "start" }).addBlock("retriever_docs", {
  type: "retriever",
  title: "Search Docs",
  config: { top_k: 5, collection: "documents" }
}).addBlock("retriever_faq", {
  type: "retriever",
  title: "Search FAQ",
  config: { top_k: 3, collection: "faq" }
}).addBlock("merge", {
  type: "merge",
  title: "Merge Sources",
  config: { strategy: "concat" }
}).addBlock("reranker", {
  type: "reranker",
  title: "Rerank All",
  config: { model: "rerank-v1", top_n: 5 }
}).addBlock("prompt", {
  type: "prompt_template",
  config: {
    template: "Using the following sources, answer the question.\n\nSources:\n{{context}}\n\nQuestion: {{query}}"
  }
}).addBlock("llm", {
  type: "llm",
  config: { model: "gpt-4o-mini", temperature: 0.3, max_tokens: 2048 }
}).addBlock("answer", { type: "answer", config: { format: "text" } }).addBlock("webhook", {
  type: "webhook",
  title: "Notify Slack",
  config: { url: "https://hooks.slack.com/services/xxx", secret: "" }
}).addBlock("end", { type: "end" }).connect("start", "retriever_docs", "out", "query").connect("start", "retriever_faq", "out", "query").connect("retriever_docs", "merge", "results", "in_0").connect("retriever_faq", "merge", "results", "in_1").connect("merge", "reranker", "out", "results").connect("start", "reranker", "out", "query").connect("reranker", "prompt", "reranked", "vars").connect("prompt", "llm", "prompt", "prompt").connect("llm", "answer", "response", "response").connect("answer", "webhook", "out", "in").connect("answer", "end", "out", "in").build();
export {
  BLOCK_TYPES,
  BlockConfigPanel,
  BlockPalette,
  CATEGORY_ACCENT,
  CATEGORY_BADGE_COLORS,
  CATEGORY_COLORS,
  DEFAULT_UI,
  SchemaBuilder,
  WorkflowBuilder,
  WorkflowCanvas,
  WorkflowEditor,
  WorkflowEditorProvider,
  WorkflowList,
  basicRagIngest,
  conditionalRouting,
  contractAnalysis,
  contractClauseExtractor,
  editorStateToGraph,
  getBlockTypeDef,
  invoiceTableExtraction,
  multiSourceRag,
  ragQuery,
  useBlockTypes,
  useWorkflowAPI,
  useWorkflowUI,
  workflowToEditorState
};
//# sourceMappingURL=workflow-editor.js.map