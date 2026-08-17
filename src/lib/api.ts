import { supabase } from './supabase'
import type {
  Activity,
  Company,
  Contact,
  Deal,
  Expense,
  Profile,
  Task,
  VaultEntry,
} from './types'

/** Turns a PostgrestError into a thrown Error so callers can use try/catch. */
async function rows<T>(
  query: PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data ?? []
}

async function run(
  query: PromiseLike<{ error: { message: string } | null }>,
): Promise<void> {
  const { error } = await query
  if (error) throw new Error(error.message)
}

// -- companies ---------------------------------------------------------------

export const listCompanies = () =>
  rows<Company>(supabase.from('companies').select('*').order('name'))

export const createCompany = (values: Partial<Company>) =>
  run(supabase.from('companies').insert(values))

export const updateCompany = (id: string, values: Partial<Company>) =>
  run(supabase.from('companies').update(values).eq('id', id))

export const deleteCompany = (id: string) =>
  run(supabase.from('companies').delete().eq('id', id))

// -- contacts ----------------------------------------------------------------

export const listContacts = () =>
  rows<Contact>(supabase.from('contacts').select('*').order('created_at', { ascending: false }))

export const createContact = (values: Partial<Contact>) =>
  run(supabase.from('contacts').insert(values))

export const updateContact = (id: string, values: Partial<Contact>) =>
  run(supabase.from('contacts').update(values).eq('id', id))

export const deleteContact = (id: string) =>
  run(supabase.from('contacts').delete().eq('id', id))

// -- deals -------------------------------------------------------------------

export const listDeals = () =>
  rows<Deal>(supabase.from('deals').select('*').order('created_at', { ascending: false }))

export const createDeal = (values: Partial<Deal>) =>
  run(supabase.from('deals').insert(values))

export const updateDeal = (id: string, values: Partial<Deal>) =>
  run(supabase.from('deals').update(values).eq('id', id))

export const deleteDeal = (id: string) => run(supabase.from('deals').delete().eq('id', id))

// -- activities --------------------------------------------------------------

export const listActivities = (limit = 20) =>
  rows<Activity>(
    supabase.from('activities').select('*').order('occurred_at', { ascending: false }).limit(limit),
  )

export const createActivity = (values: Partial<Activity>) =>
  run(supabase.from('activities').insert(values))

export const deleteActivity = (id: string) =>
  run(supabase.from('activities').delete().eq('id', id))

// -- tasks -------------------------------------------------------------------

export const listTasks = () =>
  rows<Task>(
    supabase
      .from('tasks')
      .select('*')
      .order('completed')
      .order('due_date', { ascending: true, nullsFirst: false }),
  )

export const createTask = (values: Partial<Task>) => run(supabase.from('tasks').insert(values))

export const updateTask = (id: string, values: Partial<Task>) =>
  run(supabase.from('tasks').update(values).eq('id', id))

export const deleteTask = (id: string) => run(supabase.from('tasks').delete().eq('id', id))

// -- expenses ----------------------------------------------------------------

export const listExpenses = () =>
  rows<Expense>(supabase.from('expenses').select('*').order('spent_on', { ascending: false }))

export const createExpense = (values: Partial<Expense>) =>
  run(supabase.from('expenses').insert(values))

/** Insert returning the new row, so an invoice can be uploaded under its id. */
export async function createExpenseReturning(values: Partial<Expense>): Promise<Expense> {
  const { data, error } = await supabase.from('expenses').insert(values).select().single()
  if (error) throw new Error(error.message)
  return data as Expense
}

export const updateExpense = (id: string, values: Partial<Expense>) =>
  run(supabase.from('expenses').update(values).eq('id', id))

export const deleteExpense = (id: string) => run(supabase.from('expenses').delete().eq('id', id))

// -- profiles ----------------------------------------------------------------

/** Teammates who have signed in at least once; populated by a trigger on sign-up. */
export const listProfiles = () =>
  rows<Profile>(supabase.from('profiles').select('*').order('full_name'))

// -- invoice documents -------------------------------------------------------

const INVOICE_BUCKET = 'invoices'

/**
 * Uploads an invoice and returns its storage path. Files are namespaced by
 * expense id so one expense's documents never collide with another's.
 */
export async function uploadInvoice(expenseId: string, file: File): Promise<string> {
  // Keep the extension so signed URLs download with a sensible filename.
  const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin'
  const path = `${expenseId}/${Date.now()}.${ext}`

  const { error } = await supabase.storage.from(INVOICE_BUCKET).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  })
  if (error) throw new Error(error.message)
  return path
}

/**
 * Mints a short-lived signed URL. The bucket is private, so this is the only
 * way to view a document — a plain public URL would 400.
 */
export async function getInvoiceUrl(path: string, expiresInSeconds = 300): Promise<string> {
  const { data, error } = await supabase.storage
    .from(INVOICE_BUCKET)
    .createSignedUrl(path, expiresInSeconds)
  if (error) throw new Error(error.message)
  return data.signedUrl
}

export async function removeInvoice(path: string): Promise<void> {
  const { error } = await supabase.storage.from(INVOICE_BUCKET).remove([path])
  if (error) throw new Error(error.message)
}

// -- vault -------------------------------------------------------------------

export const listVaultEntries = () =>
  rows<VaultEntry>(supabase.from('vault_entries').select('*').order('title'))

export const createVaultEntry = (values: Partial<VaultEntry>) =>
  run(supabase.from('vault_entries').insert(values))

export const updateVaultEntry = (id: string, values: Partial<VaultEntry>) =>
  run(supabase.from('vault_entries').update(values).eq('id', id))

export const deleteVaultEntry = (id: string) =>
  run(supabase.from('vault_entries').delete().eq('id', id))

/** Empty strings from form inputs should land in the DB as NULL, not "". */
export function nullifyBlanks<T extends Record<string, unknown>>(values: T): T {
  const out = { ...values }
  for (const key of Object.keys(out) as (keyof T)[]) {
    if (out[key] === '') out[key] = null as T[keyof T]
  }
  return out
}
