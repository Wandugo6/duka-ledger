import { supabase } from "./supabaseClient";

// ---- Sales ----

export async function fetchSales() {
  const { data, error } = await supabase
    .from("sales")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  // Map snake_case DB rows to the camelCase shape the UI expects.
  return data.map(rowToSale);
}

export async function insertSale(entry) {
  const { data, error } = await supabase
    .from("sales")
    .insert({
      shop: entry.shop,
      date: entry.date,
      item: entry.item,
      qty: entry.qty,
      amount: entry.amount,
      employee: entry.employee,
      note: entry.note || "",
    })
    .select()
    .single();
  if (error) throw error;
  return rowToSale(data);
}

export async function deleteSale(id) {
  const { error } = await supabase.from("sales").delete().eq("id", id);
  if (error) throw error;
}

function rowToSale(row) {
  return {
    id: row.id,
    shop: row.shop,
    date: row.date,
    item: row.item,
    qty: row.qty,
    amount: row.amount,
    employee: row.employee,
    note: row.note,
    createdAt: row.created_at,
  };
}

// ---- Transfers ----

export async function fetchTransfers() {
  const { data, error } = await supabase
    .from("transfers")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(rowToTransfer);
}

export async function insertTransfer(entry) {
  const { data, error } = await supabase
    .from("transfers")
    .insert({
      date: entry.date,
      from_shop: entry.fromShop,
      to_shop: entry.toShop,
      item: entry.item,
      qty: entry.qty,
      employee: entry.employee,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToTransfer(data);
}

export async function deleteTransfer(id) {
  const { error } = await supabase.from("transfers").delete().eq("id", id);
  if (error) throw error;
}

function rowToTransfer(row) {
  return {
    id: row.id,
    date: row.date,
    fromShop: row.from_shop,
    toShop: row.to_shop,
    item: row.item,
    qty: row.qty,
    employee: row.employee,
    createdAt: row.created_at,
  };
}

// ---- Settings (used for the owner PIN) ----

export async function getSetting(key) {
  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error) throw error;
  return data ? data.value : null;
}

export async function setSetting(key, value) {
  const { error } = await supabase
    .from("settings")
    .upsert({ key, value }, { onConflict: "key" });
  if (error) throw error;
}

// ---- Realtime subscriptions ----
// Keeps every open device in sync automatically: when one shop logs a sale,
// the owner view (and other shops, if they're looking at shared data) update
// without needing to refresh.

export function subscribeToChanges(onChange) {
  const channel = supabase
    .channel("duka-ledger-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "transfers" }, onChange)
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
