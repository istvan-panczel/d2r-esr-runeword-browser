import { HelpCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

/**
 * A help button that explains what the shareable URL includes
 */
export function CopyLinkHelpButton() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="size-5 text-muted-foreground" aria-label="Copy link help">
          <HelpCircle className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="start">
        <div className="space-y-3">
          <div>
            <h4 className="font-medium mb-1">Shareable Link</h4>
            <p className="text-sm text-muted-foreground">
              The generated URL encodes your current filter settings so others can see the same results.
            </p>
          </div>

          <div>
            <h4 className="font-medium mb-1">Included Filters</h4>
            <ul className="text-sm space-y-1 text-muted-foreground list-disc pl-4">
              <li>Search text</li>
              <li>Socket count</li>
              <li>Max required level</li>
              <li>Selected item types</li>
              <li>Selected runes</li>
              <li>Tier point limits</li>
            </ul>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
