'use client';

import * as React from 'react';
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { type DayButton, DayPicker, getDefaultClassNames } from 'react-day-picker';

import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/components/ui/button';

/**
 * Calendar component that wraps react-day-picker with custom styling
 * @param className - Additional class names to apply to the calendar
 * @param classNames - Custom class names for calendar elements
 * @param showOutsideDays - Whether to show days from previous/next months
 * @param captionLayout - Layout style for the calendar caption
 * @param buttonVariant - Button variant for navigation buttons
 * @param formatters - Custom formatters for dates
 * @param components - Custom components to override defaults
 * @param props - Additional props to pass to DayPicker
 */
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = 'label',
  buttonVariant = 'ghost',
  formatters,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>['variant'];
}) {
  const defaultClassNames = getDefaultClassNames();

  // Wrapper div to ensure proper centering
  return (
    <div className="flex justify-center w-full">
      <DayPicker
        showOutsideDays={showOutsideDays}
        className={cn(
          'bg-background group/calendar p-3 pt-0 [--cell-size:--spacing(8)] [[data-slot=card-content]_&]:bg-transparent [[data-slot=popover-content]_&]:bg-transparent inline-block',
          String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
          String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
          className
        )}
        captionLayout={captionLayout}
        formatters={{
          formatMonthDropdown: date => date.toLocaleString('default', { month: 'short' }),
          ...formatters,
        }}
        classNames={{
          root: cn('', defaultClassNames.root),
          months: cn('flex gap-4 flex-col md:flex-row', defaultClassNames.months),
          month: cn('flex flex-col gap-4', defaultClassNames.month),
          nav: cn('flex items-center justify-center gap-2 mb-2 order-first', defaultClassNames.nav),
          button_previous: cn(
            buttonVariants({ variant: buttonVariant }),
            'h-8 w-8 aria-disabled:opacity-50 p-0 select-none absolute left-0',
            defaultClassNames.button_previous
          ),
          button_next: cn(
            buttonVariants({ variant: buttonVariant }),
            'h-8 w-8 aria-disabled:opacity-50 p-0 select-none absolute right-0',
            defaultClassNames.button_next
          ),
          month_caption: cn(
            'flex items-center justify-center h-8 px-2 relative',
            defaultClassNames.month_caption
          ),
          dropdowns: cn(
            'flex items-center text-sm font-medium justify-center h-8 gap-1.5',
            defaultClassNames.dropdowns
          ),
          dropdown_root: cn(
            'relative has-focus:border-ring border border-input shadow-xs has-focus:ring-ring/50 has-focus:ring-[3px] rounded-md',
            defaultClassNames.dropdown_root
          ),
          dropdown: cn('absolute inset-0 opacity-0', defaultClassNames.dropdown),
          caption_label: cn(
            'select-none font-medium text-sm mx-3',
            defaultClassNames.caption_label
          ),
          //@ts-ignore
          table: cn('w-full border-collapse', defaultClassNames.table),
          weekdays: cn('flex w-full', defaultClassNames.weekdays),
          weekday: cn(
            'text-muted-foreground rounded-md w-8 h-8 font-normal text-xs flex items-center justify-center select-none',
            defaultClassNames.weekday
          ),
          week: cn('flex w-full mt-1', defaultClassNames.week),
          week_number_header: cn('select-none', defaultClassNames.week_number_header),
          week_number: cn(
            'text-xs select-none text-muted-foreground',
            defaultClassNames.week_number
          ),
          day: cn(
            'w-8 h-8 p-0 relative flex items-center justify-center select-none',
            defaultClassNames.day
          ),
          range_start: cn('rounded-l-md bg-accent', defaultClassNames.range_start),
          range_middle: cn('rounded-none', defaultClassNames.range_middle),
          range_end: cn('rounded-r-md bg-accent', defaultClassNames.range_end),
          today: cn('bg-gray-600 text-foreground rounded-md', defaultClassNames.today),
          outside: cn(
            'text-muted-foreground aria-selected:text-muted-foreground opacity-50',
            defaultClassNames.outside
          ),
          disabled: cn('text-muted-foreground opacity-30', defaultClassNames.disabled),
          hidden: cn('invisible', defaultClassNames.hidden),
          ...classNames,
        }}
        components={{
          Root: ({ className, rootRef, ...props }) => {
            return <div data-slot="calendar" ref={rootRef} className={cn(className)} {...props} />;
          },
          Chevron: ({ className, orientation, ...props }) => {
            if (orientation === 'left') {
              return <ChevronLeftIcon className={cn('size-4 mt-20', className)} {...props} />;
            }

            if (orientation === 'right') {
              return <ChevronRightIcon className={cn('size-4 mt-20', className)} {...props} />;
            }

            return <ChevronDownIcon className={cn('size-4', className)} {...props} />;
          },
          DayButton: CalendarDayButton,
          WeekNumber: ({ children, ...props }) => {
            return (
              <td {...props}>
                <div className="flex size-(--cell-size) items-center justify-center text-center">
                  {children}
                </div>
              </td>
            );
          },
          ...components,
        }}
        {...props}
      />
    </div>
  );
}

/**
 * Custom day button component for the calendar
 * @param className - Additional class names to apply to the button
 * @param day - Day information
 * @param modifiers - Modifiers for the day button
 * @param props - Additional props to pass to the Button component
 */
function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const defaultClassNames = getDefaultClassNames();

  const ref = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString()}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      className={cn(
        'h-8 w-8 p-0 font-normal text-sm hover:bg-accent hover:text-accent-foreground rounded-md transition-colors',
        'data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground data-[selected=true]:ring-2 data-[selected=true]:ring-white data-[selected=true]:border-[2px] data-[selected=true]:border-white data-[selected=true]:ring-offset-1',
        'data-[today=true]:bg-muted/60 data-[today=true]:text-foreground',
        'data-[outside=true]:text-muted-foreground data-[outside=true]:opacity-50',
        'data-[disabled=true]:text-muted-foreground data-[disabled=true]:opacity-30',
        className
      )}
      {...props}
    />
  );
}

export { Calendar, CalendarDayButton };
