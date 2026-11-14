import {
  RECORDS_KEY,
  addWin,
  breakCleanRun,
  readRecords,
  type Records,
  type WinFacts,
} from "../utils/records";
import { readJSON, writeJSON } from "../utils/safeJson";

/** Personal records (rules in utils/records.ts). */
export function useRecords() {
  const get = (): Records => readRecords(readJSON<unknown>(RECORDS_KEY, null));
  const recordWin = (win: WinFacts) => writeJSON(RECORDS_KEY, addWin(get(), win));
  function recordMistake() {
    const rec = get();
    if (rec.cleanRun) writeJSON(RECORDS_KEY, breakCleanRun(rec));
  }
  return { get, recordWin, recordMistake };
}
