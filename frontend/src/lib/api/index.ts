// Re-export all API modules from their themed files
export { userApi } from "./user";
export { interactionApi } from "./interactions";
export { albumsApi } from "./albums";
export { adminAlbumsApi } from "./admin-albums";
export { mediaApi } from "./media";
export { contentApi } from "./content";

// Build-time validation only
if (typeof process.env.NEXT_PUBLIC_API_URL === "undefined") {
  console.error("Warning: NEXT_PUBLIC_API_URL is not set");
}

// Export with fallback or non-null assertion
const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.pornspot.ai";

export default API_URL;
