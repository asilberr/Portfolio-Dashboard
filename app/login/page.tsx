import Link from "next/link";

import { login, register } from "./actions";
import styles from "./login.module.css";

type LoginPageProps = {
  searchParams: Promise<{
    mode?: string;
    error?: string;
    message?: string;
  }>;
};

export default async function LoginPage({
  searchParams,
}: LoginPageProps) {
  const params = await searchParams;

  const mode =
    params.mode === "register" ? "register" : "login";

  const error = params.error;
  const message = params.message;

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <section className={styles.hero}>
          <div>
            <div className={styles.logo}>
              <div className={styles.logoMark}>D</div>
              <span>DepotCockpit</span>
            </div>

            <div className={styles.heroContent}>
              <div className={styles.eyebrow}>
                PORTFOLIO DASHBOARD
              </div>

              <h1>
                Deine Investments.
                <br />
                Endlich an einem Ort.
              </h1>

              <p>
                Führe deine Depots bankübergreifend zusammen,
                analysiere dein Portfolio und erhalte regelmäßig
                einen kompakten Überblick über Chancen und Risiken.
              </p>
            </div>
          </div>

          <div className={styles.features}>
            <Feature
              number="01"
              title="Alle Depots"
              text="Aktien, ETFs und Fonds über mehrere Banken hinweg."
            />

            <Feature
              number="02"
              title="Klare Performance"
              text="Gesamtwert, Wertentwicklung sowie Tops und Flops."
            />

            <Feature
              number="03"
              title="Portfolio Review"
              text="Automatisierte Wochenreports und später KI-Analysen."
            />
          </div>
        </section>

        <section className={styles.authPanel}>
          <div className={styles.authContent}>
            <div className={styles.mobileLogo}>
              MyPortfolio
            </div>

            <div className={styles.heading}>
              <h2>
                {mode === "login"
                  ? "Willkommen zurück"
                  : "Konto erstellen"}
              </h2>

              <p>
                {mode === "login"
                  ? "Melde dich an, um dein Portfolio zu öffnen."
                  : "Erstelle deinen persönlichen Zugang zum DepotCockpit."}
              </p>
            </div>

            <div className={styles.modeSwitcher}>
              <Link
                href="/login?mode=login"
                className={
                  mode === "login"
                    ? styles.modeActive
                    : styles.modeButton
                }
              >
                Anmelden
              </Link>

              <Link
                href="/login?mode=register"
                className={
                  mode === "register"
                    ? styles.modeActive
                    : styles.modeButton
                }
              >
                Konto erstellen
              </Link>
            </div>

            {error && (
              <div className={styles.errorMessage}>
                {error}
              </div>
            )}

            {message && (
              <div className={styles.successMessage}>
                {message}
              </div>
            )}

            {mode === "login" ? (
              <form
                action={login}
                className={styles.form}
              >
                <div className={styles.fields}>
                  <div className={styles.field}>
                    <label htmlFor="login-email">
                      E-Mail-Adresse
                    </label>

                    <input
                      id="login-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      placeholder="name@beispiel.de"
                    />
                  </div>

                  <div className={styles.field}>
                    <label htmlFor="login-password">
                      Passwort
                    </label>

                    <input
                      id="login-password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      placeholder="Dein Passwort"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className={styles.primaryButton}
                >
                  Anmelden
                </button>
              </form>
            ) : (
              <form
                action={register}
                className={styles.form}
              >
                <div className={styles.fields}>
                  <div className={styles.field}>
                    <label htmlFor="register-email">
                      E-Mail-Adresse
                    </label>

                    <input
                      id="register-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      placeholder="name@beispiel.de"
                    />
                  </div>

                  <div className={styles.field}>
                    <label htmlFor="register-password">
                      Passwort
                    </label>

                    <input
                      id="register-password"
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={6}
                      placeholder="Mindestens 6 Zeichen"
                    />
                  </div>

                  <div className={styles.field}>
                    <label htmlFor="register-password-repeat">
                      Passwort wiederholen
                    </label>

                    <input
                      id="register-password-repeat"
                      name="passwordRepeat"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={6}
                      placeholder="Passwort erneut eingeben"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className={styles.primaryButton}
                >
                  Konto erstellen
                </button>
              </form>
            )}

            <div className={styles.securityNote}>
              <div className={styles.securityIcon}>
                ✓
              </div>

              <div>
                <strong>
                  Deine Daten bleiben getrennt
                </strong>

                <span>
                  Jedes Benutzerkonto sieht ausschließlich
                  die eigenen Depotdaten.
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Feature({
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <div className={styles.feature}>
      <span>{number}</span>

      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
    </div>
  );
}