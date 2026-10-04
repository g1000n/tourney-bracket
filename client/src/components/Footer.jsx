import { Link } from "react-router-dom";
import styles from "./Footer.module.css";

export default function Footer() {
  const isAdmin = sessionStorage.getItem("isAdmin") === "true";
  return (
    <footer className={styles.footer}>
      <hr />
      <p>TourneyBracket — a 6APSI final project</p>
      {!isAdmin && (
        <p>
          <Link to="/admin/login">Admin login</Link>
        </p>
      )}
    </footer>
  );
}
