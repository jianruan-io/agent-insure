import * as React from 'react';
import { cn } from '../../lib/utils';

/**
 * The soft-shadow container used for every content block on a screen (stat tiles use
 * their own tighter shell — see StatTile — but every other grouped block sits in one of
 * these). Matches DESIGN.northbeam.md's `{components.card}` token: full rounding, a
 * hairline border, and a barely-there 0.04-opacity shadow, never a hard drop shadow.
 */
function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card"
      className={cn('rounded-xl border border-border bg-card text-card-foreground shadow-sm', className)}
      {...props}
    />
  );
}

/**
 * The title row at the top of a Card, e.g. a heading paired with a trailing action.
 */
function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn('flex items-center justify-between gap-2 p-5 pb-2', className)}
      {...props}
    />
  );
}

/**
 * The body of a Card, below an optional CardHeader.
 */
function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-content" className={cn('p-5 pt-0', className)} {...props} />;
}

export { Card, CardHeader, CardContent };
