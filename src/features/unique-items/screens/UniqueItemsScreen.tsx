import { useState } from 'react';
import { UniqueItemFilters } from '../components/UniqueItemFilters';
import { UniqueItemCard } from '../components/UniqueItemCard';
import { UniqueItemDetailModal } from '../modals';
import { useFilteredUniqueItems } from '../hooks/useFilteredUniqueItems';
import { Spinner } from '@/components/ui/spinner';
import type { DisplayUniqueItem } from '../types';

export function UniqueItemsScreen() {
  const items = useFilteredUniqueItems();
  const [selectedItem, setSelectedItem] = useState<DisplayUniqueItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleItemClick = (item: DisplayUniqueItem) => {
    setSelectedItem(item);
    setIsModalOpen(true);
  };

  // Loading state
  if (items === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="size-8" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Unique Items</h1>
      <UniqueItemFilters />

      {items.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center">
          No unique items found. Try adjusting your filters or load TXT data first from Settings.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <UniqueItemCard key={item.id} item={item} onItemClick={handleItemClick} />
          ))}
        </div>
      )}

      <UniqueItemDetailModal item={selectedItem} open={isModalOpen} onOpenChange={setIsModalOpen} />
    </div>
  );
}
