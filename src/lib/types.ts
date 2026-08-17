export type ContactStatus = 'lead' | 'prospect' | 'customer' | 'churned'
export type DealStage = 'new' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost'
export type ActivityType = 'note' | 'call' | 'email' | 'meeting'
export type Priority = 'low' | 'medium' | 'high'

export interface Company {
  id: string
  owner_id: string
  name: string
  domain: string | null
  industry: string | null
  phone: string | null
  address: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Contact {
  id: string
  owner_id: string
  company_id: string | null
  first_name: string
  last_name: string | null
  email: string | null
  phone: string | null
  job_title: string | null
  status: ContactStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Deal {
  id: string
  owner_id: string
  company_id: string | null
  contact_id: string | null
  title: string
  value: number
  currency: string
  stage: DealStage
  probability: number
  expected_close_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Activity {
  id: string
  owner_id: string
  contact_id: string | null
  company_id: string | null
  deal_id: string | null
  type: ActivityType
  body: string
  occurred_at: string
  created_at: string
}

export interface Task {
  id: string
  owner_id: string
  contact_id: string | null
  company_id: string | null
  deal_id: string | null
  title: string
  description: string | null
  due_date: string | null
  priority: Priority
  completed: boolean
  completed_at: string | null
  created_at: string
  updated_at: string
}

export type ExpenseCategory =
  | 'travel'
  | 'meals'
  | 'software'
  | 'hardware'
  | 'office'
  | 'marketing'
  | 'training'
  | 'utilities'
  | 'professional'
  | 'other'
export type PaymentMethod = 'card' | 'cash' | 'transfer' | 'direct_debit' | 'other'
export type ExpenseStatus = 'pending' | 'approved' | 'reimbursed' | 'rejected'
export type VaultCategory = 'portal' | 'email' | 'banking' | 'social' | 'software' | 'server' | 'other'

export interface Expense {
  id: string
  owner_id: string
  company_id: string | null
  deal_id: string | null
  description: string
  amount: number
  currency: string
  category: ExpenseCategory
  spent_on: string
  vendor: string | null
  payment_method: PaymentMethod
  status: ExpenseStatus
  invoice_number: string | null
  /** Path inside the private `invoices` bucket, not a public URL. */
  invoice_path: string | null
  /** Original filename, for display and download. */
  invoice_name: string | null
  /** profiles.id of whoever actually paid. */
  paid_by: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  full_name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface VaultEntry {
  id: string
  owner_id: string
  company_id: string | null
  title: string
  username: string | null
  secret: string
  /** Reserved for a future client-side encrypted vault; false for plaintext rows. */
  secret_encrypted: boolean
  url: string | null
  category: VaultCategory
  notes: string | null
  created_at: string
  updated_at: string
}

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'travel',
  'meals',
  'software',
  'hardware',
  'office',
  'marketing',
  'training',
  'utilities',
  'professional',
  'other',
]

export const PAYMENT_METHODS: PaymentMethod[] = [
  'card',
  'cash',
  'transfer',
  'direct_debit',
  'other',
]

export const EXPENSE_STATUSES: ExpenseStatus[] = ['pending', 'approved', 'reimbursed', 'rejected']

export const VAULT_CATEGORIES: VaultCategory[] = [
  'portal',
  'email',
  'banking',
  'social',
  'software',
  'server',
  'other',
]

export const CONTACT_STATUSES: ContactStatus[] = ['lead', 'prospect', 'customer', 'churned']
export const PRIORITIES: Priority[] = ['low', 'medium', 'high']
export const ACTIVITY_TYPES: ActivityType[] = ['note', 'call', 'email', 'meeting']

export const DEAL_STAGES: { id: DealStage; label: string }[] = [
  { id: 'new', label: 'New' },
  { id: 'qualified', label: 'Qualified' },
  { id: 'proposal', label: 'Proposal' },
  { id: 'negotiation', label: 'Negotiation' },
  { id: 'won', label: 'Won' },
  { id: 'lost', label: 'Lost' },
]

/** Stages that still count towards the open pipeline. */
export const OPEN_STAGES: DealStage[] = ['new', 'qualified', 'proposal', 'negotiation']
