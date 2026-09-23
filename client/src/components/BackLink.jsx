// client/src/components/BackLink.jsx
import { Link } from "react-router-dom";
import styles from "./BackLink.module.css";

export default function BackLink({ to = "/", children = "← Back to tournaments" }) {
  return <Link to={to} className={styles.backLink}>{children}</Link>;
}