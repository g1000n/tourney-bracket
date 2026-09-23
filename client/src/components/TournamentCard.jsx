import styles from "./TournamentCard.module.css";

export default function TournamentCard({ name, date, status, teamCount, onClick }) {
  const isComplete = status === "complete";
  return (
    <button
      className={`${styles.card} ${isComplete ? styles.complete : ""}`}
      onClick={onClick}
    >
      <p className={styles.name}>{name}</p>
      <p className={styles.date}>{date}</p>
      <div className={styles.meta}>
        <span className={isComplete ? styles.pillComplete : styles.pill}>
          {isComplete ? "Complete" : "In progress"}
        </span>
        <span>{teamCount} players</span>
      </div>
    </button>
  );
}