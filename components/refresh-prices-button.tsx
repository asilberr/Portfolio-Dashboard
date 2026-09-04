"use client";

import {
  RefreshCw,
} from "lucide-react";

import {
  useFormStatus,
} from "react-dom";

type RefreshPricesButtonProps = {
  action:
    (
      formData: FormData
    ) => void | Promise<void>;
};

export function RefreshPricesButton({
  action,
}: RefreshPricesButtonProps) {
  return (
    <form action={action}>
      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const {
    pending,
  } = useFormStatus();

  return (
    <button
      type="submit"
      className="button"
      disabled={pending}
    >
      <RefreshCw
        size={16}
      />

      {pending
        ? "Kurse werden geladen ..."
        : "Kurse aktualisieren"}
    </button>
  );
}