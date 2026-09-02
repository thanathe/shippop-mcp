/** SHIPPOP error codes as documented in the "Error Code" section of the API docs. */
export const ERROR_CODES: Record<string, string> = {
  SERVICE_MAINTENANCE: "SHIPPOP service is under maintenance",
  ERR_MAINTENANCE: "SHIPPOP system is under maintenance",
  ERR_ORIGIN: "Invalid origin area (sender address)",
  ERR_DEST: "Invalid destination area (receiver address)",
  ERR_DEFAULT: "Courier returned a generic error (no further detail)",
  ERR_REALTIME_CHECKPRICE: "Courier could not calculate a price in real time",
  ERR_REVERSE_GEOCODE_FAILURE: "Reverse geocode failed (lat/lng could not be resolved)",
  ERR_COD_AMOUNT_EXCEED: "COD amount exceeds the courier's limit",
  ERR_NOT_SUPPORT_COD: "This courier does not support COD",
  NOT_SUPPORT_COD: "This courier service does not support COD",
  INVALID_WEIGHT: "Invalid weight",
  ERR_OVER_WEIGHT: "Parcel is over the courier's weight limit",
  ERR_MIN_ORDER_10: "Courier requires a minimum of 10 shipments per booking",
  ERR_OUT_OF_AREA: "Service unavailable in this area",
  ERR_SIZE: "Invalid parcel size",
  ERR_OVER_SIZE: "Parcel is over the courier's size limit",
  DAY_OFF: "Courier holiday — no service today",
  ERR_POSTCODE: "This postcode is not served",
  ERR_LAT_LNG: "Invalid lat/lng",
};

/** Human-readable meaning of a SHIPPOP error code, handling the parameterised ERR_MIN_ORDER_{x} / ERR_SIZE_{x} forms. */
export function describeErrorCode(code: string | undefined | null): string | undefined {
  if (!code) return undefined;
  if (ERROR_CODES[code]) return ERROR_CODES[code];
  let m = /^ERR_MIN_ORDER_(\d+)$/.exec(code);
  if (m) return `Courier requires a minimum of ${m[1]} shipments per booking`;
  m = /^ERR_SIZE_(\d+)$/.exec(code);
  if (m) return `Parcel size (width + length + height) must not exceed ${m[1]} cm`;
  return undefined;
}

/** Shipment status values returned by /tracking/ and the webhook. */
export const ORDER_STATUS: Record<string, string> = {
  wait: "Waiting for confirm (unpaid)",
  booking: "Confirmed (paid), courier has the booking",
  invalid: "Shipment has an error",
  shipping: "In transit",
  package_detail: "Courier updated real weight/size and surcharges",
  problem: "Shipment has a problem",
  complete: "Delivered",
  return: "Returning to sender",
  cancel: "Cancelled",
  return_shipping: "Returned shipment in transit",
  return_problem: "Returned shipment has a problem",
  return_complete: "Returned shipment delivered back to sender",
  return_return: "Returned shipment returned again",
  return_close: "Returned shipment closed",
  pending_transfer: "COD collected, transfer pending",
  transferred: "COD transferred",
  rider_accept: "On-demand rider accepted the job",
};
