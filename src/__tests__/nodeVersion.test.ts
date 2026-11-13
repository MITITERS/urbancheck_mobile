import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * C-17: una sola versión de Node en todos lados: la de .nvmrc, la del CI y la
 * de `engines`.
 */
const read = (path: string) => readFileSync(resolve(__dirname, "../..", path), "utf8");

describe("versión de Node", () => {
  it("el CI, .nvmrc y engines coinciden", () => {
    const major = read(".nvmrc").trim();

    expect(major).toMatch(/^\d+$/);
    expect(read(".github/workflows/ci.yml")).toContain("node-version-file: '.nvmrc'");
    const engines = JSON.parse(read("package.json")).engines?.node ?? "";
    expect(engines).toMatch(new RegExp(`>=${major}\\.\\d+\\.\\d+ <${Number(major) + 1}`));
  });
});
