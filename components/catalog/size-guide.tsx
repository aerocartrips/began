"use client";

import { useId, useState } from "react";
import { Ruler } from "lucide-react";
import AccountDialog from "@/features/account/components/account-dialog";
import { TextField } from "@/components/ui/form/text-field";
import { convertCell, primaryColumnIndex, recommendSize } from "@/lib/catalog/size-chart";
import type { SizeChartData } from "@/features/catalog/types";

type SizeGuideProps = {
  chart: SizeChartData;
  /** The option's name ("Size", "Waist size"). */
  optionName: string;
  /** Sizes this product comes in; others in the chart are shown dimmed. */
  sizes: string[];
  selected?: string;
  /** Chooses a size on the product page (from the fit finder or a row). */
  onSelect?: (size: string) => void;
};

const FIT_NOTES = {
  within: "",
  between: "You're between sizes, so we suggest the larger one.",
  below: "Your measurement is below our smallest size.",
  above: "Your measurement is above our largest size: it may fit snugly.",
} as const;

/**
 * "Size guide" link and its dialog: the chart (in inches or centimetres), how
 * to measure, and a fit finder that turns one measurement into a size.
 */
export default function SizeGuide({ chart, optionName, sizes, selected, onSelect }: SizeGuideProps) {
  const [open, setOpen] = useState(false);
  const [unit, setUnit] = useState<"in" | "cm">(chart.unit);
  const [measurement, setMeasurement] = useState("");
  const unitGroupId = useId();
  const primary = primaryColumnIndex(chart);
  const primaryColumn = primary === -1 ? null : chart.columns[primary];
  const recommendation = primaryColumn ? recommendSize(chart, Number(measurement), unit) : null;
  const offered = new Set(sizes);
  const cell = (value: string, column: number) => (chart.columns[column]?.measurement === false ? value : convertCell(value, chart.unit, unit));

  return (
    <>
      <button type="button" className="size-guide-link" onClick={() => setOpen(true)}>
        <Ruler size={15} strokeWidth={1.8} aria-hidden="true" /> {optionName} guide
      </button>
      <AccountDialog open={open} title={`${optionName} guide`} description={chart.note || undefined} onClose={() => setOpen(false)}>
        <div className="size-guide">
          <div className="size-guide__units" role="radiogroup" aria-labelledby={unitGroupId}>
            <span id={unitGroupId} className="sr-only">Units</span>
            {(["in", "cm"] as const).map((option) => (
              <button key={option} type="button" role="radio" aria-checked={unit === option} className="option-chip" onClick={() => setUnit(option)}>
                {option === "in" ? "Inches" : "Centimetres"}
              </button>
            ))}
          </div>

          <div className="size-guide__table-wrap">
            <table className="size-guide__table">
              <caption className="sr-only">{optionName} measurements in {unit === "in" ? "inches" : "centimetres"}</caption>
              <thead>
                <tr>
                  <th scope="col">{optionName}</th>
                  {chart.columns.map((column) => (
                    <th key={column.label} scope="col">
                      {column.label}
                      {column.measurement === false ? "" : ` (${unit})`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chart.rows.map((row) => (
                  <tr
                    key={row.size}
                    className={[
                      row.size === selected ? "is-selected" : "",
                      row.size === recommendation?.size ? "is-recommended" : "",
                      offered.size && !offered.has(row.size) ? "is-unoffered" : "",
                    ]
                      .filter(Boolean)
                      .join(" ") || undefined}
                  >
                    <th scope="row">{row.size}</th>
                    {chart.columns.map((column, index) => (
                      <td key={column.label}>{cell(row.values[index] ?? "", index) || "–"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {primaryColumn ? (
            <section className="size-guide__finder" aria-labelledby={`${unitGroupId}-finder`}>
              <h3 id={`${unitGroupId}-finder`}>Find your size</h3>
              <div className="size-guide__finder-row">
                <TextField
                  label={`Your ${primaryColumn.label.toLowerCase()} (${unit})`}
                  name="measurement"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.1"
                  value={measurement}
                  onChange={(event) => setMeasurement(event.currentTarget.value)}
                  required={false}
                />
              </div>
              {recommendation ? (
                <p className="size-guide__result" role="status">
                  <span>
                    Based on this chart: <strong>{recommendation.size}</strong>. {FIT_NOTES[recommendation.fit]}
                  </span>
                  {onSelect && offered.has(recommendation.size) && recommendation.size !== selected ? (
                    <button
                      type="button"
                      className="button button-primary button-sm"
                      onClick={() => {
                        onSelect(recommendation.size);
                        setOpen(false);
                      }}
                    >
                      Choose {recommendation.size}
                    </button>
                  ) : null}
                </p>
              ) : null}
            </section>
          ) : null}

          {chart.howToMeasure.length ? (
            <section className="size-guide__measure">
              <h3>How to measure</h3>
              <dl>
                {chart.howToMeasure.map((tip) => (
                  <div key={tip.label}>
                    <dt>{tip.label}</dt>
                    <dd>{tip.text}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}
        </div>
      </AccountDialog>
    </>
  );
}
