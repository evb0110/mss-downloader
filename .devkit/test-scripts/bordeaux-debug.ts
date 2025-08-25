#!/usr/bin/env bun

import { SharedManifestLoaders } from "../../src/shared/SharedManifestLoaders";

const url = process.argv[2] || "https://selene.bordeaux.fr/ark:/27705/330636101_MS_0778";

(async () => {
  const loaders = new SharedManifestLoaders();
  try {
    const res = await loaders.getBordeauxManifest(url);
    const images = Array.isArray(res) ? res : res.images;
    console.log("OK pages:", images?.length || 0);
    if (!Array.isArray(res)) {
      console.log("meta:", {
        baseId: res.baseId,
        tileBaseUrl: res.tileBaseUrl,
        startPage: res.startPage,
        pageCount: res.pageCount,
        type: res.type,
      });
    }
    process.exit(0);
  } catch (e) {
    console.error("ERROR:", (e as Error).message);
    process.exit(1);
  }
})();

