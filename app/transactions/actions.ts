"use server";

import {
  revalidatePath,
} from "next/cache";

import {
  redirect,
} from "next/navigation";

import {
  createClient,
} from "@/lib/supabase/server";


function cleanText(
  value:
    FormDataEntryValue
    | null
) {
  return String(
    value ?? ""
  ).trim();
}


function parseOptionalNumber(
  value:
    FormDataEntryValue
    | null
) {
  const raw =
    cleanText(value)
      .replace(/\s/g, "")
      .replace(",", ".");

  if (!raw) {
    return null;
  }

  const number =
    Number(raw);

  if (
    !Number.isFinite(
      number
    )
  ) {
    return null;
  }

  return number;
}


function isValidTransactionType(
  value: string
): value is
  | "buy"
  | "sell"
  | "dividend"
  | "fee"
  | "deposit"
  | "withdrawal" {
  return [
    "buy",
    "sell",
    "dividend",
    "fee",
    "deposit",
    "withdrawal",
  ].includes(value);
}


function errorRedirect(
  message: string
): never {
  redirect(
    `/transactions?error=${encodeURIComponent(
      message
    )}`
  );
}


function readableError(
  message: string
) {
  const normalized =
    message.toUpperCase();

  if (
    normalized.includes(
      "PORTFOLIO_NOT_FOUND"
    )
  ) {
    return "Das ausgewählte Depot wurde nicht gefunden.";
  }

  if (
    normalized.includes(
      "INSTRUMENT_REQUIRED"
    )
  ) {
    return "Für Käufe und Verkäufe muss ein Wertpapier ausgewählt werden.";
  }

  if (
    normalized.includes(
      "INVALID_QUANTITY"
    )
  ) {
    return "Bitte gib eine gültige Stückzahl größer als 0 ein.";
  }

  if (
    normalized.includes(
      "INVALID_PRICE"
    )
  ) {
    return "Bitte gib einen gültigen Kurs ein.";
  }

  if (
    normalized.includes(
      "INVALID_AMOUNT"
    )
  ) {
    return "Bitte gib einen gültigen Betrag ein.";
  }

  if (
    normalized.includes(
      "POSITION_NOT_FOUND"
    )
  ) {
    return "Für dieses Wertpapier existiert in diesem Depot keine Position.";
  }

  if (
    normalized.includes(
      "INSUFFICIENT_POSITION_QUANTITY"
    )
  ) {
    return "Du kannst nicht mehr Stück verkaufen als aktuell im Depot vorhanden sind.";
  }

  if (
    normalized.includes(
      "POSITION_CURRENCY_MISMATCH"
    )
  ) {
    return "Die Währung des Kaufs stimmt nicht mit der bisherigen Einstandswährung dieser Position überein.";
  }

  if (
    normalized.includes(
      "INVALID_CURRENCY"
    )
  ) {
    return "Bitte verwende einen gültigen dreistelligen Währungscode.";
  }

  if (
    normalized.includes(
      "INVALID_TRANSACTION_TYPE"
    )
  ) {
    return "Bitte wähle einen gültigen Transaktionstyp.";
  }

  return message;
}


export async function createTransaction(
  formData: FormData
) {
  const portfolioId =
    cleanText(
      formData.get(
        "portfolioId"
      )
    );

  const instrumentId =
    cleanText(
      formData.get(
        "instrumentId"
      )
    );

  const transactionType =
    cleanText(
      formData.get(
        "transactionType"
      )
    );

  const tradeDate =
    cleanText(
      formData.get(
        "tradeDate"
      )
    );

  const quantity =
    parseOptionalNumber(
      formData.get(
        "quantity"
      )
    );

  const pricePerUnit =
    parseOptionalNumber(
      formData.get(
        "pricePerUnit"
      )
    );

  const amount =
    parseOptionalNumber(
      formData.get(
        "amount"
      )
    );

  const currency =
    (
      cleanText(
        formData.get(
          "currency"
        )
      ) || "EUR"
    ).toUpperCase();

  const notes =
    cleanText(
      formData.get(
        "notes"
      )
    );


  if (!portfolioId) {
    errorRedirect(
      "Bitte wähle ein Depot aus."
    );
  }


  if (
    !isValidTransactionType(
      transactionType
    )
  ) {
    errorRedirect(
      "Bitte wähle einen gültigen Transaktionstyp."
    );
  }


  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      tradeDate
    )
  ) {
    errorRedirect(
      "Bitte gib ein gültiges Datum ein."
    );
  }


  if (
    !/^[A-Z]{3}$/.test(
      currency
    )
  ) {
    errorRedirect(
      "Bitte verwende einen gültigen Währungscode."
    );
  }


  const isSecurityTransaction =
    transactionType ===
      "buy"
    ||
    transactionType ===
      "sell";


  if (
    isSecurityTransaction
  ) {
    if (!instrumentId) {
      errorRedirect(
        "Bitte wähle ein Wertpapier aus."
      );
    }

    if (
      quantity === null
      || quantity <= 0
    ) {
      errorRedirect(
        "Bitte gib eine gültige Stückzahl größer als 0 ein."
      );
    }

    if (
      pricePerUnit === null
      || pricePerUnit < 0
    ) {
      errorRedirect(
        "Bitte gib einen gültigen Kurs ein."
      );
    }
  } else {
    if (
      amount === null
      || amount < 0
    ) {
      errorRedirect(
        "Bitte gib einen gültigen Betrag ein."
      );
    }
  }


  const supabase =
    await createClient();


  const {
    data: authData,
    error: authError,
  } =
    await supabase.auth.getClaims();


  const userId =
    authData?.claims?.sub;


  if (
    authError
    || !userId
  ) {
    redirect("/login");
  }


  const {
    error,
  } = await supabase.rpc(
    "record_portfolio_transaction",
    {
      p_portfolio_id:
        portfolioId,

      p_instrument_id:
        isSecurityTransaction
          ? instrumentId
          : instrumentId || null,

      p_transaction_type:
        transactionType,

      p_trade_date:
        tradeDate,

      p_quantity:
        isSecurityTransaction
          ? quantity
          : null,

      p_price_per_unit:
        isSecurityTransaction
          ? pricePerUnit
          : null,

      p_amount:
        isSecurityTransaction
          ? null
          : amount,

      p_currency:
        currency,

      p_notes:
        notes || null,
    }
  );


  if (error) {
    console.error(
      "Create transaction error:",
      error
    );

    errorRedirect(
      readableError(
        error.message
      )
    );
  }


  revalidatePath("/");
  revalidatePath(
    "/positions"
  );
  revalidatePath(
    "/transactions"
  );


  redirect(
    `/transactions?success=${encodeURIComponent(
      "Transaktion erfolgreich gespeichert."
    )}`
  );
}