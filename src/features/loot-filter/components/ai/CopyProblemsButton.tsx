import { MessageSquareShare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Diagnostic, LootFilter } from '../../engine/types';
import { problemsMessage } from '../../utils/aiFollowUp';
import { copyText } from './copyText';

interface CopyProblemsButtonProps {
  readonly diagnostics: readonly Diagnostic[];
  /** For the rule comments in the message; null when the text cannot be read. */
  readonly filter: LootFilter | null;
  readonly size?: 'sm' | 'default';
  readonly variant?: 'default' | 'outline';
}

/**
 * "Copy problems for the AI": the problems list as a ready follow-up message for the LLM (rule numbers, comments and
 * paths, then "fix these and keep everything else"). Nothing to copy without problems.
 */
export function CopyProblemsButton({ diagnostics, filter, size = 'sm', variant = 'outline' }: CopyProblemsButtonProps) {
  const message = problemsMessage(diagnostics, filter);
  if (message === null) return null;
  return (
    <Button
      size={size}
      variant={variant}
      onClick={() =>
        void copyText(message, 'Copied the problems', 'Paste them into the AI chat; it fixes them and sends the whole filter again.')
      }
    >
      <MessageSquareShare />
      Copy problems for the AI
    </Button>
  );
}
