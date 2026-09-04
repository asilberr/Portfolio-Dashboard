"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

function readableError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "E-Mail-Adresse oder Passwort sind nicht korrekt.";
  }

  if (normalized.includes("email not confirmed")) {
    return "Bitte bestätige zuerst deine E-Mail-Adresse.";
  }

  if (normalized.includes("user already registered")) {
    return "Für diese E-Mail-Adresse existiert bereits ein Konto.";
  }

  if (normalized.includes("password should be at least")) {
    return "Das Passwort ist zu kurz.";
  }

  if (normalized.includes("signup is disabled")) {
    return "Die Registrierung ist aktuell in Supabase deaktiviert.";
  }

  if (normalized.includes("rate limit")) {
    return "Zu viele Versuche in kurzer Zeit. Bitte versuche es später erneut.";
  }

  if (normalized.includes("invalid path")) {
    return "Die Weiterleitungs-URL ist in Supabase noch nicht korrekt konfiguriert.";
  }

  return message;
}

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect(
      `/login?mode=login&error=${encodeURIComponent(
        "Bitte E-Mail-Adresse und Passwort eingeben."
      )}`
    );
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(
      `/login?mode=login&error=${encodeURIComponent(
        readableError(error.message)
      )}`
    );
  }

  redirect("/");
}

export async function register(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const passwordRepeat = String(
    formData.get("passwordRepeat") ?? ""
  );

  if (!email) {
    redirect(
      `/login?mode=register&error=${encodeURIComponent(
        "Bitte gib deine E-Mail-Adresse ein."
      )}`
    );
  }

  if (password.length < 6) {
    redirect(
      `/login?mode=register&error=${encodeURIComponent(
        "Das Passwort muss mindestens 6 Zeichen lang sein."
      )}`
    );
  }

  if (password !== passwordRepeat) {
    redirect(
      `/login?mode=register&error=${encodeURIComponent(
        "Die beiden Passwörter stimmen nicht überein."
      )}`
    );
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    redirect(
      `/login?mode=register&error=${encodeURIComponent(
        readableError(error.message)
      )}`
    );
  }

  /*
   * Wenn "Confirm email" in Supabase deaktiviert ist,
   * erhalten wir direkt eine Session.
   */
  if (data.session) {
    redirect("/");
  }

  /*
   * Wenn "Confirm email" aktiviert ist,
   * wurde das Konto erstellt, aber der User muss
   * zunächst die E-Mail-Adresse bestätigen.
   */
  if (data.user) {
    redirect(
      `/login?mode=login&message=${encodeURIComponent(
        "Konto erfolgreich erstellt. Bitte prüfe dein E-Mail-Postfach und bestätige deine Adresse. Danach kannst du dich anmelden."
      )}`
    );
  }

  redirect(
    `/login?mode=register&error=${encodeURIComponent(
      "Die Registrierung konnte nicht abgeschlossen werden."
    )}`
  );
}