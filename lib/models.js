/**************************************
 * Copyright (c) envbee
 * Licensed under the MIT License.
 **************************************/

const VariableType = Object.freeze({
  STRING: "STRING",
  NUMBER: "NUMBER",
  BOOLEAN: "BOOLEAN",
  JSON: "JSON"
});

const normalizeVariableType = function normalizeVariableType(type) {
  if (typeof type !== "string") {
    throw new Error("Variable type is required");
  }

  const normalized = type.toUpperCase();
  if (!Object.prototype.hasOwnProperty.call(VariableType, normalized)) {
    throw new Error(`Unsupported variable type: ${type}`);
  }

  return VariableType[normalized];
};

const toVariable = function toVariable(raw) {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid variable payload");
  }

  return {
    id: Number(raw.id),
    type: normalizeVariableType(raw.type),
    name: raw.name,
    description: raw.description ?? null
  };
};

const toVariableValue = function toVariableValue(raw) {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid variable value payload");
  }

  return {
    id: Number(raw.id),
    variable_id: Number(raw.variable_id),
    content: raw.content ?? {}
  };
};

module.exports = {
  VariableType,
  toVariable,
  toVariableValue
};
