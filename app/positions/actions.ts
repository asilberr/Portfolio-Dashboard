"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

const allowedAssetTypes = [
  "stock",
  "etf",
  "fund",
  "cash",
] as const;

type AssetType =
  (typeof allowedAssetTypes)[number];

type InstrumentIdRow = {
  id: string;
};

function cleanText(
  value: FormDataEntryValue | null
) {
  return String(value ?? "").trim();
}

function cleanUppercase(
  value: FormDataEntryValue | null
) {
  const cleaned = cleanText(value);

  return cleaned
    ? cleaned.toUpperCase()
    : null;
}

function parsePositiveNumber(
  value: FormDataEntryValue | null
) {
  const raw = cleanText(value)
    .replace(/\s/g, "")
    .replace(",", ".");

  const number = Number(raw);

  if (
    !Number.isFinite(number) ||
    number <= 0
  ) {
    return null;
  }

  return number;
}

function parseNonNegativeNumber(
  value: FormDataEntryValue | null
) {
  const raw = cleanText(value)
    .replace(/\s/g, "")
    .replace(",", ".");

  const number = Number(raw);

  if (
    !Number.isFinite(number) ||
    number < 0
  ) {
    return null;
  }

  return number;
}

function errorRedirect(
  message: string
): never {
  redirect(
    `/positions?error=${encodeURIComponent(
      message
    )}`
  );
}

async function getAuthenticatedUser() {
  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await supabase.auth.getClaims();

  const userId =
    data?.claims?.sub;

  if (
    error ||
    !userId
  ) {
    redirect("/login");
  }

  return {
    supabase,
    userId,
  };
}

export async function createPosition(
  formData: FormData
) {
  const portfolioId =
    cleanText(
      formData.get(
        "portfolioId"
      )
    );

  const assetTypeRaw =
    cleanText(
      formData.get(
        "assetType"
      )
    );

  const name =
    cleanText(
      formData.get("name")
    );

  const symbol =
    cleanUppercase(
      formData.get("symbol")
    );

  const isin =
    cleanUppercase(
      formData.get("isin")
    );

  const quantity =
    parsePositiveNumber(
      formData.get(
        "quantity"
      )
    );

  const averageCost =
    parseNonNegativeNumber(
      formData.get(
        "averageCost"
      )
    );

  const currency =
    cleanUppercase(
      formData.get(
        "currency"
      )
    ) ?? "EUR";

  if (!portfolioId) {
    errorRedirect(
      "Bitte wähle ein Depot aus."
    );
  }

  if (
    !allowedAssetTypes.includes(
      assetTypeRaw as AssetType
    )
  ) {
    errorRedirect(
      "Bitte wähle einen gültigen Wertpapiertyp."
    );
  }

  const assetType =
    assetTypeRaw as AssetType;

  if (!name) {
    errorRedirect(
      "Bitte gib den Namen des Wertpapiers ein."
    );
  }

  if (
    quantity === null
  ) {
    errorRedirect(
      "Bitte gib eine gültige Stückzahl größer als 0 ein."
    );
  }

  if (
    averageCost === null
  ) {
    errorRedirect(
      "Bitte gib einen gültigen Einstandskurs ein."
    );
  }

  if (
    !/^[A-Z]{3}$/.test(
      currency
    )
  ) {
    errorRedirect(
      "Bitte verwende einen gültigen dreistelligen Währungscode."
    );
  }

  const {
    supabase,
    userId,
  } =
    await getAuthenticatedUser();

  /*
   * Prüfen, ob das Depot wirklich
   * dem eingeloggten Benutzer gehört.
   */
  const {
    data: portfolio,
    error: portfolioError,
  } = await supabase
    .from("portfolios")
    .select("id")
    .eq(
      "id",
      portfolioId
    )
    .eq(
      "user_id",
      userId
    )
    .maybeSingle();

  if (
    portfolioError ||
    !portfolio
  ) {
    errorRedirect(
      "Das ausgewählte Depot wurde nicht gefunden."
    );
  }

  /*
   * Hier speichern wir die ID des
   * gefundenen oder neu angelegten
   * Instruments.
   */
  let instrumentId:
    string | undefined;

  /*
   * 1. Suche über ISIN
   */
  if (isin) {
    const {
      data:
        existingInstrument,
      error:
        existingInstrumentError,
    } = await supabase
      .from("instruments")
      .select("id")
      .eq("isin", isin)
      .maybeSingle();

    if (
      existingInstrumentError
    ) {
      console.error(
        "Instrument lookup error:",
        existingInstrumentError
      );

      errorRedirect(
        "Das Wertpapier konnte nicht geprüft werden."
      );
    }

    if (
      existingInstrument?.id
    ) {
      instrumentId =
        String(
          existingInstrument.id
        );
    }
  }

  /*
   * 2. Falls keine ISIN gefunden:
   * Suche über Ticker + Asset-Typ
   */
  if (
    !instrumentId &&
    symbol
  ) {
    const {
      data:
        symbolMatches,
      error:
        symbolLookupError,
    } = await supabase
      .from("instruments")
      .select("id")
      .eq(
        "symbol",
        symbol
      )
      .eq(
        "asset_type",
        assetType
      )
      .limit(1);

    if (
      symbolLookupError
    ) {
      console.error(
        "Symbol lookup error:",
        symbolLookupError
      );

      errorRedirect(
        "Das Wertpapier konnte nicht geprüft werden."
      );
    }

    const firstMatch =
      symbolMatches?.[0];

    if (
      firstMatch?.id
    ) {
      instrumentId =
        String(
          firstMatch.id
        );
    }
  }

  /*
   * 3. Falls noch kein Instrument existiert:
   * neues Instrument anlegen
   */
  if (!instrumentId) {
    const {
      data:
        createdInstrument,
      error:
        instrumentError,
    } = await supabase
      .from("instruments")
      .insert({
        name,
        symbol,
        isin,
        asset_type:
          assetType,
        currency,
      })
      .select("id")
      .single();

    if (
      instrumentError
    ) {
      console.error(
        "Create instrument error:",
        instrumentError
      );

      if (
        instrumentError.code ===
        "23505"
      ) {
        errorRedirect(
          "Dieses Wertpapier existiert bereits. Bitte prüfe insbesondere die ISIN."
        );
      }

      errorRedirect(
        `Das Wertpapier konnte nicht angelegt werden: ${instrumentError.message}`
      );
    }

    if (
      !createdInstrument ||
      !createdInstrument.id
    ) {
      errorRedirect(
        "Das Wertpapier wurde angelegt, aber es konnte keine Instrument-ID ermittelt werden."
      );
    }

    const typedInstrument =
      createdInstrument as InstrumentIdRow;

    instrumentId =
      typedInstrument.id;
  }

  /*
   * TypeScript-Sicherheitscheck.
   */
  if (!instrumentId) {
    errorRedirect(
      "Es konnte keine Instrument-ID ermittelt werden."
    );
  }

  /*
   * Position anlegen
   */
  const {
    error:
      positionError,
  } = await supabase
    .from("positions")
    .insert({
      portfolio_id:
        portfolioId,
      instrument_id:
        instrumentId,
      quantity,
      average_cost:
        averageCost,
      cost_currency:
        currency,
    });

  if (
    positionError
  ) {
    console.error(
      "Create position error:",
      positionError
    );

    if (
      positionError.code ===
      "23505"
    ) {
      errorRedirect(
        "Dieses Wertpapier befindet sich bereits in diesem Depot."
      );
    }

    errorRedirect(
      `Die Position konnte nicht gespeichert werden: ${positionError.message}`
    );
  }

  revalidatePath("/");
  revalidatePath(
    "/positions"
  );
  revalidatePath(
    "/depots"
  );

  redirect(
    `/positions?success=${encodeURIComponent(
      `${name} wurde erfolgreich hinzugefügt.`
    )}`
  );
}

export async function deletePosition(
  formData: FormData
) {
  const positionId =
    cleanText(
      formData.get(
        "positionId"
      )
    );

  if (!positionId) {
    errorRedirect(
      "Die Position wurde nicht gefunden."
    );
  }

  const {
    supabase,
  } =
    await getAuthenticatedUser();

  const {
    error,
  } = await supabase
    .from("positions")
    .delete()
    .eq(
      "id",
      positionId
    );

  if (error) {
    console.error(
      "Delete position error:",
      error
    );

    errorRedirect(
      `Die Position konnte nicht gelöscht werden: ${error.message}`
    );
  }

  revalidatePath("/");
  revalidatePath(
    "/positions"
  );

  redirect(
    `/positions?success=${encodeURIComponent(
      "Position wurde gelöscht."
    )}`
  );
}