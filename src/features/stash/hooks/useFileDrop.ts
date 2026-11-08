import { useState, type DragEvent } from 'react';

const hasFiles = (event: DragEvent) => event.dataTransfer.types.includes('Files');

/** Drag-and-drop of one file onto an element: the handlers to spread on it and whether a file is over it. */
export function useFileDrop(onFile: (file: File) => void) {
  return useFilesDrop((files) => {
    const first = files.at(0);
    if (first !== undefined) onFile(first);
  });
}

/** Drag-and-drop of one or more files onto an element: the handlers to spread on it and whether a file is over it. */
export function useFilesDrop(onFiles: (files: readonly File[]) => void) {
  const [dragging, setDragging] = useState(false);
  const handlers = {
    onDragOver: (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      setDragging(true);
    },
    onDragLeave: (event: DragEvent) => {
      // Leaving into a child element is not leaving the drop target
      if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
      setDragging(false);
    },
    onDrop: (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      setDragging(false);
      if (event.dataTransfer.files.length > 0) onFiles(Array.from(event.dataTransfer.files));
    },
  };
  return { dragging, handlers };
}
