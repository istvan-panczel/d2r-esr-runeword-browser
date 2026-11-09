import { MoveHorizontal } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PAGE_WIDTH_OPTIONS, isPageWidthMode, selectPageWidth, setPageWidth } from '@/features/settings';

/** Header quick control for the Page width setting (the same setting as in the Settings drawer); md and up only. */
export function PageWidthMenu() {
  const dispatch = useDispatch();
  const pageWidth = useSelector(selectPageWidth);
  const current = PAGE_WIDTH_OPTIONS.find((option) => option.value === pageWidth);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="hidden @desktop-nav/header:inline-flex"
          aria-label={`Page width: ${current?.label ?? pageWidth}`}
          title="Page width"
        >
          <MoveHorizontal className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Page width</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={pageWidth}
          onValueChange={(value) => {
            if (isPageWidthMode(value)) dispatch(setPageWidth(value));
          }}
        >
          {PAGE_WIDTH_OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value} className="justify-between gap-4">
              {option.label}
              <span className="text-xs text-muted-foreground">{option.description}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
