import { useEffect, useCallback, useRef } from 'react';

/**
 * Comprehensive TV Remote Navigation Hook
 * 
 * Features:
 * - Spatial navigation (finds nearest element in direction)
 * - Proper focus management in scroll containers
 * - Modal/Menu support (traps focus within open menus)
 * - Enter/OK key handling (clicks focused element)
 * - Back button support
 * - Smooth scrolling to focused elements
 */

export function useTVNavigation(options: {
  // If true, this component contains a modal/menu that should trap focus
  trapFocus?: boolean;
  // Selector for the container that should trap focus (defaults to document)
  containerSelector?: string;
  // Callback when back is pressed
  onBack?: () => boolean | void; // Return true to prevent default back behavior
  // Disable default Enter/OK handling (for custom handling)
  disableEnterKey?: boolean;
  // Disable default Back handling (for custom handling in player)
  disableBackKey?: boolean;
} = {}) {
  const lastFocusedElement = useRef<HTMLElement | null>(null);
  const lastNavTimeRef = useRef<number>(0);

  // Get focusable elements within a container
  const getFocusableElements = useCallback((container: HTMLElement | Document = document): HTMLElement[] => {
    const selector = [
      'button:not([disabled]):not([tabindex="-1"])',
      '[tabindex="0"]',
      'a[href]:not([tabindex="-1"])',
      'input:not([disabled]):not([tabindex="-1"])',
      'select:not([disabled]):not([tabindex="-1"])',
      '[role="button"]:not([disabled]):not([tabindex="-1"])',
      '[role="menuitem"]:not([disabled]):not([tabindex="-1"])',
      '[role="option"]:not([disabled]):not([tabindex="-1"])',
    ].join(', ');
    
    const elements = Array.from(container.querySelectorAll<HTMLElement>(selector));
    
    // Filter out hidden elements and elements within hidden containers
    return elements.filter(el => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      
      // Check if element is visible
      if (rect.width === 0 || rect.height === 0) return false;
      if (style.visibility === 'hidden' || style.display === 'none') return false;
      if (style.opacity === '0') return false;
      
      // Check if element is within visible viewport (with some margin for scroll containers)
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const margin = 500; // Allow elements in scroll containers
      
      if (rect.right < -margin || rect.left > viewportWidth + margin) return false;
      if (rect.bottom < -margin || rect.top > viewportHeight + margin) return false;
      
      // Check if any parent is hidden
      let parent = el.parentElement;
      while (parent) {
        const parentStyle = window.getComputedStyle(parent);
        if (parentStyle.display === 'none' || parentStyle.visibility === 'hidden') {
          return false;
        }
        parent = parent.parentElement;
      }
      
      return true;
    });
  }, []);

  // Find the best element in a given direction using spatial navigation
  const findNextElement = useCallback((
    currentElement: HTMLElement,
    direction: 'up' | 'down' | 'left' | 'right',
    container?: HTMLElement | Document
  ): HTMLElement | null => {
    const elements = getFocusableElements(container || document);
    const currentRect = currentElement.getBoundingClientRect();
    
    // Get center point of current element
    const currentCenterX = currentRect.left + currentRect.width / 2;
    const currentCenterY = currentRect.top + currentRect.height / 2;

    // Find the scrollable container (role="list") that contains the current element
    const getRowContainer = (el: HTMLElement): HTMLElement | null => {
      let parent = el.parentElement;
      while (parent) {
        if (parent.getAttribute('role') === 'list' || 
            parent.classList.contains('tv-row') ||
            parent.hasAttribute('data-tv-row')) {
          return parent;
        }
        // Also check for horizontal scroll containers
        const style = window.getComputedStyle(parent);
        if (style.overflowX === 'auto' || style.overflowX === 'scroll') {
          if (parent.scrollWidth > parent.clientWidth) {
            return parent;
          }
        }
        parent = parent.parentElement;
      }
      return null;
    };

    // Check if element is a media card (in a scrollable row)
    const isInCardRow = (el: HTMLElement): boolean => {
      return getRowContainer(el) !== null;
    };

    // Check if element is a row header button (like "See All")
    const isRowHeaderButton = (el: HTMLElement): boolean => {
      // Check if it's a button NOT in a scroll container but in a row header
      if (getRowContainer(el)) return false;
      // Check if it has focusable-item class or is near a row
      return el.classList.contains('focusable-item') || 
             el.textContent?.includes('See All') ||
             el.closest('.flex.items-center.gap-3') !== null;
    };

    // Check if element is a primary action button (like "Play Now")
    const isPrimaryAction = (el: HTMLElement): boolean => {
      return el.classList.contains('primary-action');
    };

    // Check if element is in the top header/menu bar
    const isInHeader = (el: HTMLElement): boolean => {
      return el.closest('header') !== null;
    };

    const currentRowContainer = getRowContainer(currentElement);
    const currentIsInCardRow = isInCardRow(currentElement);
    const currentIsInHeader = isInHeader(currentElement);

    // For horizontal navigation in a row container, use DOM order instead of spatial
    if ((direction === 'left' || direction === 'right') && currentRowContainer) {
      // Get all focusable elements in this row container
      const rowElements = Array.from(currentRowContainer.querySelectorAll<HTMLElement>(
        'button:not([disabled]):not([tabindex="-1"]), [tabindex="0"]'
      )).filter(el => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
      });
      
      const currentIndex = rowElements.indexOf(currentElement);
      if (currentIndex !== -1) {
        const nextIndex = direction === 'right' ? currentIndex + 1 : currentIndex - 1;
        if (nextIndex >= 0 && nextIndex < rowElements.length) {
          return rowElements[nextIndex];
        }
      }
      // If we can't find next in row, fall through to spatial navigation
      // (to allow moving to elements outside the row)
    }

    let bestElement: HTMLElement | null = null;
    let bestScore = Infinity;

    for (const element of elements) {
      if (element === currentElement) continue;

      const rect = element.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const dx = centerX - currentCenterX;
      const dy = centerY - currentCenterY;

      // Check if element is in the correct direction
      let isInDirection = false;
      let primaryDistance = 0;
      let secondaryDistance = 0;

      // Check if both elements are in the same row container
      const targetRowContainer = getRowContainer(element);
      const sameRow = currentRowContainer && currentRowContainer === targetRowContainer;

      // For same-row horizontal navigation, use a very small threshold
      // For cross-row, use a larger threshold
      const threshold = sameRow ? 1 : 10;

      // Check if elements are roughly on the same visual row (within 80px vertically)
      // This is more generous to handle cards that might be slightly offset
      const roughlySameRow = Math.abs(dy) < 80;

      switch (direction) {
        case 'up':
          // For up, the element must be clearly above (not just slightly)
          // When in a card row, be more strict - we want to go to the row header
          if (currentIsInCardRow && !sameRow) {
            isInDirection = dy < -20; // Must be clearly above
          } else {
            isInDirection = dy < -threshold;
          }
          primaryDistance = Math.abs(dy);
          secondaryDistance = Math.abs(dx);
          break;
        case 'down':
          isInDirection = dy > threshold;
          primaryDistance = Math.abs(dy);
          secondaryDistance = Math.abs(dx);
          break;
        case 'left':
          // For left navigation: element must be to the left
          // Be more permissive with the threshold - any element clearly to the left
          if (sameRow || roughlySameRow) {
            isInDirection = dx < -1; // Just needs to be to the left
          } else {
            isInDirection = dx < -threshold && Math.abs(dy) < 100;
          }
          primaryDistance = Math.abs(dx);
          secondaryDistance = (sameRow || roughlySameRow) ? 0 : Math.abs(dy);
          break;
        case 'right':
          // For right navigation: element must be to the right
          // Be more permissive with the threshold - any element clearly to the right
          if (sameRow || roughlySameRow) {
            isInDirection = dx > 1; // Just needs to be to the right
          } else {
            isInDirection = dx > threshold && Math.abs(dy) < 100;
          }
          primaryDistance = Math.abs(dx);
          secondaryDistance = (sameRow || roughlySameRow) ? 0 : Math.abs(dy);
          break;
      }

      if (!isInDirection) continue;

      // Calculate score - lower is better
      // Heavily favor elements in the same row for horizontal navigation
      let score = primaryDistance;
      
      if (direction === 'left' || direction === 'right') {
        if (sameRow) {
          // Same row container: use only horizontal distance with massive bonus
          score = primaryDistance - 50000;
        } else if (roughlySameRow) {
          // Visually same row: still strong preference
          score = primaryDistance - 10000;
        } else {
          // Different row: penalize very heavily - we almost never want this
          score = primaryDistance + (secondaryDistance * 50) + 5000;
        }
      } else {
        // Vertical navigation
        score = primaryDistance + (secondaryDistance * 0.3);
        
        // When navigating DOWN from a card row, prioritize header buttons (like "See All")
        // over cards in the next row
        if (direction === 'down' && currentIsInCardRow) {
          const targetIsHeaderButton = isRowHeaderButton(element);
          const targetIsInCardRow = isInCardRow(element);
          
          if (targetIsHeaderButton && !targetIsInCardRow) {
            // Give a significant bonus to header buttons
            score -= 500;
          }
        }
        
        // When navigating UP from a card row, STRONGLY prioritize the row's header
        if (direction === 'up' && currentIsInCardRow) {
          const targetIsHeaderButton = isRowHeaderButton(element);
          const targetIsInCardRow = isInCardRow(element);
          
          if (targetIsHeaderButton && !targetIsInCardRow) {
            // Very strong bonus for header buttons when going up from cards
            score -= 1000;
          }
          
          // Penalize other cards in different rows
          if (targetIsInCardRow && !sameRow) {
            score += 500;
          }
        }
        
        // When navigating DOWN from a header button (like "See All"), 
        // prioritize the first card in the row below (leftmost)
        // and HEAVILY penalize other header buttons
        if (direction === 'down' && isRowHeaderButton(currentElement)) {
          const targetIsInCardRow = isInCardRow(element);
          const targetIsHeaderButton = isRowHeaderButton(element);
          
          if (targetIsInCardRow) {
            // Give massive bonus to cards - we almost always want to go to cards
            score -= 2000;
            // STRONG bonus for cards on the left side - we want the FIRST card
            // Use absolute position: leftmost card wins regardless of distance
            score += rect.left * 2;
          } else if (targetIsHeaderButton) {
            // Heavily penalize other header buttons when going down from a header
            // We want to go to the cards, not to the next "See All" button
            score += 3000;
          }
        }

        // When navigating DOWN from the top header menu, prioritize primary-action buttons (Play Now)
        if (direction === 'down' && currentIsInHeader) {
          if (isPrimaryAction(element)) {
            // Massive bonus to go to Play Now from header
            score -= 5000;
          }
        }

        // When navigating UP from a card row (like Continue Watching), prioritize primary-action buttons
        if (direction === 'up' && currentIsInCardRow) {
          if (isPrimaryAction(element)) {
            // Strong bonus to go to Play Now when pressing up from content rows
            score -= 3000;
          }
        }
        
        // Bonus for elements that overlap horizontally
        const horizontalOverlap = Math.max(0, 
          Math.min(currentRect.right, rect.right) - Math.max(currentRect.left, rect.left)
        );
        if (horizontalOverlap > 0) {
          score -= horizontalOverlap * 0.2;
        }
      }

      if (score < bestScore) {
        bestScore = score;
        bestElement = element;
      }
    }

    return bestElement;
  }, [getFocusableElements]);

  // Focus an element and scroll it into view
  const focusElement = useCallback((element: HTMLElement, direction?: 'up' | 'down' | 'left' | 'right') => {
    // Scroll into view FIRST, then focus
    // This ensures the element is visible before focus changes
    
    // Check if element is in a horizontal scroll row
    const isInHorizontalRow = (() => {
      let parent = element.parentElement;
      while (parent) {
        if (parent.getAttribute('role') === 'list' || 
            parent.classList.contains('tv-row') ||
            parent.hasAttribute('data-tv-row')) {
          return true;
        }
        const style = window.getComputedStyle(parent);
        if ((style.overflowX === 'auto' || style.overflowX === 'scroll') && 
            parent.scrollWidth > parent.clientWidth) {
          return true;
        }
        parent = parent.parentElement;
      }
      return false;
    })();
    
    // Find scrollable parent and scroll immediately (not smooth)
    let parent = element.parentElement;
    let handledVerticalScroll = false;
    
    while (parent) {
      const style = window.getComputedStyle(parent);
      const isScrollableX = style.overflowX === 'auto' || style.overflowX === 'scroll';
      const isScrollableY = style.overflowY === 'auto' || style.overflowY === 'scroll';
      
      // Handle horizontal scroll containers
      if (isScrollableX && parent.scrollWidth > parent.clientWidth) {
        const parentRect = parent.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();
        const padding = 100;
        
        if (elementRect.left < parentRect.left + padding) {
          const scrollAmount = parentRect.left - elementRect.left + padding;
          parent.scrollLeft -= scrollAmount;
        } else if (elementRect.right > parentRect.right - padding) {
          const scrollAmount = elementRect.right - parentRect.right + padding;
          parent.scrollLeft += scrollAmount;
        }
      }
      
      // Handle vertical scroll containers (like modal content areas)
      if (isScrollableY && parent.scrollHeight > parent.clientHeight && !handledVerticalScroll) {
        const parentRect = parent.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();
        const padding = 60; // Padding from edges within scroll container
        
        if (elementRect.top < parentRect.top + padding) {
          // Element is above visible area - scroll up
          const scrollAmount = elementRect.top - parentRect.top - padding;
          parent.scrollBy({ top: scrollAmount, behavior: 'smooth' });
          handledVerticalScroll = true;
        } else if (elementRect.bottom > parentRect.bottom - padding) {
          // Element is below visible area - scroll down
          const scrollAmount = elementRect.bottom - parentRect.bottom + padding;
          parent.scrollBy({ top: scrollAmount, behavior: 'smooth' });
          handledVerticalScroll = true;
        }
      }
      
      parent = parent.parentElement;
    }
    
    // Only do main viewport vertical scrolling when navigating vertically (up/down)
    // and we haven't already handled scrolling in a scroll container
    // Skip vertical scroll adjustments for horizontal navigation in card rows
    // This prevents the viewport from jumping up/down when moving left/right
    const shouldScrollVertically = !handledVerticalScroll && (!isInHorizontalRow || direction === 'up' || direction === 'down');
    
    if (shouldScrollVertically) {
      // Ensure the element is visible in the main viewport (vertical scrolling)
      const rect = element.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportPadding = 150; // Extra padding to keep element away from edges
      
      if (rect.top < viewportPadding) {
        // Element is above the viewport - scroll up
        window.scrollBy({ top: rect.top - viewportPadding, behavior: 'smooth' });
      } else if (rect.bottom > viewportHeight - viewportPadding) {
        // Element is below the viewport - scroll down
        window.scrollBy({ top: rect.bottom - viewportHeight + viewportPadding, behavior: 'smooth' });
      }
    }
    
    // Now focus the element
    element.focus({ preventScroll: true });
    lastFocusedElement.current = element;
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const activeElement = document.activeElement as HTMLElement;
        // Reduce jank from long-press key repeats
        if (e.repeat) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
    const container = options.containerSelector 
      ? document.querySelector(options.containerSelector) as HTMLElement 
      : document;

    // Check if we're in an input field
    const isInInput = activeElement?.tagName === 'INPUT' || 
              activeElement?.tagName === 'TEXTAREA' ||
              activeElement?.isContentEditable;
    const isAriaSlider = activeElement?.getAttribute?.('role') === 'slider';

    // Handle Back button (Escape, Backspace, XF86Back on Android)
    if (e.key === 'Escape' || e.key === 'Backspace' || e.key === 'GoBack' || e.key === 'XF86Back') {
      // Allow typing in input fields
      if (isInInput && e.key === 'Backspace') {
        return; // Let backspace work normally in inputs
      }
      
      // If back key handling is disabled, let other handlers deal with it
      if (options.disableBackKey) {
        return;
      }
      
      // Call custom back handler if provided
      if (options.onBack) {
        const handled = options.onBack();
        if (handled) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }
      
      // Default: don't go back from home page
      if (window.location.pathname === '/home' || window.location.pathname === '/') {
        e.preventDefault();
        return;
      }
      
      e.preventDefault();
      window.history.back();
      return;
    }

    // Handle Enter/OK key - click the focused element
    if (!options.disableEnterKey && (e.key === 'Enter' || e.key === ' ')) {
      // Don't handle space in input fields
      if (isInInput && e.key === ' ') {
        return;
      }
      
      // If there's a focused element that's clickable, click it
      if (activeElement && activeElement !== document.body) {
        const isClickable = activeElement.tagName === 'BUTTON' ||
                           activeElement.tagName === 'A' ||
                           activeElement.getAttribute('role') === 'button' ||
                           activeElement.getAttribute('role') === 'menuitem' ||
                           activeElement.getAttribute('role') === 'option' ||
                           activeElement.hasAttribute('onclick') ||
                           (activeElement.hasAttribute('tabindex') && activeElement.tagName !== 'INPUT');
        
        if (isClickable) {
          e.preventDefault();
          e.stopPropagation();
          activeElement.click();
          return;
        }
      }
    }

    // Handle directional navigation
    let direction: 'up' | 'down' | 'left' | 'right' | null = null;

    switch (e.key) {
      case 'ArrowUp':
        direction = 'up';
        break;
      case 'ArrowDown':
        direction = 'down';
        break;
      case 'ArrowLeft':
        // Allow left arrow in input/slider fields for value/cursor movement
        if (isInInput || isAriaSlider) return;
        direction = 'left';
        break;
      case 'ArrowRight':
        // Allow right arrow in input/slider fields for value/cursor movement
        if (isInInput || isAriaSlider) return;
        direction = 'right';
        break;
      default:
        return; // Don't handle other keys
    }

    if (direction) {
      // Basic throttle to avoid overshooting when holding DPAD
      const now = Date.now();
      if (now - lastNavTimeRef.current < 80) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      lastNavTimeRef.current = now;

      e.preventDefault();
      e.stopPropagation();
      
      // If nothing is focused, focus the first element
      if (!activeElement || activeElement === document.body) {
        const elements = getFocusableElements(container || document);
        if (elements.length > 0) {
          focusElement(elements[0]);
        }
        return;
      }

      const nextElement = findNextElement(activeElement, direction, container || undefined);
      
      if (nextElement) {
        focusElement(nextElement, direction);
      }
    }
  }, [options, getFocusableElements, findNextElement, focusElement]);

  // Ensure something is focused on mount
  const ensureFocus = useCallback(() => {
    const activeElement = document.activeElement;
    
    // If nothing meaningful is focused, focus the first focusable element
    if (!activeElement || activeElement === document.body || activeElement === document.documentElement) {
      const container = options.containerSelector 
        ? document.querySelector(options.containerSelector) as HTMLElement 
        : document;
      
      const elements = getFocusableElements(container || document);
      
      // Try to restore last focused element
      if (lastFocusedElement.current && document.contains(lastFocusedElement.current)) {
        const rect = lastFocusedElement.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          focusElement(lastFocusedElement.current);
          return;
        }
      }
      
      // Otherwise focus the first element
      if (elements.length > 0) {
        focusElement(elements[0]);
      }
    }
  }, [options.containerSelector, getFocusableElements, focusElement]);

  // Set up event listeners
  useEffect(() => {
    // Use capture phase to handle events before other handlers
    window.addEventListener('keydown', handleKeyDown, true);
    
    // Ensure focus after a short delay (for initial render)
    const timer = setTimeout(ensureFocus, 150);
    
    // Add TV navigation class to body
    document.body.classList.add('tv-navigation');

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      clearTimeout(timer);
      document.body.classList.remove('tv-navigation');
    };
  }, [handleKeyDown, ensureFocus]);

  // Re-ensure focus when the DOM changes significantly
  useEffect(() => {
    const observer = new MutationObserver(() => {
      // Check if focus was lost
      const activeElement = document.activeElement;
      if (!activeElement || activeElement === document.body) {
        setTimeout(ensureFocus, 100);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [ensureFocus]);

  return {
    ensureFocus,
    getFocusableElements,
    focusElement,
    findNextElement,
  };
}

/**
 * Utility hook for player-specific TV navigation
 * Handles controls visibility, menu management, and playback controls
 */
export function usePlayerTVNavigation(options: {
  showControls: boolean;
  setShowControls: (show: boolean) => void;
  isMenuOpen: boolean;
  onTogglePlayPause: () => void;
  onSeekForward: () => void;
  onSeekBackward: () => void;
  onVolumeUp?: () => void;
  onVolumeDown?: () => void;
  onBack: () => void;
}) {
  const controlsTimeoutRef = useRef<number | null>(null);
  //const { focusElement, getFocusableElements } = useTVNavigation({ disableEnterKey: true, disableBackKey: true });

  const clearControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = null;
    }
  }, []);

  const showControlsTemporarily = useCallback((duration = 3000) => {
    options.setShowControls(true);
    clearControlsTimeout();
    
    if (!options.isMenuOpen) {
      controlsTimeoutRef.current = window.setTimeout(() => {
        options.setShowControls(false);
      }, duration);
    }
  }, [options, clearControlsTimeout]);

  // Note: Removed auto-focus on controls show to prevent focus-related issues
  // User can navigate to controls naturally with d-pad

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const activeElement = document.activeElement as HTMLElement;

    // Handle back button
    if (e.key === 'Escape' || e.key === 'Backspace' || e.key === 'GoBack' || e.key === 'XF86Back') {
      e.preventDefault();
      e.stopPropagation();
      
      // If a menu is open, let the component close it
      if (options.isMenuOpen) {
        return; // Parent component should handle this
      }
      
      // If controls are visible, hide them instead of going back
      if (options.showControls) {
        options.setShowControls(false);
        clearControlsTimeout();
        return;
      }
      
      // Controls are hidden, go back
      options.onBack();
      return;
    }

    // Handle Enter/Space (OK button)
    if (e.key === 'Enter' || e.key === ' ') {
      // If on a menu item or button, let it handle the click
      if (activeElement && activeElement !== document.body) {
        const isClickable = activeElement.tagName === 'BUTTON' ||
                           activeElement.getAttribute('role') === 'button' ||
                           activeElement.getAttribute('role') === 'menuitem';
        
        if (isClickable) {
          e.preventDefault();
          e.stopPropagation();
          activeElement.click();
          showControlsTemporarily();
          return;
        }
      }
      
      // If controls are hidden, just show them (don't toggle play)
      if (!options.showControls) {
        e.preventDefault();
        showControlsTemporarily();
        return;
      }
      
      // Controls are visible but nothing specific focused - just prevent default
      // Don't reset the timer for non-actions
      e.preventDefault();
      return;
    }

    // Handle directional keys
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      // If controls are hidden, show them first (no seeking with d-pad)
      if (!options.showControls) {
        e.preventDefault();
        showControlsTemporarily();
        return;
      }
      
      // When controls are already visible, DON'T reset the hide timer for navigation
      // This allows the controls to fade after 3 seconds of no activity
      // The timer will only reset on actual playback actions (play/pause, seek, etc.)
      // Don't prevent default - let the base useTVNavigation handle spatial navigation
    }

    // Handle media keys (these still work for play/pause and seek)
    if (e.key === 'MediaPlayPause' || e.key === 'MediaPlay' || e.key === 'MediaPause') {
      e.preventDefault();
      options.onTogglePlayPause();
      showControlsTemporarily();
    } else if (e.key === 'MediaFastForward') {
      e.preventDefault();
      options.onSeekForward();
      showControlsTemporarily();
    } else if (e.key === 'MediaRewind') {
      e.preventDefault();
      options.onSeekBackward();
      showControlsTemporarily();
    }
  }, [options, showControlsTemporarily, clearControlsTimeout]);

  useEffect(() => {
    // Use capture to intercept before other handlers
    window.addEventListener('keydown', handleKeyDown, true);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      clearControlsTimeout();
    };
  }, [handleKeyDown, clearControlsTimeout]);

  // Keep controls visible while menu is open
  useEffect(() => {
    if (options.isMenuOpen) {
      clearControlsTimeout();
    }
  }, [options.isMenuOpen, clearControlsTimeout]);

  return {
    showControlsTemporarily,
    clearControlsTimeout,
  };
}
