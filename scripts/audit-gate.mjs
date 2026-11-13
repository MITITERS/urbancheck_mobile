#!/usr/bin/env node
// Corre `npm audit` y falla ante cualquier vulnerabilidad alta o crítica que
// no figure en `audit-allowlist.json`.
//
// Es `npm audit --audit-level=high` con una sola diferencia: las excepciones
// revisadas. Algunas advertencias no tienen ninguna versión corregida publicada
// y solo alcanzan a herramientas de desarrollo que no llegan al bundle; sin
// esta lista, el pipeline quedaría rojo para siempre sin que nadie pueda
// arreglarlo. Cada entrada lleva el motivo y la fecha de revisión, y una
// entrada que ya no hace falta también hace fallar el control, para que la
// lista no acumule excepciones viejas.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const BLOCKING = new Set(["high", "critical"]);

function runAudit() {
  try {
    return execFileSync("npm", ["audit", "--json"], { encoding: "utf8" });
  } catch (error) {
    // `npm audit` sale con código distinto de cero si encuentra algo; el
    // reporte viene igual por stdout.
    if (error.stdout) return error.stdout;
    throw error;
  }
}

const allowlist = JSON.parse(readFileSync(new URL("../audit-allowlist.json", import.meta.url)));
const allowed = new Map(allowlist.map((entry) => [entry.advisory, entry]));
const report = JSON.parse(runAudit());

const advisories = new Map();
for (const vulnerability of Object.values(report.vulnerabilities ?? {})) {
  for (const via of vulnerability.via) {
    if (typeof via !== "object" || !BLOCKING.has(via.severity)) continue;
    const id = via.url.split("/").pop();
    advisories.set(id, { id, severity: via.severity, name: via.name, title: via.title });
  }
}

const blocking = [...advisories.values()].filter((advisory) => !allowed.has(advisory.id));
const stale = [...allowed.keys()].filter((id) => !advisories.has(id));

for (const advisory of advisories.values()) {
  const entry = allowed.get(advisory.id);
  const mark = entry ? "permitida" : "BLOQUEA";
  console.log(`${mark}  ${advisory.severity}  ${advisory.name}  ${advisory.id}  ${advisory.title}`);
  if (entry) console.log(`           motivo: ${entry.reason} (revisada ${entry.reviewed})`);
}
for (const id of stale) {
  console.log(`SOBRA     ${id} ya no aparece en npm audit: sacarla de audit-allowlist.json`);
}

if (blocking.length || stale.length) process.exit(1);
console.log("Sin vulnerabilidades altas o críticas fuera de las excepciones revisadas.");
