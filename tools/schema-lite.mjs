/* A very small JSON Schema checker.
 *
 * ideas.schema.json is the published contract, but the site ships no dependencies
 * and `validateCatalog()` stays the runtime authority. Rather than pull in a full
 * implementation, this file supports exactly the keywords the schema uses and
 * says so out loud: anything outside SUPPORTED is rejected by lintSchema(), so the
 * schema cannot quietly rely on a keyword that is never enforced.
 *
 * Supported: $ref (local, "#/..."), type, enum, const, required, properties,
 * additionalProperties, items, prefixItems, minItems, maxItems, uniqueItems,
 * minLength, maxLength, pattern, minimum, maximum.
 * Ignored on purpose: title, description, $schema, $id (documentation only).
 */

const SUPPORTED = new Set([
  "$ref", "$schema", "$id", "$defs", "title", "description",
  "type", "enum", "const", "required", "properties", "additionalProperties",
  "items", "prefixItems", "minItems", "maxItems", "uniqueItems",
  "minLength", "maxLength", "pattern", "minimum", "maximum"
]);

const TYPES = new Set(["object", "array", "string", "number", "integer", "boolean", "null"]);

function typeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function resolve(ref, root) {
  if (typeof ref !== "string" || !ref.startsWith("#/")) return null;
  let node = root;
  for (const raw of ref.slice(2).split("/")) {
    const key = raw.replace(/~1/g, "/").replace(/~0/g, "~");
    if (node === null || typeof node !== "object" || !(key in node)) return null;
    node = node[key];
  }
  return node;
}

function checkType(value, type) {
  const actual = typeOf(value);
  if (type === "integer") return actual === "number" && Number.isInteger(value);
  return actual === type;
}

function walk(value, schema, root, path, errors) {
  if (schema === true || schema === undefined) return;
  if (schema === false) {
    errors.push(`${path} is not allowed here`);
    return;
  }
  if (typeof schema !== "object" || schema === null) return;

  if (schema.$ref) {
    const target = resolve(schema.$ref, root);
    if (!target) {
      errors.push(`${path} has an unresolvable $ref ${schema.$ref}`);
      return;
    }
    walk(value, target, root, path, errors);
    return;
  }

  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => checkType(value, t))) {
      errors.push(`${path} should be ${types.join(" or ")}, not ${typeOf(value)}`);
      return;
    }
  }

  if (schema.const !== undefined && JSON.stringify(value) !== JSON.stringify(schema.const)) {
    errors.push(`${path} should be ${JSON.stringify(schema.const)}`);
  }

  if (Array.isArray(schema.enum) && !schema.enum.some((v) => JSON.stringify(v) === JSON.stringify(value))) {
    errors.push(`${path} should be one of ${schema.enum.join(", ")}`);
  }

  if (typeof value === "string") {
    if (typeof schema.minLength === "number" && value.length < schema.minLength) {
      errors.push(`${path} is shorter than ${schema.minLength}`);
    }
    if (typeof schema.maxLength === "number" && value.length > schema.maxLength) {
      errors.push(`${path} is longer than ${schema.maxLength}`);
    }
    if (typeof schema.pattern === "string" && !new RegExp(schema.pattern).test(value)) {
      errors.push(`${path} does not match ${schema.pattern}`);
    }
  }

  if (typeof value === "number") {
    if (typeof schema.minimum === "number" && value < schema.minimum) {
      errors.push(`${path} is below ${schema.minimum}`);
    }
    if (typeof schema.maximum === "number" && value > schema.maximum) {
      errors.push(`${path} is above ${schema.maximum}`);
    }
  }

  if (Array.isArray(value)) {
    if (typeof schema.minItems === "number" && value.length < schema.minItems) {
      errors.push(`${path} needs at least ${schema.minItems} item${schema.minItems === 1 ? "" : "s"}`);
    }
    if (typeof schema.maxItems === "number" && value.length > schema.maxItems) {
      errors.push(`${path} allows at most ${schema.maxItems} item${schema.maxItems === 1 ? "" : "s"}`);
    }
    if (schema.uniqueItems === true) {
      const seen = new Set();
      value.forEach((item, i) => {
        const key = JSON.stringify(item);
        if (seen.has(key)) errors.push(`${path}[${i}] repeats an earlier item`);
        seen.add(key);
      });
    }
    if (Array.isArray(schema.prefixItems)) {
      schema.prefixItems.forEach((sub, i) => {
        if (i < value.length) walk(value[i], sub, root, `${path}[${i}]`, errors);
      });
    }
    if (schema.items) {
      value.forEach((item, i) => walk(item, schema.items, root, `${path}[${i}]`, errors));
    }
  }

  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    if (Array.isArray(schema.required)) {
      for (const key of schema.required) {
        if (!(key in value)) errors.push(`${path}.${key} is required`);
      }
    }
    const props = schema.properties || {};
    for (const [key, sub] of Object.entries(props)) {
      if (key in value) walk(value[key], sub, root, `${path}.${key}`, errors);
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in props)) errors.push(`${path}.${key} is not an allowed field`);
      }
    } else if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
      for (const key of Object.keys(value)) {
        if (!(key in props)) {
          walk(value[key], schema.additionalProperties, root, `${path}.${key}`, errors);
        }
      }
    }
  }
}

/** Validate `value` against `schema`. Returns a list of human-readable errors. */
export function validate(value, schema, root = schema) {
  const errors = [];
  walk(value, schema, root, "$", errors);
  return errors;
}

/**
 * Check the schema file itself: known keyword names, known type names, resolvable
 * $refs, and `required` names that actually exist in `properties`. A typo here is
 * otherwise invisible, because the schema is documentation until something reads it.
 */
export function lintSchema(schema, root = schema, path = "$") {
  const errors = [];
  lint(schema, root, path, errors);
  return errors;
}

function lint(schema, root, path, errors) {
  if (typeof schema === "boolean") return;
  if (!schema || typeof schema !== "object") {
    errors.push(`${path} should be an object or a boolean`);
    return;
  }
  for (const key of Object.keys(schema)) {
    if (!SUPPORTED.has(key)) errors.push(`${path}.${key} is not a supported keyword`);
  }
  if (schema.$ref) {
    if (!resolve(schema.$ref, root)) errors.push(`${path}.$ref ${schema.$ref} does not resolve`);
  }
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    for (const t of types) {
      if (!TYPES.has(t)) errors.push(`${path}.type ${t} is not a JSON type`);
    }
  }
  if (schema.pattern !== undefined) {
    try { new RegExp(schema.pattern); } catch (e) {
      errors.push(`${path}.pattern is not a valid regular expression: ${e.message}`);
    }
  }
  if (Array.isArray(schema.required) && schema.properties) {
    for (const key of schema.required) {
      if (!(key in schema.properties)) errors.push(`${path}.required names ${key}, which is not in properties`);
    }
  }
  if (schema.properties) {
    for (const [key, sub] of Object.entries(schema.properties)) {
      lint(sub, root, `${path}.properties.${key}`, errors);
    }
  }
  if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
    lint(schema.additionalProperties, root, `${path}.additionalProperties`, errors);
  }
  if (schema.items && typeof schema.items === "object") {
    lint(schema.items, root, `${path}.items`, errors);
  }
  if (Array.isArray(schema.prefixItems)) {
    schema.prefixItems.forEach((sub, i) => lint(sub, root, `${path}.prefixItems[${i}]`, errors));
  }
  if (schema.$defs) {
    for (const [key, sub] of Object.entries(schema.$defs)) {
      lint(sub, root, `${path}.$defs.${key}`, errors);
    }
  }
}
