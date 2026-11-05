// Event wiring for the single-ware inspector, extracted from renderWareInspector (Stage 4, step 10a).
// deps carries the inspector functions this wiring calls back into, passed in rather than imported so
// this file does not import inspector.js.
import { bindBiPanelFocusListeners } from './budgetBindings.js';
import { state } from '../../state/store.js';

export function bindWareInspector(deps, id, insBody, prevInsScrollTop) {
  const { updateInspector, selectWare } = deps;
  const chkInspectorSingle = document.getElementById('chkInspectorSingle');
  if (chkInspectorSingle) {
    chkInspectorSingle.addEventListener('change', (e) => {
      state.inspectorSingle = e.target.checked;
      updateInspector(id);
    });
  }

  const thUpSortComp = document.getElementById('thUpSortComp');
  if (thUpSortComp) {
    thUpSortComp.addEventListener('click', () => {
      if (state.bpSortField === 'level') {
        state.bpSortAsc = !state.bpSortAsc;
      } else {
        state.bpSortField = 'level';
        state.bpSortAsc = true;
      }
      updateInspector(id);
    });
  }

  const thUpSortNeeded = document.getElementById('thUpSortNeeded');
  if (thUpSortNeeded) {
    thUpSortNeeded.addEventListener('click', () => {
      if (state.bpSortField === 'needed') {
        state.bpSortAsc = !state.bpSortAsc;
      } else {
        state.bpSortField = 'needed';
        state.bpSortAsc = false;
      }
      updateInspector(id);
    });
  }

  const consumerRows = insBody.querySelectorAll('.consumer-row');
  consumerRows.forEach(row => {
    row.addEventListener('click', (e) => {
      e.stopPropagation();
      const targetWareId = row.dataset.wareId;
      if (targetWareId) {
        selectWare(targetWareId, typeof window !== 'undefined' ? window.renderApp : null);
      }
    });
  });

  if (prevInsScrollTop > 0) {
    insBody.scrollTop = prevInsScrollTop;
  }

  bindBiPanelFocusListeners();
}
