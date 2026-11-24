declare module 'node:test' { const test: (name: string, callback: () => void) => void; export default test; }
declare module 'node:assert/strict' { const assert: any; export default assert; }
