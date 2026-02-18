import { defineConfig } from 'vite'

export default defineConfig({
    build: {
        lib: {
            entry: 'src/index.ts',
            name: 'FoldUIBuilder',
            fileName: 'foldui-builder',
        },
        rollupOptions: {
            external: ['foldui'],
        },
    },
})
