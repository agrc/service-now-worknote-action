import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';

const config = {
  input: 'src/index.ts',
  output: {
    esModule: true,
    file: 'dist/index.js',
    format: 'es',
    inlineDynamicImports: true,
    sourcemap: true,
  },
  plugins: [typescript(), resolve({ preferBuiltins: true }), commonjs()],
};

export default config;
