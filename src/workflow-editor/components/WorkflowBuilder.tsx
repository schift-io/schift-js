import { useState, useCallback, useEffect, useRef } from "react";
import { useWorkflowAPI, useWorkflowUI } from "../context.js";
import BlockPalette from "./BlockPalette.js";
import WorkflowCanvas from "./WorkflowCanvas.js";
import BlockConfigPanel from "./BlockConfigPanel.js";
import { getBlockTypeDef } from "../types.js";
import type { CanvasBlock, CanvasEdge, Workflow } from "../types.js";
import { workflowToEditorState, editorStateToGraph } from "../utils/workflow-graph.js";
import type { WorkflowEditorState } from "../utils/workflow-graph.js";

// ---- Sticky Note type ----

export interface StickyNote {
  id: string;
  text: string;
  position: { x: number; y: number };
  color: string;
}

// ---- Block execution status ----

export type BlockStatus = "idle" | "pending" | "running" | "completed" | "failed";

// ---- Undo/Redo history ----

interface HistoryState {
  past: WorkflowEditorState[];
  present: WorkflowEditorState;
  future: WorkflowEditorState[];
}

type WorkflowAction =
  | { type: "SET_NAME"; name: string }
  | { type: "SET_WORKFLOW_ID"; id: string }
  | { type: "ADD_BLOCK"; block: CanvasBlock }
  | { type: "UPDATE_BLOCK"; blockId: string; updates: Partial<CanvasBlock> }
  | { type: "MOVE_BLOCK"; blockId: string; pos: { x: number; y: number } }
  | { type: "REMOVE_BLOCK"; blockId: string }
  | { type: "ADD_EDGE"; edge: CanvasEdge }
  | { type: "REMOVE_EDGE"; edgeId: string }
  | { type: "LOAD"; state: WorkflowEditorState }
  | { type: "UNDO" }
  | { type: "REDO" };

const MAX_HISTORY = 50;

// Actions that should NOT create undo history entries
const SKIP_HISTORY: Set<string> = new Set(["MOVE_BLOCK", "LOAD", "SET_WORKFLOW_ID"]);

function workflowReducer(state: WorkflowEditorState, action: WorkflowAction): WorkflowEditorState {
  switch (action.type) {
    case "SET_NAME": return { ...state, name: action.name };
    case "SET_WORKFLOW_ID": return { ...state, workflowId: action.id };
    case "ADD_BLOCK": return { ...state, blocks: [...state.blocks, action.block] };
    case "UPDATE_BLOCK": return { ...state, blocks: state.blocks.map((b) => b.id === action.blockId ? { ...b, ...action.updates } : b) };
    case "MOVE_BLOCK": return { ...state, blocks: state.blocks.map((b) => b.id === action.blockId ? { ...b, position: action.pos } : b) };
    case "REMOVE_BLOCK": return { ...state, blocks: state.blocks.filter((b) => b.id !== action.blockId), edges: state.edges.filter((e) => e.sourceBlockId !== action.blockId && e.targetBlockId !== action.blockId) };
    case "ADD_EDGE": return { ...state, edges: [...state.edges, action.edge] };
    case "REMOVE_EDGE": return { ...state, edges: state.edges.filter((e) => e.id !== action.edgeId) };
    case "LOAD": return action.state;
    default: return state;
  }
}

function historyReducer(histState: HistoryState, action: WorkflowAction): HistoryState {
  if (action.type === "UNDO") {
    if (histState.past.length === 0) return histState;
    const prev = histState.past[histState.past.length - 1];
    return {
      past: histState.past.slice(0, -1),
      present: prev,
      future: [histState.present, ...histState.future],
    };
  }
  if (action.type === "REDO") {
    if (histState.future.length === 0) return histState;
    const next = histState.future[0];
    return {
      past: [...histState.past, histState.present],
      present: next,
      future: histState.future.slice(1),
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
    future: [],
  };
}

function useUndoReducer(initial: WorkflowEditorState) {
  const [hist, rawDispatch] = useState<HistoryState>({ past: [], present: initial, future: [] });
  const dispatch = useCallback((action: WorkflowAction) => {
    rawDispatch((h) => historyReducer(h, action));
  }, []);
  return { state: hist.present, dispatch, canUndo: hist.past.length > 0, canRedo: hist.future.length > 0 };
}

// ---- Run result ----

interface RunResult {
  status: "success" | "error" | "running";
  message: string;
  outputs?: Record<string, unknown>;
}

const initialState: WorkflowEditorState = { workflowId: null, name: "Untitled Workflow", blocks: [], edges: [] };

const QUICK_ADD_POSITIONS = [
  { x: 80, y: 80 }, { x: 340, y: 80 }, { x: 600, y: 80 },
  { x: 80, y: 260 }, { x: 340, y: 260 }, { x: 600, y: 260 },
];

const STICKY_COLORS = ["#fbbf24", "#34d399", "#60a5fa", "#f472b6", "#a78bfa"];

// ---- Main Component ----

interface WorkflowBuilderProps {
  onBack: () => void;
  initialWorkflowId?: string | null;
}

export default function WorkflowBuilder({ onBack, initialWorkflowId }: WorkflowBuilderProps) {
  const api = useWorkflowAPI();
  const { Button, LoadingSpinner, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } = useWorkflowUI();
  const { state, dispatch, canUndo, canRedo } = useUndoReducer(initialState);

  // Multi-select
  const [selectedBlockIds, setSelectedBlockIds] = useState<Set<string>>(new Set());
  const selectedBlockId = selectedBlockIds.size === 1 ? Array.from(selectedBlockIds)[0] : null;
  const selectedBlock = selectedBlockId ? (state.blocks.find((b) => b.id === selectedBlockId) ?? null) : null;

  const selectBlock = useCallback((id: string | null, additive = false) => {
    if (!id) { setSelectedBlockIds(new Set()); return; }
    if (additive) {
      setSelectedBlockIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
    } else {
      setSelectedBlockIds(new Set([id]));
    }
  }, []);

  // Sticky notes
  const [stickyNotes, setStickyNotes] = useState<StickyNote[]>([]);
  const addStickyNote = useCallback(() => {
    const note: StickyNote = {
      id: `note_${Date.now()}`,
      text: "Double-click to edit",
      position: { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 },
      color: STICKY_COLORS[stickyNotes.length % STICKY_COLORS.length],
    };
    setStickyNotes((prev) => [...prev, note]);
  }, [stickyNotes.length]);
  const updateStickyNote = useCallback((id: string, updates: Partial<StickyNote>) => {
    setStickyNotes((prev) => prev.map((n) => n.id === id ? { ...n, ...updates } : n));
  }, []);
  const removeStickyNote = useCallback((id: string) => {
    setStickyNotes((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // Block execution status
  const [blockStatuses, setBlockStatuses] = useState<Map<string, BlockStatus>>(new Map());

  // UI state
  const [isLoadingWorkflow, setIsLoadingWorkflow] = useState(Boolean(initialWorkflowId));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [showRunPanel, setShowRunPanel] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(state.name);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const lastSavedStateRef = useRef<WorkflowEditorState>(initialState);

  // ---- Keyboard shortcuts ----
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "z" && !e.shiftKey) { e.preventDefault(); dispatch({ type: "UNDO" }); }
      if (mod && e.key === "z" && e.shiftKey) { e.preventDefault(); dispatch({ type: "REDO" }); }
      if (mod && e.key === "y") { e.preventDefault(); dispatch({ type: "REDO" }); }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedBlockIds.size > 0 && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        for (const id of selectedBlockIds) dispatch({ type: "REMOVE_BLOCK", blockId: id });
        setSelectedBlockIds(new Set());
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [dispatch, selectedBlockIds]);

  // ---- Load workflow ----
  useEffect(() => {
    if (!initialWorkflowId) { dispatch({ type: "LOAD", state: initialState }); setSelectedBlockIds(new Set()); setIsLoadingWorkflow(false); setLoadError(null); return; }
    let cancelled = false;
    setIsLoadingWorkflow(true); setLoadError(null);
    api.get(initialWorkflowId)
      .then((wf: Workflow) => { if (!cancelled) { dispatch({ type: "LOAD", state: workflowToEditorState(wf) }); setSelectedBlockIds(new Set()); } })
      .catch((e: unknown) => { if (!cancelled) setLoadError(e instanceof Error ? e.message : "Failed to load workflow."); })
      .finally(() => { if (!cancelled) setIsLoadingWorkflow(false); });
    return () => { cancelled = true; };
  }, [initialWorkflowId, api, dispatch]);

  useEffect(() => { setNameInput(state.name); }, [state.name]);
  useEffect(() => {
    if (selectedBlockIds.size > 0 && !state.blocks.some((b) => selectedBlockIds.has(b.id))) setSelectedBlockIds(new Set());
  }, [selectedBlockIds, state.blocks]);

  useEffect(() => {
    const saved = lastSavedStateRef.current;
    setHasUnsavedChanges(
      state.name !== saved.name || state.blocks.length !== saved.blocks.length || state.edges.length !== saved.edges.length ||
      JSON.stringify(state.blocks) !== JSON.stringify(saved.blocks) || JSON.stringify(state.edges) !== JSON.stringify(saved.edges),
    );
  }, [state]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { if (hasUnsavedChanges) e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedChanges]);

  // ---- Handlers ----

  const createBlock = useCallback((type: string, pos: { x: number; y: number }) => {
    const def = getBlockTypeDef(type);
    if (!def) return null;
    return { id: `block_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, type, title: def.label, config: { ...def.defaultConfig }, position: pos } as CanvasBlock;
  }, []);

  const handleDropBlock = useCallback((type: string, pos: { x: number; y: number }) => {
    const block = createBlock(type, pos); if (!block) return;
    dispatch({ type: "ADD_BLOCK", block }); selectBlock(block.id);
  }, [createBlock, dispatch, selectBlock]);

  const handleQuickAddBlock = useCallback((type: string) => {
    const slot = QUICK_ADD_POSITIONS[state.blocks.length % QUICK_ADD_POSITIONS.length];
    const offset = Math.floor(state.blocks.length / QUICK_ADD_POSITIONS.length) * 180;
    const block = createBlock(type, { x: slot.x, y: slot.y + offset }); if (!block) return;
    dispatch({ type: "ADD_BLOCK", block }); selectBlock(block.id);
  }, [createBlock, dispatch, selectBlock, state.blocks.length]);

  const handleMoveBlock = useCallback((blockId: string, pos: { x: number; y: number }) => dispatch({ type: "MOVE_BLOCK", blockId, pos }), [dispatch]);
  const handleUpdateBlock = useCallback((blockId: string, updates: Partial<CanvasBlock>) => dispatch({ type: "UPDATE_BLOCK", blockId, updates }), [dispatch]);
  const handleDeleteBlock = useCallback((blockId: string) => { dispatch({ type: "REMOVE_BLOCK", blockId }); setSelectedBlockIds(new Set()); }, [dispatch]);

  const handleAddEdge = useCallback((sourceBlockId: string, sourcePort: string, targetBlockId: string, targetPort: string) => {
    if (state.edges.some((e) => e.sourceBlockId === sourceBlockId && e.sourcePort === sourcePort && e.targetBlockId === targetBlockId && e.targetPort === targetPort)) return;
    dispatch({ type: "ADD_EDGE", edge: { id: `edge_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, sourceBlockId, sourcePort, targetBlockId, targetPort } });
  }, [state.edges, dispatch]);

  const handleDeleteEdge = useCallback((edgeId: string) => dispatch({ type: "REMOVE_EDGE", edgeId }), [dispatch]);

  const handleSave = async () => {
    setIsSaving(true); setSaveStatus("idle");
    try {
      const graph = editorStateToGraph(state.blocks, state.edges);
      let wf: Workflow;
      if (!state.workflowId) { wf = await api.create({ name: state.name, graph }); }
      else { wf = await api.update(state.workflowId, { name: state.name, graph }); }
      dispatch({ type: "LOAD", state: workflowToEditorState(wf) }); setSelectedBlockIds(new Set());
      setSaveStatus("saved"); setHasUnsavedChanges(false); lastSavedStateRef.current = state;
      setTimeout(() => setSaveStatus("idle"), 2500);
    } catch (err) { console.error("Save failed:", err); setSaveStatus("error"); }
    finally { setIsSaving(false); }
  };

  const handleValidate = async () => {
    if (!state.workflowId) { setRunResult({ status: "error", message: "Save the workflow before validating." }); setShowRunPanel(true); return; }
    setIsValidating(true);
    try {
      const result = await api.validate(state.workflowId);
      setRunResult({ status: result.valid ? "success" : "error", message: result.valid ? "Workflow is valid and ready to run." : `Validation failed:\n${result.errors.map((e) => e.message).join("\n")}` });
    } catch (err) { setRunResult({ status: "error", message: String(err) }); }
    finally { setIsValidating(false); setShowRunPanel(true); }
  };

  const handleRun = async () => {
    if (!state.workflowId) { setRunResult({ status: "error", message: "Save the workflow before running." }); setShowRunPanel(true); return; }
    setIsRunning(true);
    setRunResult({ status: "running", message: "Running workflow..." });
    setShowRunPanel(true);

    // Set all blocks to pending
    const pending = new Map<string, BlockStatus>();
    state.blocks.forEach((b) => pending.set(b.id, "pending"));
    setBlockStatuses(pending);

    try {
      const result = await api.run(state.workflowId, {});
      // Update block statuses from run result
      const statuses = new Map<string, BlockStatus>();
      if (result.block_states) {
        for (const bs of result.block_states) {
          statuses.set(bs.block_id, bs.status === "completed" ? "completed" : bs.status === "failed" ? "failed" : "completed");
        }
      }
      // Blocks not in block_states → completed (simple run without per-block tracking)
      state.blocks.forEach((b) => { if (!statuses.has(b.id)) statuses.set(b.id, result.status === "failed" ? "failed" : "completed"); });
      setBlockStatuses(statuses);
      setRunResult({
        status: result.status === "failed" ? "error" : "success",
        message: result.error ?? `Run ${result.id} completed with status: ${result.status}`,
        outputs: result.outputs,
      });
    } catch (err) {
      const failed = new Map<string, BlockStatus>();
      state.blocks.forEach((b) => failed.set(b.id, "failed"));
      setBlockStatuses(failed);
      setRunResult({ status: "error", message: String(err) });
    } finally { setIsRunning(false); }
  };

  const handleNameSubmit = () => { dispatch({ type: "SET_NAME", name: nameInput.trim() || "Untitled Workflow" }); setEditingName(false); };
  const handleBackClick = () => { if (!hasUnsavedChanges) { onBack(); return; } setShowExitConfirm(true); };

  // ---- Render ----

  if (isLoadingWorkflow) {
    return <div className="flex h-screen items-center justify-center bg-[var(--schift-black)]"><LoadingSpinner text="Loading workflow..." /></div>;
  }

  if (loadError) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--schift-black)] p-6">
        <div className="w-full max-w-md rounded-lg border border-[var(--schift-red)]/30 bg-[var(--schift-gray-100)] p-6">
          <p className="text-sm font-medium text-[var(--schift-white)] mb-2">Workflow load failed</p>
          <p className="text-sm text-[var(--schift-gray-50)] mb-4">{loadError}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleBackClick}>Back</Button>
            <Button size="sm" onClick={() => window.location.reload()}>Retry</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[var(--schift-black)] overflow-hidden">
      {/* Top bar */}
      <header className="h-12 flex items-center px-4 gap-3 border-b border-[var(--schift-gray-80)] bg-[var(--schift-gray-100)] flex-shrink-0">
        <Button variant="ghost" size="sm" onClick={handleBackClick} className="gap-1 text-xs">&larr; Back</Button>
        <div className="w-px h-5 bg-[var(--schift-gray-80)]" />
        {editingName ? (
          <input autoFocus value={nameInput} onChange={(e) => setNameInput(e.target.value)} onBlur={handleNameSubmit}
            onKeyDown={(e) => { if (e.key === "Enter") handleNameSubmit(); if (e.key === "Escape") { setNameInput(state.name); setEditingName(false); } }}
            className="text-sm font-medium bg-[var(--schift-gray-80)] text-[var(--schift-white)] border border-[var(--schift-blue)] rounded px-2 py-0.5 w-52 focus:outline-none" />
        ) : (
          <button className="text-sm font-medium text-[var(--schift-white)] hover:text-[var(--schift-gray-30)] transition-colors"
            onClick={() => { setNameInput(state.name); setEditingName(true); }} title="Click to rename">{state.name}</button>
        )}
        {state.workflowId && <span className="text-[10px] text-[var(--schift-gray-60)] font-mono">#{state.workflowId.slice(-8)}</span>}

        <div className="flex-1" />

        {/* Undo/Redo */}
        <div className="flex items-center gap-0.5 mr-2">
          <button onClick={() => dispatch({ type: "UNDO" })} disabled={!canUndo} className={`px-1.5 py-1 rounded text-xs ${canUndo ? "text-[var(--schift-gray-30)] hover:bg-[var(--schift-gray-80)]" : "text-[var(--schift-gray-70)]"}`} title="Undo (Ctrl+Z)">&#x21A9;</button>
          <button onClick={() => dispatch({ type: "REDO" })} disabled={!canRedo} className={`px-1.5 py-1 rounded text-xs ${canRedo ? "text-[var(--schift-gray-30)] hover:bg-[var(--schift-gray-80)]" : "text-[var(--schift-gray-70)]"}`} title="Redo (Ctrl+Shift+Z)">&#x21AA;</button>
        </div>

        {/* Sticky note */}
        <button onClick={addStickyNote} className="px-1.5 py-1 rounded text-xs text-[var(--schift-gray-30)] hover:bg-[var(--schift-gray-80)]" title="Add sticky note">&#x1F4CC;</button>

        <div className="w-px h-5 bg-[var(--schift-gray-80)] mx-1" />

        <span className="text-[10px] text-[var(--schift-gray-60)]">{state.blocks.length} blocks &middot; {state.edges.length} edges</span>
        {selectedBlockIds.size > 1 && <span className="text-[10px] font-medium text-[var(--schift-blue)]">{selectedBlockIds.size} selected</span>}
        {hasUnsavedChanges && <span className="text-[10px] font-medium text-[var(--schift-yellow)]">Unsaved changes</span>}

        <Button variant="outline" size="sm" onClick={handleValidate} disabled={isValidating} className="text-xs">{isValidating ? "Checking\u2026" : "Validate"}</Button>
        <Button variant="outline" size="sm" onClick={handleSave} disabled={isSaving}
          className={saveStatus === "saved" ? "border-[var(--schift-green)]/50 text-[var(--schift-green)] text-xs" : saveStatus === "error" ? "border-[var(--schift-red)]/50 text-[var(--schift-red)] text-xs" : "text-xs"}>
          {isSaving ? "Saving\u2026" : saveStatus === "saved" ? "Saved" : saveStatus === "error" ? "Error" : "Save"}
        </Button>
        <Button size="sm" onClick={handleRun} disabled={isRunning} className="text-xs gap-1">
          {isRunning ? <><span className="animate-spin">&orarr;</span> Running</> : <>&blacktriangleright; Run</>}
        </Button>
      </header>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        <BlockPalette onDragStart={() => {}} />
        <div className="flex flex-col flex-1 overflow-hidden">
          <WorkflowCanvas
            blocks={state.blocks}
            edges={state.edges}
            selectedBlockId={selectedBlockId}
            selectedBlockIds={selectedBlockIds}
            blockStatuses={blockStatuses}
            stickyNotes={stickyNotes}
            onSelectBlock={(id, additive) => selectBlock(id, additive)}
            onMoveBlock={handleMoveBlock}
            onDropBlock={handleDropBlock}
            onQuickAddBlock={handleQuickAddBlock}
            onAddEdge={handleAddEdge}
            onDeleteEdge={handleDeleteEdge}
            onUpdateStickyNote={updateStickyNote}
            onRemoveStickyNote={removeStickyNote}
          />
          {/* Run results panel */}
          {showRunPanel && runResult && (
            <div className={`flex-shrink-0 border-t ${runResult.status === "success" ? "border-[var(--schift-green)]/30 bg-[var(--schift-green)]/5" : runResult.status === "running" ? "border-[var(--schift-blue)]/30 bg-[var(--schift-blue)]/5" : "border-[var(--schift-red)]/30 bg-[var(--schift-red)]/5"}`}>
              <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--schift-gray-80)]">
                <span className={`text-xs font-medium ${runResult.status === "success" ? "text-[var(--schift-green)]" : runResult.status === "running" ? "text-[var(--schift-blue)]" : "text-[var(--schift-red)]"}`}>
                  {runResult.status === "running" ? "Running" : runResult.status === "success" ? "Success" : "Error"}
                </span>
                <button onClick={() => { setShowRunPanel(false); setBlockStatuses(new Map()); }} className="text-[var(--schift-gray-50)] hover:text-[var(--schift-white)] text-xs">&times;</button>
              </div>
              <div className="px-4 py-3 max-h-40 overflow-y-auto">
                <pre className="text-xs font-mono text-[var(--schift-gray-30)] whitespace-pre-wrap">{runResult.message}</pre>
                {runResult.outputs && Object.keys(runResult.outputs).length > 0 && (
                  <pre className="text-xs font-mono text-[var(--schift-gray-50)] mt-2 whitespace-pre-wrap">{JSON.stringify(runResult.outputs, null, 2)}</pre>
                )}
              </div>
            </div>
          )}
        </div>
        <BlockConfigPanel block={selectedBlock} onUpdate={handleUpdateBlock} onDelete={handleDeleteBlock} onClose={() => setSelectedBlockIds(new Set())} />
      </div>

      {/* Exit confirm dialog */}
      <Dialog open={showExitConfirm}>
        <DialogContent onClose={() => setShowExitConfirm(false)} className="max-w-[420px]">
          <DialogHeader><DialogTitle>Leave builder?</DialogTitle>
            <DialogDescription>You have unsaved workflow changes. Save first if you want to keep the latest block layout and connections.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExitConfirm(false)}>Stay here</Button>
            <Button variant="outline" onClick={() => { setShowExitConfirm(false); void handleSave(); }}>Save first</Button>
            <Button variant="destructive" onClick={() => { setShowExitConfirm(false); onBack(); }}>Leave without saving</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
