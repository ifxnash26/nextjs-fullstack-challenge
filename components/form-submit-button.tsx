"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

type FormSubmitButtonProps = React.ComponentProps<typeof Button> & {
  pendingText: string;
  defaultText: string;
};

export function FormSubmitButton({ pendingText, defaultText, disabled, ...props }: FormSubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button {...props} disabled={pending || disabled}>
      {pending ? pendingText : defaultText}
    </Button>
  );
}
