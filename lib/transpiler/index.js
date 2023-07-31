const fs = require("fs");
const ejs = require("ejs");
const { parser } = require("../parser");

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

module.exports = {
  transpiler,
};
