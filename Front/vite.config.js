import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cp, mkdir, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

async function copyModelsWithoutUnusedFormats(source, destination) {
  await mkdir(destination, { recursive: true });
  const entries = await readdir(source, { withFileTypes: true });

  await Promise.all(entries.map(async entry => {
    const sourcePath = resolve(source, entry.name);
    const destinationPath = resolve(destination, entry.name);
    if (entry.isDirectory()) {
      await copyModelsWithoutUnusedFormats(sourcePath, destinationPath);
    } else if (!entry.name.toLowerCase().endsWith('.stl')) {
      await cp(sourcePath, destinationPath);
    }
  }));
}

export default defineConfig({
  plugins: [react(), {
    name: 'copy-collected-space-assets',
    apply: 'build',
    async closeBundle() {
      const root = process.cwd();
      await Promise.all([
        copyModelsWithoutUnusedFormats(resolve(root, 'Models'), resolve(root, 'dist', 'Models')),
        cp(resolve(root, 'Skybox-bg'), resolve(root, 'dist', 'Skybox-bg'), { recursive: true }),
      ]);
    },
  }],
  base: './',
});
