"use client";

import React from "react";
import { ArrowDownRight, ArrowUpRight, MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CategoryMenuItem = {
  id: string;
  name: string;
  icon?: string;
  color?: string;
};

type CategoryActionsMenuProps = {
  item: CategoryMenuItem;
  variant?: "parent" | "subcategory";
  onEdit: (item: CategoryMenuItem) => void;
  onDelete: (item: CategoryMenuItem) => void;
  onAddSubcategory?: (item: CategoryMenuItem) => void;
  onConvertToSubcategory?: (item: CategoryMenuItem) => void;
  onConvertToParent?: (item: CategoryMenuItem) => void;
  triggerClassName?: string;
  align?: "start" | "end";
};

const CategoryActionsMenu: React.FC<CategoryActionsMenuProps> = ({
  item,
  variant = "parent",
  onEdit,
  onDelete,
  onAddSubcategory,
  onConvertToSubcategory,
  onConvertToParent,
  triggerClassName,
  align = "end",
}) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground",
            triggerClassName,
          )}
          aria-label={`Actions for ${item.name}`}
          onClick={(event) => event.stopPropagation()}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-48">
        <DropdownMenuItem
          onClick={(event) => {
            event.stopPropagation();
            onEdit(item);
          }}
        >
          <Pencil className="h-4 w-4" />
          Edit
        </DropdownMenuItem>
        {variant === "parent" && onAddSubcategory ? (
          <DropdownMenuItem
            onClick={(event) => {
              event.stopPropagation();
              onAddSubcategory(item);
            }}
          >
            <Plus className="h-4 w-4" />
            Add subcategory
          </DropdownMenuItem>
        ) : null}
        {variant === "parent" && onConvertToSubcategory ? (
          <DropdownMenuItem
            onClick={(event) => {
              event.stopPropagation();
              onConvertToSubcategory(item);
            }}
          >
            <ArrowDownRight className="h-4 w-4" />
            Make subcategory
          </DropdownMenuItem>
        ) : null}
        {variant === "subcategory" && onConvertToParent ? (
          <DropdownMenuItem
            onClick={(event) => {
              event.stopPropagation();
              onConvertToParent(item);
            }}
          >
            <ArrowUpRight className="h-4 w-4" />
            Make top-level category
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={(event) => {
            event.stopPropagation();
            onDelete(item);
          }}
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default CategoryActionsMenu;
