import { ParameterStoreService } from "./parameters";

export class RevalidationService {
  /**
   * Trigger revalidation for specific tags
   * @param tags Array of tags to revalidate (e.g., ['albums', 'media'])
   */
  static async revalidate(tags: string[]): Promise<void> {
    if (!tags || tags.length === 0) {
      console.log("No revalidation tags provided, skipping revalidation");
      return;
    }

    try {
      console.log("Fetching revalidation parameters...");

      const [frontendUrl, revalidateSecret] = await Promise.all([
        ParameterStoreService.getFrontendUrl(),
        ParameterStoreService.getRevalidateSecret(),
      ]);

      // In local development with Docker, we need to use host.docker.internal
      // to access the host machine from inside the container
      const isLocal =
        process.env["AWS_SAM_LOCAL"] === "true" ||
        process.env["ENVIRONMENT"] === "local";
      let adjustedFrontendUrl = frontendUrl;

      if (isLocal && frontendUrl.includes("localhost")) {
        adjustedFrontendUrl = frontendUrl.replace(
          "localhost",
          "host.docker.internal"
        );
        console.log(
          `Local development detected: Adjusted frontend URL from ${frontendUrl} to ${adjustedFrontendUrl}`
        );
      }

      // Trigger revalidation for each tag
      const revalidationPromises = tags.map(async (tag) => {
        const revalidateUrl = `${adjustedFrontendUrl}/api/revalidate?secret=${revalidateSecret}&tag=${tag}`;
        console.log(
          "Triggering revalidation for tag:",
          tag,
          "URL:",
          revalidateUrl.replace(revalidateSecret, "***")
        );

        try {
          const revalidateResponse = await fetch(revalidateUrl, {
            method: "POST",
          });

          if (!revalidateResponse.ok) {
            const errorText = await revalidateResponse.text();
            console.error(`Revalidation failed for tag ${tag}:`, {
              status: revalidateResponse.status,
              statusText: revalidateResponse.statusText,
              body: errorText,
            });
          } else {
            const result = await revalidateResponse.json();
            console.log(`Revalidation successful for tag ${tag}:`, result);
          }
        } catch (error) {
          console.error(`Error during revalidation for tag ${tag}:`, error);
        }
      });

      await Promise.all(revalidationPromises);
    } catch (revalidateError) {
      console.error("Error triggering revalidation:", revalidateError);
      // Do not block the response for revalidation failure
    }
  }

  /**
   * Trigger revalidation for albums
   */
  static async revalidateAlbums(): Promise<void> {
    await this.revalidate(["albums"]);
  }

  /**
   * Trigger revalidation for a specific album
   * @param albumId The album ID to revalidate
   */
  static async revalidateAlbum(albumId: string): Promise<void> {
    await this.revalidate(["albums", `album-${albumId}`]);
    await this.revalidatePathAllLocales(`/albums/${albumId}`);
  }

  /**
   * Trigger revalidation for a specific media page
   * @param mediaId The media ID to revalidate
   */
  static async revalidateMedia(mediaId: string): Promise<void> {
    await this.revalidate(["medias", `media-${mediaId}`]);
    await this.revalidatePathAllLocales(`/media/${mediaId}`);
  }

  /**
   * Trigger revalidation for specific paths
   * @param paths Array of paths to revalidate (e.g., ['/en/albums', '/fr/media/123'])
   */
  static async revalidateByPath(paths: string[]): Promise<void> {
    if (!paths || paths.length === 0) {
      console.log("No revalidation paths provided, skipping revalidation");
      return;
    }

    try {
      console.log("Fetching revalidation parameters...");

      const [frontendUrl, revalidateSecret] = await Promise.all([
        ParameterStoreService.getFrontendUrl(),
        ParameterStoreService.getRevalidateSecret(),
      ]);

      // In local development with Docker, we need to use host.docker.internal
      // to access the host machine from inside the container
      const isLocal =
        process.env["AWS_SAM_LOCAL"] === "true" ||
        process.env["ENVIRONMENT"] === "local";
      let adjustedFrontendUrl = frontendUrl;

      if (isLocal && frontendUrl.includes("localhost")) {
        adjustedFrontendUrl = frontendUrl.replace(
          "localhost",
          "host.docker.internal"
        );
        console.log(
          `Local development detected: Adjusted frontend URL from ${frontendUrl} to ${adjustedFrontendUrl}`
        );
      }

      // Trigger revalidation for each path
      const revalidationPromises = paths.map(async (path) => {
        const revalidateUrl = `${adjustedFrontendUrl}/api/revalidate?secret=${revalidateSecret}&path=${encodeURIComponent(
          path
        )}&type=path`;
        console.log(
          "Triggering revalidation for path:",
          path,
          "URL:",
          revalidateUrl.replace(revalidateSecret, "***")
        );

        try {
          const revalidateResponse = await fetch(revalidateUrl, {
            method: "POST",
          });

          if (!revalidateResponse.ok) {
            const errorText = await revalidateResponse.text();
            console.error(`Revalidation failed for path ${path}:`, {
              status: revalidateResponse.status,
              statusText: revalidateResponse.statusText,
              body: errorText,
            });
          } else {
            const result = await revalidateResponse.json();
            console.log(`Revalidation successful for path ${path}:`, result);
          }
        } catch (error) {
          console.error(`Error during revalidation for path ${path}:`, error);
        }
      });

      await Promise.all(revalidationPromises);
    } catch (revalidateError) {
      console.error("Error triggering revalidation:", revalidateError);
      // Do not block the response for revalidation failure
    }
  }

  /**
   * Trigger revalidation for a specific path
   * @param path The path to revalidate (e.g., '/en/albums/123')
   */
  static async revalidatePath(path: string): Promise<void> {
    await this.revalidateByPath([path]);
  }

  /**
   * Trigger revalidation for a specific resource across all locales
   * @param resourcePath The resource path without locale (e.g., '/albums/123')
   * @param locales Array of locales to revalidate for (defaults to ['en', 'fr'])
   */
  static async revalidatePathAllLocales(
    resourcePath: string,
    locales: string[] = ["de", "en", "es", "fr", "ru", "zh"]
  ): Promise<void> {
    const paths = locales.map((locale) => `/${locale}${resourcePath}`);
    await this.revalidateByPath(paths);
  }
}
