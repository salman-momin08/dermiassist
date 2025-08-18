
"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker, DropdownProps } from "react-day-picker"
import { format, set } from "date-fns"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { Button } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker> & {
    view?: 'day' | 'month' | 'year';
    onViewChange?: (view: 'day' | 'month' | 'year') => void;
};

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  view = 'day',
  onViewChange,
  ...props
}: CalendarProps) {
    const { onMonthChange, month: currentMonth } = props;

    const handleYearSelect = (year: number) => {
        if (currentMonth) {
            onMonthChange?.(set(currentMonth, { year }));
        }
        onViewChange?.('month');
    }

    const handleMonthSelect = (month: number) => {
        if (currentMonth) {
            onMonthChange?.(set(currentMonth, { month }));
        }
        onViewChange?.('day');
    }

    if (view === 'year') {
        const currentYear = new Date().getFullYear();
        const years = Array.from({ length: 100 }, (_, i) => currentYear - i);
        return (
            <div className="p-3">
                <div className="grid grid-cols-4 gap-2">
                    {years.map(year => (
                        <Button 
                            key={year}
                            variant="ghost"
                            className="w-full"
                            onClick={() => handleYearSelect(year)}
                        >
                            {year}
                        </Button>
                    ))}
                </div>
            </div>
        )
    }

    if (view === 'month') {
         const months = Array.from({ length: 12 }, (_, i) => i);
         return (
             <div className="p-3">
                 <div className="grid grid-cols-3 gap-2">
                     {months.map(month => (
                         <Button
                             key={month}
                             variant="ghost"
                             className="w-full"
                             onClick={() => handleMonthSelect(month)}
                         >
                             {format(set(new Date(), { month }), "MMMM")}
                         </Button>
                     ))}
                 </div>
             </div>
         );
    }
  
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium hidden",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell:
          "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground",
        day_outside:
          "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ...props }) => <ChevronLeft className="h-4 w-4" />,
        IconRight: ({ ...props }) => <ChevronRight className="h-4 w-4" />,
        Caption: ({ ...captionProps}) => {
            const { displayMonth } = captionProps;
            return (
                <div className="flex justify-between items-center px-2">
                     <Button
                        variant="ghost"
                        onClick={() => onViewChange?.('month')}
                     >
                        {format(displayMonth, 'MMMM')}
                    </Button>
                    <Button
                        variant="ghost"
                        onClick={() => onViewChange?.('year')}
                     >
                        {format(displayMonth, 'yyyy')}
                    </Button>
                </div>
            )
        }
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
