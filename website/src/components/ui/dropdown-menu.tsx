// Dropdown menu built on @base-ui/react/menu.
// Copied from Sigillo — same styles, same API.

"use client";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import type React from "react";
import { cn } from "../../lib/utils.ts";

export const DropdownMenu: typeof MenuPrimitive.Root = MenuPrimitive.Root;

export function DropdownMenuTrigger({
  className,
  ...props
}: MenuPrimitive.Trigger.Props): React.ReactElement {
  return (
    <MenuPrimitive.Trigger
      data-slot="dropdown-menu-trigger"
      className={cn("cursor-pointer outline-none", className)}
      suppressHydrationWarning
      {...props}
    />
  );
}

export function DropdownMenuPopup({
  className,
  children,
  side = "bottom",
  sideOffset = 4,
  align = "start",
  alignOffset = 0,
  anchor,
  ...props
}: MenuPrimitive.Popup.Props & {
  side?: MenuPrimitive.Positioner.Props["side"];
  sideOffset?: MenuPrimitive.Positioner.Props["sideOffset"];
  align?: MenuPrimitive.Positioner.Props["align"];
  alignOffset?: MenuPrimitive.Positioner.Props["alignOffset"];
  anchor?: MenuPrimitive.Positioner.Props["anchor"];
}): React.ReactElement {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        anchor={anchor}
        className="z-50"
        data-slot="dropdown-menu-positioner"
        side={side}
        sideOffset={sideOffset}
      >
        <MenuPrimitive.Popup
          className={cn(
            "min-w-(--anchor-width) origin-(--transform-origin) rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg/5 outline-none transition-[transform,scale,opacity] data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 not-dark:bg-clip-padding before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] dark:before:shadow-[0_-1px_--theme(--color-white/6%)]",
            className,
          )}
          data-slot="dropdown-menu-popup"
          {...props}
        >
          {children}
        </MenuPrimitive.Popup>
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  );
}

export function DropdownMenuItem({
  className,
  ...props
}: MenuPrimitive.Item.Props): React.ReactElement {
  return (
    <MenuPrimitive.Item
      className={cn(
        "flex w-full cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className,
      )}
      data-slot="dropdown-menu-item"
      {...props}
    />
  );
}

export function DropdownMenuSeparator({
  className,
}: {
  className?: string;
}): React.ReactElement {
  return (
    <div
      role="separator"
      className={cn("my-1 h-px bg-border", className)}
      data-slot="dropdown-menu-separator"
    />
  );
}

export function DropdownMenuLabel({
  className,
  ...props
}: React.ComponentProps<"div">): React.ReactElement {
  return (
    <div
      className={cn(
        "px-2 py-1.5 text-xs font-medium text-muted-foreground",
        className,
      )}
      data-slot="dropdown-menu-label"
      {...props}
    />
  );
}

export { MenuPrimitive as DropdownMenuPrimitive };
