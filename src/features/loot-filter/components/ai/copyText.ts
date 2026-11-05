import { toast } from 'sonner';

/** Copies `text` to the clipboard with a toast either way; resolves to whether it worked. */
export async function copyText(text: string, success: string, description?: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(success, { description });
    return true;
  } catch (error) {
    console.error('[Loot filters] Could not copy to the clipboard', error);
    toast.error('Could not copy to the clipboard');
    return false;
  }
}
