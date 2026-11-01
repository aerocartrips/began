"use client";

import { useState, type FormEvent } from "react";
import { MapPin, Plus } from "lucide-react";
import { useFeedback } from "@/components/feedback/feedback-provider";
import Button from "@/components/ui/button";
import EmptyState from "@/components/ui/empty-state";
import LoadingButton from "@/components/ui/buttons/loading-button";
import AccountDialog from "@/features/account/components/account-dialog";
import AddressCard from "@/features/account/components/address-card";
import AddressFormFields, { readAddressForm } from "@/features/account/components/address-form-fields";
import { accountApi, toFieldErrors } from "@/features/account/account-api";
import type { AddressBook as AddressBookData, FieldErrors, SavedAddress } from "@/features/account/types";

type Editing = { mode: "create" } | { mode: "edit"; address: SavedAddress } | null;

export default function AddressBook({ initialBook }: { initialBook: AddressBookData }) {
  const feedback = useFeedback();
  const [book, setBook] = useState(initialBook);
  const [editing, setEditing] = useState<Editing>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<SavedAddress | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const atLimit = book.items.length >= book.limit;

  function openEditor(next: Editing) {
    setErrors({});
    setEditing(next);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || saving) return;
    const formData = new FormData(event.currentTarget);
    const payload = {
      ...readAddressForm(formData),
      makeDefaultShipping: formData.get("makeDefaultShipping") === "on",
      makeDefaultBilling: formData.get("makeDefaultBilling") === "on",
    };

    setSaving(true);
    setErrors({});
    try {
      const result =
        editing.mode === "edit"
          ? await accountApi.updateAddress(editing.address.id, payload)
          : await accountApi.createAddress(payload);
      if (result.data) setBook(result.data.book);
      feedback.success(editing.mode === "edit" ? "Address updated" : "Address saved");
      setEditing(null);
    } catch (error) {
      const fieldErrors = toFieldErrors(error);
      setErrors(fieldErrors);
      if (Object.keys(fieldErrors).length === 0) {
        feedback.error("Address not saved", error instanceof Error ? error.message : undefined);
      }
    } finally {
      setSaving(false);
    }
  }

  async function runCardAction(id: string, action: () => Promise<{ data: AddressBookData | null }>, success: string) {
    setBusyId(id);
    try {
      const result = await action();
      if (result.data) setBook(result.data);
      feedback.success(success);
      return true;
    } catch (error) {
      feedback.error("Something went wrong", error instanceof Error ? error.message : undefined);
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const deleted = await runCardAction(pendingDelete.id, () => accountApi.deleteAddress(pendingDelete.id), "Address removed");
    if (deleted) setPendingDelete(null);
  }

  const editingAddress = editing?.mode === "edit" ? editing.address : null;

  return (
    <>
      <div className="account-toolbar">
        <p className="account-muted">
          {book.items.length} of {book.limit} addresses saved. Defaults are preselected at checkout.
        </p>
        <Button size="sm" icon={<Plus size={14} aria-hidden="true" />} onClick={() => openEditor({ mode: "create" })} disabled={atLimit}>
          Add address
        </Button>
      </div>

      {book.items.length === 0 ? (
        <EmptyState
          className="account-empty"
          icon={<MapPin size={20} />}
          title="No saved addresses yet"
          description="Save your warehouse, office or store addresses to check out faster."
          action={<Button size="sm" onClick={() => openEditor({ mode: "create" })}>Add your first address</Button>}
        />
      ) : (
        <div className="address-grid">
          {book.items.map((address) => {
            const busy = busyId === address.id;
            return (
              <AddressCard
                key={address.id}
                address={address}
                actions={
                  <>
                    <button type="button" className="account-link-button" onClick={() => openEditor({ mode: "edit", address })} disabled={busy}>
                      Edit
                    </button>
                    {!address.isDefaultShipping ? (
                      <button
                        type="button"
                        className="account-link-button"
                        disabled={busy}
                        onClick={() => void runCardAction(address.id, () => accountApi.setDefaultAddress(address.id, "shipping"), "Default shipping address updated")}
                      >
                        Set default shipping
                      </button>
                    ) : null}
                    {!address.isDefaultBilling ? (
                      <button
                        type="button"
                        className="account-link-button"
                        disabled={busy}
                        onClick={() => void runCardAction(address.id, () => accountApi.setDefaultAddress(address.id, "billing"), "Default billing address updated")}
                      >
                        Set default billing
                      </button>
                    ) : null}
                    <button type="button" className="account-link-button is-danger" onClick={() => setPendingDelete(address)} disabled={busy}>
                      Delete
                    </button>
                  </>
                }
              />
            );
          })}
        </div>
      )}

      <AccountDialog
        open={editing !== null}
        title={editingAddress ? "Edit address" : "Add a new address"}
        description="Orders keep a copy of the address used at checkout, so editing this never changes past orders."
        onClose={() => setEditing(null)}
        busy={saving}
      >
        {editing ? (
          <form className="account-dialog-form" onSubmit={handleSubmit} key={editingAddress?.id ?? "new"}>
            <AddressFormFields defaults={editingAddress ?? undefined} errors={errors} />
            <div className="account-checkbox-group">
              {!editingAddress?.isDefaultShipping ? (
                <label className="account-checkbox">
                  <input type="checkbox" name="makeDefaultShipping" defaultChecked={book.items.length === 0} />
                  Use as my default shipping address
                </label>
              ) : null}
              {!editingAddress?.isDefaultBilling ? (
                <label className="account-checkbox">
                  <input type="checkbox" name="makeDefaultBilling" defaultChecked={book.items.length === 0} />
                  Use as my default billing address
                </label>
              ) : null}
            </div>
            <div className="account-dialog-foot">
              <Button variant="secondary" size="sm" onClick={() => setEditing(null)} disabled={saving}>
                Cancel
              </Button>
              <LoadingButton type="submit" size="sm" loading={saving} loadingText="Saving...">
                {editingAddress ? "Save changes" : "Save address"}
              </LoadingButton>
            </div>
          </form>
        ) : null}
      </AccountDialog>

      <AccountDialog
        open={pendingDelete !== null}
        title="Delete this address?"
        size="sm"
        tone="danger"
        description={
          pendingDelete?.isDefaultShipping || pendingDelete?.isDefaultBilling
            ? "This is a default address. Another saved address will become the default automatically."
            : "This removes the address from your address book. Past orders are not affected."
        }
        onClose={() => setPendingDelete(null)}
        busy={busyId !== null}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setPendingDelete(null)} disabled={busyId !== null}>
              Keep address
            </Button>
            <LoadingButton variant="destructive" size="sm" loading={busyId !== null} loadingText="Deleting..." onClick={() => void confirmDelete()}>
              Delete address
            </LoadingButton>
          </>
        }
      />
    </>
  );
}
