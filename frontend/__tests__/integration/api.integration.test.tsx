import React from "react";
import { Album } from "@/types";
import { render, screen, waitFor, user } from "../utils/test-utils";
import { server } from "../mocks/server";
import { http, HttpResponse } from "msw";
import { resetMockData } from "../fixtures/data";

// Mock API client component for testing
const AlbumsList = () => {
  const [albums, setAlbums] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchAlbums = async () => {
      try {
        const response = await fetch("/api/albums");
        const data = await response.json();

        if (data.success) {
          setAlbums(data.data);
        } else {
          setError(data.error);
        }
      } catch (err) {
        setError("Failed to fetch albums");
      } finally {
        setLoading(false);
      }
    };

    fetchAlbums();
  }, []);

  if (loading) return <div data-testid="loading">Loading...</div>;
  if (error) return <div data-testid="error">{error}</div>;

  return (
    <div data-testid="albums-list">
      {albums.map((album: Album) => (
        <div key={album.id} data-testid={`album-${album.id}`}>
          <h3>{album.title}</h3>
          <div>
            {album.tags?.map((tag: string) => (
              <span key={tag} className="tag">
                {tag}
              </span>
            ))}
          </div>
          <span data-testid={`media-count-${album.id}`}>
            {album.mediaCount} items
          </span>
        </div>
      ))}
    </div>
  );
};

const CreateAlbumForm = () => {
  const [title, setTitle] = React.useState("");
  const [tags, setTags] = React.useState<string[]>([]);
  const [isPublic, setIsPublic] = React.useState(true);
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/albums", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, tags, isPublic }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage("Album created successfully!");
        setTitle("");
        setTags([]);
      } else {
        setMessage(data.error || "Failed to create album");
      }
    } catch (err) {
      setMessage("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} data-testid="create-album-form">
      <input
        data-testid="title-input"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Album title"
        required
      />
      <input
        data-testid="tags-input"
        value={tags.join(", ")}
        onChange={(e) => setTags(e.target.value.split(", ").filter(Boolean))}
        placeholder="Album tags (comma separated)"
      />
      <label>
        <input
          data-testid="public-checkbox"
          type="checkbox"
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
        />
        Public album
      </label>
      <button type="submit" disabled={loading} data-testid="submit-button">
        {loading ? "Creating..." : "Create Album"}
      </button>
      {message && <div data-testid="message">{message}</div>}
    </form>
  );
};

describe("API Integration Tests", () => {
  beforeEach(() => {
    resetMockData();
  });

  describe("Albums API", () => {
    it("fetches and displays albums successfully", async () => {
      render(<AlbumsList />);

      // Should show loading initially
      expect(screen.getByTestId("loading")).toBeInTheDocument();

      // Wait for albums to load
      await waitFor(() => {
        expect(screen.getByTestId("albums-list")).toBeInTheDocument();
      });

      // Should display all mock albums
      expect(screen.getByTestId("album-album-1")).toBeInTheDocument();
      expect(screen.getByTestId("album-album-2")).toBeInTheDocument();
      expect(screen.getByTestId("album-album-3")).toBeInTheDocument();
      expect(screen.getByTestId("album-album-4")).toBeInTheDocument();

      // Check album content
      expect(screen.getByText("Nature Photography")).toBeInTheDocument();
      expect(screen.getByText("Urban Exploration")).toBeInTheDocument();
      expect(screen.getByTestId("media-count-album-1")).toHaveTextContent(
        "12 items"
      );
    });

    it("handles API errors gracefully", async () => {
      // Override the handler to return an error
      server.use(
        http.get("/api/albums", ({ request: _request }) => {
          return HttpResponse.json(
            { success: false, error: "Server error" },
            { status: 500 }
          );
        })
      );

      render(<AlbumsList />);

      await waitFor(() => {
        expect(screen.getByTestId("error")).toBeInTheDocument();
      });

      expect(screen.getByText("Server error")).toBeInTheDocument();
    });

    it("handles network errors", async () => {
      // Override the handler to simulate network error
      server.use(
        http.get("*/api/albums", ({ request: _request }) => {
          return HttpResponse.error();
        })
      );

      render(<AlbumsList />);

      await waitFor(() => {
        expect(screen.getByTestId("error")).toBeInTheDocument();
      });

      expect(screen.getByText("Failed to fetch albums")).toBeInTheDocument();
    });

    it("creates a new album successfully", async () => {
      render(<CreateAlbumForm />);

      // Fill out the form
      await user.type(screen.getByTestId("title-input"), "Test Album");
      await user.type(screen.getByTestId("tags-input"), "test, album");

      // Submit the form
      await user.click(screen.getByTestId("submit-button"));

      // Should show loading state
      expect(screen.getByText("Creating...")).toBeInTheDocument();

      // Wait for success message
      await waitFor(() => {
        expect(screen.getByTestId("message")).toBeInTheDocument();
      });

      expect(
        screen.getByText("Album created successfully!")
      ).toBeInTheDocument();

      // Form should be reset
      expect(screen.getByTestId("title-input")).toHaveValue("");
      expect(screen.getByTestId("tags-input")).toHaveValue("");
    });

    it("handles form validation errors", async () => {
      render(<CreateAlbumForm />);

      // Try to submit without title
      await user.click(screen.getByTestId("submit-button"));

      // HTML5 validation should prevent submission
      const titleInput = screen.getByTestId("title-input");
      expect(titleInput).toBeInvalid();
    });

    it("handles API errors during creation", async () => {
      // Override the handler to return an error
      server.use(
        http.post("/api/albums", ({ request: _request }) => {
          return HttpResponse.json(
            { success: false, error: "Title already exists" },
            { status: 400 }
          );
        })
      );

      render(<CreateAlbumForm />);

      await user.type(screen.getByTestId("title-input"), "Duplicate Title");
      await user.click(screen.getByTestId("submit-button"));

      await waitFor(() => {
        expect(screen.getByTestId("message")).toBeInTheDocument();
      });

      expect(screen.getByText("Title already exists")).toBeInTheDocument();
    });

    it("filters public albums correctly", async () => {
      // Create a component that filters public albums
      const PublicAlbumsList = () => {
        const [albums, setAlbums] = React.useState([]);
        const [loading, setLoading] = React.useState(true);

        React.useEffect(() => {
          const fetchPublicAlbums = async () => {
            try {
              const response = await fetch("/api/albums?isPublic=true");
              const data = await response.json();

              if (data.success) {
                setAlbums(data.data);
              }
            } catch (err) {
              // Handle error
            } finally {
              setLoading(false);
            }
          };

          fetchPublicAlbums();
        }, []);

        if (loading) return <div data-testid="loading">Loading...</div>;

        return (
          <div data-testid="public-albums-list">
            {albums.map((album: Album) => (
              <div key={album.id} data-testid={`album-${album.id}`}>
                {album.title}
              </div>
            ))}
          </div>
        );
      };

      render(<PublicAlbumsList />);

      await waitFor(() => {
        expect(screen.getByTestId("public-albums-list")).toBeInTheDocument();
      });

      // Should only show public albums (album-3 is private)
      expect(screen.getByTestId("album-album-1")).toBeInTheDocument();
      expect(screen.getByTestId("album-album-2")).toBeInTheDocument();
      expect(screen.getByTestId("album-album-4")).toBeInTheDocument();
      expect(screen.queryByTestId("album-album-3")).not.toBeInTheDocument();
    });

    it("handles pagination correctly", async () => {
      const PaginatedAlbumsList = () => {
        const [albums, setAlbums] = React.useState([]);
        const [pagination, setPagination] = React.useState<{
          page: number;
          limit: number;
          total: number;
          hasNext: boolean;
          hasPrev: boolean;
        } | null>(null);
        const [page, setPage] = React.useState(1);
        const [loading, setLoading] = React.useState(true);

        React.useEffect(() => {
          const fetchAlbums = async () => {
            setLoading(true);
            try {
              const response = await fetch(`/api/albums?page=${page}&limit=2`);
              const data = await response.json();

              if (data.success) {
                setAlbums(data.data);
                setPagination(data.pagination);
              }
            } catch (err) {
              // Handle error
            } finally {
              setLoading(false);
            }
          };

          fetchAlbums();
        }, [page]);

        if (loading) return <div data-testid="loading">Loading...</div>;

        return (
          <div>
            <div data-testid="albums-list">
              {albums.map((album: Album) => (
                <div key={album.id} data-testid={`album-${album.id}`}>
                  {album.title}
                </div>
              ))}
            </div>
            {pagination && (
              <div data-testid="pagination">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={!pagination.hasPrev}
                  data-testid="prev-button"
                >
                  Previous
                </button>
                <span data-testid="page-info">Page {pagination.page}</span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={!pagination.hasNext}
                  data-testid="next-button"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        );
      };

      render(<PaginatedAlbumsList />);

      await waitFor(() => {
        expect(screen.getByTestId("albums-list")).toBeInTheDocument();
      });

      // Should show first 2 albums
      expect(screen.getByTestId("album-album-1")).toBeInTheDocument();
      expect(screen.getByTestId("album-album-2")).toBeInTheDocument();
      expect(screen.queryByTestId("album-album-3")).not.toBeInTheDocument();

      // Check pagination controls
      expect(screen.getByTestId("page-info")).toHaveTextContent("Page 1");
      expect(screen.getByTestId("prev-button")).toBeDisabled();
      expect(screen.getByTestId("next-button")).not.toBeDisabled();

      // Go to next page
      await user.click(screen.getByTestId("next-button"));

      await waitFor(() => {
        expect(screen.getByTestId("page-info")).toHaveTextContent("Page 2");
      });

      // Should show next 2 albums
      expect(screen.getByTestId("album-album-3")).toBeInTheDocument();
      expect(screen.getByTestId("album-album-4")).toBeInTheDocument();
      expect(screen.queryByTestId("album-album-1")).not.toBeInTheDocument();
    });
  });
});
