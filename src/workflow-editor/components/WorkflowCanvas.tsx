import { useRef, useState, useCallback, useEffect } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { useWorkflowUI } from "../context.js";
import { getBlockTypeDef, CATEGORY_ACCENT, CATEGORY_BADGE_COLORS } from "../types.js";
import type { CanvasBlock, CanvasEdge, PendingConnection } from "../types.js";
import type { StickyNote, BlockStatus } from "./WorkflowBuilder.js";

const BLOCK_WIDTH = 180;
const BLOCK_HEADER_HEIGHT = 56;
const PORT_SIZE = 10;
const PORT_HIT_SIZE = 18;
const PORT_SPACING = 20;

function blockHeight(def: ReturnType<typeof getBlockTypeDef>): number {
  if (!def) return BLOCK_HEADER_HEIGHT;
  return BLOCK_HEADER_HEIGHT + Math.max(def.inputs.length, def.outputs.length, 1) * PORT_SPACING + 8;
}
function portY(i: number) { return BLOCK_HEADER_HEIGHT + i * PORT_SPACING + PORT_SPACING / 2; }
function getOutputPortPos(b: CanvasBlock, i: number) { return { x: b.position.x + BLOCK_WIDTH, y: b.position.y + portY(i) }; }
function getInputPortPos(b: CanvasBlock, i: number) { return { x: b.position.x, y: b.position.y + portY(i) }; }
function bezierPath(sx: number, sy: number, tx: number, ty: number) { const cx = (sx + tx) / 2; return `M${sx},${sy} C${cx},${sy} ${cx},${ty} ${tx},${ty}`; }
function truncate(s: string, n: number) { return s.length > n ? s.slice(0, n) + "\u2026" : s; }

function accentFill(cat?: string) {
  const m: Record<string, string> = { Control: "#64748b", Document: "#3b82f6", Embedding: "#8b5cf6", Storage: "#10b981", Retrieval: "#f59e0b", LLM: "#f43f5e", Logic: "#06b6d4", Transform: "#f97316", Integration: "#ec4899" };
  return m[cat ?? ""] ?? "#64748b";
}
function badgeFill(cat?: string) {
  const m: Record<string, string> = { Control: "#94a3b8", Document: "#93c5fd", Embedding: "#c4b5fd", Storage: "#6ee7b7", Retrieval: "#fcd34d", LLM: "#fda4af", Logic: "#67e8f9", Transform: "#fdba74", Integration: "#f9a8d4" };
  return m[cat ?? ""] ?? "#94a3b8";
}

const STATUS_COLORS: Record<BlockStatus, string> = {
  idle: "", pending: "#f59e0b", running: "#3b82f6", completed: "#10b981", failed: "#ef4444",
};

// ---- BlockNode ----

function BlockNode({ block, isSelected, isMultiSelected, isPendingSource, status, onMouseDown, onClick, onOutputPortClick, onInputPortClick, pendingConnection }: {
  block: CanvasBlock; isSelected: boolean; isMultiSelected: boolean; isPendingSource: boolean; status: BlockStatus;
  onMouseDown: (e: ReactMouseEvent, id: string) => void; onClick: (e: ReactMouseEvent, id: string) => void;
  onOutputPortClick: (e: ReactMouseEvent, id: string, port: string) => void; onInputPortClick: (e: ReactMouseEvent, id: string, port: string) => void;
  pendingConnection: PendingConnection | null;
}) {
  const def = getBlockTypeDef(block.type);
  const h = blockHeight(def);
  const inputs = def?.inputs ?? ["in"];
  const outputs = def?.outputs ?? ["out"];
  const statusColor = STATUS_COLORS[status];
  const borderColor = statusColor || (isSelected ? "var(--schift-blue)" : isMultiSelected ? "#8b5cf6" : isPendingSource ? "var(--schift-green)" : "var(--schift-gray-70)");
  const strokeW = isSelected || isMultiSelected || isPendingSource || statusColor ? 2 : 1;

  return (
    <g transform={`translate(${block.position.x},${block.position.y})`} style={{ cursor: "grab" }} onMouseDown={(e) => onMouseDown(e, block.id)} onClick={(e) => onClick(e, block.id)}>
      <rect x={2} y={2} width={BLOCK_WIDTH} height={h} rx={6} fill="rgba(0,0,0,0.4)" />
      <rect width={BLOCK_WIDTH} height={h} rx={6} fill="var(--schift-gray-90)" stroke={borderColor} strokeWidth={strokeW} />
      {/* Status glow */}
      {statusColor && <rect width={BLOCK_WIDTH} height={h} rx={6} fill="none" stroke={statusColor} strokeWidth={3} opacity={0.3} />}
      {/* Running spinner indicator */}
      {status === "running" && <circle cx={BLOCK_WIDTH - 12} cy={12} r={4} fill="none" stroke={statusColor} strokeWidth={1.5} strokeDasharray="6,4" style={{ animation: "spin 1s linear infinite", transformOrigin: `${BLOCK_WIDTH - 12}px 12px` }} />}
      {/* Status dot */}
      {status !== "idle" && <circle cx={BLOCK_WIDTH - 12} cy={12} r={4} fill={statusColor} />}
      <rect x={0} y={0} width={4} height={h} rx={6} style={{ fill: accentFill(def?.category) }} />
      <text x={16} y={22} dominantBaseline="middle" fontSize="14" style={{ userSelect: "none" }}>{def?.icon ?? "?"}</text>
      <text x={36} y={18} fontSize="11" fontWeight="600" fill="var(--schift-white)" style={{ userSelect: "none" }}>{truncate(block.title, 16)}</text>
      <text x={36} y={34} fontSize="9" fill={badgeFill(def?.category)} style={{ userSelect: "none" }}>{def?.category ?? block.type}</text>
      {inputs.map((port, i) => {
        const py = portY(i);
        const canConnect = !!pendingConnection && pendingConnection.sourceBlockId !== block.id;
        return (<g key={`in-${port}`}>
          <circle cx={0} cy={py} r={PORT_HIT_SIZE / 2} fill="transparent" style={{ cursor: canConnect ? "pointer" : "default" }} onClick={(e) => { e.stopPropagation(); onInputPortClick(e, block.id, port); }} />
          <circle cx={0} cy={py} r={PORT_SIZE / 2} fill={canConnect ? "var(--schift-green)" : "var(--schift-gray-70)"} stroke="var(--schift-gray-50)" strokeWidth={1} style={{ cursor: canConnect ? "pointer" : "default" }} onClick={(e) => { e.stopPropagation(); onInputPortClick(e, block.id, port); }} />
          <text x={8} y={py} dominantBaseline="middle" fontSize="8" fill="var(--schift-gray-50)" style={{ userSelect: "none" }}>{port}</text>
        </g>);
      })}
      {outputs.map((port, i) => {
        const py = portY(i);
        return (<g key={`out-${port}`}>
          <circle cx={BLOCK_WIDTH} cy={py} r={PORT_HIT_SIZE / 2} fill="transparent" style={{ cursor: "crosshair" }} onClick={(e) => { e.stopPropagation(); onOutputPortClick(e, block.id, port); }} />
          <circle cx={BLOCK_WIDTH} cy={py} r={PORT_SIZE / 2} fill="var(--schift-gray-60)" stroke="var(--schift-gray-50)" strokeWidth={1} style={{ cursor: "crosshair" }} onClick={(e) => { e.stopPropagation(); onOutputPortClick(e, block.id, port); }} />
          <text x={BLOCK_WIDTH - 8} y={py} dominantBaseline="middle" textAnchor="end" fontSize="8" fill="var(--schift-gray-50)" style={{ userSelect: "none" }}>{port}</text>
        </g>);
      })}
    </g>
  );
}

// ---- Minimap ----

function Minimap({ blocks, edges, pan, zoom, viewW, viewH }: {
  blocks: CanvasBlock[]; edges: CanvasEdge[]; pan: { x: number; y: number }; zoom: number; viewW: number; viewH: number;
}) {
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

  // Viewport rect in world coords
  const vpX = (-pan.x / zoom - minX) * scale;
  const vpY = (-pan.y / zoom - minY) * scale;
  const vpW = (viewW / zoom) * scale;
  const vpH = (viewH / zoom) * scale;

  return (
    <div className="absolute bottom-3 left-3 rounded-lg border border-[var(--schift-gray-70)] bg-[var(--schift-gray-100)]/90 overflow-hidden" style={{ width: mmW, height: mmH }}>
      <svg width={mmW} height={mmH}>
        {edges.map((edge) => {
          const s = blocks.find((b) => b.id === edge.sourceBlockId);
          const t = blocks.find((b) => b.id === edge.targetBlockId);
          if (!s || !t) return null;
          return <line key={edge.id} x1={(s.position.x + BLOCK_WIDTH / 2 - minX) * scale} y1={(s.position.y + 20 - minY) * scale} x2={(t.position.x + BLOCK_WIDTH / 2 - minX) * scale} y2={(t.position.y + 20 - minY) * scale} stroke="var(--schift-gray-60)" strokeWidth={0.5} />;
        })}
        {blocks.map((b) => (
          <rect key={b.id} x={(b.position.x - minX) * scale} y={(b.position.y - minY) * scale} width={BLOCK_WIDTH * scale} height={30 * scale} rx={2} fill={accentFill(getBlockTypeDef(b.type)?.category)} opacity={0.7} />
        ))}
        <rect x={vpX} y={vpY} width={vpW} height={vpH} fill="none" stroke="var(--schift-blue)" strokeWidth={1} rx={1} opacity={0.6} />
      </svg>
    </div>
  );
}

// ---- Main Canvas ----

interface WorkflowCanvasProps {
  blocks: CanvasBlock[];
  edges: CanvasEdge[];
  selectedBlockId: string | null;
  selectedBlockIds: Set<string>;
  blockStatuses: Map<string, BlockStatus>;
  stickyNotes: StickyNote[];
  onSelectBlock: (id: string | null, additive?: boolean) => void;
  onMoveBlock: (id: string, pos: { x: number; y: number }) => void;
  onDropBlock: (type: string, pos: { x: number; y: number }) => void;
  onQuickAddBlock?: (type: string) => void;
  onAddEdge: (src: string, srcPort: string, tgt: string, tgtPort: string) => void;
  onDeleteEdge: (id: string) => void;
  onUpdateStickyNote: (id: string, updates: Partial<StickyNote>) => void;
  onRemoveStickyNote: (id: string) => void;
}

export default function WorkflowCanvas({ blocks, edges, selectedBlockId, selectedBlockIds, blockStatuses, stickyNotes, onSelectBlock, onMoveBlock, onDropBlock, onQuickAddBlock, onAddEdge, onDeleteEdge, onUpdateStickyNote, onRemoveStickyNote }: WorkflowCanvasProps) {
  const { Button } = useWorkflowUI();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState<{ blockId: string; startMouse: { x: number; y: number }; startPos: { x: number; y: number } } | null>(null);
  const [panning, setPanning] = useState<{ startMouse: { x: number; y: number }; startPan: { x: number; y: number } } | null>(null);
  const [pendingConnection, setPendingConnection] = useState<PendingConnection | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [editingStickyId, setEditingStickyId] = useState<string | null>(null);
  const [containerSize, setContainerSize] = useState({ w: 800, h: 600 });

  // Track container size for minimap viewport
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setContainerSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const svgToWorld = useCallback((cx: number, cy: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return { x: (cx - rect.left - pan.x) / zoom, y: (cy - rect.top - pan.y) / zoom };
  }, [pan, zoom]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
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

  const handleMouseUp = useCallback(() => { setDragging(null); setPanning(null); }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => { window.removeEventListener("mousemove", handleMouseMove); window.removeEventListener("mouseup", handleMouseUp); };
  }, [handleMouseMove, handleMouseUp]);

  useEffect(() => { if (selectedEdgeId && !edges.some((e) => e.id === selectedEdgeId)) setSelectedEdgeId(null); }, [edges, selectedEdgeId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { if (pendingConnection) setPendingConnection(null); if (selectedEdgeId) setSelectedEdgeId(null); return; }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedEdgeId && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault(); onDeleteEdge(selectedEdgeId); setSelectedEdgeId(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onDeleteEdge, pendingConnection, selectedEdgeId]);

  const handleBlockMouseDown = useCallback((e: ReactMouseEvent, blockId: string) => {
    e.stopPropagation();
    if (pendingConnection) return;
    const block = blocks.find((b) => b.id === blockId);
    if (!block) return;
    setDragging({ blockId, startMouse: { x: e.clientX, y: e.clientY }, startPos: { ...block.position } });
  }, [blocks, pendingConnection]);

  const handleBlockClick = useCallback((e: ReactMouseEvent, blockId: string) => {
    e.stopPropagation(); setSelectedEdgeId(null);
    if (pendingConnection) { setPendingConnection(null); return; }
    onSelectBlock(blockId, e.shiftKey || e.metaKey);
  }, [pendingConnection, onSelectBlock]);

  const handleOutputPortClick = useCallback((e: ReactMouseEvent, blockId: string, port: string) => {
    e.stopPropagation(); setSelectedEdgeId(null); setPendingConnection({ sourceBlockId: blockId, sourcePort: port });
  }, []);

  const handleInputPortClick = useCallback((e: ReactMouseEvent, blockId: string, port: string) => {
    e.stopPropagation(); setSelectedEdgeId(null);
    if (pendingConnection && pendingConnection.sourceBlockId !== blockId) { onAddEdge(pendingConnection.sourceBlockId, pendingConnection.sourcePort, blockId, port); setPendingConnection(null); }
  }, [pendingConnection, onAddEdge]);

  const handleSvgMouseDown = useCallback((e: ReactMouseEvent) => {
    setSelectedEdgeId(null);
    if (pendingConnection) { setPendingConnection(null); return; }
    onSelectBlock(null);
    setPanning({ startMouse: { x: e.clientX, y: e.clientY }, startPan: { ...pan } });
  }, [pendingConnection, pan, onSelectBlock]);

  const handleWheel = useCallback((e: React.WheelEvent) => { e.preventDefault(); setZoom((z) => Math.min(Math.max(z * (e.deltaY > 0 ? 0.9 : 1.1), 0.2), 3)); }, []);
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); const type = e.dataTransfer.getData("block-type"); if (type) onDropBlock(type, svgToWorld(e.clientX, e.clientY)); };

  // Build edge paths
  const edgePaths = edges.map((edge) => {
    const s = blocks.find((b) => b.id === edge.sourceBlockId);
    const t = blocks.find((b) => b.id === edge.targetBlockId);
    if (!s || !t) return null;
    const sp = getOutputPortPos(s, Math.max((getBlockTypeDef(s.type)?.outputs ?? ["out"]).indexOf(edge.sourcePort), 0));
    const tp = getInputPortPos(t, Math.max((getBlockTypeDef(t.type)?.inputs ?? ["in"]).indexOf(edge.targetPort), 0));
    return { edge, path: bezierPath(sp.x, sp.y, tp.x, tp.y) };
  }).filter(Boolean) as { edge: CanvasEdge; path: string }[];

  let pendingPath: string | null = null;
  if (pendingConnection) {
    const s = blocks.find((b) => b.id === pendingConnection.sourceBlockId);
    if (s) { const sp = getOutputPortPos(s, Math.max((getBlockTypeDef(s.type)?.outputs ?? ["out"]).indexOf(pendingConnection.sourcePort), 0)); pendingPath = bezierPath(sp.x, sp.y, mousePos.x, mousePos.y); }
  }

  return (
    <div ref={containerRef} className="flex-1 h-full relative overflow-hidden bg-[var(--schift-black)]" onDragOver={handleDragOver} onDrop={handleDrop}>
      {/* Grid */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.15 }} aria-hidden="true">
        <defs><pattern id="grid" width={20 * zoom} height={20 * zoom} patternUnits="userSpaceOnUse" x={pan.x % (20 * zoom)} y={pan.y % (20 * zoom)}><circle cx={0} cy={0} r={0.5} fill="var(--schift-gray-50)" /></pattern></defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* Main SVG */}
      <svg ref={svgRef} className="absolute inset-0 w-full h-full" onMouseDown={handleSvgMouseDown} onWheel={handleWheel} style={{ cursor: panning ? "grabbing" : pendingConnection ? "crosshair" : "default" }}>
        <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
          {/* Sticky Notes (behind blocks) */}
          {stickyNotes.map((note) => (
            <foreignObject key={note.id} x={note.position.x} y={note.position.y} width={160} height={100}>
              <div
                className="w-full h-full rounded-lg p-2 text-[11px] leading-4 overflow-hidden shadow-lg"
                style={{ backgroundColor: note.color + "30", borderLeft: `3px solid ${note.color}` }}
                onDoubleClick={() => setEditingStickyId(note.id)}
              >
                {editingStickyId === note.id ? (
                  <textarea
                    autoFocus
                    value={note.text}
                    onChange={(e) => onUpdateStickyNote(note.id, { text: e.target.value })}
                    onBlur={() => setEditingStickyId(null)}
                    onKeyDown={(e) => { if (e.key === "Escape") setEditingStickyId(null); }}
                    className="w-full h-full bg-transparent border-none outline-none text-[11px] text-[var(--schift-white)] resize-none"
                  />
                ) : (
                  <div className="text-[var(--schift-gray-30)]">
                    {note.text}
                    <button onClick={() => onRemoveStickyNote(note.id)} className="absolute top-1 right-1 text-[10px] text-[var(--schift-gray-60)] hover:text-red-400 opacity-0 group-hover:opacity-100">&times;</button>
                  </div>
                )}
              </div>
            </foreignObject>
          ))}

          {/* Edges */}
          {edgePaths.map(({ edge, path }) => (
            <g key={edge.id}>
              <path d={path} fill="none" stroke="transparent" strokeWidth={12} style={{ cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); setSelectedEdgeId(edge.id); }} />
              <path d={path} fill="none" stroke={selectedEdgeId === edge.id ? "var(--schift-blue)" : "var(--schift-gray-60)"} strokeWidth={selectedEdgeId === edge.id ? 2.5 : 1.5} markerEnd="url(#arrow)" style={{ pointerEvents: "none" }} />
            </g>
          ))}
          {pendingPath && <path d={pendingPath} fill="none" stroke="var(--schift-green)" strokeWidth={1.5} strokeDasharray="5,3" style={{ pointerEvents: "none" }} />}
          <defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="var(--schift-gray-60)" /></marker></defs>

          {/* Blocks */}
          {blocks.map((block) => (
            <BlockNode key={block.id} block={block}
              isSelected={selectedBlockId === block.id}
              isMultiSelected={selectedBlockIds.has(block.id) && selectedBlockIds.size > 1}
              isPendingSource={pendingConnection?.sourceBlockId === block.id}
              status={blockStatuses.get(block.id) ?? "idle"}
              onMouseDown={handleBlockMouseDown} onClick={handleBlockClick}
              onOutputPortClick={handleOutputPortClick} onInputPortClick={handleInputPortClick}
              pendingConnection={pendingConnection} />
          ))}
        </g>
      </svg>

      {/* Empty state */}
      {blocks.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center px-6">
          <div className="w-full max-w-lg rounded-xl border border-[var(--schift-gray-80)] bg-[var(--schift-gray-100)]/95 p-6 text-left shadow-2xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--schift-blue)] mb-2">Start Here</p>
            <h3 className="text-lg font-semibold text-[var(--schift-white)] mb-2">Build your first flow in three steps</h3>
            <div className="space-y-2 text-sm text-[var(--schift-gray-30)]">
              <p>1. Add a starter block from the left palette or use the quick buttons below.</p>
              <p>2. Click a block to edit its config in the right panel.</p>
              <p>3. Click an output port, then click an input port to connect blocks.</p>
            </div>
            {onQuickAddBlock && (
              <div className="mt-5 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => onQuickAddBlock("start")}>Add Start</Button>
                <Button size="sm" variant="outline" onClick={() => onQuickAddBlock("document_loader")}>Add Document Loader</Button>
                <Button size="sm" variant="outline" onClick={() => onQuickAddBlock("llm")}>Add LLM</Button>
                <Button size="sm" variant="outline" onClick={() => onQuickAddBlock("answer")}>Add Answer</Button>
              </div>
            )}
            <p className="text-xs text-[var(--schift-gray-50)] mt-4">Scroll to zoom, drag the background to pan. Shift+click to multi-select. Ctrl+Z to undo.</p>
          </div>
        </div>
      )}

      {/* Zoom indicator */}
      <div className="absolute bottom-3 right-3 text-[10px] text-[var(--schift-gray-60)] bg-[var(--schift-gray-90)] px-2 py-1 rounded pointer-events-none">{Math.round(zoom * 100)}%</div>

      {/* Connection mode hint */}
      {pendingConnection && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-[var(--schift-green)]/20 border border-[var(--schift-green)]/40 text-[var(--schift-green)] text-xs px-3 py-1.5 rounded pointer-events-none">
          Connecting from <span className="font-mono">{pendingConnection.sourcePort}</span>. Click any input port to finish, or press Escape to cancel.
        </div>
      )}

      {/* Edge selected panel */}
      {selectedEdgeId && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-lg border border-[var(--schift-blue)]/40 bg-[var(--schift-gray-100)]/95 px-3 py-3 shadow-lg">
          <p className="text-xs font-medium text-[var(--schift-white)]">Connection selected</p>
          <p className="text-xs text-[var(--schift-gray-50)] mt-1 mb-3">Press Delete to remove, or click elsewhere to deselect.</p>
          <div className="flex items-center justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setSelectedEdgeId(null)}>Keep</Button>
            <Button size="sm" variant="destructive" onClick={() => { onDeleteEdge(selectedEdgeId); setSelectedEdgeId(null); }}>Remove</Button>
          </div>
        </div>
      )}

      {/* Minimap */}
      <Minimap blocks={blocks} edges={edges} pan={pan} zoom={zoom} viewW={containerSize.w} viewH={containerSize.h} />
    </div>
  );
}
