"use client";

import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export interface SortableHandle {
  setNodeRef: (el: HTMLElement | null) => void;
  style: React.CSSProperties;
  attributes: ReturnType<typeof useSortable>["attributes"];
  listeners: ReturnType<typeof useSortable>["listeners"];
}

/**
 * Generic drag-reorder engine, extracted from ResourceManager's original inline @dnd-kit setup (same sensors,
 * collision strategy and keyboard support) so list-field and object-field reordering reuse it instead of
 * reimplementing it. Unlike ResourceManager's own version, this one doesn't render the item's root element itself --
 * it hands back the ref/style/attributes/listeners so the caller can render whatever element (li, div, chip) fits.
 */
export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  strategy = "vertical",
  renderItem,
}: {
  items: T[];
  onReorder: (next: T[]) => void;
  strategy?: "vertical" | "grid";
  renderItem: (item: T, handle: SortableHandle, isDragging: boolean) => React.ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.id === active.id);
    const to = items.findIndex((i) => i.id === over.id);
    if (from === -1 || to === -1) return;
    onReorder(arrayMove(items, from, to));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={strategy === "grid" ? rectSortingStrategy : verticalListSortingStrategy}>
        {items.map((item) => (
          <Item key={item.id} id={item.id} item={item} renderItem={renderItem} />
        ))}
      </SortableContext>
    </DndContext>
  );
}

function Item<T extends { id: string }>({
  id,
  item,
  renderItem,
}: {
  id: string;
  item: T;
  renderItem: (item: T, handle: SortableHandle, isDragging: boolean) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition };
  return <>{renderItem(item, { setNodeRef, style, attributes, listeners }, isDragging)}</>;
}
