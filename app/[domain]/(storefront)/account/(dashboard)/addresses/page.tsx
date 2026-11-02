import { Suspense } from "react";
import AccountHeading from "@/features/account/components/account-heading";
import AddressBook from "@/features/account/components/address-book";
import { AccountSectionSkeleton } from "@/features/account/components/account-skeletons";
import { requireAccountUser } from "@/lib/auth/current-customer";
import { toAddressBook } from "@/lib/services/address.service";
import type { AddressBook as AddressBookData } from "@/features/account/types";

export const metadata = {
  title: "My Addresses",
  description: "Manage your saved shipping and billing addresses.",
};

async function AddressBookContent() {
  const user = await requireAccountUser("/account/addresses");
  return <AddressBook initialBook={toAddressBook(user) as AddressBookData} />;
}

export default function AccountAddressesPage() {
  return (
    <>
      <AccountHeading title="My addresses" lead="Save delivery and billing addresses, and choose which ones checkout uses by default." />
      <Suspense fallback={<AccountSectionSkeleton panels={1} />}>
        <AddressBookContent />
      </Suspense>
    </>
  );
}
