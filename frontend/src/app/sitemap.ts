import { MetadataRoute } from "next";
import { fetchAllPublicAlbums } from "@/lib/data";
import { locales } from "@/i18n";

// Enable ISR for sitemap - static generation with revalidation
export const revalidate = 86400; // Revalidate every 24 hours (1 day)
export const dynamic = "force-static"; // Force static generation at build time

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env["NEXT_PUBLIC_SITE_URL"] || "https://pornspot.ai";

  // Define static routes that should be included in the sitemap (excluding admin and auth routes)
  const staticRoutes = [
    {
      path: "",
      priority: 1.0,
      changeFrequency: "weekly" as const,
    },
    {
      path: "/pricing",
      priority: 0.8,
      changeFrequency: "monthly" as const,
    },
    {
      path: "/generate",
      priority: 0.9,
      changeFrequency: "monthly" as const,
    },
    {
      path: "/our-friends",
      priority: 0.7,
      changeFrequency: "weekly" as const,
    },
    {
      path: "/terms",
      priority: 0.6,
      changeFrequency: "yearly" as const,
    },
    {
      path: "/privacy",
      priority: 0.6,
      changeFrequency: "yearly" as const,
    },
  ];

  // Generate locale-specific static routes
  const localeStaticRoutes: MetadataRoute.Sitemap = [];
  staticRoutes.forEach((route) => {
    locales.forEach((locale) => {
      localeStaticRoutes.push({
        url: `${baseUrl}/${locale}${route.path}`,
        lastModified: new Date(),
        changeFrequency: route.changeFrequency,
        priority: route.priority,
      });
    });
  });

  // Fetch all public albums to generate dynamic routes
  try {
    const albums = await fetchAllPublicAlbums();

    // Generate locale-specific album routes
    const albumRoutes: MetadataRoute.Sitemap = [];
    albums.forEach((album) => {
      locales.forEach((locale) => {
        albumRoutes.push({
          url: `${baseUrl}/${locale}/albums/${album.id}`,
          lastModified: album.updatedAt
            ? new Date(album.updatedAt)
            : new Date(),
          changeFrequency: "monthly" as const,
          priority: 0.6,
        });
      });
    });

    return [...localeStaticRoutes, ...albumRoutes];
  } catch (error) {
    console.error("Error fetching albums for sitemap:", error);
    // Return static routes only if album fetching fails
    return localeStaticRoutes;
  }
}
