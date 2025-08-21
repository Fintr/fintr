import React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Pencil, Trash2 } from "lucide-react";
import { NewAccountData } from "./add-account-form";
import { CategoryToggleType } from "./category-toggle";

interface CategoryItem {
  id: string;
  name: string;
  color?: string;
  amount?: number;
  budget?: number;
  [key: string]: any; // For any additional properties
}

interface CategoryListCardProps {
  title: string;
  description: string;
  items: CategoryItem[];
  onAddItem: () => void;
  onEditItem: (item: CategoryItem) => void;
  onDeleteItem: (item: CategoryItem) => void;
  colorField?: string;
  primaryField?: string;
  secondaryField?: string;
  addButtonText?: string;
  customEditComponent?: (item: CategoryItem) => React.ReactNode; // Optional custom edit component
  customDeleteComponent?: (item: CategoryItem) => React.ReactNode; // Optional custom delete component
  customAddComponent?: React.ReactNode; // Optional custom add component, now accepts React.ReactNode
}

const CategoryListCard: React.FC<CategoryListCardProps> = ({
  title,
  description,
  items = [],
  onAddItem,
  onEditItem,
  onDeleteItem,
  colorField = "color",
  primaryField = "name",
  secondaryField,
  addButtonText = "Add New",
  customEditComponent,
  customDeleteComponent,
  customAddComponent,
}) => {
  return (
    <Card>
      <CardHeader className="px-4">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {items.length === 0 ? (
            <div className="text-center py-4 text-gray-500 col-span-2">
              No items found
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 bg-background rounded-lg"
              >
                <div className="flex items-center">
                  <div>
                    <span className="font-medium text-primary">
                      {item[primaryField]}
                    </span>
                    {secondaryField && item[secondaryField] && (
                      <div className="text-sm text-gray-500">
                        {typeof item[secondaryField] === "number"
                          ? `₱${item[secondaryField].toLocaleString()}`
                          : item[secondaryField]}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex space-x-2">
                  {customEditComponent ? (
                    customEditComponent(item)
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-primary hover:bg-blue-50"
                      onClick={() => onEditItem(item)}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                        <path d="m15 5 4 4" />
                      </svg>
                    </Button>
                  )}
                  {customDeleteComponent ? (
                    customDeleteComponent(item)
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-delete hover:bg-red-50"
                      onClick={() => onDeleteItem(item)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        {customAddComponent ? (
          customAddComponent
        ) : (
          <Button
            className="bg-primary hover:bg-primary/80 mt-4 w-full rounded-md"
            onClick={onAddItem}
          >
            <Plus className="h-4 w-4 mr-2" /> {addButtonText}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default CategoryListCard;
