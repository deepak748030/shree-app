/**
 * Lint rules chosen for this codebase, not copied from a template.
 *
 *  • `react-hooks` is the important one here: a missing dependency array entry
 *    is the usual cause of a stale cache in this dashboard, which looks like a
 *    performance bug but is a correctness bug.
 *  • Unused vars are errors (they survive refactors and confuse readers), with
 *    the standard `_` escape hatch for intentionally ignored arguments.
 *  • Type-aware linting is intentionally off: `tsc --noEmit` already type-checks
 *    the whole project, so duplicating it here only slows the feedback loop.
 */
module.exports = {
    root: true,
    env: { browser: true, es2022: true },
    parser: '@typescript-eslint/parser',
    parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    settings: { react: { version: '18.3' } },
    plugins: ['@typescript-eslint', 'react-hooks', 'react-refresh'],
    extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
    ignorePatterns: ['dist', 'node_modules', 'server', 'shree-app', '*.cjs'],
    rules: {
        'no-unused-vars': 'off',
        '@typescript-eslint/no-unused-vars': [
            'error',
            { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
        ],
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-empty-object-type': 'off',
        'react-hooks/rules-of-hooks': 'error',
        'react-hooks/exhaustive-deps': 'warn',
        'react-refresh/only-export-components': 'off',
        'no-empty': ['error', { allowEmptyCatch: true }],
        eqeqeq: ['warn', 'smart'],
        'prefer-const': 'warn',
    },
};
