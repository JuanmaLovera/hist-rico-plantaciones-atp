const csvUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR7kHC-Y8mbAuePLyIFc9NOHtHwPrMnLp8zYtkru_wV8YUpQ2L7zTOhfT3Gv8TuDKJ8ipe6O3qqQSnC/pub?gid=555240624&single=true&output=csv";

const map = L.map("map").setView([-23.5, -58.0], 6);

const baseMaps = {
  osm: L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }),
  satellite: L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "Tiles © Esri" }),
  topo: L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", { maxZoom: 17, attribution: "© OpenTopoMap" })
};

baseMaps.satellite.addTo(map);
let currentBase = baseMaps.satellite;

let markers = L.layerGroup().addTo(map);
let datos = [];

const colores = ["#2E7D32", "#1565C0", "#EF6C00", "#6A1B9A", "#C62828", "#00838F", "#558B2F", "#AD1457", "#5D4037", "#283593"];
let colorPorActividad = {};

Papa.parse(csvUrl, {
  download: true,
  header: true,
  skipEmptyLines: true,
  complete: function(results) {
    datos = results.data.filter(r => r["Coord_X"] && r["Coord_Y"]);
    asignarColores();
    cargarFiltros();
    dibujarLeyenda();
    dibujarMapa(datos);
  }
});

function numero(valor) {
  if (!valor) return 0;
  return Number(String(valor).trim().replace(/,/g, "")) || 0;
}

function decimal(valor) {
  if (!valor) return 0;
  return Number(String(valor).trim().replace(",", ".")) || 0;
}

function asignarColores() {
  const actividades = [...new Set(datos.map(r => r["Actividad"]).filter(Boolean))].sort();
  actividades.forEach((act, i) => colorPorActividad[act] = colores[i % colores.length]);
}

function cargarFiltros() {
  llenarSelect("filtroActividad", "Actividad");
  llenarSelect("filtroAnio", "Ano_plan");
  llenarSelect("filtroDepartamento", "Departamento");
  llenarSelect("filtroDistrito", "Distrito");

  document.getElementById("filtroActividad").addEventListener("change", aplicarFiltros);
  document.getElementById("filtroAnio").addEventListener("change", aplicarFiltros);
  document.getElementById("filtroDepartamento").addEventListener("change", aplicarFiltros);
  document.getElementById("filtroDistrito").addEventListener("change", aplicarFiltros);
  document.getElementById("filtroMapaBase").addEventListener("change", cambiarMapaBase);
}

function llenarSelect(id, campo) {
  const select = document.getElementById(id);
  select.innerHTML = '<option value="">Todos</option>';
  const valores = [...new Set(datos.map(r => r[campo]).filter(Boolean))].sort();

  valores.forEach(v => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    select.appendChild(opt);
  });
}

function cambiarMapaBase() {
  const valor = document.getElementById("filtroMapaBase").value;
  map.removeLayer(currentBase);
  currentBase = baseMaps[valor];
  currentBase.addTo(map);
}

function aplicarFiltros() {
  const actividad = document.getElementById("filtroActividad").value;
  const anio = document.getElementById("filtroAnio").value;
  const departamento = document.getElementById("filtroDepartamento").value;
  const distrito = document.getElementById("filtroDistrito").value;

  const filtrados = datos.filter(r =>
    (!actividad || r["Actividad"] === actividad) &&
    (!anio || r["Ano_plan"] === anio) &&
    (!departamento || r["Departamento"] === departamento) &&
    (!distrito || r["Distrito"] === distrito)
  );

  dibujarMapa(filtrados);
}

function dibujarMapa(registros) {
  markers.clearLayers();

  let totalArboles = 0;
  let totalHa = 0;

  registros.forEach(r => {
    const lon = decimal(r["Coord_X"]);
    const lat = decimal(r["Coord_Y"]);

    if (!lat || !lon || isNaN(lat) || isNaN(lon)) return;

    const arboles = numero(r["Arboles_plantados"]);
    const ha = decimal(r["Superficie_ha"]);

    totalArboles += arboles;
    totalHa += ha;

    const actividad = r["Actividad"] || "Sin actividad";
    const color = colorPorActividad[actividad] || "#2E7D32";

    const marker = L.circleMarker([lat, lon], {
      radius: 7,
      fillColor: color,
      color: "#ffffff",
      weight: 2,
      opacity: 1,
      fillOpacity: 0.9
    });

    const popup = `
      <div class="popup">
        <h3>🌳 ${actividad}</h3>
        <p>📅 <b>Año:</b> ${r["Ano_plan"] || ""}</p>
        <p>👤 <b>Beneficiario:</b> ${r["Nombre_beneficiario"] || ""}</p>
        <p>📍 <b>Departamento:</b> ${r["Departamento"] || ""}</p>
        <p>🗺️ <b>Distrito:</b> ${r["Distrito"] || ""}</p>
        <p>🌱 <b>Especies:</b> ${r["Especies_plantadas"] || ""}</p>
        <p>🌿 <b>Sistema:</b> ${limpiarTexto(r["Sist_forestal_impl"]) || ""}</p>
        <p>🌳 <b>Árboles:</b> ${formatearNumero(arboles)}</p>
        <p>📏 <b>Superficie:</b> ${r["Superficie_ha"] || ""} ha</p>
        `;

    marker.bindPopup(popup);
    marker.addTo(markers);
  });

  document.getElementById("totalRegistros").textContent = registros.length.toLocaleString("es-PY");
  document.getElementById("totalArboles").textContent = totalArboles.toLocaleString("es-PY");
  document.getElementById("totalHa").textContent = totalHa.toLocaleString("es-PY", { maximumFractionDigits: 1 });

  if (markers.getLayers().length > 0) {
    map.fitBounds(markers.getBounds(), { padding: [30, 30] });
  }
}

function dibujarLeyenda() {
  const cont = document.getElementById("leyenda");
  cont.innerHTML = "<h4>🌿 Proyectos / Actividades</h4>";

  Object.keys(colorPorActividad).forEach(act => {
    const item = document.createElement("div");
    item.className = "leyenda-item";
    item.innerHTML = `
      <span class="color-box" style="background:${colorPorActividad[act]}"></span>
      <span>${act}</span>
    `;
    cont.appendChild(item);
  });
}

function limpiarTexto(valor) {
  if (!valor) return "";
  return String(valor).replace(/_/g, " ");
}

function formatearNumero(valor) {
  return Number(valor || 0).toLocaleString("es-PY");
}