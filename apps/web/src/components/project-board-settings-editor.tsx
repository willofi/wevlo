"use client";

import { GripVertical } from "lucide-react";
import { type DragEndEvent, DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";

import type { ProjectBoardAccent, ProjectBoardColumnConfigDto } from "@wevlo/contracts";
import { Input, cn } from "@wevlo/ui-web";

export const boardAccentLabels: Record<ProjectBoardAccent, string> = {
  slate: "Slate",
  blue: "Blue",
  amber: "Amber",
  teal: "Teal",
  rose: "Rose"
};

export const boardAccentClasses: Record<ProjectBoardAccent, { chip: string; dot: string; panel: string; rail: string }> = {
  slate: {
    chip: "border-slate-200 bg-slate-100 text-slate-700",
    dot: "bg-slate-400",
    panel: "border-border/70 bg-card/70",
    rail: "border-t-slate-200"
  },
  blue: {
    chip: "border-sky-200 bg-sky-100 text-sky-700",
    dot: "bg-sky-400",
    panel: "border-border/70 bg-card/70",
    rail: "border-t-sky-200"
  },
  amber: {
    chip: "border-amber-200 bg-amber-100 text-amber-700",
    dot: "bg-amber-400",
    panel: "border-border/70 bg-card/70",
    rail: "border-t-amber-200"
  },
  teal: {
    chip: "border-teal-200 bg-teal-100 text-teal-700",
    dot: "bg-teal-400",
    panel: "border-border/70 bg-card/70",
    rail: "border-t-teal-200"
  },
  rose: {
    chip: "border-rose-200 bg-rose-100 text-rose-700",
    dot: "bg-rose-400",
    panel: "border-border/70 bg-card/70",
    rail: "border-t-rose-200"
  }
};

const selectClassName =
  "flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring";

type ProjectBoardSettingsEditorProps = {
  columns: ProjectBoardColumnConfigDto[];
  disabled?: boolean | undefined;
  onChange: (columns: ProjectBoardColumnConfigDto[]) => void;
};

type SortableBoardColumnRowProps = {
  column: ProjectBoardColumnConfigDto;
  disabled?: boolean | undefined;
  onAccentChange: (accent: ProjectBoardAccent) => void;
  onLabelChange: (label: string) => void;
};

const reorderColumns = (
  columns: ProjectBoardColumnConfigDto[],
  activeState: ProjectBoardColumnConfigDto["state"],
  overState: ProjectBoardColumnConfigDto["state"]
) =>
  arrayMove(
    columns,
    columns.findIndex((column) => column.state === activeState),
    columns.findIndex((column) => column.state === overState)
  ).map((column, index) => ({
    ...column,
    order: index
  }));

function SortableBoardColumnRow({
  column,
  disabled = false,
  onAccentChange,
  onLabelChange
}: SortableBoardColumnRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: column.state,
    ...(disabled ? { disabled: true } : {})
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition
      }}
      className={cn(
        "grid gap-3 rounded-2xl border border-t-[3px] bg-card/70 p-4 shadow-sm md:grid-cols-[auto_minmax(0,1fr)_160px]",
        boardAccentClasses[column.accent].panel,
        boardAccentClasses[column.accent].rail,
        isDragging && "opacity-70 shadow-lg"
      )}
    >
      <button
        type="button"
        className="mt-1 inline-flex size-9 items-center justify-center rounded-xl border border-border/70 bg-background/80 text-muted-foreground transition-colors hover:text-foreground"
        aria-label={`Reorder ${column.label}`}
        disabled={disabled}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <div className="grid gap-2">
        <div className="flex items-center gap-2">
          <span className={cn("size-2 rounded-full", boardAccentClasses[column.accent].dot)} />
          <span className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">{column.state.replace("_", " ")}</span>
        </div>
        <Input value={column.label} onChange={(event) => onLabelChange(event.target.value)} disabled={disabled} />
      </div>
      <label className="grid gap-2">
        <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Accent</span>
        <select
          value={column.accent}
          onChange={(event) => onAccentChange(event.target.value as ProjectBoardAccent)}
          disabled={disabled}
          className={selectClassName}
        >
          {Object.entries(boardAccentLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function ProjectBoardSettingsEditor({
  columns,
  disabled = false,
  onChange
}: ProjectBoardSettingsEditorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    onChange(reorderColumns(columns, active.id as ProjectBoardColumnConfigDto["state"], over.id as ProjectBoardColumnConfigDto["state"]));
  };

  return (
    <div className="grid gap-3">
      <div className="text-sm leading-6 text-muted-foreground">
        Reorder board columns for the whole project and choose cleaner labels or accents without changing the underlying workflow states.
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={columns.map((column) => column.state)} strategy={verticalListSortingStrategy}>
          <div className="grid gap-3">
            {columns.map((column) => (
              <SortableBoardColumnRow
                key={column.state}
                column={column}
                disabled={disabled}
                onLabelChange={(label) =>
                  onChange(
                    columns.map((candidate) =>
                      candidate.state === column.state ? { ...candidate, label } : candidate
                    )
                  )
                }
                onAccentChange={(accent) =>
                  onChange(
                    columns.map((candidate) =>
                      candidate.state === column.state ? { ...candidate, accent } : candidate
                    )
                  )
                }
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
