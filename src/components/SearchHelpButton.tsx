import { HelpCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

/**
 * A help button that shows search syntax explanation in a popover
 */
export function SearchHelpButton() {
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

          <div>
            <h4 className="font-medium mb-1">Examples</h4>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>
                <code className="bg-muted px-1 rounded">life fire</code> - items with both "life" and "fire"
              </li>
              <li>
                <code className="bg-muted px-1 rounded">"maximum life"</code> - exact phrase "maximum life"
              </li>
              <li>
                <code className="bg-muted px-1 rounded">"life on striking"</code> - exact phrase
              </li>
              <li>
                <code className="bg-muted px-1 rounded">"aura when" paladin</code> - combines phrase + word
              </li>
            </ul>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
