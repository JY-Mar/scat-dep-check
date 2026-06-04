import { defineConfig, type Options } from 'tsup'

export default defineConfig(() => {
  const entry = ['src/index.ts']
  const shared: Options = {
    entry,
    outDir: 'dist',
    clean: true,
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: ['log']
      },
      mangle: {
        eval: true,
        toplevel: true
      },
      format: {
        comments: false
      }
    },
    external: ['fs', 'path', 'os', 'process', 'child_process', 'readline']
  }
  return [
    {
      ...shared,
      format: ['esm'],
      dts: {
        bundle: true,
        entry,
        out: 'index.d.ts'
      }
    },
    {
      ...shared,
      format: ['cjs'],
      dts: false
    }
  ]
})
