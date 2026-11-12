export type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'time' | 'select' | 'multiselect' | 'checkbox' | 'section' | 'repeatable'

export interface ColumnDef {
  id: string
  label: string
  type: FieldType
  options?: string[]
  placeholder?: string
  width?: number
}

export interface FieldDef {
  id: string
  label: string
  type: FieldType
  required?: boolean
  span?: number
  placeholder?: string
  help?: string
  options?: string[]
  columns?: ColumnDef[]
  add_label?: string
  read_only?: boolean
}

export interface TabDef {
  id: string
  label: string
  description?: string
  icon?: string
  custom?: boolean
  fields: FieldDef[]
}

export interface ClientRecord {
  id: string
  name: string
  phone: string
  email: string
  city: string
  consent: boolean
  start_date: string
  end_date: string
  created_at: string
  updated_at: string
}

export interface ClientBundle {
  client: ClientRecord
  tabs: TabDef[]
  data: Record<string, Record<string, unknown>>
  options: Record<string, string[]>
}

export interface CustomTabField {
  label: string
  type: FieldType
  options: string[]
  span?: number
  placeholder?: string
  help?: string
}

export interface HeadToeSnapshot {
  id: string
  created_at: string
  data: Record<string, unknown>
}
