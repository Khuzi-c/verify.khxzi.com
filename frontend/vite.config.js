import { defineConfig } from 'vite';
import { resolve } from 'path';


export default defineConfig({
    build: {
        outDir: 'dist',
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                verify: resolve(__dirname, 'verify.html'),
                status: resolve(__dirname, 'status.html'),
                success: resolve(__dirname, 'success.html'),
            },
        },
    },
    server: {
        port: 5173
    }
});
