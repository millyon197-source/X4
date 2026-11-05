// Mount / unmount of the Matrix tab: subscribes to the store while the tab is shown and re-renders on every change.
// Extracted from matrixView.js (Stage 4, step 11). The tab renderer is passed in so this module does not import the view.
import { state, store } from '../../state/store.js';

export function createMatrixLifecycle(renderMatrixTabHTML) {
  let containerEl = null;
  let unsubscribeStore = null;

  /**
   * Initializes the Matrix View component and subscribes to state changes.
   * @param {HTMLElement} rootElement - Parent DOM container
   */
  function initMatrixView(rootElement) {
    containerEl = rootElement;

    if (unsubscribeStore) {
      unsubscribeStore();
    }

    // Subscribe to store updates
    unsubscribeStore = store.subscribe((currentState) => {
      if (containerEl && state.activeTab === 'matrix') {
        if (typeof window !== 'undefined' && typeof window.renderApp === 'function') {
          window.renderApp();
        } else {
          containerEl.innerHTML = renderMatrixTabHTML();
        }
      }
    });

    // Initial render
    if (containerEl) {
      if (typeof window !== 'undefined' && typeof window.renderApp === 'function') {
        window.renderApp();
      } else {
        containerEl.innerHTML = renderMatrixTabHTML();
      }
    }
  }

  /**
   * Cleans up DOM event listeners and store subscriptions upon tab switch.
   */
  function destroyMatrixView() {
    if (unsubscribeStore) {
      unsubscribeStore();
      unsubscribeStore = null;
    }
    containerEl = null;
  }

  return { initMatrixView, destroyMatrixView };
}
