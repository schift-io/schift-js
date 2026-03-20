import {
  CATEGORY_BADGE_COLORS,
  type BlockCategory,
  type BlockTypeDefinition,
} from "../types.js";
import { useBlockTypes } from "../context.js";

interface BlockPaletteProps {
  onDragStart: (blockType: string) => void;
}

const CATEGORIES: BlockCategory[] = [
  "Control",
  "Document",
  "Embedding",
  "Storage",
  "Retrieval",
  "LLM",
  "Logic",
  "Transform",
  "Integration",
];

const STARTER_BLOCKS = [
  "start",
  "document_loader",
  "chunker",
  "embedder",
  "llm",
  "end",
];

function PaletteItem({
  def,
  onDragStart,
  featured = false,
}: {
  def: BlockTypeDefinition;
  onDragStart: (type: string) => void;
  featured?: boolean;
}) {
  const badge = CATEGORY_BADGE_COLORS[def.category];

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("block-type", def.type);
        e.dataTransfer.effectAllowed = "copy";
        onDragStart(def.type);
      }}
      className={`flex items-center gap-2 px-3 py-2 rounded cursor-grab active:cursor-grabbing hover:bg-[var(--schift-gray-80)] transition-colors select-none group ${
        featured
          ? "border border-[var(--schift-blue)]/20 bg-[var(--schift-blue)]/5"
          : ""
      }`}
      title={`Drag to add ${def.label}`}
    >
      <span
        className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-mono ${badge}`}
      >
        {def.icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--schift-gray-30)] group-hover:text-[var(--schift-white)] transition-colors truncate">
            {def.label}
          </span>
          {featured && (
            <span className="text-[10px] text-[var(--schift-blue)] uppercase tracking-wider">
              starter
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BlockPalette({ onDragStart }: BlockPaletteProps) {
  const blockTypes = useBlockTypes();
  const allCategories = Array.from(new Set([...CATEGORIES, ...blockTypes.map((b) => b.category)])) as BlockCategory[];
  const byCategory = allCategories.reduce<Record<string, BlockTypeDefinition[]>>(
    (acc, cat) => {
      acc[cat] = blockTypes.filter((b) => b.category === cat);
      return acc;
    },
    {},
  );

  return (
    <aside className="w-52 flex-shrink-0 h-full bg-[var(--schift-gray-100)] border-r border-[var(--schift-gray-80)] overflow-y-auto flex flex-col">
      <div className="px-3 py-3 border-b border-[var(--schift-gray-80)]">
        <p className="text-xs font-semibold text-[var(--schift-gray-50)] uppercase tracking-wider">
          Blocks
        </p>
        <p className="text-[11px] text-[var(--schift-gray-50)] mt-2 leading-5">
          Drag a starter block onto the canvas, then connect the right-side
          output circle to another block&apos;s left-side input.
        </p>
      </div>

      <div className="px-3 py-3 border-b border-[var(--schift-gray-80)] bg-[var(--schift-gray-90)]">
        <p className="text-[10px] font-semibold text-[var(--schift-gray-50)] uppercase tracking-wider mb-2">
          First run
        </p>
        <ol className="space-y-1 text-[11px] text-[var(--schift-gray-30)] leading-5">
          <li>1. Start with `Start`, `Document Loader`, or `LLM`.</li>
          <li>2. Drop the block anywhere on the canvas.</li>
          <li>3. Click an output circle, then an input circle to connect.</li>
          <li>4. Click any block to edit its config on the right.</li>
        </ol>
      </div>

      <div className="flex-1 py-2">
        {allCategories.map((cat) => (
          <div key={cat} className="mb-1">
            <div className="px-3 pt-3 pb-1">
              <p
                className={`text-[10px] font-semibold uppercase tracking-wider ${CATEGORY_BADGE_COLORS[cat]}`}
              >
                {cat}
              </p>
            </div>
            {byCategory[cat].map((def) => (
              <PaletteItem
                key={def.type}
                def={def}
                onDragStart={onDragStart}
                featured={STARTER_BLOCKS.includes(def.type)}
              />
            ))}
          </div>
        ))}
      </div>
    </aside>
  );
}
