// Why: Define shared types for the context system
export interface BaseContext {
  id: string;
  cleanup: Set<() => void>;
  parent?: BaseContext | null;
}

export interface ComponentContext extends BaseContext {
  type: "component";
  hooks: any[];
  hookIndex: number;
  signals: Set<any>;
  mounted: boolean;
  element: HTMLElement | null;
}

// Create a base value context type
export interface ValueContext extends BaseContext {
  value: any;
}

export interface SignalContext extends ValueContext {
  type: "signal";
}

export interface ComputedContext extends ValueContext {
  type: "computed";
  dependencies: Set<string>;
}

export interface GlobalContext extends BaseContext {
  type: "global";
  children: Set<BaseContext>;
}
