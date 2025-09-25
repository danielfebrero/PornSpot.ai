// Re-export all API modules from their themed files
export { userApi } from "./user";
export { interactionApi } from "./interactions";
export { albumsApi } from "./albums";
export { adminAlbumsApi } from "./admin-albums";
export { adminMediaApi } from "./admin-media";
export { adminUsersApi } from "./admin-users";
export { adminAnalyticsApi } from "./admin-analytics";
export { adminPSCApi } from "./admin-psc";
export { pscApi } from "./psc";
export { mediaApi } from "./media";
export { contentApi } from "./content";
export { discoverApi } from "./discover";
export { trustpayApi } from "./trustpay";
export { finbyApi } from "./finby";

// Export with fallback or non-null assertion
const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.pornspot.ai";

export default API_URL;
