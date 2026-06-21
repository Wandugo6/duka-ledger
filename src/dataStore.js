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

// ---- Deposits ----
// A deposit is NOT a sale yet — it's money held against an item that hasn't
// been fully paid for. It only becomes a sale (and counts toward daily
// totals) once it's settled via settleDeposit().

export async function fetchDeposits() {
  const { data, error } = await supabase
    .from("deposits")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(rowToDeposit);
}

export async function insertDeposit(entry) {
  const fullPrice = Number(entry.fullPrice);
  const amountPaid = Number(entry.amountPaid);
  const { data, error } = await supabase
    .from("deposits")
    .insert({
      shop: entry.shop,
      date: entry.date,
      item: entry.item,
      customer: entry.customer,
      full_price: fullPrice,
      amount_paid: amountPaid,
      balance: fullPrice - amountPaid,
      employee: entry.employee,
      status: "open",
    })
    .select()
    .single();
  if (error) throw error;
  return rowToDeposit(data);
}

// Settling a deposit does two things atomically-enough for this app's needs:
// 1. Creates a real sale for the FULL price, dated today (the day it's completed)
// 2. Marks the deposit as settled and links it to that sale
export async function settleDeposit(deposit, settledEmployee) {
  const today = new Date().toISOString().slice(0, 10);
  const sale = await insertSale({
    shop: deposit.shop,
    date: today,
    item: deposit.item,
    qty: 1,
    amount: deposit.fullPrice,
    employee: settledEmployee,
    note: `Deposit settled (customer: ${deposit.customer})`,
  });

  const { data, error } = await supabase
    .from("deposits")
    .update({
      status: "settled",
      settled_at: new Date().toISOString(),
      settled_employee: settledEmployee,
      sale_id: sale.id,
    })
    .eq("id", deposit.id)
    .select()
    .single();
  if (error) throw error;
  return { deposit: rowToDeposit(data), sale };
}

export async function deleteDeposit(id) {
  const { error } = await supabase.from("deposits").delete().eq("id", id);
  if (error) throw error;
}

function rowToDeposit(row) {
  return {
    id: row.id,
    shop: row.shop,
    date: row.date,
    item: row.item,
    customer: row.customer,
    fullPrice: row.full_price,
    amountPaid: row.amount_paid,
    balance: row.balance,
    employee: row.employee,
    status: row.status,
    settledAt: row.settled_at,
    settledEmployee: row.settled_employee,
    saleId: row.sale_id,
    createdAt: row.created_at,
  };
}

// ---- Returns ----

export async function fetchReturns() {
  const { data, error } = await supabase
    .from("returns")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(rowToReturn);
}

export async function insertReturn(entry) {
  const { data, error } = await supabase
    .from("returns")
    .insert({
      shop: entry.shop,
      date: entry.date,
      item: entry.item,
      qty: entry.qty,
      return_type: entry.returnType,
      refund_amount: entry.returnType === "refunded" ? Number(entry.refundAmount) || 0 : 0,
      exchanged_for: entry.returnType === "exchanged" ? entry.exchangedFor || "" : "",
      employee: entry.employee,
      note: entry.note || "",
    })
    .select()
    .single();
  if (error) throw error;
  return rowToReturn(data);
}

export async function deleteReturn(id) {
  const { error } = await supabase.from("returns").delete().eq("id", id);
  if (error) throw error;
}

function rowToReturn(row) {
  return {
    id: row.id,
    shop: row.shop,
    date: row.date,
    item: row.item,
    qty: row.qty,
    returnType: row.return_type,
    refundAmount: row.refund_amount,
    exchangedFor: row.exchanged_for,
    employee: row.employee,
    note: row.note,
    createdAt: row.created_at,
  };
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
    .on("postgres_changes", { event: "*", schema: "public", table: "deposits" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "returns" }, onChange)
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
