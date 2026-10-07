import styles from "./Footer.module.css";

// The admin login isn't linked from the site; the admin opens /admin/login
// directly (the New tournament page also sends you there).
export default function Footer() {
  return (
    <footer className={styles.footer}>
      <hr />
      <p>TourneyBracket — brackets, live scores and stats for casual tournaments</p>
    </footer>
  );
}
