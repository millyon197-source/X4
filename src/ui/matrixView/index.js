// Public boundary of the matrix view. Consumers import from here, not from matrixView.js.
export {
  renderMatrixTabHTML,
  drawLines,
  highlightGraph,
  filterWares,
  selectWare,
  updateInspector,
  centerOnWare,
  getCenteredWareId,
  showNoBlueprintPopup,
  alignSubdueLevel4,
  updateModuleCountFromDiff,
} from './matrixView.js';
