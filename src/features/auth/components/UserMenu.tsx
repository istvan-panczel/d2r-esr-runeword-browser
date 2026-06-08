import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { selectAuthUserId, selectAvatarUrl, selectDisplayName, selectProfileTag, signOutRequested } from '../store';
import { avatarInitials } from '../utils/profile';

export function UserMenu() {
  const dispatch = useDispatch();
  const tag = useSelector(selectProfileTag);
  const avatarUrl = useSelector(selectAvatarUrl);
  const displayName = useSelector(selectDisplayName);
  const userId = useSelector(selectAuthUserId);

  if (tag === null || userId === null) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-9 gap-2 px-2">
          <Avatar className="size-6">
            {avatarUrl !== null && <AvatarImage src={avatarUrl} alt="" />}
            <AvatarFallback className="text-xs">{avatarInitials(displayName ?? '')}</AvatarFallback>
          </Avatar>
          <span className="hidden max-w-[14ch] truncate text-sm font-medium sm:inline">{tag}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem asChild>
          <Link to="/builds">My Builds</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to={`/user/${userId}`}>Profile</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            dispatch(signOutRequested());
          }}
        >
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
