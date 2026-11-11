import { Component, type ErrorInfo, type ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';
import { DevNotice } from '@/core/components/DevNotice';

interface CharacterPageBoundaryProps {
  readonly children: ReactNode;
}

interface CharacterPageBoundaryState {
  readonly message: string | null;
}

/**
 * Keeps an unexpected error in one character's tabs from taking the whole page (and its switcher with Remove) down to
 * the route error screen. Keyed by the character in CharacterGate, so switching to another character starts afresh.
 * Error boundaries still need a class.
 */
export class CharacterPageBoundary extends Component<CharacterPageBoundaryProps, CharacterPageBoundaryState> {
  override state: CharacterPageBoundaryState = { message: null };

  static getDerivedStateFromError(error: unknown): CharacterPageBoundaryState {
    return { message: error instanceof Error ? error.message : String(error) };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('[Character] The character page failed:', error, info.componentStack);
  }

  override render() {
    if (this.state.message === null) return this.props.children;
    return (
      <DevNotice icon={TriangleAlert} title="This character’s page could not be shown.">
        Something in this save tripped the page up. You can switch to another character, or remove this one and upload it again. Details:{' '}
        {this.state.message}
      </DevNotice>
    );
  }
}
