import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import ImageLightbox from "./ImageLightbox"

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockDownloadBlobAsFile = vi.fn()

vi.mock("@/lib/download-blob", () => ({
  downloadBlobAsFile: (...args: unknown[]) => mockDownloadBlobAsFile(...args),
}))

vi.mock("@/lib/auth-storage", () => ({
  AuthStorage: {
    getAuthData: () => ({
      tokens: { access_token: "test-token-123" },
    }),
    getAccessToken: () => "test-token-123",
  },
}))

// Mock Dialog components to avoid radix complexity
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open?: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}))

describe("ImageLightbox", () => {
  const s3Image = {
    url: "https://s3.ap-southeast-1.amazonaws.com/fintr-production/test-image.jpg",
    filename: "receipt.jpg",
    contentType: "image/jpeg",
    byteSize: 1024,
  }

  const renderLightbox = (props = {}) => {
    return render(
      <ImageLightbox
        images={[s3Image]}
        isOpen={true}
        initialIndex={0}
        onClose={() => {}}
        {...props}
      />
    )
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockDownloadBlobAsFile.mockResolvedValue(undefined)

    // Default fetch mock (successful direct download)
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        blob: () => Promise.resolve(new Blob(["test-image-data"], { type: "image/jpeg" })),
        text: () => Promise.resolve(""),
      })
    ) as unknown as typeof fetch

    // Mock Image to always load successfully in canvas tests
    const originalImage = global.Image
    global.Image = class MockImage {
      onload?: () => void
      onerror?: () => void
      src = ""
      crossOrigin = ""
      width = 100
      height = 100
      constructor() {
        setTimeout(() => {
          if (this.onload) this.onload()
        }, 10)
      }
    } as unknown as typeof Image

    // Store original for cleanup
    ;(global as any)._originalImage = originalImage
  })

  afterEach(() => {
    vi.restoreAllMocks()
    if ((global as any)._originalImage) {
      global.Image = (global as any)._originalImage
    }
  })

  it("renders lightbox when open", async () => {
    renderLightbox()

    await waitFor(() => {
      expect(screen.getByText("receipt.jpg")).toBeInTheDocument()
    })
  })

  it("calls downloadBlobAsFile when download button is clicked", async () => {
    renderLightbox()

    await waitFor(() => {
      expect(screen.getByText("receipt.jpg")).toBeInTheDocument()
    })

    const downloadButton = screen.getByRole("button", { name: /download/i })
    fireEvent.click(downloadButton)

    await waitFor(() => {
      expect(mockDownloadBlobAsFile).toHaveBeenCalledTimes(1)
    })

    expect(mockDownloadBlobAsFile).toHaveBeenCalledWith(
      expect.any(Blob),
      "receipt.jpg"
    )
  })

  it("shows error dialog when all download methods fail", async () => {
    // All fetch calls fail
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 404,
        blob: () => Promise.resolve(new Blob([])),
        text: () => Promise.resolve("Not found"),
      })
    ) as unknown as typeof fetch

    // Override Image to fail loading
    global.Image = class MockImage {
      onload?: () => void
      onerror?: () => void
      src = ""
      crossOrigin = ""
      width = 100
      height = 100
      constructor() {
        setTimeout(() => {
          if (this.onerror) this.onerror()
        }, 10)
      }
    } as unknown as typeof Image

    renderLightbox()

    await waitFor(() => {
      expect(screen.getByText("receipt.jpg")).toBeInTheDocument()
    })

    const downloadButton = screen.getByRole("button", { name: /download/i })
    fireEvent.click(downloadButton)

    // Wait for error dialog to appear
    await waitFor(
      () => {
        expect(screen.getByTestId("dialog")).toBeInTheDocument()
      },
      { timeout: 3000 }
    )

    expect(mockDownloadBlobAsFile).not.toHaveBeenCalled()
  })

  it("uses correct filename with extension from contentType", async () => {
    const images = [
      {
        url: "https://example.com/image",
        contentType: "image/png",
      },
    ]

    renderLightbox({ images })

    await waitFor(() => {
      expect(screen.getByText("Image 1")).toBeInTheDocument()
    })

    const downloadButton = screen.getByRole("button", { name: /download/i })
    fireEvent.click(downloadButton)

    await waitFor(() => {
      expect(mockDownloadBlobAsFile).toHaveBeenCalledTimes(1)
    })

    // When no filename is provided, base filename defaults to image-{index+1}
    expect(mockDownloadBlobAsFile).toHaveBeenCalledWith(
      expect.any(Blob),
      "image-1.png"
    )
  })

  it("uses filename from URL extension when no filename or contentType provided", async () => {
    const images = [
      {
        url: "https://example.com/photo.webp",
      },
    ]

    renderLightbox({ images })

    await waitFor(() => {
      expect(screen.getByText("Image 1")).toBeInTheDocument()
    })

    const downloadButton = screen.getByRole("button", { name: /download/i })
    fireEvent.click(downloadButton)

    await waitFor(() => {
      expect(mockDownloadBlobAsFile).toHaveBeenCalledTimes(1)
    })

    // When no filename is provided, base filename defaults to image-{index+1}
    expect(mockDownloadBlobAsFile).toHaveBeenCalledWith(
      expect.any(Blob),
      "image-1.webp"
    )
  })

  it("navigates to next image on arrow button click", async () => {
    const images = [
      { url: "https://example.com/image1.jpg", filename: "image1.jpg" },
      { url: "https://example.com/image2.jpg", filename: "image2.jpg" },
    ]

    renderLightbox({ images })

    await waitFor(() => {
      expect(screen.getByText("image1.jpg")).toBeInTheDocument()
    })

    const nextButton = screen.getByRole("button", { name: /next image/i })
    fireEvent.click(nextButton)

    await waitFor(() => {
      expect(screen.getByText("image2.jpg")).toBeInTheDocument()
    })
  })

  it("navigates to previous image on arrow button click", async () => {
    const images = [
      { url: "https://example.com/image1.jpg", filename: "image1.jpg" },
      { url: "https://example.com/image2.jpg", filename: "image2.jpg" },
    ]

    renderLightbox({ images, initialIndex: 1 })

    await waitFor(() => {
      expect(screen.getByText("image2.jpg")).toBeInTheDocument()
    })

    const prevButton = screen.getByRole("button", { name: /previous image/i })
    fireEvent.click(prevButton)

    await waitFor(() => {
      expect(screen.getByText("image1.jpg")).toBeInTheDocument()
    })
  })

  it("does not render when isOpen is false", () => {
    const { container } = renderLightbox({ isOpen: false })
    expect(container).toBeEmptyDOMElement()
  })

  it("closes on close button click", async () => {
    const onClose = vi.fn()
    renderLightbox({ onClose })

    await waitFor(() => {
      expect(screen.getByText("receipt.jpg")).toBeInTheDocument()
    })

    const closeButton = screen.getByRole("button", { name: /close/i })
    fireEvent.click(closeButton)

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
