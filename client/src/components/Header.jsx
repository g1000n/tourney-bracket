// client/src/components/Header.jsx
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useTournaments } from "../context/TournamentsContext";
import { USING_MOCK_API } from "../api";
import logoIcon from "../assets/logo-icon.svg";
import styles from "./Header.module.css";

// The nav bar: the braces icon on the left, then the main links as chunky
// coloured buttons. Admin-only links appear after logging in.
export default function Header() {
  const navigate = useNavigate();
  const { loadError, reload, logout } = useTournaments();
  const isAdmin = sessionStorage.getItem("isAdmin") === "true";
  const linkClass = (colour) => ({ isActive }) =>
    `${styles.navLink} ${styles[colour]} ${isActive ? styles.active : ""}`;

  return (
    <>
      <header className={styles.header}>
        <Link to="/" className={styles.brand} aria-label="TourneyBracket home">
          <img src={logoIcon} alt="" className={styles.icon} />
        </Link>
        <nav className={styles.nav} aria-label="Main">
          <NavLink to="/" end className={linkClass("green")}>
            Tournaments
          </NavLink>
          <NavLink to="/stats" className={linkClass("blue")}>
            Stats
          </NavLink>
          {isAdmin && (
            <NavLink to="/setup" className={linkClass("yellow")}>
              New tournament
            </NavLink>
          )}
          {isAdmin && (
            <button
              type="button"
              className={styles.logout}
              onClick={() => {
                logout();
                navigate("/");
              }}
            >
              Log out
            </button>
          )}
        </nav>
        {USING_MOCK_API && <span className={styles.demo}>Demo mode · data stays in this browser</span>}
      </header>
      {loadError && (
        <div className={styles.error} role="alert">
          <span>Couldn't load data: {loadError}</span>
          <button type="button" onClick={reload}>
            Try again
          </button>
        </div>
      )}
    </>
  );
}
