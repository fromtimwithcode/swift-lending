"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { Loader2, Plus, Pencil, Save, X, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { formatCurrency } from "@/lib/format";
import { REHAB_CATEGORIES } from "@/convex/lib/constants";

type Category = (typeof REHAB_CATEGORIES)[number]["value"];

export function RehabBudgetEditor({ loanId }: { loanId: Id<"loans"> }) {
  const items = useQuery(api.admin.getRehabBudgetItems, { loanId });
  const addItem = useMutation(api.admin.addRehabBudgetItem);
  const updateItem = useMutation(api.admin.updateRehabBudgetItem);
  const deleteItem = useMutation(api.admin.deleteRehabBudgetItem);

  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    category: "interior" as Category,
    itemName: "",
    allocatedAmount: "",
    actualAmount: "",
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    category: "interior" as Category,
    itemName: "",
    allocatedAmount: "",
    actualAmount: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  if (items === undefined) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  const totalAllocated = items.reduce((s, i) => s + i.allocatedAmount, 0);
  const totalActual = items.reduce((s, i) => s + (i.actualAmount ?? 0), 0);
  const remaining = totalAllocated - totalActual;

  const handleAdd = async () => {
    if (!form.itemName.trim() || !form.allocatedAmount) return;
    setAdding(true);
    try {
      await addItem({
        loanId,
        category: form.category,
        itemName: form.itemName,
        allocatedAmount: Number(form.allocatedAmount),
        actualAmount: form.actualAmount
          ? Number(form.actualAmount)
          : undefined,
      });
      toast.success("Budget item added");
      setForm({
        category: "interior",
        itemName: "",
        allocatedAmount: "",
        actualAmount: "",
      });
      setShowAdd(false);
    } catch {
      toast.error("Failed to add budget item");
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (item: NonNullable<typeof items>[number]) => {
    setEditingId(item._id);
    setEditForm({
      category: item.category,
      itemName: item.itemName,
      allocatedAmount: String(item.allocatedAmount),
      actualAmount: item.actualAmount != null ? String(item.actualAmount) : "",
    });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    setSavingEdit(true);
    try {
      await updateItem({
        id: editingId as Id<"rehabBudgetItems">,
        category: editForm.category,
        itemName: editForm.itemName,
        allocatedAmount: Number(editForm.allocatedAmount),
        actualAmount: editForm.actualAmount
          ? Number(editForm.actualAmount)
          : undefined,
      });
      toast.success("Budget item updated");
      setEditingId(null);
    } catch {
      toast.error("Failed to update budget item");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await deleteItem({ id: id as Id<"rehabBudgetItems"> });
      toast.success("Budget item deleted");
    } catch {
      toast.error("Failed to delete budget item");
    } finally {
      setDeleting(null);
      setConfirmDelete(null);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30";
  const selectClass =
    "w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30";

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-muted-foreground">
          Rehab Budget
        </h3>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/80"
        >
          <Plus className="size-3" />
          Add Item
        </button>
      </div>

      {/* Summary Bar */}
      {items.length > 0 && (
        <div className="mb-4 grid grid-cols-3 gap-4 rounded-lg bg-muted/40 p-3">
          <div>
            <p className="text-xs text-muted-foreground">Total Allocated</p>
            <p className="text-sm font-bold">{formatCurrency(totalAllocated)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Actual</p>
            <p className="text-sm font-bold">{formatCurrency(totalActual)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Remaining</p>
            <p
              className={`text-sm font-bold ${
                remaining < 0
                  ? "text-red-600 dark:text-red-400"
                  : "text-green-600 dark:text-green-400"
              }`}
            >
              {formatCurrency(remaining)}
            </p>
          </div>
        </div>
      )}

      {/* Add Form */}
      {showAdd && (
        <div className="mb-4 rounded-lg border border-border bg-muted/30 p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                Category
              </label>
              <select
                className={selectClass}
                value={form.category}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    category: e.target.value as Category,
                  }))
                }
              >
                {REHAB_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                Item Name *
              </label>
              <input
                className={inputClass}
                placeholder="e.g. Kitchen cabinets"
                value={form.itemName}
                onChange={(e) =>
                  setForm((p) => ({ ...p, itemName: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                Allocated *
              </label>
              <input
                className={inputClass}
                type="number"
                placeholder="5000"
                value={form.allocatedAmount}
                onChange={(e) =>
                  setForm((p) => ({ ...p, allocatedAmount: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                Actual
              </label>
              <input
                className={inputClass}
                type="number"
                placeholder="Optional"
                value={form.actualAmount}
                onChange={(e) =>
                  setForm((p) => ({ ...p, actualAmount: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowAdd(false)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={adding}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/80 disabled:opacity-50"
            >
              {adding && <Loader2 className="size-3 animate-spin" />}
              Add
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {items.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground">
                  Category
                </th>
                <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground">
                  Item
                </th>
                <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground text-right">
                  Allocated
                </th>
                <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground text-right">
                  Actual
                </th>
                <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground text-right">
                  Variance
                </th>
                <th className="pb-2 text-xs font-medium text-muted-foreground w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item) => {
                const isEditing = editingId === item._id;
                const variance =
                  item.allocatedAmount - (item.actualAmount ?? 0);
                const categoryLabel =
                  REHAB_CATEGORIES.find((c) => c.value === item.category)?.label ??
                  item.category;

                return (
                  <tr key={item._id} className="group">
                    <td className="py-2 pr-4">
                      {isEditing ? (
                        <select
                          className={selectClass}
                          value={editForm.category}
                          onChange={(e) =>
                            setEditForm((p) => ({
                              ...p,
                              category: e.target.value as Category,
                            }))
                          }
                        >
                          {REHAB_CATEGORIES.map((c) => (
                            <option key={c.value} value={c.value}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                          {categoryLabel}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      {isEditing ? (
                        <input
                          className={inputClass}
                          value={editForm.itemName}
                          onChange={(e) =>
                            setEditForm((p) => ({
                              ...p,
                              itemName: e.target.value,
                            }))
                          }
                        />
                      ) : (
                        item.itemName
                      )}
                    </td>
                    <td className="py-2 pr-4 text-right">
                      {isEditing ? (
                        <input
                          className={inputClass + " text-right"}
                          type="number"
                          value={editForm.allocatedAmount}
                          onChange={(e) =>
                            setEditForm((p) => ({
                              ...p,
                              allocatedAmount: e.target.value,
                            }))
                          }
                        />
                      ) : (
                        formatCurrency(item.allocatedAmount)
                      )}
                    </td>
                    <td className="py-2 pr-4 text-right">
                      {isEditing ? (
                        <input
                          className={inputClass + " text-right"}
                          type="number"
                          value={editForm.actualAmount}
                          onChange={(e) =>
                            setEditForm((p) => ({
                              ...p,
                              actualAmount: e.target.value,
                            }))
                          }
                        />
                      ) : (
                        formatCurrency(item.actualAmount ?? 0)
                      )}
                    </td>
                    <td className="py-2 pr-4 text-right">
                      {!isEditing && (
                        <span
                          className={
                            variance < 0
                              ? "text-red-600 dark:text-red-400"
                              : "text-green-600 dark:text-green-400"
                          }
                        >
                          {formatCurrency(variance)}
                        </span>
                      )}
                    </td>
                    <td className="py-2">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={handleSaveEdit}
                            disabled={savingEdit}
                            className="rounded-lg p-1 text-primary hover:bg-muted"
                          >
                            {savingEdit ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Save className="size-4" />
                            )}
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
                          >
                            <X className="size-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => startEdit(item)}
                            className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            onClick={() => setConfirmDelete(item._id)}
                            disabled={deleting === item._id}
                            className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-red-600"
                          >
                            {deleting === item._id ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="size-3.5" />
                            )}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No budget items yet. Add items to track rehab costs.
        </p>
      )}
      <ConfirmDialog
        open={confirmDelete !== null}
        title="Delete budget item?"
        description="This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        loading={deleting !== null}
        onConfirm={async () => { if (confirmDelete) await handleDelete(confirmDelete); }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
