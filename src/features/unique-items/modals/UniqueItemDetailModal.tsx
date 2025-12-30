import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { DisplayUniqueItem } from '../types';

interface UniqueItemDetailModalProps {
  readonly item: DisplayUniqueItem | null;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

/**
 * Modal showing all raw data for a unique item
 * Useful for debugging and transparency
 */
export function UniqueItemDetailModal({ item, open, onOpenChange }: UniqueItemDetailModalProps) {
  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl text-amber-700 dark:text-amber-400">{item.index}</DialogTitle>
          <DialogDescription>Base Item: {item.itemName}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Basic Info */}
          <Section title="Basic Info">
            <div className="grid grid-cols-2 gap-2 text-sm font-mono">
              <DataRow label="ID" value={item.id} />
              <DataRow label="Version" value={item.version} />
              <DataRow label="Level" value={item.level} />
              <DataRow label="Level Req" value={item.levelReq} />
              <DataRow label="Item Code" value={item.itemCode} />
              <DataRow label="Enabled" value={item.enabled ? 'true' : 'false'} />
              <DataRow label="Ancient Coupon" value={item.isAncientCoupon ? 'true' : 'false'} />
            </div>
          </Section>

          {/* Categorization */}
          <Section title="Categorization">
            <div className="grid grid-cols-2 gap-2 text-sm font-mono">
              <DataRow label="Group" value={item.group} />
              <DataRow label="Type Code" value={item.typeCode} />
              <DataRow label="Type Label" value={item.typeLabel} />
            </div>
          </Section>

          {/* Raw Properties */}
          <Section title="Properties (Raw)">
            {item.properties.length > 0 ? (
              <div className="space-y-1 text-sm font-mono">
                {item.properties.map((prop, idx) => (
                  <div key={`${String(idx)}-${prop.code}`} className="flex gap-2">
                    <span className="text-muted-foreground w-4">{idx + 1}.</span>
                    <span className="text-blue-600 dark:text-blue-400">{prop.code}</span>
                    {prop.param && <span className="text-purple-600 dark:text-purple-400">({prop.param})</span>}
                    <span className="text-muted-foreground">
                      min: {prop.min}, max: {prop.max}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No properties</p>
            )}
          </Section>

          {/* Resolved Properties */}
          <Section title="Properties (Resolved)">
            {item.translatedProperties.length > 0 ? (
              <ul className="space-y-0.5 text-sm text-[#8080E6]">
                {item.translatedProperties.map((prop, idx) => (
                  <li key={`${String(idx)}-${prop.rawCode}`}>{prop.text}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No resolved properties (refresh data from Settings)</p>
            )}
          </Section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { readonly title: string; readonly children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-muted-foreground mb-2 border-b pb-1">{title}</h3>
      {children}
    </div>
  );
}

function DataRow({ label, value }: { readonly label: string; readonly value: string | number | boolean }) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground">{label}:</span>
      <span>{String(value)}</span>
    </div>
  );
}
