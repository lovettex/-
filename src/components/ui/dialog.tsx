"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

interface DialogContextType {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const DialogContext = React.createContext<DialogContextType>({
  open: false,
  onOpenChange: () => {},
})

interface DialogProps {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}

function Dialog({ open: controlledOpen, defaultOpen = false, onOpenChange, children }: DialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? !!controlledOpen : uncontrolledOpen

  const handleOpenChange = React.useCallback(
    (newOpen: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(newOpen)
      }
      onOpenChange?.(newOpen)
    },
    [isControlled, onOpenChange]
  )

  return (
    <DialogContext.Provider value={{ open, onOpenChange: handleOpenChange }}>
      {children}
    </DialogContext.Provider>
  )
}

function DialogTrigger({
  children,
  onClick,
  asChild,
  render,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean; render?: React.ReactNode }) {
  const { onOpenChange } = React.useContext(DialogContext)

  const handleClick = (e: React.MouseEvent<any>) => {
    onClick?.(e as any)
    onOpenChange(true)
  }

  if (render && React.isValidElement(render)) {
    return React.cloneElement(render as React.ReactElement<any>, {
      onClick: (e: any) => {
        (render.props as any)?.onClick?.(e)
        handleClick(e)
      },
    })
  }

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      onClick: (e: any) => {
        (children.props as any)?.onClick?.(e)
        handleClick(e)
      },
    })
  }

  return (
    <button
      type="button"
      data-slot="dialog-trigger"
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  )
}

function DialogPortal({ children }: { children?: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || typeof document === "undefined") {
    return null
  }

  return createPortal(children, document.body)
}

function DialogOverlay({
  className,
  onClick,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const { onOpenChange } = React.useContext(DialogContext)

  return (
    <div
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-[100000] bg-black/50 backdrop-blur-xs transition-opacity duration-150 animate-in fade-in-0",
        className
      )}
      onClick={(e) => {
        onClick?.(e)
        onOpenChange(false)
      }}
      {...props}
    />
  )
}

function DialogClose({
  className,
  children,
  render,
  onClick,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { render?: React.ReactNode }) {
  const { onOpenChange } = React.useContext(DialogContext)

  const handleClick = (e: React.MouseEvent<any>) => {
    onClick?.(e as any)
    onOpenChange(false)
  }

  if (render && React.isValidElement(render)) {
    return React.cloneElement(render as React.ReactElement<any>, {
      onClick: (e: any) => {
        (render.props as any)?.onClick?.(e)
        handleClick(e)
      },
    })
  }

  return (
    <button
      type="button"
      data-slot="dialog-close"
      onClick={handleClick}
      className={className}
      {...props}
    >
      {children}
    </button>
  )
}

interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  showCloseButton?: boolean
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogContentProps) {
  const { open, onOpenChange } = React.useContext(DialogContext)
  const contentRef = React.useRef<HTMLDivElement>(null)

  // ESC key to close
  React.useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation()
        onOpenChange(false)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, onOpenChange])

  // Prevent background scroll
  React.useEffect(() => {
    if (!open) return
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [open])

  if (!open) return null

  return (
    <DialogPortal>
      <DialogOverlay />
      <div
        ref={contentRef}
        data-slot="dialog-content"
        data-lenis-prevent
        className={cn(
          "fixed top-1/2 left-1/2 z-[100010] grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground shadow-2xl ring-1 ring-foreground/10 duration-150 outline-none sm:max-w-md animate-in fade-in-0 zoom-in-95",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <Button
            type="button"
            variant="ghost"
            className="absolute top-3 right-3 h-7 w-7 p-0 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground cursor-pointer z-10"
            onClick={() => onOpenChange(false)}
          >
            <XIcon className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        )}
      </div>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  const { onOpenChange } = React.useContext(DialogContext)

  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      )}
    </div>
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="dialog-title"
      className={cn(
        "font-heading text-base leading-none font-medium",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
