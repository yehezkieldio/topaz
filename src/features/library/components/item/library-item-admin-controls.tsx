"use client";

import { EditIcon, MoreHorizontalIcon, TrashIcon } from "lucide-react";
import { memo } from "react";
import { Button } from "#/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";

type AdminControlsProps = {
    onEdit: () => void;
    onDelete: () => void;
};

function _AdminControls({ onEdit, onDelete }: AdminControlsProps) {
    return (
        <>
            <Button className="h-8 w-8 p-0" onClick={onEdit} size="sm" variant="ghost">
                <EditIcon className="size-3" />
            </Button>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button className="h-8 w-8 p-0" size="sm" variant="ghost">
                        <MoreHorizontalIcon className="size-3" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={onEdit}>
                        <EditIcon className="mr-2 size-3" />
                        Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
                        <TrashIcon className="mr-2 size-3" />
                        Delete
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </>
    );
}

export const LibraryItemAdminControls = memo(_AdminControls);
LibraryItemAdminControls.displayName = "LibraryItemAdminControls";
