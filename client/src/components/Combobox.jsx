import { useId, useState } from "react";
import styles from "./Combobox.module.css";

// A text field with a searchable dropdown of earlier choices. Typing filters
// the list; you can pick an entry or keep typing something new.
//
//   options: [{ value, meta? }]   meta = small grey text on the right
//   newLabel: (text) => string    label for the "add something new" row
export default function Combobox({ value, onChange, options, placeholder, ariaLabel, id, newLabel, maxShown = 8 }) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const query = value.trim().toLowerCase();
  const matches = options.filter((o) => o.value.toLowerCase().includes(query)).slice(0, maxShown);
  const exact = options.some((o) => o.value.toLowerCase() === query);
  const rows = [...matches.map((o) => ({ ...o, kind: "option" }))];
  if (newLabel && query && !exact) rows.push({ value: value.trim(), meta: "", kind: "new" });
  const showList = open && rows.length > 0;

  function choose(row) {
    onChange(row.value);
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, rows.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && showList && active >= 0) {
      e.preventDefault();
      choose(rows[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <input
        id={id}
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      {showList && (
        <ul id={listId} role="listbox" className={styles.list}>
          {rows.map((row, i) => (
            <li
              key={`${row.kind}-${row.value}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={`${styles.option} ${i === active ? styles.active : ""} ${row.kind === "new" ? styles.addNew : ""}`}
              // mousedown, not click: picking must happen before the input
              // loses focus and closes the list.
              onMouseDown={(e) => {
                e.preventDefault();
                choose(row);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span>{row.kind === "new" ? newLabel(row.value) : row.value}</span>
              {row.meta && <span className={styles.meta}>{row.meta}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
