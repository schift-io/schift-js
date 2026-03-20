import { useCallback, useEffect, useState } from "react";
import { useWorkflowAPI, useWorkflowUI } from "../context.js";
import type { Workflow } from "../types.js";

const EMPTY_STATE_STEPS = [
  "Choose a template if you want a starter RAG flow instead of an empty graph.",
  "Open the builder and drag blocks from the left palette onto the canvas.",
  "Save first, then validate and run from the top bar before sharing changes.",
];

function formatDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return iso; }
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "bg-[var(--schift-green)]/20 text-[var(--schift-green)]",
    published: "bg-[var(--schift-green)]/20 text-[var(--schift-green)]",
    draft: "bg-[var(--schift-gray-70)]/30 text-[var(--schift-gray-30)]",
    inactive: "bg-[var(--schift-yellow)]/20 text-[var(--schift-yellow)]",
    archived: "bg-[var(--schift-yellow)]/20 text-[var(--schift-yellow)]",
    error: "bg-[var(--schift-red)]/20 text-[var(--schift-red)]",
  };
  return <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${colors[status] ?? colors.draft}`}>{status}</span>;
}

function WorkflowCard({ workflow, deleting, onOpen, onRequestDelete }: {
  workflow: Workflow; deleting: boolean;
  onOpen: (id: string) => void;
  onRequestDelete: (workflow: Workflow) => void;
}) {
  const { Button, Card, CardContent } = useWorkflowUI();
  return (
    <Card className="hover:border-[var(--schift-gray-60)] transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-medium text-[var(--schift-white)] truncate">{workflow.name}</h3>
              <StatusBadge status={workflow.status} />
            </div>
            <div className="flex items-center gap-3 text-xs text-[var(--schift-gray-50)]">
              <span>{workflow.graph.blocks.length} blocks</span>
              <span>&middot;</span>
              <span>Updated {formatDate(workflow.updated_at)}</span>
            </div>
          </div>
        </div>
        <div className="mt-3 flex gap-1">
          {Array.from({ length: Math.min(workflow.graph.blocks.length, 12) }).map((_, i) => (
            <div key={i} className="h-1.5 flex-1 rounded-full bg-[var(--schift-gray-70)]" />
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between gap-2">
          <p className="text-[11px] text-[var(--schift-gray-50)]">Open to edit blocks, validate, and run this workflow.</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpen(workflow.id)}>Open</Button>
            <Button variant="danger" size="sm" disabled={deleting} onClick={() => onRequestDelete(workflow)}>Delete</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DeleteWorkflowDialog({ workflow, deleting, onClose, onConfirm }: {
  workflow: Workflow; deleting: boolean; onClose: () => void; onConfirm: (id: string) => void;
}) {
  const { Button, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Alert } = useWorkflowUI();
  return (
    <DialogContent onClose={onClose} className="max-w-[420px]">
      <DialogHeader><DialogTitle>Delete workflow</DialogTitle>
        <DialogDescription>Remove this workflow from the dashboard. This also removes its saved graph from the current workspace.</DialogDescription>
      </DialogHeader>
      <Alert variant="error">
        <p className="text-sm text-[var(--schift-white)]">{workflow.name}</p>
        <p className="text-xs text-[var(--schift-gray-50)] mt-1">{workflow.graph.blocks.length} blocks &middot; updated {formatDate(workflow.updated_at)}</p>
      </Alert>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button variant="destructive" disabled={deleting} onClick={() => onConfirm(workflow.id)}>{deleting ? "Deleting..." : "Delete workflow"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  const { Button, Card, CardContent } = useWorkflowUI();
  return (
    <Card>
      <CardContent className="p-12 text-center">
        <p className="text-3xl mb-3">&loz;</p>
        <p className="text-sm font-medium text-[var(--schift-white)] mb-1">No workflows yet</p>
        <p className="text-sm text-[var(--schift-gray-50)] mb-6">Start with a blank canvas or a template, then add blocks and connect outputs to inputs.</p>
        <div className="grid gap-3 max-w-xl mx-auto text-left mb-6">
          {EMPTY_STATE_STEPS.map((step, index) => (
            <div key={step} className="flex items-start gap-3 rounded-lg border border-[var(--schift-gray-80)] bg-[var(--schift-gray-90)] px-4 py-3">
              <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--schift-gray-80)] text-[10px] font-medium text-[var(--schift-white)]">{index + 1}</span>
              <p className="text-sm text-[var(--schift-gray-30)]">{step}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-col items-center gap-3">
          <Button onClick={onCreate}>Create workflow</Button>
          <p className="text-xs text-[var(--schift-gray-50)]">Tip: `Basic RAG` is the fastest way to get a runnable starter pipeline.</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ---- Main ----

interface WorkflowListProps {
  onOpenBuilder: (workflowId?: string) => void;
}

export default function WorkflowList({ onOpenBuilder }: WorkflowListProps) {
  const api = useWorkflowAPI();
  const { Button, Card, CardContent, ErrorText, Dialog } = useWorkflowUI();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Workflow | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  // AI Generate
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const hasGenerate = typeof api.generate === "function";

  const fetchWorkflows = useCallback(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    api.list()
      .then((data) => { if (!cancelled) setWorkflows(data); })
      .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load workflows."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [api]);

  useEffect(() => fetchWorkflows(), [fetchWorkflows]);

  const closeNewModal = () => { setShowNewModal(false); setNewName(""); setSelectedTemplate(null); setError(null); };

  const handleCreate = async () => {
    const name = newName.trim() || "Untitled Workflow";
    setCreating(true); setError(null);
    try {
      const wf = await api.create({ name, ...(selectedTemplate ? { template: selectedTemplate as import("../../workflow/types.js").WorkflowTemplate } : {}) });
      setWorkflows((prev) => [wf, ...prev]);
      closeNewModal();
      onOpenBuilder(wf.id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create workflow.");
    } finally { setCreating(false); }
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim() || !api.generate) return;
    setAiGenerating(true); setAiError(null);
    try {
      const result = await api.generate(aiPrompt.trim());
      // Create the workflow from generated graph
      const wf = await api.create({ name: result.name, description: result.description, graph: result.graph });
      setWorkflows((prev) => [wf, ...prev]);
      setShowAiModal(false); setAiPrompt("");
      onOpenBuilder(wf.id);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to generate workflow.";
      setAiError(msg.includes("upgrade") ? "Paid plan required for AI generation." : msg);
    } finally { setAiGenerating(false); }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id); setError(null);
    try {
      await api.delete(id);
      setWorkflows((prev) => prev.filter((w) => w.id !== id));
      setDeleteTarget(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to delete workflow.");
    } finally { setDeletingId(null); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-[var(--schift-white)]">Workflows</h2>
          <p className="text-sm text-[var(--schift-gray-50)] mt-0.5">Build and manage your data processing pipelines</p>
        </div>
        <div className="flex items-center gap-2">
          {hasGenerate && (
            <Button variant="outline" onClick={() => setShowAiModal(true)} className="gap-2">
              &#x1F9E0; AI Generate
            </Button>
          )}
          <Button onClick={() => setShowNewModal(true)} className="gap-2">+ New Workflow</Button>
        </div>
      </div>

      {showNewModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[var(--schift-gray-90)] border border-[var(--schift-gray-70)] rounded-lg p-6 w-96 shadow-2xl">
            <h3 className="text-sm font-semibold text-[var(--schift-white)] mb-4">New Workflow</h3>
            <div className="mb-4">
              <label className="text-xs text-[var(--schift-gray-50)] block mb-1">Workflow name</label>
              <input autoFocus type="text" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !creating && handleCreate()} placeholder="e.g. RAG Pipeline" className="w-full h-9 px-3 text-sm bg-[var(--schift-gray-100)] border border-[var(--schift-gray-70)] rounded text-[var(--schift-white)] placeholder:text-[var(--schift-gray-60)] focus:outline-none focus:border-[var(--schift-blue)]" />
            </div>
            <div className="mb-5">
              <p className="text-xs text-[var(--schift-gray-50)] mb-2">Start with a template</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Blank", template: null },
                  { label: "Basic RAG", template: "basic_rag" },
                  { label: "Document QA", template: "document_qa" },
                  { label: "Chat RAG", template: "chat_rag" },
                  { label: "OCR Ingestion", template: "image_ocr_ingest" },
                  { label: "Conversational", template: "conversational_rag" },
                ].map((opt) => (
                  <button key={opt.label} onClick={() => { setNewName(opt.template ? opt.label : ""); setSelectedTemplate(opt.template); }}
                    className={`text-xs px-3 py-2 rounded border transition-colors ${selectedTemplate === opt.template ? "border-[var(--schift-blue)] bg-[var(--schift-blue)]/10 text-[var(--schift-blue)]" : "border-[var(--schift-gray-70)] text-[var(--schift-gray-30)] hover:border-[var(--schift-gray-50)]"}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <ErrorText className="mb-4">{error}</ErrorText>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={closeNewModal}>Cancel</Button>
              <Button size="sm" disabled={creating} onClick={handleCreate}>{creating ? "Creating\u2026" : "Create"}</Button>
            </div>
          </div>
        </div>
      )}

      {/* AI Generate modal */}
      {showAiModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[var(--schift-gray-90)] border border-[var(--schift-gray-70)] rounded-lg p-6 w-[480px] shadow-2xl">
            <h3 className="text-sm font-semibold text-[var(--schift-white)] mb-1 flex items-center gap-2">
              &#x1F9E0; AI Workflow Generator
            </h3>
            <p className="text-xs text-[var(--schift-gray-50)] mb-4">Describe what you want and AI will build the workflow for you.</p>
            <textarea
              autoFocus
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && e.metaKey && !aiGenerating) handleAiGenerate(); }}
              placeholder={"e.g. OCR invoices and extract line items as a table\ne.g. RAG pipeline that searches docs and answers questions\ne.g. Classify support tickets and route to different handlers"}
              rows={4}
              className="w-full px-3 py-2 text-sm bg-[var(--schift-gray-100)] border border-[var(--schift-gray-70)] rounded text-[var(--schift-white)] placeholder:text-[var(--schift-gray-60)] focus:outline-none focus:border-[var(--schift-blue)] resize-none"
            />
            {aiError && <p className="text-xs text-[var(--schift-red)] mt-2">{aiError}</p>}
            <div className="flex items-center justify-between mt-4">
              <span className="text-[10px] text-[var(--schift-gray-60)]">{aiGenerating ? "Generating workflow..." : "Cmd+Enter to generate"}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { setShowAiModal(false); setAiPrompt(""); setAiError(null); }}>Cancel</Button>
                <Button size="sm" disabled={aiGenerating || !aiPrompt.trim()} onClick={handleAiGenerate}>
                  {aiGenerating ? "Generating\u2026" : "Generate"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Dialog open={!!deleteTarget}>
        {deleteTarget && <DeleteWorkflowDialog workflow={deleteTarget} deleting={deletingId === deleteTarget.id} onClose={() => { if (!deletingId) setDeleteTarget(null); }} onConfirm={handleDelete} />}
      </Dialog>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4">
              <div className="h-4 bg-[var(--schift-gray-80)] rounded w-2/3 mb-2 animate-pulse" />
              <div className="h-3 bg-[var(--schift-gray-80)] rounded w-1/2 mb-3 animate-pulse" />
              <div className="flex gap-1">{Array.from({ length: 5 }).map((__, j) => <div key={j} className="h-1.5 flex-1 rounded-full bg-[var(--schift-gray-80)] animate-pulse" />)}</div>
            </CardContent></Card>
          ))}
        </div>
      ) : error ? (
        <Card><CardContent className="p-6 text-center">
          <ErrorText>{error}</ErrorText>
          <Button variant="link" size="sm" onClick={fetchWorkflows} className="mt-2">Retry</Button>
        </CardContent></Card>
      ) : workflows.length === 0 ? (
        <EmptyState onCreate={() => setShowNewModal(true)} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workflows.map((wf) => <WorkflowCard key={wf.id} workflow={wf} deleting={deletingId === wf.id} onOpen={onOpenBuilder} onRequestDelete={setDeleteTarget} />)}
        </div>
      )}
    </div>
  );
}
