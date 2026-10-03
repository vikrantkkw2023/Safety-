import { access } from "node:fs/promises";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const asyncStorageMock = pathToFileURL(
  resolvePath(dirname(fileURLToPath(import.meta.url)), "mocks", "async-storage.ts"),
).href;

export async function resolve(specifier, context, defaultResolve) {
  if (specifier === "@react-native-async-storage/async-storage") {
    return { url: asyncStorageMock, shortCircuit: true };
  }

  if (
    specifier.startsWith(".") &&
    !/\.(?:js|mjs|cjs|ts|tsx|jsx|json)$/.test(specifier)
  ) {
    const parentPath = dirname(fileURLToPath(context.parentURL));
    const candidate = resolvePath(parentPath, specifier + ".ts");
    try {
      await access(candidate);
      return { url: pathToFileURL(candidate).href, shortCircuit: true };
    } catch {}
  }

  return defaultResolve(specifier, context, defaultResolve);
}
