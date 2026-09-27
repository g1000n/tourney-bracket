import { useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./AdminLoginPage.module.css";

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleLogin(e) {
    e.preventDefault();
    setError("");

// temporary admin login
    if (username === "admin" && password === "123") {
      navigate("/");
      return;
    }
    setError("incorrect username or password.");
  }

  return (
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
        <button type="submit">Log in</button>
      </form>
    </main>
  );
}