import ReactDOM from 'react-dom/client'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act } from '@testing-library/react'
import { useKeyboardPanning } from './useKeyboardPanning'

describe('useKeyboardPanning', () => {
  let host: HTMLElement
  let root: ReactDOM.Root

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    root = ReactDOM.createRoot(host)
    vi.useFakeTimers()
  })

  afterEach(() => {
    root.unmount()
    document.body.removeChild(host)
    vi.restoreAllMocks()
  })

  describe('Arrow Key Handling', () => {
    it('should detect arrow key presses', async () => {
      const handlePan = vi.fn()
      
      function ArrowTest() {
        useKeyboardPanning(handlePan, { panSpeed: 10 })
        return <div>Test</div>
      }

      await act(async () => {
        root.render(<ArrowTest />)
      })

      const upEvent = new KeyboardEvent('keydown', { key: 'ArrowUp' })
      await act(async () => {
        window.dispatchEvent(upEvent)
        vi.advanceTimersByTime(16)
      })

      expect(handlePan).toHaveBeenCalled()

      const upRelease = new KeyboardEvent('keyup', { key: 'ArrowUp' })
      await act(async () => {
        window.dispatchEvent(upRelease)
      })
    })

    it('should handle diagonal movement', async () => {
      const panHistory: Array<{ dx: number; dy: number }> = []
      const handlePan = vi.fn((dx: number, dy: number) => {
        panHistory.push({ dx, dy })
      })

      function DiagonalTest() {
        useKeyboardPanning(handlePan, { 
          panSpeed: 10,
          accelerationFactor: 1.0  // Disable acceleration for predictable testing
        })
        return <div>Test</div>
      }

      await act(async () => {
        root.render(<DiagonalTest />)
      })

      const upEvent = new KeyboardEvent('keydown', { key: 'ArrowUp' })
      const leftEvent = new KeyboardEvent('keydown', { key: 'ArrowLeft' })
      
      await act(async () => {
        window.dispatchEvent(upEvent)
        window.dispatchEvent(leftEvent)
        vi.advanceTimersByTime(16)
      })

      expect(handlePan).toHaveBeenCalled()
      
      const lastCall = handlePan.mock.calls[handlePan.mock.calls.length - 1]
      if (lastCall) {
        const [dx, dy] = lastCall
        expect(dx).toBeGreaterThan(0)
        expect(dy).toBeGreaterThan(0)
        
        // Check that diagonal movement is properly normalized
        // When moving diagonally, both components should be present but reduced
        expect(Math.abs(dx)).toBeLessThan(10)
        expect(Math.abs(dy)).toBeLessThan(10)
      }
    })

    it('should stop movement on key release', async () => {
      const handlePan = vi.fn()

      function ReleaseTest() {
        useKeyboardPanning(handlePan, { panSpeed: 10 })
        return <div>Test</div>
      }

      await act(async () => {
        root.render(<ReleaseTest />)
      })

      const downEvent = new KeyboardEvent('keydown', { key: 'ArrowDown' })
      await act(async () => {
        window.dispatchEvent(downEvent)
        vi.advanceTimersByTime(100)
      })

      const callCountBeforeRelease = handlePan.mock.calls.length
      expect(callCountBeforeRelease).toBeGreaterThan(0)

      const releaseEvent = new KeyboardEvent('keyup', { key: 'ArrowDown' })
      await act(async () => {
        window.dispatchEvent(releaseEvent)
        vi.advanceTimersByTime(100)
      })

      const callCountAfterRelease = handlePan.mock.calls.length
      expect(callCountAfterRelease).toBe(callCountBeforeRelease)
    })
  })

  describe('Options', () => {
    it('should respect isEnabled option', async () => {
      const handlePan = vi.fn()

      function DisabledTest() {
        useKeyboardPanning(handlePan, { isEnabled: false })
        return <div>Test</div>
      }

      await act(async () => {
        root.render(<DisabledTest />)
      })

      const upEvent = new KeyboardEvent('keydown', { key: 'ArrowUp' })
      await act(async () => {
        window.dispatchEvent(upEvent)
        vi.advanceTimersByTime(100)
      })

      expect(handlePan).not.toHaveBeenCalled()
    })

    it('should apply pan speed correctly', async () => {
      const handlePan = vi.fn()
      const customSpeed = 25

      function SpeedTest() {
        useKeyboardPanning(handlePan, { panSpeed: customSpeed })
        return <div>Test</div>
      }

      await act(async () => {
        root.render(<SpeedTest />)
      })

      const rightEvent = new KeyboardEvent('keydown', { key: 'ArrowRight' })
      await act(async () => {
        window.dispatchEvent(rightEvent)
        vi.advanceTimersByTime(16)
      })

      expect(handlePan).toHaveBeenCalled()
      const [dx] = handlePan.mock.calls[0]
      // Check that speed is applied (with initial acceleration factor)
      expect(Math.abs(dx)).toBeGreaterThanOrEqual(customSpeed * 0.5)
      expect(Math.abs(dx)).toBeLessThanOrEqual(customSpeed * 2)
    })

    it('should apply acceleration over time', async () => {
      const handlePan = vi.fn()

      function AccelerationTest() {
        useKeyboardPanning(handlePan, { 
          panSpeed: 10,
          accelerationFactor: 1.5,
          maxSpeed: 50
        })
        return <div>Test</div>
      }

      await act(async () => {
        root.render(<AccelerationTest />)
      })

      const leftEvent = new KeyboardEvent('keydown', { key: 'ArrowLeft' })
      await act(async () => {
        window.dispatchEvent(leftEvent)
      })

      await act(async () => {
        vi.advanceTimersByTime(16)
      })
      const firstSpeed = handlePan.mock.calls[0] ? Math.abs(handlePan.mock.calls[0][0]) : 0

      await act(async () => {
        vi.advanceTimersByTime(200)
      })
      
      const lastCall = handlePan.mock.calls[handlePan.mock.calls.length - 1]
      const lastSpeed = lastCall ? Math.abs(lastCall[0]) : 0

      expect(lastSpeed).toBeGreaterThan(firstSpeed)
      expect(lastSpeed).toBeLessThanOrEqual(50)
    })
  })

  describe('Edge Cases', () => {
    it('should clear keys on window blur', async () => {
      const handlePan = vi.fn()

      function BlurTest() {
        useKeyboardPanning(handlePan)
        return <div>Test</div>
      }

      await act(async () => {
        root.render(<BlurTest />)
      })

      const downEvent = new KeyboardEvent('keydown', { key: 'ArrowDown' })
      await act(async () => {
        window.dispatchEvent(downEvent)
        vi.advanceTimersByTime(50)
      })

      const callsBeforeBlur = handlePan.mock.calls.length
      expect(callsBeforeBlur).toBeGreaterThan(0)

      const blurEvent = new Event('blur')
      await act(async () => {
        window.dispatchEvent(blurEvent)
        vi.advanceTimersByTime(100)
      })

      expect(handlePan.mock.calls.length).toBe(callsBeforeBlur)
    })

    it('should prevent default on arrow keys', async () => {
      function PreventDefaultTest() {
        useKeyboardPanning(() => {})
        return <div>Test</div>
      }

      await act(async () => {
        root.render(<PreventDefaultTest />)
      })

      const event = new KeyboardEvent('keydown', { key: 'ArrowUp', cancelable: true })
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault')
      
      await act(async () => {
        window.dispatchEvent(event)
      })

      expect(preventDefaultSpy).toHaveBeenCalled()
    })

    it('should ignore non-arrow keys', async () => {
      const handlePan = vi.fn()

      function NonArrowTest() {
        useKeyboardPanning(handlePan)
        return <div>Test</div>
      }

      await act(async () => {
        root.render(<NonArrowTest />)
      })

      const aEvent = new KeyboardEvent('keydown', { key: 'a' })
      const spaceEvent = new KeyboardEvent('keydown', { key: ' ' })
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' })
      
      await act(async () => {
        window.dispatchEvent(aEvent)
        window.dispatchEvent(spaceEvent)
        window.dispatchEvent(enterEvent)
        vi.advanceTimersByTime(100)
      })

      expect(handlePan).not.toHaveBeenCalled()
    })

    it('should handle multiple keys pressed and released', async () => {
      const handlePan = vi.fn()

      function MultiKeyTest() {
        useKeyboardPanning(handlePan)
        return <div>Test</div>
      }

      await act(async () => {
        root.render(<MultiKeyTest />)
      })

      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }))
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))
        vi.advanceTimersByTime(50)
      })

      const diagonalCalls = handlePan.mock.calls.length
      expect(diagonalCalls).toBeGreaterThan(0)

      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowUp' }))
        vi.advanceTimersByTime(50)
      })

      const afterFirstRelease = handlePan.mock.calls.length
      expect(afterFirstRelease).toBeGreaterThan(diagonalCalls)

      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowLeft' }))
        vi.advanceTimersByTime(50)
      })

      const afterAllRelease = handlePan.mock.calls.length
      expect(afterAllRelease).toBe(afterFirstRelease)
    })
  })
})