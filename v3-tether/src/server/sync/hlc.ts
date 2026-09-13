import "server-only";

/**
 * Hybrid Logical Clock (08_sync/00_oplog_and_clock.md): physical time plus a
 * logical counter, giving a total, monotonic order across events from
 * different devices even when their wall clocks disagree. Chosen over
 * vector clocks because last-write-wins needs "which write is last," a
 * total order, not "which writes are concurrent" -- a question this design
 * doesn't ask (ADR-0007).
 */
export interface HlcState {
  physicalMs: number;
  counter: number;
}

// Fixed-width, zero-padded fields so plain string comparison (`order by
// hlc_timestamp`) is a correct total order without decoding first.
// PHYSICAL_DIGITS = 15 covers physicalMs up to year ~5138 -- comfortably
// beyond needing to ever revisit this format.
const PHYSICAL_DIGITS = 15;
const COUNTER_DIGITS = 6;
const MAX_COUNTER = 10 ** COUNTER_DIGITS - 1;

const padToWidth = (value: number, width: number, label: string): string => {
  const digits = Math.trunc(value).toString();
  if (digits.length > width) {
    throw new RangeError(
      `HLC ${label} ${value} exceeds its reserved ${width}-digit width -- ` +
        "the sortable-string encoding is no longer a valid total order."
    );
  }
  return digits.padStart(width, "0");
};

/**
 * Encodes an HLC state plus the device that produced it into the sortable
 * string stored in oplog.hlc_timestamp. No delimiter between fields --
 * device ids (generated UUIDs) contain hyphens, so a delimited format would
 * make splitting ambiguous. Fixed-width prefixes make slicing unambiguous
 * instead.
 */
export const encodeHlc = (state: HlcState, deviceId: string): string =>
  padToWidth(state.physicalMs, PHYSICAL_DIGITS, "physicalMs") +
  padToWidth(state.counter, COUNTER_DIGITS, "counter") +
  deviceId;

export interface DecodedHlc extends HlcState {
  deviceId: string;
}

export const decodeHlc = (encoded: string): DecodedHlc => {
  if (encoded.length < PHYSICAL_DIGITS + COUNTER_DIGITS) {
    throw new RangeError(`Malformed HLC timestamp: ${encoded}`);
  }
  return {
    counter: Number.parseInt(
      encoded.slice(PHYSICAL_DIGITS, PHYSICAL_DIGITS + COUNTER_DIGITS),
      10
    ),
    deviceId: encoded.slice(PHYSICAL_DIGITS + COUNTER_DIGITS),
    physicalMs: Number.parseInt(encoded.slice(0, PHYSICAL_DIGITS), 10),
  };
};

/**
 * Advances the clock for a purely local event: physical time moves forward
 * to at least `now`, and the counter increments only when physical time
 * hasn't actually advanced past the previous tick (the standard HLC local
 * rule) -- otherwise two events in the same millisecond would encode to the
 * same timestamp and conflict resolution would have no real ordering
 * between them.
 */
export const tickLocal = (state: HlcState, now: number): HlcState => {
  const physicalMs = Math.max(state.physicalMs, now);
  const counter = physicalMs === state.physicalMs ? state.counter + 1 : 0;
  if (counter > MAX_COUNTER) {
    throw new RangeError(
      `HLC counter overflow at physicalMs=${physicalMs} -- more than ` +
        `${MAX_COUNTER + 1} local events in the same millisecond tick.`
    );
  }
  return { counter, physicalMs };
};

/**
 * Merges in an event's HLC observed from a remote device during sync
 * (08_sync/01_transport_and_pairing.md): physical time moves forward to the
 * max of local time, the remote event's time, and wall-clock now; the
 * counter increments from whichever of local/remote produced that max
 * physical time (the standard HLC receive rule), keeping this device's
 * clock loosely synchronized with every remote event it observes without
 * ever moving backward.
 */
export const mergeRemote = (
  local: HlcState,
  remote: HlcState,
  now: number
): HlcState => {
  const physicalMs = Math.max(local.physicalMs, remote.physicalMs, now);
  let counter: number;
  if (physicalMs === local.physicalMs && physicalMs === remote.physicalMs) {
    counter = Math.max(local.counter, remote.counter) + 1;
  } else if (physicalMs === local.physicalMs) {
    counter = local.counter + 1;
  } else if (physicalMs === remote.physicalMs) {
    counter = remote.counter + 1;
  } else {
    counter = 0;
  }
  if (counter > MAX_COUNTER) {
    throw new RangeError(
      `HLC counter overflow merging remote event at physicalMs=${physicalMs}.`
    );
  }
  return { counter, physicalMs };
};
