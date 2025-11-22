import { ComponentProps } from 'react';
import type { SidebarTab } from 'fumadocs-ui/utils/get-sidebar-tabs';

export interface Option extends SidebarTab {
  props?: ComponentProps<'a'>;
}
