import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function BuildCardSkeleton() {
  return (
    <Card className="flex flex-col gap-3 p-4">
      <Skeleton className="h-5 w-2/3" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-28" />
      </div>
      <Skeleton className="h-4 w-24" />
    </Card>
  );
}
