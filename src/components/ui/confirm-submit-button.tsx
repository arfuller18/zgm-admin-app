"use client";

import { Button } from "@/components/ui/button";
import type * as React from "react";

// A submit button that requires a native confirm() before letting the
// enclosing form (bound to a server action) actually submit — used for
// destructive actions like deleting a Project or Unit Production.
export function ConfirmSubmitButton({
  confirmMessage,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { confirmMessage: string }) {
  return (
    <Button
      {...props}
      onClick={(e) => {
        if (!window.confirm(confirmMessage)) {
          e.preventDefault();
        }
      }}
    >
      {children}
    </Button>
  );
}
