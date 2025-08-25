import { useEffect, useRef, MouseEvent as ReactMouseEvent } from 'react'
import ReactDOM from 'react-dom/client'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { act } from '@testing-library/react'
import { usePanZoom } from './usePanZoom'

interface TestAPI {
  getPan: () => { x: number; y: number }
  getZoom: () => number
  getIsPanning: () => boolean
  getIsZooming: () => boolean
  handleKeyPan: (dx: number, dy: number) => void
  handleZoomIn: () => void
  handleZoomOut: () => void
  handleZoomReset: () => void
  handleFitToScreen: (isAutoResize?: boolean) => void
  handleMouseDown: (e: ReactMouseEvent) => void
  handleMouseMove: (e: ReactMouseEvent) => void
  handleMouseUp: () => void
  containerElement: HTMLDivElement | null
  contentElement: HTMLDivElement | null
}

function TestComponent({
  onReady,
  options = {}
}: {
  onReady: (api: TestAPI) => void
  options?: Parameters<typeof usePanZoom>[2]
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const panZoom = usePanZoom(containerRef, contentRef, options)

  const panRef = useRef(panZoom.pan)
  const zoomRef = useRef(panZoom.zoom)
  const isPanningRef = useRef(panZoom.isPanning)
  const isZoomingRef = useRef(panZoom.isZooming)

  useEffect(() => { panRef.current = panZoom.pan }, [panZoom.pan])
  useEffect(() => { zoomRef.current = panZoom.zoom }, [panZoom.zoom])
  useEffect(() => { isPanningRef.current = panZoom.isPanning }, [panZoom.isPanning])
  useEffect(() => { isZoomingRef.current = panZoom.isZooming }, [panZoom.isZooming])

  useEffect(() => {
    onReady({
      getPan: () => panRef.current,
      getZoom: () => zoomRef.current,
      getIsPanning: () => isPanningRef.current,
      getIsZooming: () => isZoomingRef.current,
      handleKeyPan: panZoom.handleKeyPan,
      handleZoomIn: panZoom.handleZoomIn,
      handleZoomOut: panZoom.handleZoomOut,
      handleZoomReset: panZoom.handleZoomReset,
      handleFitToScreen: panZoom.handleFitToScreen,
      handleMouseDown: panZoom.handleMouseDown,
      handleMouseMove: panZoom.handleMouseMove,
      handleMouseUp: panZoom.handleMouseUp,
      containerElement: containerRef.current,
      contentElement: contentRef.current,
    })
  }, [onReady, panZoom])

  return (
    <div>
      <div 
        ref={containerRef} 
        style={{ width: '800px', height: '600px', position: 'relative' }}
        data-testid="container"
      />
      <div 
        ref={contentRef}
        data-testid="content"
      >
        <svg width="400" height="300" viewBox="0 0 400 300">
          <rect width="400" height="300" fill="blue" />
        </svg>
      </div>
    </div>
  )
}

describe('usePanZoom', () => {
  let host: HTMLElement
  let root: ReactDOM.Root
  let api: TestAPI

  beforeEach(async () => {
    host = document.createElement('div')
    document.body.appendChild(host)
    root = ReactDOM.createRoot(host)
  })

  afterEach(() => {
    root.unmount()
    document.body.removeChild(host)
  })

  async function setupTest(options = {}) {
    await act(async () => {
      root.render(
        <TestComponent 
          onReady={(testApi) => { api = testApi }} 
          options={options}
        />
      )
    })
    return api
  }

  describe('Initial State', () => {
    it('should initialize with default values', async () => {
      await setupTest()
      
      expect(api.getPan()).toEqual({ x: 0, y: 0 })
      expect(api.getZoom()).toBe(1)
      expect(api.getIsPanning()).toBe(false)
      expect(api.getIsZooming()).toBe(false)
    })
  })

  describe('Keyboard Panning', () => {
    it('should pan in all directions', async () => {
      await setupTest()

      await act(async () => api.handleKeyPan(0, 50))
      expect(api.getPan()).toEqual({ x: 0, y: 50 })

      await act(async () => api.handleKeyPan(0, -100))
      expect(api.getPan()).toEqual({ x: 0, y: -50 })

      await act(async () => api.handleKeyPan(30, 0))
      expect(api.getPan()).toEqual({ x: 30, y: -50 })

      await act(async () => api.handleKeyPan(-60, 0))
      expect(api.getPan()).toEqual({ x: -30, y: -50 })
    })

    it('should accumulate pan movements', async () => {
      await setupTest()

      const movements = [
        { dx: 10, dy: 20, expected: { x: 10, y: 20 } },
        { dx: -5, dy: 10, expected: { x: 5, y: 30 } },
        { dx: 25, dy: -15, expected: { x: 30, y: 15 } },
      ]

      for (const move of movements) {
        await act(async () => api.handleKeyPan(move.dx, move.dy))
        expect(api.getPan()).toEqual(move.expected)
      }
    })

    it('should respect enablePan option', async () => {
      await setupTest({ enablePan: false })

      await act(async () => api.handleKeyPan(50, 50))
      expect(api.getPan()).toEqual({ x: 0, y: 0 })
    })
  })

  describe('Zoom Controls', () => {
    it('should zoom in and out with configured step', async () => {
      await setupTest({ zoomStep: 2 })

      await act(async () => api.handleZoomIn())
      expect(api.getZoom()).toBe(2)

      await act(async () => api.handleZoomIn())
      expect(api.getZoom()).toBe(4)

      await act(async () => api.handleZoomOut())
      expect(api.getZoom()).toBe(2)

      await act(async () => api.handleZoomOut())
      expect(api.getZoom()).toBe(1)
    })

    it('should respect zoom limits', async () => {
      await setupTest({ minZoom: 0.5, maxZoom: 3, zoomStep: 2 })

      for (let i = 0; i < 5; i++) {
        await act(async () => api.handleZoomIn())
      }
      expect(api.getZoom()).toBeLessThanOrEqual(3)

      for (let i = 0; i < 5; i++) {
        await act(async () => api.handleZoomOut())
      }
      expect(api.getZoom()).toBeGreaterThanOrEqual(0.5)
    })

    it('should reset zoom and pan', async () => {
      await setupTest()

      await act(async () => {
        api.handleKeyPan(100, 50)
        api.handleZoomIn()
      })

      expect(api.getPan()).not.toEqual({ x: 0, y: 0 })
      expect(api.getZoom()).not.toBe(1)

      await act(async () => api.handleZoomReset())

      expect(api.getPan()).toEqual({ x: 0, y: 0 })
      expect(api.getZoom()).toBe(1)
    })

    it('should respect enableZoom option', async () => {
      await setupTest({ enableZoom: false })

      await act(async () => api.handleZoomIn())
      expect(api.getZoom()).toBe(1)

      await act(async () => api.handleZoomOut())
      expect(api.getZoom()).toBe(1)
    })
  })

  describe('Mouse Panning', () => {
    it('should start and stop panning on mouse events', async () => {
      await setupTest()

      const mouseDown = new MouseEvent('mousedown', { 
        clientX: 100, 
        clientY: 100, 
        button: 0 
      }) as unknown as ReactMouseEvent

      await act(async () => api.handleMouseDown(mouseDown))
      expect(api.getIsPanning()).toBe(true)

      const mouseMove = new MouseEvent('mousemove', { 
        clientX: 150, 
        clientY: 120 
      }) as unknown as ReactMouseEvent

      await act(async () => api.handleMouseMove(mouseMove))
      expect(api.getPan()).toEqual({ x: 50, y: 20 })

      await act(async () => api.handleMouseUp())
      expect(api.getIsPanning()).toBe(false)
    })

    it('should ignore non-left mouse button', async () => {
      await setupTest()

      const rightClick = new MouseEvent('mousedown', { 
        clientX: 100, 
        clientY: 100, 
        button: 2 
      }) as unknown as ReactMouseEvent

      await act(async () => api.handleMouseDown(rightClick))
      expect(api.getIsPanning()).toBe(false)
    })
  })

  describe('Wheel Events', () => {
    it('should pan with regular scroll', async () => {
      await setupTest()

      if (!api.containerElement) throw new Error('Container not ready')

      const wheelEvent = new WheelEvent('wheel', {
        deltaX: 10,
        deltaY: 20,
        clientX: 400,
        clientY: 300,
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
      })

      await act(async () => {
        api.containerElement!.dispatchEvent(wheelEvent)
        await new Promise(resolve => setTimeout(resolve, 10))
      })

      const pan = api.getPan()
      expect(pan.x).toBeCloseTo(-10 * 1.5, 1)
      expect(pan.y).toBeCloseTo(-20 * 1.5, 1)
    })

    it('should pan horizontally with shift+scroll', async () => {
      await setupTest()

      if (!api.containerElement) throw new Error('Container not ready')

      const wheelEvent = new WheelEvent('wheel', {
        deltaY: 30,
        clientX: 400,
        clientY: 300,
        shiftKey: true,
        ctrlKey: false,
        metaKey: false,
      })

      await act(async () => {
        api.containerElement!.dispatchEvent(wheelEvent)
        await new Promise(resolve => setTimeout(resolve, 10))
      })

      const pan = api.getPan()
      expect(pan.x).toBeCloseTo(-30 * 1.5, 1)
      expect(pan.y).toBe(0)
    })

    it('should zoom with ctrl+scroll', async () => {
      await setupTest()

      if (!api.containerElement) throw new Error('Container not ready')

      const initialZoom = api.getZoom()

      const wheelEvent = new WheelEvent('wheel', {
        deltaY: -100,
        clientX: 400,
        clientY: 300,
        ctrlKey: true,
      })

      await act(async () => {
        api.containerElement!.dispatchEvent(wheelEvent)
        await new Promise(resolve => setTimeout(resolve, 10))
      })

      expect(api.getZoom()).toBeGreaterThan(initialZoom)
    })
  })

  describe('Fit to Screen', () => {
    it.skip('should calculate correct scale to fit content', async () => {
      await setupTest({ fitPadding: 50 })

      // Wait for next tick to ensure component is fully mounted
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0))
      })

      // Mock the getBBox for the SVG element since jsdom doesn't fully support it
      const svg = api.contentElement?.querySelector('svg')
      if (svg) {
        Object.defineProperty(svg, 'getBBox', {
          value: () => ({ width: 400, height: 300, x: 0, y: 0 }),
          configurable: true
        })
      }

      await act(async () => api.handleFitToScreen())

      const zoom = api.getZoom()
      expect(zoom).toBeGreaterThan(0)
      expect(zoom).toBeLessThanOrEqual(2)
      expect(api.getPan()).toEqual({ x: 0, y: 0 })
    })

    it.skip('should handle auto-resize differently from manual fit', async () => {
      await setupTest()

      // Wait for next tick to ensure component is fully mounted
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0))
      })

      // Mock the getBBox for the SVG element
      const svg = api.contentElement?.querySelector('svg')
      if (svg) {
        Object.defineProperty(svg, 'getBBox', {
          value: () => ({ width: 400, height: 300, x: 0, y: 0 }),
          configurable: true
        })
      }

      await act(async () => api.handleFitToScreen(true))
      const autoZoom = api.getZoom()

      await act(async () => api.handleFitToScreen(false))
      const manualZoom = api.getZoom()

      expect(autoZoom).toBeCloseTo(manualZoom, 2)
    })
  })

  describe('Edge Cases', () => {
    it('should handle extreme values', async () => {
      await setupTest()

      await act(async () => api.handleKeyPan(Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER))
      const pan = api.getPan()
      expect(Number.isFinite(pan.x)).toBe(true)
      expect(Number.isFinite(pan.y)).toBe(true)
    })

    it('should handle zero movements', async () => {
      await setupTest()

      const initialPan = api.getPan()
      await act(async () => api.handleKeyPan(0, 0))
      expect(api.getPan()).toEqual(initialPan)
    })

    it('should handle fractional values', async () => {
      await setupTest()

      await act(async () => api.handleKeyPan(0.5, 0.3))
      expect(api.getPan()).toEqual({ x: 0.5, y: 0.3 })

      await act(async () => api.handleKeyPan(0.2, 0.7))
      expect(api.getPan()).toEqual({ x: 0.7, y: 1 })
    })

    it('should handle rapid sequential operations', async () => {
      await setupTest({ zoomStep: 2 })

      await act(async () => {
        api.handleZoomIn()
        api.handleKeyPan(10, 10)
        api.handleZoomOut()
        api.handleKeyPan(-5, -5)
        api.handleZoomIn()
      })

      expect(api.getZoom()).toBe(2)
      expect(api.getPan()).toEqual({ x: 5, y: 5 })
    })
  })
})