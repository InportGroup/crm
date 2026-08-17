import { supabase } from './supabase'
import type { Activity, Company, Contact, Deal, Expense, Task, VaultEntry } from './types'

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

export const updateExpense = (id: string, values: Partial<Expense>) =>
  run(supabase.from('expenses').update(values).eq('id', id))

export const deleteExpense = (id: string) => run(supabase.from('expenses').delete().eq('id', id))

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
