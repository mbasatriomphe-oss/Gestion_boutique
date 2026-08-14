"use client"

import type React from "react"

import { Coffee, IceCream, LayoutGrid, Utensils } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface CategorySidebarProps {
  selectedCategory: string
  onSelectCategory: (category: string) => void
  categories: Array<{ id: string; name: string }>
}

interface CategoryItem {
  id: string
  name: string
  icon: React.ElementType
}

const fallbackCategories: CategoryItem[] = [
  {
    id: "all",
    name: "Tous les produits",
    icon: LayoutGrid,
  },
  {
    id: "food",
    name: "Aliments",
    icon: Utensils,
  },
  {
    id: "drinks",
    name: "Boissons",
    icon: Coffee,
  },
  {
    id: "desserts",
    name: "Desserts",
    icon: IceCream,
  },
]

export default function CategorySidebar({ selectedCategory, onSelectCategory, categories }: CategorySidebarProps) {
  const items: CategoryItem[] = [
    ...fallbackCategories.slice(0, 1),
    ...categories
      .filter((category) => category.id !== "all")
      .map((category) => ({
      id: category.id,
      name: category.name,
      icon: LayoutGrid,
      })),
  ]

  return (
    <div className="border-b bg-background p-3 md:w-56 md:border-b-0 md:border-r md:p-4">
      <div className="mb-3 flex items-center justify-between md:mb-4">
        <h2 className="text-base font-semibold md:text-lg">Catégories</h2>
        <span className="text-xs text-muted-foreground md:hidden">Glissez pour voir plus</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 md:grid md:gap-3 md:overflow-visible md:pb-0">
        {items.map((category) => {
          const Icon = category.icon
          return (
            <Button
              key={category.id}
              variant="ghost"
              className={cn(
                "flex h-auto min-w-[9rem] flex-col items-center justify-center border bg-transparent py-3 md:min-w-0 md:py-4",
                selectedCategory === category.id
                  ? "border-2 border-primary text-foreground font-medium"
                  : "border-muted text-muted-foreground hover:border-muted-foreground hover:text-foreground",
                "hover:bg-transparent",
              )}
              onClick={() => onSelectCategory(category.id)}
            >
              <Icon className="mb-2 h-6 w-6" />
              <span className="text-sm leading-tight">{category.name}</span>
            </Button>
          )
        })}
      </div>
    </div>
  )
}
