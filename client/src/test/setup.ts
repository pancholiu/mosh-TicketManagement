import '@testing-library/jest-dom'

// recharts' ResponsiveContainer observes its element size via ResizeObserver,
// which jsdom does not implement.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
;(globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver = ResizeObserverStub
