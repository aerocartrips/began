"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import Select from "@/components/ui/form/select";
import type { AdminSizeChart } from "@/features/products/catalog-setup";

type SizeChartEditorProps = {
  chart: AdminSizeChart;
  onChange: (chart: AdminSizeChart) => void;
  /** Options the chart can describe (key, name and the sizes on offer). */
  options: { key: string; name: string; values: string[] }[];
};

const UNIT_OPTIONS = [
  { id: "in", label: "Inches" },
  { id: "cm", label: "Centimetres" },
];

const move = <T,>(list: T[], index: number, step: number) => {
  const next = [...list];
  const target = index + step;
  if (target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
};

/**
 * A size chart as a grid: measurements across (Chest, Length…; one marked for
 * the shoppers' fit finder), sizes down. "Fill sizes" adds a row for every
 * size the option offers, so charts never miss one.
 */
export default function SizeChartEditor({ chart, onChange, options }: SizeChartEditorProps) {
  const set = (changes: Partial<AdminSizeChart>) => onChange({ ...chart, ...changes });
  const sizes = options.find((option) => option.key === chart.optionKey)?.values ?? [];
  const missing = sizes.filter((size) => !chart.rows.some((row) => row.size === size));

  const setColumns = (columns: AdminSizeChart["columns"], rows = chart.rows) =>
    set({ columns, rows: rows.map((row) => ({ ...row, values: columns.map((_, index) => row.values[index] ?? "") })) });
  const setCell = (rowIndex: number, columnIndex: number, value: string) =>
    set({
      rows: chart.rows.map((row, index) =>
        index === rowIndex ? { ...row, values: row.values.map((cell, cellIndex) => (cellIndex === columnIndex ? value : cell)) } : row,
      ),
    });

  return (
    <div className="admin-size-chart">
      <div className="admin-form-grid">
        <Select
          className="admin-field"
          label="Describes"
          options={options.map((option) => ({ id: option.key, label: option.name }))}
          value={chart.optionKey}
          onChange={(optionKey) => set({ optionKey })}
        />
        <Select className="admin-field" label="Measured in" options={UNIT_OPTIONS} value={chart.unit} onChange={(unit) => set({ unit: unit as "in" | "cm" })} />
      </div>

      <div className="admin-table-wrap admin-size-chart__grid">
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">Size</th>
              {chart.columns.map((column, index) => (
                <th key={index} scope="col">
                  <div className="admin-size-chart__column">
                    <input
                      aria-label={`Measurement ${index + 1}`}
                      value={column.label}
                      maxLength={40}
                      placeholder="Chest"
                      onChange={(event) =>
                        setColumns(chart.columns.map((entry, position) => (position === index ? { ...entry, label: event.currentTarget.value } : entry)))
                      }
                    />
                    <label title="The fit finder asks shoppers for this measurement">
                      <input
                        type="radio"
                        name="primary-measurement"
                        checked={column.primary}
                        disabled={!column.measurement}
                        onChange={() => setColumns(chart.columns.map((entry, position) => ({ ...entry, primary: position === index })))}
                      />
                      Fit finder
                    </label>
                    <label title="Untick for columns that aren't lengths, such as EU sizes">
                      <input
                        type="checkbox"
                        checked={column.measurement}
                        onChange={(event) => {
                          const measurement = event.currentTarget.checked;
                          setColumns(
                            chart.columns.map((entry, position) =>
                              position === index ? { ...entry, measurement, primary: measurement ? entry.primary : false } : entry,
                            ),
                          );
                        }}
                      />
                      Length
                    </label>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Remove ${column.label || "measurement"}`}
                      onClick={() =>
                        set({
                          columns: chart.columns.filter((_, position) => position !== index),
                          rows: chart.rows.map((row) => ({ ...row, values: row.values.filter((_, position) => position !== index) })),
                        })
                      }
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </th>
              ))}
              <th scope="col" aria-label="Row actions" />
            </tr>
          </thead>
          <tbody>
            {chart.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <th scope="row">
                  <input
                    aria-label={`Size ${rowIndex + 1}`}
                    value={row.size}
                    maxLength={40}
                    onChange={(event) => set({ rows: chart.rows.map((entry, index) => (index === rowIndex ? { ...entry, size: event.currentTarget.value } : entry)) })}
                  />
                </th>
                {chart.columns.map((column, columnIndex) => (
                  <td key={columnIndex}>
                    <input
                      aria-label={`${row.size} ${column.label}`}
                      value={row.values[columnIndex] ?? ""}
                      maxLength={40}
                      placeholder={column.measurement ? "38 or 38–40" : ""}
                      onChange={(event) => setCell(rowIndex, columnIndex, event.currentTarget.value)}
                    />
                  </td>
                ))}
                <td>
                  <div className="admin-size-chart__row-actions">
                    <button type="button" className="icon-button" aria-label={`Move ${row.size} up`} disabled={rowIndex === 0} onClick={() => set({ rows: move(chart.rows, rowIndex, -1) })}>
                      <ArrowUp size={13} />
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Move ${row.size} down`}
                      disabled={rowIndex === chart.rows.length - 1}
                      onClick={() => set({ rows: move(chart.rows, rowIndex, 1) })}
                    >
                      <ArrowDown size={13} />
                    </button>
                    <button type="button" className="icon-button" aria-label={`Remove ${row.size}`} onClick={() => set({ rows: chart.rows.filter((_, index) => index !== rowIndex) })}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="admin-size-chart__tools">
        <button
          type="button"
          className="text-button"
          disabled={chart.columns.length >= 8}
          onClick={() => setColumns([...chart.columns, { label: "", primary: !chart.columns.some((column) => column.primary), measurement: true }])}
        >
          <Plus size={14} aria-hidden="true" /> Add measurement
        </button>
        <button type="button" className="text-button" onClick={() => set({ rows: [...chart.rows, { size: "", values: chart.columns.map(() => "") }] })}>
          <Plus size={14} aria-hidden="true" /> Add size
        </button>
        {missing.length ? (
          <button
            type="button"
            className="text-button"
            onClick={() => set({ rows: [...chart.rows, ...missing.map((size) => ({ size, values: chart.columns.map(() => "") }))] })}
          >
            <Plus size={14} aria-hidden="true" /> Fill sizes ({missing.join(", ")})
          </button>
        ) : null}
      </div>

      <div className="admin-form-grid">
        <label className="admin-field admin-field-wide">
          Note for shoppers
          <input value={chart.note} maxLength={500} placeholder="Garment measurements, laid flat." onChange={(event) => set({ note: event.currentTarget.value })} />
        </label>
      </div>

      <fieldset className="admin-repeater">
        <legend>How to measure</legend>
        {chart.howToMeasure.map((tip, index) => (
          <div key={index} className="admin-repeater__row">
            <label className="admin-field">
              Measurement
              <input value={tip.label} maxLength={40} onChange={(event) => set({ howToMeasure: chart.howToMeasure.map((entry, position) => (position === index ? { ...entry, label: event.currentTarget.value } : entry)) })} />
            </label>
            <label className="admin-field admin-size-chart__tip">
              How
              <input value={tip.text} maxLength={300} onChange={(event) => set({ howToMeasure: chart.howToMeasure.map((entry, position) => (position === index ? { ...entry, text: event.currentTarget.value } : entry)) })} />
            </label>
            <button type="button" className="icon-button" aria-label={`Remove ${tip.label || "tip"}`} onClick={() => set({ howToMeasure: chart.howToMeasure.filter((_, position) => position !== index) })}>
              <Trash2 size={15} />
            </button>
          </div>
        ))}
        {chart.howToMeasure.length < 8 ? (
          <button type="button" className="text-button" onClick={() => set({ howToMeasure: [...chart.howToMeasure, { label: chart.columns[chart.howToMeasure.length]?.label ?? "", text: "" }] })}>
            <Plus size={14} aria-hidden="true" /> Add a tip
          </button>
        ) : null}
      </fieldset>
    </div>
  );
}
