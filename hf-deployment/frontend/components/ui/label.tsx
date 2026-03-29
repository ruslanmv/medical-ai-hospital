// =============================
// frontend/components/ui/label.tsx (FIXED)
// - Removes dependency on @radix-ui/react-label
// - Keeps API compatible with our usage in forms
// - No external utilities required
// =============================
"use client";
import * as React from "react";

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}

const base =
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70";

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className = "", ...props }, ref) => {
    return <label ref={ref} className={`${base} ${className}`} {...props} />;
  }
);

Label.displayName = "Label";

export { Label };


