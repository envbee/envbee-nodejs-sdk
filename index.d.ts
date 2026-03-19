declare namespace EnvbeeSDK {
  interface InitParams {
    key?: string | null;
    secret?: string | null;
    apiURL?: string;
    encKey?: string | Uint8Array;
  }

  interface Metadata {
    limit: number;
    offset: number;
    total: number;
  }

  type VariableType = "STRING" | "NUMBER" | "BOOLEAN" | "JSON";

  interface Variable {
    id: number;
    type: VariableType;
    name: string;
    description: string | null;
  }

  interface VariableValueContent {
    value?: unknown;
    [key: string]: unknown;
  }

  interface VariableValue {
    id: number;
    variable_id: number;
    content: VariableValueContent;
  }

  interface VariablesResult<T> {
    data: T[];
    metadata: Metadata;
  }

  interface VariableTypeMap {
    readonly STRING: "STRING";
    readonly NUMBER: "NUMBER";
    readonly BOOLEAN: "BOOLEAN";
    readonly JSON: "JSON";
  }

  interface Client {
    readonly VariableType: VariableTypeMap;
    get(variableName: string): Promise<string | number | boolean | null>;
    getVariables(offset?: number, limit?: number): Promise<VariablesResult<Record<string, unknown>>>;
    getVariablesValues(
      offset?: number,
      limit?: number
    ): Promise<VariablesResult<Record<string, unknown>>>;
    getVariablesTyped(offset?: number, limit?: number): Promise<VariablesResult<Variable>>;
    getVariablesValuesTyped(
      offset?: number,
      limit?: number
    ): Promise<VariablesResult<VariableValue>>;
    fillEnvVars(variableNames?: string[]): Promise<void>;
    setLogLevel(newLevel: "fatal" | "error" | "warn" | "info" | "debug" | "trace"): void;
  }
}

declare function envbeeInit(parameters?: EnvbeeSDK.InitParams): EnvbeeSDK.Client;

export = envbeeInit;
