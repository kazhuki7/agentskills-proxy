declare module 'vm2' {
  export interface VMOptions {
    timeout?: number;
    sandbox?: Record<string, any>;
    eval?: boolean;
    wasm?: boolean;
    fixAsync?: boolean;
    compiler?: string;
  }

  export class VM {
    constructor(options?: VMOptions);
    run(script: VMScript | string): any;
    setGlobals(globals: Record<string, any>): this;
    freeze(value: any, globalName?: string): this;
    protect(value: any, globalName?: string): this;
  }

  export class VMScript {
    constructor(code: string, filename?: string);
    compile(): this;
  }

  export class NodeVM extends VM {
    constructor(options?: VMOptions & {
      console?: 'inherit' | 'redirect' | 'off';
      require?: boolean | {
        external?: boolean | string[];
        builtin?: string[];
        root?: string;
        mock?: Record<string, any>;
        context?: 'host' | 'sandbox';
      };
      nesting?: boolean;
      wrapper?: 'commonjs' | 'none';
    });
    run(script: VMScript | string, filename?: string): any;
    require(module: string): any;
  }
}
