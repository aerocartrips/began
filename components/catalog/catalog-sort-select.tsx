"use client";

import { useEffect, useRef, useState } from "react";
import Select, { type SelectOption } from "@/components/ui/form/select";

/**
 * Sort control of the catalog filter form (AutoSubmitForm). The dropdown sets
 * its value without a DOM change event, so it submits the form itself once
 * the new value is committed to the form's hidden select.
 */
export default function CatalogSortSelect({ options, defaultValue }: { options: SelectOption[]; defaultValue: string }) {
  const [value, setValue] = useState(defaultValue);
  const rootRef = useRef<HTMLDivElement>(null);
  const changedRef = useRef(false);

  useEffect(() => {
    if (!changedRef.current) return;
    changedRef.current = false;
    rootRef.current?.closest("form")?.requestSubmit();
  }, [value]);

  return (
    <Select
      ref={rootRef}
      className="catalog-sort"
      label="Sort by"
      name="sort"
      options={options}
      value={value}
      onChange={(next) => {
        changedRef.current = true;
        setValue(next);
      }}
    />
  );
}
