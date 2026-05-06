import * as React from "react"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const Sheet = SheetPrimitive.Root

const SheetTrigger = SheetPrimitive.Trigger

const SheetClose = SheetPrimitive.Close

const SheetPortal = SheetPrimitive.Portal

const SheetOverlay = React.forwardRef<React.ElementRef<typeof SheetPrimitive.Overlay>, React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>>(({ className, onClick, ...props }, ref) => {
  const [hasLightbox, setHasLightbox] = React.useState(false);
  const overlayRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const checkLightbox = () => {
      const lightbox = document.querySelector('.lightbox-container');
      if (!lightbox) {
        setHasLightbox(false);
        return;
      }
      
      const style = window.getComputedStyle(lightbox);
      const isVisible = style.display !== 'none' && 
                        style.visibility !== 'hidden' && 
                        style.opacity !== '0' &&
                        lightbox.getAttribute('aria-hidden') !== 'true';
      setHasLightbox(isVisible);
    };

    checkLightbox();

    const observer = new MutationObserver(checkLightbox);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class', 'aria-hidden'],
    });

    const interval = setInterval(checkLightbox, 50);

    return () => {
      observer.disconnect();
      clearInterval(interval);
    };
  }, []);

  const handleClick = (e: React.MouseEvent) => {
    if (hasLightbox) return;
    onClick?.(e);
  };

  return (
    <SheetPrimitive.Overlay
      ref={(node) => {
        overlayRef.current = node as HTMLDivElement;
        if (typeof ref === 'function') {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      }}
      className={cn(
        "fixed inset-0 z-[90] bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        hasLightbox && "pointer-events-none",
        className
      )}
      onClick={handleClick}
      {...props}
    />
  );
})
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName

const sheetVariants = cva(
  "fixed z-[100] gap-4 bg-background p-6 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
  {
    variants: {
      side: {
        top:
          "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom:
          "inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        left:
          "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
        right:
          "inset-y-0 right-0 h-full w-3/4 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
      },
    },
    defaultVariants: {
      side: "right",
    },
  }
)

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {
  /** Merged into `SheetOverlay` (e.g. higher z-index when opening a sheet from a dialog). */
  overlayClassName?: string
}

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {
  /** Merged into `SheetOverlay` (e.g. higher z-index when opening a sheet from a dialog). */
  overlayClassName?: string
  /** Called when user clicks the overlay (outside the sheet content). Default: closes the sheet. */
  onOverlayClick?: () => void
}

const SheetContent = React.forwardRef<React.ElementRef<typeof SheetPrimitive.Content>, SheetContentProps>(
  (
    {
      side = "right",
      className,
      overlayClassName,
      onOverlayClick,
      children,
      ...props
    },
    ref
  ) => {
    const handleOverlayClick = () => {
      if (onOverlayClick) {
        onOverlayClick()
      }
      // If no custom handler, let Radix handle it (default behavior)
    }

    return (
      <SheetPortal>
        <SheetOverlay className={overlayClassName} onClick={handleOverlayClick} />
        <SheetPrimitive.Content ref={ref} className={cn(sheetVariants({ side }), className)} {...props}>
          {children}
        </SheetPrimitive.Content>
      </SheetPortal>
    );
  }
)
SheetContent.displayName = SheetPrimitive.Content.displayName

const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-2 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
SheetHeader.displayName = "SheetHeader"

const SheetFooter = ({ 
    className, 
    ...props 
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
SheetFooter.displayName = "SheetFooter"

const SheetTitle = React.forwardRef<React.ElementRef<typeof SheetPrimitive.Title>, React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold text-foreground", className)}
    {...props}
  />
))
SheetTitle.displayName = SheetPrimitive.Title.displayName

const SheetDescription = React.forwardRef<React.ElementRef<typeof SheetPrimitive.Description>, React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
SheetDescription.displayName = SheetPrimitive.Description.displayName

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} 
