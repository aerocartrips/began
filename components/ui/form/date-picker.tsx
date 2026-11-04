"use client";

import type { ReactNode } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { getLocalTimeZone, parseDate, parseDateTime, today, type DateValue } from "@internationalized/date";
import {
  Button,
  Calendar,
  CalendarCell,
  CalendarGrid,
  DateInput,
  DatePicker as AriaDatePicker,
  DateRangePicker as AriaDateRangePicker,
  DateSegment,
  Dialog,
  FieldError,
  Group,
  Heading,
  I18nProvider,
  Label,
  Popover,
  RangeCalendar,
  Text,
} from "react-aria-components";

/*
 * Dates go in and out as the same strings native inputs used:
 * "YYYY-MM-DD", or "YYYY-MM-DDTHH:mm" with `withTime`. "" means empty.
 * Shown in Indian format (dd/mm/yyyy) everywhere.
 *
 * The pickers read today's date while rendering (calendar placeholder), so use
 * them on request-time pages, or inside <Suspense> on a prerendered one.
 */
const LOCALE = "en-IN";

function parse(value: string | undefined): DateValue | null {
  if (!value) return null;
  try {
    return value.length > 10 ? parseDateTime(value.slice(0, 16)) : parseDate(value);
  } catch {
    return null;
  }
}

const format = (value: DateValue | null | undefined) => (value ? value.toString().slice(0, 16) : "");

/** Today's date in the visitor's time zone, as "YYYY-MM-DD". */
export const todayIso = () => today(getLocalTimeZone()).toString();

type BaseProps = {
  label: ReactNode;
  /** Field wrapper class of the surrounding form (admin-field, account-field, contact-field…). */
  className?: string;
  /** Earliest / latest selectable date ("YYYY-MM-DD" or with time). */
  min?: string;
  max?: string;
  /** Dates that can't be picked, e.g. holidays. Receives "YYYY-MM-DD". */
  isDateUnavailable?: (date: string) => boolean;
  /** Pick a time as well as a date. */
  withTime?: boolean;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  disabled?: boolean;
};

function sharedProps({ className, min, max, isDateUnavailable, withTime, error, required, disabled }: BaseProps, kind: string) {
  return {
    className: [`ui-date-picker ui-date-picker--${kind}`, className].filter(Boolean).join(" "),
    minValue: parse(min),
    maxValue: parse(max),
    isDateUnavailable: isDateUnavailable ? (date: DateValue) => isDateUnavailable(date.toString().slice(0, 10)) : undefined,
    granularity: withTime ? ("minute" as const) : ("day" as const),
    // 24-hour time: unambiguous for scheduling, and the am/pm spacing differs
    // between server and browser ICU data, which breaks hydration.
    hourCycle: 24 as const,
    shouldForceLeadingZeros: true,
    isRequired: required,
    isDisabled: disabled,
    isInvalid: error ? true : undefined,
  };
}

function CalendarBody() {
  return (
    <>
      <header className="ui-calendar__header">
        <Button slot="previous" className="ui-calendar__nav" aria-label="Previous month"><ChevronLeft size={15} aria-hidden="true" /></Button>
        <Heading className="ui-calendar__title" />
        <Button slot="next" className="ui-calendar__nav" aria-label="Next month"><ChevronRight size={15} aria-hidden="true" /></Button>
      </header>
      <CalendarGrid className="ui-calendar__grid">{(date) => <CalendarCell date={date} className="ui-calendar__cell" />}</CalendarGrid>
    </>
  );
}

function FieldFooter({ hint, error }: Pick<BaseProps, "hint" | "error">) {
  return (
    <>
      {hint ? <Text slot="description" className="ui-field-hint">{hint}</Text> : null}
      <FieldError className="ui-field-error">{error}</FieldError>
    </>
  );
}

const calendarButton = (
  <Button className="ui-field-button" aria-label="Open calendar">
    <CalendarDays size={14} aria-hidden="true" />
  </Button>
);

const segments = (segment: Parameters<typeof DateSegment>[0]["segment"]) => <DateSegment segment={segment} className="ui-date-segment" />;

export function DatePicker({ value, defaultValue, onChange, name, ...props }: BaseProps & {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** Submits "YYYY-MM-DD" with a plain HTML form. */
  name?: string;
}) {
  return (
    <I18nProvider locale={LOCALE}>
      <AriaDatePicker
        {...sharedProps(props, "single")}
        value={value === undefined ? undefined : parse(value)}
        defaultValue={parse(defaultValue)}
        onChange={(date) => onChange?.(format(date))}
        name={name}
      >
        <Label>{props.label}</Label>
        <Group className="ui-field-control ui-field-box">
          <DateInput className="ui-date-input">{segments}</DateInput>
          {calendarButton}
        </Group>
        <FieldFooter hint={props.hint} error={props.error} />
        <Popover className="ui-popover" offset={6}>
          <Dialog className="ui-calendar-dialog" aria-label="Choose a date">
            <Calendar className="ui-calendar"><CalendarBody /></Calendar>
          </Dialog>
        </Popover>
      </AriaDatePicker>
    </I18nProvider>
  );
}

export type DateRange = { start: string; end: string };

export function DateRangePicker({ value, onChange, startName, endName, ...props }: BaseProps & {
  value: DateRange;
  onChange: (value: DateRange) => void;
  startName?: string;
  endName?: string;
}) {
  const start = parse(value.start);
  const end = parse(value.end);
  return (
    <I18nProvider locale={LOCALE}>
      <AriaDateRangePicker
        {...sharedProps(props, "range")}
        value={start && end ? { start, end } : null}
        onChange={(range) => onChange({ start: format(range?.start), end: format(range?.end) })}
        startName={startName}
        endName={endName}
      >
        <Label>{props.label}</Label>
        <Group className="ui-field-control ui-field-box">
          <DateInput slot="start" className="ui-date-input">{segments}</DateInput>
          <span className="ui-date-range-dash" aria-hidden="true">–</span>
          <DateInput slot="end" className="ui-date-input">{segments}</DateInput>
          {calendarButton}
        </Group>
        <FieldFooter hint={props.hint} error={props.error} />
        <Popover className="ui-popover" offset={6}>
          <Dialog className="ui-calendar-dialog" aria-label="Choose a date range">
            <RangeCalendar className="ui-calendar ui-calendar--range"><CalendarBody /></RangeCalendar>
          </Dialog>
        </Popover>
      </AriaDateRangePicker>
    </I18nProvider>
  );
}
