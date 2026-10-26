"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { ChevronDownIcon, CheckIcon, ChevronUpIcon } from "lucide-react"

interface SelectContextType {
  open: boolean
  setOpen: (open: boolean) => void
  value?: string
  onValueChange?: (val: string) => void
  disabled?: boolean
  registerItem: (value: string, label: React.ReactNode) => void
  labels: Record<string, React.ReactNode>
}

const SelectContext = React.createContext<SelectContextType>({
  open: false,
  setOpen: () => {},
  value: undefined,
  onValueChange: () => {},
  disabled: false,
  registerItem: () => {},
  labels: {},
})

interface SelectProps {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  disabled?: boolean
  children?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

function Select({
  value: controlledValue,
  defaultValue,
  onValueChange,
  disabled = false,
  children,
  open: controlledOpen,
  onOpenChange,
}: SelectProps) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue || "")
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const [labels, setLabels] = React.useState<Record<string, React.ReactNode>>({})

  const isControlledValue = controlledValue !== undefined
  const currentValue = isControlledValue ? controlledValue : uncontrolledValue

  const isControlledOpen = controlledOpen !== undefined
  const currentOpen = isControlledOpen ? !!controlledOpen : uncontrolledOpen

  const handleOpenChange = React.useCallback(
    (newOpen: boolean) => {
      if (!isControlledOpen) {
        setUncontrolledOpen(newOpen)
      }
      onOpenChange?.(newOpen)
    },
    [isControlledOpen, onOpenChange]
  )

  const handleValueChange = React.useCallback(
    (val: string) => {
      if (!isControlledValue) {
        setUncontrolledValue(val)
      }
      onValueChange?.(val)
      handleOpenChange(false)
    },
    [isControlledValue, onValueChange, handleOpenChange]
  )

  const registerItem = React.useCallback((val: string, label: React.ReactNode) => {
    setLabels((prev) => {
      if (prev[val] === label) return prev
      return { ...prev, [val]: label }
    })
  }, [])

  return (
    <SelectContext.Provider
      value={{
        open: currentOpen,
        setOpen: handleOpenChange,
        value: currentValue,
        onValueChange: handleValueChange,
        disabled,
        registerItem,
        labels,
      }}
    >
      <div className="relative inline-block w-full" data-slot="select-root">
        {children}
      </div>
    </SelectContext.Provider>
  )
}

function SelectGroup({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="select-group"
      className={cn("scroll-my-1 p-1", className)}
      {...props}
    />
  )
}

function SelectValue({
  placeholder,
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { placeholder?: string }) {
  const { value, labels } = React.useContext(SelectContext)
  const displayContent = (value !== undefined && value !== "" && labels[value] !== undefined)
    ? labels[value]
    : (value || placeholder || "")

  return (
    <span
      data-slot="select-value"
      className={cn("flex flex-1 text-left items-center truncate", className)}
      {...props}
    >
      {displayContent || <span className="text-muted-foreground">{placeholder}</span>}
    </span>
  )
}

function SelectTrigger({
  className,
  size = "default",
  children,
  onClick,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: "sm" | "default"
}) {
  const { open, setOpen, disabled } = React.useContext(SelectContext)

  return (
    <button
      type="button"
      role="combobox"
      aria-expanded={open}
      disabled={disabled}
      data-slot="select-trigger"
      data-size={size}
      onClick={(e) => {
        onClick?.(e)
        if (!disabled) {
          setOpen(!open)
        }
      }}
      className={cn(
        "flex w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-background py-2 pr-2.5 pl-3 text-sm whitespace-nowrap transition-colors outline-none select-none cursor-pointer focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-8 data-[size=sm]:h-7 dark:bg-input/30 dark:hover:bg-input/50",
        className
      )}
      {...props}
    >
      {children}
      <ChevronDownIcon
        className={cn(
          "pointer-events-none size-4 text-muted-foreground transition-transform duration-200 shrink-0",
          open && "rotate-180"
        )}
      />
    </button>
  )
}

function SelectContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  side?: string
  sideOffset?: number
  align?: string
  alignOffset?: number
  alignItemWithTrigger?: boolean
}) {
  const { open, setOpen } = React.useContext(SelectContext)
  const menuRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return

    const handlePointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        // Check if click was on trigger
        const trigger = menuRef.current.parentElement?.querySelector('[data-slot="select-trigger"]')
        if (trigger && trigger.contains(e.target as Node)) {
          return
        }
        setOpen(false)
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false)
      }
    }

    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [open, setOpen])

  if (!open) return null

  return (
    <div
      ref={menuRef}
      data-slot="select-content"
      className={cn(
        "absolute left-0 top-full z-[100020] mt-1.5 min-w-[8rem] w-full max-h-60 overflow-y-auto overscroll-contain rounded-lg border border-border bg-popover text-popover-foreground shadow-xl animate-in fade-in-0 zoom-in-95 p-1 outline-none",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function SelectLabel({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="select-label"
      className={cn("px-2 py-1.5 text-xs font-semibold text-muted-foreground", className)}
      {...props}
    />
  )
}

function SelectItem({
  className,
  children,
  value,
  onClick,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { value: string }) {
  const { value: selectedValue, onValueChange, registerItem } = React.useContext(SelectContext)
  const isSelected = selectedValue === value

  React.useEffect(() => {
    registerItem(value, children)
  }, [value, children, registerItem])

  return (
    <div
      role="option"
      aria-selected={isSelected}
      data-slot="select-item"
      onClick={(e) => {
        onClick?.(e)
        onValueChange?.(value)
      }}
      className={cn(
        "relative flex w-full cursor-pointer items-center justify-between gap-2 rounded-md py-1.5 px-2.5 text-sm select-none outline-none transition-colors hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        isSelected && "bg-accent/80 font-medium text-accent-foreground",
        className
      )}
      {...props}
    >
      <span className="flex items-center gap-2 truncate flex-1">{children}</span>
      {isSelected && (
        <CheckIcon className="size-4 shrink-0 text-primary" />
      )}
    </div>
  )
}

function SelectSeparator({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="select-separator"
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  )
}

function SelectScrollUpButton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="select-scroll-up-button"
      className={cn("flex w-full items-center justify-center py-1", className)}
      {...props}
    >
      <ChevronUpIcon className="size-4" />
    </div>
  )
}

function SelectScrollDownButton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="select-scroll-down-button"
      className={cn("flex w-full items-center justify-center py-1", className)}
      {...props}
    >
      <ChevronDownIcon className="size-4" />
    </div>
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
