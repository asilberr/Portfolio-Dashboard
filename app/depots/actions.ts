"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

async function getAuthenticatedUserId() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) {
    redirect("/login");
  }

  return {
    supabase,
    userId: data.claims.sub,
  };
}

export async function createPortfolio(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const bankName = String(formData.get("bankName") ?? "").trim();

  if (!name) {
    redirect(
      `/depots?error=${encodeURIComponent(
        "Bitte gib einen Namen für das Depot ein."
      )}`
    );
  }

  const { supabase, userId } =
    await getAuthenticatedUserId();

  const { error } = await supabase
    .from("portfolios")
    .insert({
      user_id: userId,
      name,
      bank_name: bankName || null,
    });

  if (error) {
    console.error("Create portfolio error:", error);

    redirect(
      `/depots?error=${encodeURIComponent(
        "Das Depot konnte nicht gespeichert werden: " +
          error.message
      )}`
    );
  }

  revalidatePath("/");
  revalidatePath("/depots");

  redirect(
    `/depots?success=${encodeURIComponent(
      "Depot erfolgreich angelegt."
    )}`
  );
}

export async function deletePortfolio(
  formData: FormData
) {
  const portfolioId = String(
    formData.get("portfolioId") ?? ""
  ).trim();

  if (!portfolioId) {
    redirect(
      `/depots?error=${encodeURIComponent(
        "Das Depot konnte nicht gefunden werden."
      )}`
    );
  }

  const { supabase, userId } =
    await getAuthenticatedUserId();

  const { error } = await supabase
    .from("portfolios")
    .delete()
    .eq("id", portfolioId)
    .eq("user_id", userId);

  if (error) {
    console.error("Delete portfolio error:", error);

    redirect(
      `/depots?error=${encodeURIComponent(
        "Das Depot konnte nicht gelöscht werden: " +
          error.message
      )}`
    );
  }

  revalidatePath("/");
  revalidatePath("/depots");

  redirect(
    `/depots?success=${encodeURIComponent(
      "Depot wurde gelöscht."
    )}`
  );
}