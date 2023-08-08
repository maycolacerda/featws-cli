/* These lines of code are importing the necessary modules and functions for the transpiler script to
work. */
const fs = require("fs");
const ejs = require("ejs");
const { parser } = require("../parser");

/**
 * The function resolves nested access in JavaScript by replacing dot notation with method calls.
 * @param params - A string representing a nested access path. For example, "obj1.obj2.obj3" would
 * represent accessing the property "obj3" of the object "obj2", which is a property of the object
 * "obj1".
 * @param typeCast - The `typeCast` parameter is an optional argument that specifies the type casting
 * method to be used when accessing the nested property.
 * @returns The function `resolveNestedAccess` returns the modified `params` string with nested access
 * resolved using the `typeCast` parameter.
 */
function resolveNestedAccess(params, typeCast) {
  let nestedAccess = "";
  if (params) {
    nestedAccess = params.replace(/\.(\w+)\./g, `.GetMap("$1").`);

    let accessMethod = resolveAccessMethod(typeCast ? typeCast : "");

    nestedAccess = nestedAccess.replace(
      /\.(\w+)$/,
      `.${accessMethod}("$1")`
    );
  }
  return nestedAccess;
}

/**
 * The function `calcTypeAndSource` determines the type and source of a given entry based on the
 * provided scope, options, and entryname.
 * @param scope - The scope parameter is a string that determines the source of the variable. It can
 * have two possible values: "#" or "$".
 * @param options - The `options` parameter is an object that contains two properties: `features` and
 * `parameters`.
 * @param entryname - The `entryname` parameter is a string that represents the name of an entry.
 * @returns an object with two properties: "type" and "source".
 */
function calcTypeAndSource(scope, options, entryname) {
  let source = "";
  let type = "";

  if (scope === "#") {
    source = "result";
    const feat = options.features.find((f) => f.name === entryname);
    if (feat) {
      type = feat.type;
      if (typeof feat.result !== "undefined" && !feat.result) {
        source = "ctx";
      }
    }
  }
  if (scope === "$") {
    source = "ctx";
    const param = options.parameters.find((p) => p.name === entryname);
    if (param) {
      type = param.type;
    }
  }


  if (source === "") throw Error("Not implemented source: " + scope);
  return { type, source };
}

/**
 * The function transpileValue takes an outputType and an expression as input and returns the
 * transpiled value based on the outputType.
 * @param outputType - The `outputType` parameter is a string that specifies the desired type of the
 * transpiled value. It can have one of the following values: "string", "object", "integer", or
 * "decimal".
 * @param expression - The expression parameter is a string that represents a value or an expression in
 * a programming language. It can be a variable, a literal value, or a combination of both.
 * @returns the transpiled value based on the given output type and expression.
 */
function transpileValue(outputType, expression) {
  if (outputType === "string") {
    if (expression.startsWith("ctx.") || expression.startsWith("result.")) {
      return `${expression} + ""`;
    } else if (!expression.startsWith('"')) {
      return `"${expression}"`;
    }
  }
  if (outputType === "object") {
    return `processor.ToMap(${JSON.stringify(expression)})`;
  }
  if ((outputType === "integer") || (outputType === "decimal")) {
    return `${expression}`;
  }
  return expression;
}

/**
 * The function "resolveAccessMethod" returns the appropriate access method based on the input type.
 * @param type - The `type` parameter is a string that represents the data type of the object we want
 * to access.
 * @returns the access method based on the input type.
 */
function resolveAccessMethod(type) {
  let accessMethod = "Get";
  if (type === "object") accessMethod = "GetMap";
  if (type === "string") accessMethod = "GetString";
  if (type === "boolean") accessMethod = "GetBool";
  if (type === "integer") accessMethod = "GetInt";
  if (type === "decimal") accessMethod = "GetFloat";
  if (type === "slice") accessMethod = "GetSlice";
  return accessMethod;
}

/**
 * The transpileReplacer function is used to replace placeholders in a string with corresponding code
 * snippets based on certain rules and options.
 * @param options - The `options` parameter is an object that contains configuration options for the
 * `transpileReplacer` function. It is used to customize the behavior of the function.
 * @returns The function `transpileReplacer` returns a transpiled code snippet based on the provided
 * options and input parameters.
 */
const transpileReplacer = (options) => (all, scope, entryname, params) => {

  if (scope === "%") {
    return `processor.Contains(ctx.GetSlice("${entryname}_entries"), ctx.Get("${entryname}_value"))`;
  }

  if (scope === "@") scope = "#";

  let { type, source } = calcTypeAndSource(scope, options, entryname);

  let typeCast = all.match(/::(\w+)$/);
  if (typeCast) {
    typeCast = typeCast[1];
  }

  if (!params && typeCast) {
    type = typeCast;
  }

  let accessMethod = resolveAccessMethod(type);
  if (accessMethod === "")
    throw Error(
      "Not implemented accessMethod: " +
      JSON.stringify({
        scope,
        entryname,
        type,
        required,
      })
    );

  let nestedAccess = resolveNestedAccess(params, typeCast);

  return `${source}.${accessMethod}("${entryname}")${nestedAccess}`;
};

/**
 * The function `buildDefaultValues` takes in an array of features and an object of parameters, filters
 * the features that have a default value defined, transpiles the default value based on the feature's
 * type and parameters, and returns an array of objects containing the feature name and its transpiled
 * default value.
 * @param features - An array of feature objects. Each feature object has a "name" property and a
 * "default" property.
 * @param parameters - The `parameters` parameter is an object that contains additional information or
 * values that may be needed during the transpilation process. It is used as a reference when
 * transpiling the default value of a feature.
 * @returns an array of objects. Each object in the array has two properties: "name" and
 * "defaultValue".
 */
function buildDefaultValues(features, parameters) {
  return features
    .filter((feat) => typeof feat.default !== "undefined")
    .map((feat) => ({
      name: feat.name,
      defaultValue: transpile(feat.default, {
        outputType: typeof feat.default === "boolean" || feat["type"] === "boolean"
          ? "string"
          : feat["type"],
        parameters,
        features,
      }),
    }))
    .filter((feat) => feat.defaultValue !== undefined);
}

/**
 * The transpile function takes an expression and options as input, and returns the transpiled
 * expression based on the specified options.
 * @param expression - The `expression` parameter is the input expression that needs to be transpiled.
 * It can be of any type, but if it is an object or a boolean, it will be converted to a JSON string
 * using `JSON.stringify()`.
 * @param options - The `options` parameter is an object that contains configuration options for the
 * transpile function. It can have the following properties:
 * @returns The `transpile` function returns the transpiled expression.
 */
const transpile = (expression, options) => {
  if (typeof expression === "object" || typeof expression === "boolean") {
    expression = JSON.stringify(expression);
  }

  expression = expression.replace(
    /([$#%@])(\w+)((\.?\w+)*)(::(\w+))?/g,
    transpileReplacer(options)
  );

  expression = transpileValue(options.outputType, expression);

  return expression;
};

/**
 * The transpiler function takes a directory as input, parses the data in that directory, transforms
 * the data, and then writes the transformed data to a file.
 * @param dir - The `dir` parameter is a string that represents the directory path where the transpiled
 * output file will be saved.
 */
const transpiler = async (dir) => {
  try {
    const data = (await parser(dir));

    data.featureRules = data.featureRules.map(fr => ({
      ...fr,
      accessMethod: resolveAccessMethod(fr.outputType),
      condition: fr.condition != "true"
        ? transpile(fr.condition, {
          outputType: "boolean",
          parameters: data.parameters,
          features: data.features,
        })
        : "true",
      expression: transpile(fr.expression, {
        outputType: fr.outputType,
        parameters: data.parameters,
        features: data.features,
      }),
    }));

    data.defaultValues = buildDefaultValues(data.features, data.parameters);

    const grl = await ejs.renderFile(__dirname + "/resources/rules.ejs", data);

    const outputFile = dir + "/rules.grl";

    fs.writeFileSync(outputFile, grl);
  } catch (e) {
    console.error(e);
    throw e;
  }
};

/* `module.exports` is a special object in Node.js that is used to define the public interface of a
module. In this case, it is exporting the `transpiler` function from the module, making it
accessible to other parts of the code that import this module. This allows other files to use the
`transpiler` function by importing it using the `require` function. */
module.exports = {
  transpiler,
};
