declare module 'pseudocode/src/Lexer' {
    export default class Lexer { constructor(source: string); }
}
declare module 'pseudocode/src/Parser' {
    export default class Parser {
        constructor(lexer: import('pseudocode/src/Lexer').default);
        parse(): { type: string; value?: string | { type?: string; name?: string; numElif?: number; hasElse?: boolean }; whitespace?: boolean; children?: ReturnType<Parser['parse']>[] | null };
    }
}
