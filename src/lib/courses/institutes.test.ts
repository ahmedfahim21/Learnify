import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { instituteLogo, LOGO_FILES } from "./institutes";

describe("instituteLogo", () => {
  it.each([
    ["IIT Kharagpur", "/institutes/iit-kharagpur.png"],
    ["IISc Bangalore", "/institutes/iisc.png"],
    ["IIT (BHU) Varanasi", "/institutes/iit-bhu.png"],
    ["IIT(BHU) Varanasi", "/institutes/iit-bhu.png"],
    ["IIT-ISM Dhanbad", "/institutes/iit-ism.png"],
    ["IIT-ISM", "/institutes/iit-ism.png"],
    ["IIT Bhubaneshwar", "/institutes/iit-bhubaneswar.png"],
    ["IIT Bhubaneswar", "/institutes/iit-bhubaneswar.png"],
    ["IIITB", "/institutes/iiit-bangalore.png"],
    ["IIIT Delhi", "/institutes/iiit-delhi.png"],
    ["IIT Bombay-Wipro 3D", "/institutes/iit-bombay.png"],
    ["Visva Bharati University, Santiniketan", "/institutes/visva-bharati.png"],
    ["Homi Bhabha National Institute (HBNI)", "/institutes/hbni.png"],
    ["ICMR-National Institute of Epidemiology", "/institutes/nie-icmr.png"],
  ])("finds the logo for %s", (name, path) => {
    expect(instituteLogo(name)).toBe(path);
  });

  it("doesn't confuse an IIIT with the IIT of the same city", () => {
    expect(instituteLogo("IIIT Hyderabad")).toBe("/institutes/iiit-hyderabad.png");
    expect(instituteLogo("IIT Hyderabad")).toBe("/institutes/iit-hyderabad.png");
  });

  it("returns null for an institute without a logo", () => {
    expect(instituteLogo("IIT Patna")).toBeNull();
    expect(instituteLogo("Multi-Institute")).toBeNull();
  });

  it("points only at files that exist", () => {
    for (const file of LOGO_FILES) expect(existsSync(join(process.cwd(), "public/institutes", `${file}.png`)), file).toBe(true);
  });
});
