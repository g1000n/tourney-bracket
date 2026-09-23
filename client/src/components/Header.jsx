// client/src/components/Header.jsx
import { Link } from "react-router-dom";
import styles from "./Header.module.css";

export default function Header() {
  return (
    <header className={styles.header}>
      <Link to="/" className={styles.wordmark}>TourneyBracket</Link>
    </header>
  );
}