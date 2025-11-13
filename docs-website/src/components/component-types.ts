export interface NotionPageLinkProps {
  href: string
  icon?: string
  inline?: boolean
  children?: any
}

export interface VideoProps {
  src: string
  width?: number
  height?: number
  aspectRatio?: number
  alignment?: string
  className?: string
  children?: any
}

export interface FileProps {
  url: string
  name: string
  width?: number
  height?: number
  aspectRatio?: number
  alignment?: string
  className?: string
  children?: any
}

export interface AudioProps {
  src: string
  width?: number
  height?: number
  aspectRatio?: number
  alignment?: string
  className?: string
  children?: any
}

export interface MathProps {
  math: string
  inline?: boolean
}

export interface ColumnsProps {
  children?: any
}

export interface ColumnProps {
  children?: any
}

export interface EmbedProps {
  src: string
  width?: number
  height?: number
  aspectRatio?: number
  alignment?: string
  className?: string
  children?: any
}

export type ComponentPropsMap = {
  PageLink: NotionPageLinkProps
  Video: VideoProps
  File: FileProps
  Audio: AudioProps
  Math: MathProps
  Columns: ColumnsProps
  Column: ColumnProps
  Embed: EmbedProps
}
