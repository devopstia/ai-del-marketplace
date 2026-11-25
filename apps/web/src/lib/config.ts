/** Browser-facing API base (the API sets cookies on 127.0.0.1, shared with the web app across ports). */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:4000/api").replace(/\/$/, "");
/** Server-side base: inside Docker the web container reaches the API by service name. */
export const SERVER_API_URL = (process.env.API_INTERNAL_URL || API_URL).replace(/\/$/, "");
