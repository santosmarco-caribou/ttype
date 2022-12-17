import typescript from '@rollup/plugin-typescript'

export default [
  {
    input: './src/index.ts',
    output: [
      {
        file: './dist/index.mjs',
        format: 'es',
        sourcemap: false,
      },
      {
        file: './dist/index.umd.js',
        name: 'ttype',
        format: 'umd',
        sourcemap: false,
      },
    ],
    plugins: [
      typescript({
        tsconfig: './tsconfig.esm.json',
        sourceMap: false,
      }),
    ],
  },
]
