import React, { ReactElement } from "react";
import { render, RenderOptions } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

// Custom render function that includes providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return <div className="dark">{children}</div>;
};

// Special wrapper for layout components that need to render HTML/body
const LayoutWrapper = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">
) => {
  return render(ui, { wrapper: AllTheProviders, ...options });
};

// Special render function for layout components
const renderLayout = (
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">
) => {
  return render(ui, { wrapper: LayoutWrapper, ...options });
};

// Re-export everything
export * from "@testing-library/react";

// Override render method
export { customRender as render, renderLayout };

// Custom user event setup
export const user = userEvent.setup();

// Accessibility testing helper
export const checkA11y = async (container: Element) => {
  const results = await axe(container);
  expect(results).toHaveNoViolations();
};

// Mock intersection observer for components that use it
export const mockIntersectionObserver = () => {
  const mockIntersectionObserver = jest.fn();
  mockIntersectionObserver.mockReturnValue({
    observe: () => null,
    unobserve: () => null,
    disconnect: () => null,
  });
  window.IntersectionObserver = mockIntersectionObserver;
};

// Mock resize observer for components that use it
export const mockResizeObserver = () => {
  const mockResizeObserver = jest.fn();
  mockResizeObserver.mockReturnValue({
    observe: () => null,
    unobserve: () => null,
    disconnect: () => null,
  });
  window.ResizeObserver = mockResizeObserver;
};

// Helper to wait for loading states
export const waitForLoadingToFinish = () => {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
};

// Helper to create mock file for upload tests
export const createMockFile = (
  name = "test.jpg",
  size = 1024,
  type = "image/jpeg"
): File => {
  const file = new File([""], name, { type });
  Object.defineProperty(file, "size", {
    value: size,
    writable: false,
  });
  return file;
};

// Helper to mock window.URL.createObjectURL
export const mockCreateObjectURL = () => {
  const mockCreateObjectURL = jest.fn(() => "mock-url");
  const mockRevokeObjectURL = jest.fn();

  Object.defineProperty(window.URL, "createObjectURL", {
    value: mockCreateObjectURL,
    writable: true,
  });

  Object.defineProperty(window.URL, "revokeObjectURL", {
    value: mockRevokeObjectURL,
    writable: true,
  });

  return { mockCreateObjectURL, mockRevokeObjectURL };
};

// Helper to mock fetch responses
export const mockFetch = (response: unknown, status = 200) => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(response),
      text: () => Promise.resolve(JSON.stringify(response)),
    })
  ) as jest.Mock;
};

// Helper to mock console methods
export const mockConsole = () => {
  const originalConsole = { ...console };
  const mockConsoleError = jest.spyOn(console, "error").mockImplementation();
  const mockConsoleWarn = jest.spyOn(console, "warn").mockImplementation();
  const mockConsoleLog = jest.spyOn(console, "log").mockImplementation();

  return {
    mockConsoleError,
    mockConsoleWarn,
    mockConsoleLog,
    restore: () => {
      Object.assign(console, originalConsole);
    },
  };
};

// Helper for testing responsive design
export const setViewport = (width: number, height: number) => {
  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, "innerHeight", {
    writable: true,
    configurable: true,
    value: height,
  });
  window.dispatchEvent(new Event("resize"));
};

// Common viewport sizes for testing
export const viewports = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1024, height: 768 },
  large: { width: 1440, height: 900 },
};

// Helper to test dark mode
export const toggleDarkMode = (container: Element, isDark = true) => {
  if (isDark) {
    container.classList.add("dark");
  } else {
    container.classList.remove("dark");
  }
};

// Helper to wait for animations
export const waitForAnimation = (duration = 300) => {
  return new Promise((resolve) => {
    setTimeout(resolve, duration);
  });
};

// Helper to simulate keyboard navigation
export const simulateKeyboardNavigation = async (
  element: Element,
  key: string
) => {
  await user.type(element, `{${key}}`);
};

// Helper to test focus management
export const expectFocusedElement = (element: Element) => {
  expect(document.activeElement).toBe(element);
};

// Helper to create test IDs
export const testId = (id: string) => `[data-testid="${id}"]`;

// Helper to get element by test ID
export const getByTestId = (container: Element, id: string) => {
  return container.querySelector(testId(id));
};

// Helper to check if element is visible
export const isElementVisible = (element: Element) => {
  const style = window.getComputedStyle(element);
  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    style.opacity !== "0"
  );
};

// Helper to simulate drag and drop
export const simulateDragAndDrop = async (
  source: Element,
  target: Element,
  dataTransfer?: DataTransfer
) => {
  // DataTransfer is available for future use if needed
  dataTransfer = dataTransfer || new DataTransfer();

  await user.pointer([
    { target: source, keys: "[MouseLeft>]" },
    { target, keys: "[/MouseLeft]" },
  ]);
};

// Helper to create mock image load event
export const mockImageLoad = (img: HTMLImageElement) => {
  Object.defineProperty(img, "naturalWidth", { value: 1920 });
  Object.defineProperty(img, "naturalHeight", { value: 1080 });
  img.dispatchEvent(new Event("load"));
};

// Helper to create mock image error event
export const mockImageError = (img: HTMLImageElement) => {
  img.dispatchEvent(new Event("error"));
};
