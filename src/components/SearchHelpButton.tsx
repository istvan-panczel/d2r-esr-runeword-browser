import type { ReactNode } from 'react';
import { HelpCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

interface SearchExample {
  readonly query: string;
  readonly description: string;
}

interface SearchHelpButtonProps {
  readonly examples?: readonly SearchExample[];
  /** Page-specific sections between the exact phrase and the examples sections */
  readonly children?: ReactNode;
}

const DEFAULT_EXAMPLES: readonly SearchExample[] = [
  { query: 'life fire', description: 'items with both "life" and "fire"' },
  { query: '"maximum life"', description: 'exact phrase "maximum life"' },
  { query: '"life on striking"', description: 'exact phrase' },
  { query: '"aura when" mana', description: 'combines phrase + word' },
];

/**
 * A help button that shows search syntax explanation in a popover
 */
export function SearchHelpButton({ examples = DEFAULT_EXAMPLES, children }: SearchHelpButtonProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="size-5 text-muted-foreground" aria-label="Search help">
          <HelpCircle className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-3">
          <div>
            <h4 className="font-medium mb-1">How to Search</h4>
            <p className="text-sm text-muted-foreground">
              Type words separated by spaces to filter results. Items matching <strong>all</strong> words will be shown.
            </p>
          </div>

          <div>
            <h4 className="font-medium mb-1">Exact Phrases</h4>
            <p className="text-sm text-muted-foreground">
              Use <code className="bg-muted px-1 rounded">"quotes"</code> to search for exact phrases.
            </p>
          </div>

          {children}

          <div>
            <h4 className="font-medium mb-1">Examples</h4>
            <ul className="text-sm space-y-1 text-muted-foreground">
              {examples.map((example) => (
                <li key={example.query}>
                  <code className="bg-muted px-1 rounded">{example.query}</code> - {example.description}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
