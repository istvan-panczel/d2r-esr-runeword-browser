import { Badge } from '@/components/ui/badge';

/** Tags an Advanced-view field that the Basic view shows because it holds a value. */
export function AdvancedBadge() {
  return (
    <Badge
      variant="outline"
      className="px-1.5 py-0 text-[0.7rem] font-normal text-muted-foreground"
      title="An Advanced view field, shown in Basic because this rule sets it"
    >
      advanced
    </Badge>
  );
}
