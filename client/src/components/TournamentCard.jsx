import styles from "./TournamentCard.module.css";

// A tile for one tournament. The coloured band names the format:
// blue = single elimination, red = double elimination, yellow = round robin.
// `onDelete` is only passed for admins; it adds a Delete button.
export default function TournamentCard({ name, date, status, format, formatKey, teamCount, onClick, onDelete }) {
  const isComplete = status === "complete";
  return (
    <div className={styles.wrap}>
      <button className={styles.card} onClick={onClick}>
        <span className={`${styles.band} ${styles[formatKey] || ""}`}>{format}</span>
        <span className={styles.body}>
          <span className={styles.name}>{name}</span>
          <span className={styles.date}>{date}</span>
          <span className={styles.meta}>
            <span className={isComplete ? styles.pillComplete : styles.pill}>
              {isComplete ? "Complete" : "In progress"}
            </span>
            <span>{teamCount} players</span>
          </span>
        </span>
      </button>
      {onDelete && (
        <button type="button" className={styles.deleteBtn} aria-label={`Delete ${name}`} onClick={onDelete}>
          Delete
        </button>
      )}
    </div>
  );
}
