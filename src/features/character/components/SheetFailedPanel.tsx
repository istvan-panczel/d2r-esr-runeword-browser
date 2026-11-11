import { TriangleAlert } from 'lucide-react';
import { DevNotice } from '@/core/components/DevNotice';

/**
 * The calm stand-in for the computed numbers when the calculation failed on this save (an engine error, not the data):
 * says so with the message; the page around it keeps working.
 */
export function SheetFailedPanel({ message }: { readonly message: string }) {
  return (
    <DevNotice icon={TriangleAlert} title="Could not work out this character’s numbers.">
      The save itself was read: its stored values are shown below, and the other tabs work. Please report this with the save if you can.
      Details: {message}
    </DevNotice>
  );
}
