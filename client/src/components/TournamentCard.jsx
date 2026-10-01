import styles from "./TournamentCard.module.css";

// `onDelete` is only passed for admins; it adds a Delete button.
export default function TournamentCard({ name, date, status, format, teamCount, onClick, onDelete }) {
  const isComplete = status === "complete";
  return (
    <div className={styles.wrap}>
      <button className={`${styles.card} ${isComplete ? styles.complete : ""}`} onClick={onClick}>
        <p className={styles.name}>{name}</p>
        <p className={styles.date}>
          {date}
          {format && ` · ${format}`}
        </p>
        <div className={styles.meta}>
          <span className={isComplete ? styles.pillComplete : styles.pill}>
            {isComplete ? "Complete" : "In progress"}
          </span>
          <span>{teamCount} players</span>
        </div>
      </button>
      {onDelete && (
        <button type="button" className={styles.deleteBtn} aria-label={`Delete ${name}`} onClick={onDelete}>
          Delete
        </button>
      )}
    </div>
  );
}
