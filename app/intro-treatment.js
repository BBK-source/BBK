export function applyIntroTreatment(html, colors, treatment) {
  if (treatment === "color") {
    return `<span style="color:${colors.key}">${html}</span>`;
  }
  if (treatment === "bold") {
    return `<span style="font-weight:800">${html}</span>`;
  }
  if (treatment === "marker") {
    return `<span style="background:${colors.soft};padding:1px 3px;border-radius:2px">${html}</span>`;
  }
  return html;
}
