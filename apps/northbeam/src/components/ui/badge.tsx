import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

/**
 * Status and sponsor-touchpoint pill. `neutral`/`success`/`warning`/`destructive` cover
 * app-native states (Approved, OK, Pending, Flagged); `hedera`/`ens`/`world` are the three
 * fixed sponsor tags from DESIGN.northbeam.md — shared with Fidelis and never recolored to
 * Northbeam's own teal accent.
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
  {
    variants: {
      variant: {
        neutral: 'border-border bg-transparent text-foreground',
        success: 'border-transparent bg-[var(--success)]/10 text-[var(--success)]',
        warning: 'border-transparent bg-[var(--warning)]/10 text-[var(--warning)]',
        destructive: 'border-transparent bg-destructive/10 text-destructive',
        hedera: 'border-[var(--hedera)]/40 bg-[var(--hedera-fill)] text-[var(--hedera)]',
        ens: 'border-[var(--ens)]/40 bg-[var(--ens-fill)] text-[var(--ens)]',
        world: 'border-[var(--world)]/40 bg-[var(--world-fill)] text-[var(--world)]',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
