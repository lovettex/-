import * as React from "react"

interface CollapsibleContextType {
  open: boolean
  toggle: () => void
}

const CollapsibleContext = React.createContext<CollapsibleContextType>({
  open: false,
  toggle: () => {},
})

function Collapsible({
  open: openProp,
  onOpenChange,
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const isControlled = openProp !== undefined
  const open = isControlled ? openProp : internalOpen

  const toggle = React.useCallback(() => {
    const next = !open
    if (!isControlled) setInternalOpen(next)
    onOpenChange?.(next)
  }, [open, isControlled, onOpenChange])

  return (
    <CollapsibleContext.Provider value={{ open, toggle }}>
      <div data-slot="collapsible" data-state={open ? "open" : "closed"} className={className} {...props}>
        {children}
      </div>
    </CollapsibleContext.Provider>
  )
}

function CollapsibleTrigger({
  children,
  className,
  onClick,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { toggle } = React.useContext(CollapsibleContext)
  return (
    <button
      type="button"
      data-slot="collapsible-trigger"
      className={className}
      onClick={(e) => {
        onClick?.(e)
        toggle()
      }}
      {...props}
    >
      {children}
    </button>
  )
}

function CollapsibleContent({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const { open } = React.useContext(CollapsibleContext)
  if (!open) return null
  return (
    <div data-slot="collapsible-content" className={className} {...props}>
      {children}
    </div>
  )
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
