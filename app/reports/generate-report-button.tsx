"use client";

import {
  useFormStatus,
} from "react-dom";

import styles from "./reports.module.css";

export default function GenerateReportButton() {
  const { pending } =
    useFormStatus();

  return (
    <button
      type="submit"
      className="button"
      disabled={pending}
    >
      {pending ? (
        <>
          <span
            className={
              styles.reportSpinner
            }
            aria-hidden="true"
          />

          Report wird erstellt …
        </>
      ) : (
        "Monatsreport generieren"
      )}
    </button>
  );
}