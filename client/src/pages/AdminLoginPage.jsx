import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { useTournaments } from "../context/TournamentsContext";
import styles from "./AdminLoginPage.module.css";

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const { login } = useTournaments();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // The server checks the password against the admins table and returns a
  // signed token; the create/edit/delete routes require that token.
  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(username, password);
      navigate("/");
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <>
      <Header />
      <main className={styles.main}>
        <form className={styles.form} onSubmit={handleLogin}>
          <h1>Admin Login</h1>
          <div className={styles.field}>
            <label htmlFor="username">Username</label>
            <input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          {error && <p className={styles.error}>{error}</p>}
          <button type="submit" disabled={busy}>
            {busy ? "Logging in…" : "Log in"}
          </button>
        </form>
      </main>
      <Footer />
    </>
  );
}
