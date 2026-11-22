/**
 * Admin shapes for the catalogue setup: the attribute library (Admin →
 * Attributes) and product types (Admin → Product types), as the admin API
 * returns them and the type editor and product form use them.
 */

export type AttributeInput = "select" | "multiselect" | "color" | "text" | "number" | "boolean";

export type AdminAttributeValue = {
  _id?: string;
  label: string;
  slug?: string;
  hex?: string;
  isActive: boolean;
};

export type AdminAttribute = {
  _id: string;
  key: string;
  name: string;
  input: AttributeInput;
  unit: string;
  values: AdminAttributeValue[];
  filterable: boolean;
  visible: boolean;
  schemaProperty: string;
  helpText: string;
  sortOrder: number;
  /** The types using it, and how (a detail or an option). */
  usedBy?: { id: string; name: string; as: "detail" | "option" }[];
  /** Products with a value for it. */
  productCount?: number;
};

export type AdminSizeChart = {
  optionKey: string;
  unit: "in" | "cm";
  columns: { label: string; primary: boolean; measurement: boolean }[];
  rows: { size: string; values: string[] }[];
  note: string;
  howToMeasure: { label: string; text: string }[];
};

export type AdminProductType = {
  _id: string;
  id: string;
  name: string;
  pluralName: string;
  slug: string;
  description: string;
  icon: string;
  isActive: boolean;
  sortOrder: number;
  fields: { key: string; required: boolean }[];
  options: { key: string; values: string[] }[];
  sizeChart: AdminSizeChart | null;
  defaults: { hsnCode: string; gstRatePercent: number | null; minimumOrderQuantity: number; careInstructions: string };
  template: string;
  productCount: number;
  listedCount: number;
};

export type TypeTemplateSummary = {
  key: string;
  name: string;
  pluralName: string;
  icon: string;
  description: string;
  details: string[];
  options: string[];
  hasSizeChart: boolean;
};

export type ProductTypesPayload = {
  types: AdminProductType[];
  /** Products saved before product types existed (the catalogue upgrade converts them). */
  untypedCount: number;
  templates: TypeTemplateSummary[];
};

/** Inputs whose values come from the attribute's own list. */
export const LISTED_INPUTS: AttributeInput[] = ["select", "multiselect", "color"];
/** Inputs an option can use. */
export const OPTION_INPUTS: AttributeInput[] = ["select", "color"];

export const isListedInput = (input: AttributeInput) => LISTED_INPUTS.includes(input);

/** An empty size chart for `optionKey`, with sizes from the option's values. */
export function emptySizeChart(optionKey: string, sizes: string[]): AdminSizeChart {
  return {
    optionKey,
    unit: "in",
    columns: [{ label: "Chest", primary: true, measurement: true }, { label: "Length", primary: false, measurement: true }],
    rows: sizes.map((size) => ({ size, values: ["", ""] })),
    note: "",
    howToMeasure: [],
  };
}
