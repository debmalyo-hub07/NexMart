import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  // Browser journeys run through Playwright, not Vitest's Node environment.
  test: { environment: 'node', include: ['src/**/*.test.{ts,tsx}'] },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
});
