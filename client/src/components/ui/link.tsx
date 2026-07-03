import * as React from "react"
import { Link as RouterLink, type LinkProps as RouterLinkProps } from "react-router-dom"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const linkVariants = cva("transition-colors", {
  variants: {
    variant: {
      nav: "text-sm text-muted-foreground hover:text-foreground",
      subtle: "hover:underline underline-offset-2",
    },
  },
  defaultVariants: {
    variant: "nav",
  },
})

export interface TextLinkProps
  extends RouterLinkProps,
    VariantProps<typeof linkVariants> {}

const TextLink = React.forwardRef<HTMLAnchorElement, TextLinkProps>(
  ({ className, variant, ...props }, ref) => (
    <RouterLink ref={ref} className={cn(linkVariants({ variant }), className)} {...props} />
  )
)
TextLink.displayName = "TextLink"

export { TextLink, linkVariants }
