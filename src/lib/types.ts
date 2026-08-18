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
  | 'cloud'
  | 'hardware'
  | 'licenses'
  | 'office'
  | 'marketing'
  | 'training'
  | 'utilities'
  | 'professional'
  | 'other'
/**
 * Direct costs belong to a project or client and can be billed on; structural
 * costs are general overhead the company carries regardless of project work.
 */
export type CostType = 'direct' | 'structural'
/**
 * `card` and `cash` are the pre-split legacy values, kept so historical rows
 * still render. New expenses use the explicit company/personal variants.
 */
export type PaymentMethod =
  | 'company_card'
  | 'personal_card'
  | 'personal_cash'
  | 'transfer'
  | 'direct_debit'
  | 'card'
  | 'cash'
  | 'other'
export type ExpenseStatus = 'pending' | 'approved' | 'reimbursed' | 'rejected'
export type VaultCategory = 'portal' | 'email' | 'banking' | 'social' | 'software' | 'server' | 'other'

export interface Expense {
  id: string
  owner_id: string
  company_id: string | null
  deal_id: string | null
  description: string
  /** Gross total actually paid: net_amount + tax_amount. */
  amount: number
  /** Taxable base, before VAT ("base imponible"). */
  net_amount: number
  /** VAT percentage applied to the base. */
  tax_rate: number
  /** VAT in currency. Stored, not derived, so the invoice figure is preserved. */
  tax_amount: number
  currency: string
  cost_type: CostType
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
  /** The money is owed back to `paid_by` — typically personal cash or card. */
  reimbursable: boolean
  /** Set when the reimbursement was actually settled. */
  reimbursed_on: string | null
  /** profiles.id of whoever confirmed the reimbursement. */
  reimbursed_by: string | null
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
  'hardware',
  'cloud',
  'licenses',
  'software',
  'travel',
  'meals',
  'office',
  'marketing',
  'training',
  'utilities',
  'professional',
  'other',
]

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  hardware: 'Hardware',
  cloud: 'Cloud',
  licenses: 'Licences',
  software: 'Software',
  travel: 'Travel & mileage',
  meals: 'Meals',
  office: 'Office',
  marketing: 'Marketing',
  training: 'Training',
  utilities: 'Utilities',
  professional: 'Professional services',
  other: 'Other',
}

export const COST_TYPES: { id: CostType; label: string; hint: string }[] = [
  { id: 'direct', label: 'Direct cost', hint: 'Tied to a project or client' },
  { id: 'structural', label: 'Structural cost', hint: 'General overhead' },
]

/** Only the current values are offered in the form; legacy ones still render. */
export const PAYMENT_METHODS: PaymentMethod[] = [
  'company_card',
  'personal_cash',
  'personal_card',
  'transfer',
  'direct_debit',
  'other',
]

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  company_card: 'Company card',
  personal_cash: 'Personal cash (reimbursable)',
  personal_card: 'Personal card (reimbursable)',
  transfer: 'Bank transfer',
  direct_debit: 'Direct debit',
  card: 'Card (legacy)',
  cash: 'Cash (legacy)',
  other: 'Other',
}

/** Paying out of pocket is what creates something to pay back. */
export const REIMBURSABLE_METHODS: PaymentMethod[] = ['personal_cash', 'personal_card', 'cash']

export const DEFAULT_TAX_RATE = 21

/** VAT rates in force in Spain, plus 0 for exempt or reverse-charge invoices. */
export const TAX_RATES = [0, 4, 10, 21]

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
