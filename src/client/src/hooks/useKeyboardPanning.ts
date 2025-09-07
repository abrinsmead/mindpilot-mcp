import { useEffect, useRef, useCallback } from 'react';

interface KeyboardPanningOptions {
  isEnabled?: boolean;
  panSpeed?: number;
  accelerationFactor?: number;
  maxSpeed?: number;
}

export function useKeyboardPanning(
  onPan: (dx: number, dy: number) => void,
  options: KeyboardPanningOptions = {}
) {
  const {
    isEnabled = true,
    panSpeed = 5,
    accelerationFactor = 1.5,
    maxSpeed = 20
  } = options;

  const keysPressed = useRef<Set<string>>(new Set());
  const animationFrameId = useRef<number | null>(null);
  const velocityRef = useRef({ x: 0, y: 0 });
  const accelerationRef = useRef({ x: 1, y: 1 });

  const updatePanning = useCallback(() => {
    if (!isEnabled || keysPressed.current.size === 0) {
      velocityRef.current = { x: 0, y: 0 };
      accelerationRef.current = { x: 1, y: 1 };
      return;
    }

    let dx = 0;
    let dy = 0;

    // Calculate direction based on pressed keys
    if (keysPressed.current.has('ArrowUp')) dy += 1;
    if (keysPressed.current.has('ArrowDown')) dy -= 1;
    if (keysPressed.current.has('ArrowLeft')) dx += 1;
    if (keysPressed.current.has('ArrowRight')) dx -= 1;

    // Apply diagonal movement normalization (so diagonal isn't faster)
    if (dx !== 0 && dy !== 0) {
      const diagonalFactor = 0.707; // 1/sqrt(2)
      dx *= diagonalFactor;
      dy *= diagonalFactor;
    }

    // Apply acceleration for smoother feel
    if (dx !== 0) {
      accelerationRef.current.x = Math.min(accelerationRef.current.x * accelerationFactor, maxSpeed / panSpeed);
    } else {
      accelerationRef.current.x = 1;
    }

    if (dy !== 0) {
      accelerationRef.current.y = Math.min(accelerationRef.current.y * accelerationFactor, maxSpeed / panSpeed);
    } else {
      accelerationRef.current.y = 1;
    }

    // Calculate final velocity with acceleration
    velocityRef.current = {
      x: dx * panSpeed * accelerationRef.current.x,
      y: dy * panSpeed * accelerationRef.current.y
    };

    // Apply the pan
    if (velocityRef.current.x !== 0 || velocityRef.current.y !== 0) {
      onPan(velocityRef.current.x, velocityRef.current.y);
    }

    // Continue animation
    animationFrameId.current = requestAnimationFrame(updatePanning);
  }, [isEnabled, onPan, panSpeed, accelerationFactor, maxSpeed]);

  useEffect(() => {
    if (!isEnabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      
      if (arrowKeys.includes(e.key)) {
        e.preventDefault();
        
        // Start animation loop if this is the first key
        if (keysPressed.current.size === 0) {
          animationFrameId.current = requestAnimationFrame(updatePanning);
        }
        
        keysPressed.current.add(e.key);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.key);
      
      // Stop animation loop if no keys are pressed
      if (keysPressed.current.size === 0) {
        if (animationFrameId.current) {
          cancelAnimationFrame(animationFrameId.current);
          animationFrameId.current = null;
        }
        // Reset acceleration when stopping
        accelerationRef.current = { x: 1, y: 1 };
      }
    };

    // Clear all keys on blur to prevent stuck keys
    const handleBlur = () => {
      keysPressed.current.clear();
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
      accelerationRef.current = { x: 1, y: 1 };
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [isEnabled, updatePanning]);

  return {
    isMoving: keysPressed.current.size > 0,
    velocity: velocityRef.current
  };
}