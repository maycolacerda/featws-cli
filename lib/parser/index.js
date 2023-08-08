/* These lines of code are importing the `js-featws` module and the `fs` module in Node.js. */
const featws = require("js-featws");
const fs = require("fs");

const base_salience = 1000;

/**
 * The function "toBool" converts a string to lowercase if it is a string, and returns the input value.
 * @param s - The parameter `s` is a variable that represents a value that can be of any data type, but
 * it is expected to be a string.
 * @returns the value of the variable `s`.
 */
const toBool = (s) => {
  if (typeof s === "string") {
    s = s.toLowerCase();
  }
  return s;
};

/**
 * The `parser` function reads and parses files in a given directory to extract rules, parameters,
 * features, and groups, and then calls the `parse` function with the extracted data.
 * @param dir - The `dir` parameter is a string that represents the directory path where the files are
 * located. It is used to specify the location of the rules file, parameters file, features file, and
 * groups directory.
 * @returns The `parser` function returns the result of calling the `parse` function with the
 * `rulesPlain`, `parameters`, `features`, and `groups` as arguments.
 */
const parser = async (dir) => {
  try {
    let rulesPlain;

    if (fs.existsSync(dir + "/rules.featws")) {
      const rulesFile = dir + "/rules.featws";
      const file = fs.readFileSync(rulesFile, "utf8");
      rulesPlain = featws.parse(file);
    } else if (fs.existsSync(dir + "/rules.json")) {
      const rulesFile = dir + "/rules.json";
      rulesPlain = require(rulesFile);
    }

    if (typeof rulesPlain === "undefined") {
      throw new Error("Rules file not founded");
    }

    const parametersFile = dir + "/parameters.json";
    const parameters = require(parametersFile);

    const featuresFile = dir + "/features.json";
    const features = require(featuresFile);

    const groups = {};
    const groupsDir = dir + "/groups/";

    if (fs.existsSync(groupsDir)) {
      const groupFiles = fs.readdirSync(groupsDir, "utf8");
      groupFiles.forEach((gf) => {
        groups[gf.substring(0, gf.length - 5)] = require(groupsDir + gf);
      });
    }

    return parse(rulesPlain, parameters, features, groups);

  } catch (e) {
    throw e;
  }
};


/**
 * The `parse` function takes in rules, parameters, features, and groups, and returns an object
 * containing various properties and calculations based on the input.
 * @param rulesPlain - The `rulesPlain` parameter is a plain object that represents the rules for
 * parsing.
 * @param parameters - An array of objects representing the parameters used in the parsing process.
 * Each object has properties such as "name", "type", "required", and "resolver".
 * @param features - The `features` parameter is an array that contains information about the features
 * being used in the code. It is used in the `setupGroups` and `setupSlices` functions to set up the
 * groups and slices based on the provided rules.
 * @param groups - An array of group objects. Each group object represents a group of features and has
 * the following properties:
 * @returns The function `parse` returns an object with the following properties:
 */
async function parse(rulesPlain, parameters, features, groups) {
  try {
    features = setupGroups(groups, rulesPlain, features);

    const slices = [];

    features = setupSlices(rulesPlain, slices, features);

    const saliences = await calcSaliences(rulesPlain, features, parameters);

    const requiredParams = parameters.filter((p) => toBool(p.required));

    return {
      parameters,
      features,
      groups,
      slices,
      remoteLoadeds: parameters.filter((p) => !!p.resolver),
      requiredParams,
      setupReady: requiredParams.length == 0,
      featureRules: buildRules(rulesPlain, features, parameters, saliences),
    };
  } catch (e) {
    throw e;
  }
}

/**
 * The function `buildRules` takes in plain rules, features, parameters, and saliences, and returns an
 * array of processed rules.
 * @param rulesPlain - The `rulesPlain` parameter is an object that contains the rules in a plain
 * format. Each key in the object represents a feature, and the value represents the rule for that
 * feature.
 * @param features - An array of objects representing the features. Each object should have a "name"
 * property representing the name of the feature, and an optional "type" property representing the data
 * type of the feature (default is "boolean").
 * @param parameters - The `parameters` parameter is an object that contains additional configuration
 * options for building the rules. It is not used in the provided code snippet, so its purpose and
 * structure are not clear.
 * @param saliences - The `saliences` parameter is an object that contains the salience values for each
 * feature. The salience value determines the priority or importance of a rule. It is used to determine
 * the order in which rules are evaluated and executed.
 * @returns The function `buildRules` returns an array of objects. Each object represents a rule and
 * contains properties such as `name`, `outputType`, `condition`, `precedence`, `expression`, and
 * `result`.
 */
function buildRules(rulesPlain, features, parameters, saliences) {
  return Object.keys(rulesPlain).map((feat) => {
    const rule = rulesPlain[feat];
    let expression = rule;
    const condition = `${typeof expression.condition == "undefined"
      ? "true"
      : expression.condition}`;
    let result = true;
    const feature = features.find((f) => f.name == feat) || {
      type: "boolean",
    };
    let outputType = feature["type"];

    if (typeof rule === "object") {
      if (rule.type) {
        outputType = expression.type;
      }
      if (rule.value) {
        expression = expression.value;
      }
      if (typeof rule.result === "boolean") {
        result = rule.result;
      }
    }

    return {
      ...feature,
      name: feat,
      outputType,
      condition,
      precedence: `${saliences[feat] || base_salience}`,
      expression,
      result,
    };
  });
}

/**
 * The function `calcSaliences` calculates the salience values for each feature based on the given
 * rules, features, and parameters.
 * @param rulesPlain - The `rulesPlain` parameter is a plain object that represents a set of rules.
 * Each rule is represented as a key-value pair, where the key is the name of the rule and the value is
 * the condition of the rule.
 * @param features - The `features` parameter is an object that represents the features used in the
 * calculation. It contains key-value pairs where the keys are the feature names and the values are the
 * feature values.
 * @param parameters - The parameters are the values used in the calculation of saliences. They are not
 * specified in the code snippet provided, so you would need to provide the specific values for the
 * parameters in order to use the function correctly.
 * @returns an object called "saliences" which contains the salience values for each feature.
 */
async function calcSaliences(rulesPlain, features, parameters) {
  const calcOrder = await calcOrders(rulesPlain, features, parameters);

  const maxLevel = Math.max(...Object.values(calcOrder));

  const saliences = {};

  Object.keys(calcOrder).forEach((feat) => {
    saliences[feat] = base_salience + maxLevel - calcOrder[feat];
  });
  return saliences;
}

/**
 * The function `calcOrders` calculates the order in which features should be processed based on a set
 * of rules, features, and parameters.
 * @param rulesPlain - The `rulesPlain` parameter is a plain object that represents the rules for
 * calculating the order of features. It contains information about the dependencies between features
 * and their precedence.
 * @param features - The `features` parameter is an array that contains the names of all the features
 * that need to be calculated.
 * @param parameters - The `parameters` parameter is an object that contains the values for the
 * variables used in the calculation. These values are used to evaluate the rules and determine the
 * calculation order.
 * @returns The function `calcOrders` returns the `calcOrder` object, which represents the calculated
 * order of features.
 */
async function calcOrders(rulesPlain, features, parameters) {

  const entries = buildVariables(features, parameters, rulesPlain);

  const calcOrder = {};

  const precedence = calcPrecedences(rulesPlain);

  while (Object.keys(precedence).length > 0) {
    const feats = Object.keys(precedence);
    for (const feat of feats) {
      if (precedence[feat].length == 0) {
        calcOrder[feat] = 0;
        delete precedence[feat];
      } else {
        await calcOrderFeat(precedence, feat, calcOrder, entries);
      }
    }

  }
  return calcOrder;
}

/**
 * The function `calcOrderFeat` calculates the order of precedence for a given feature based on a set
 * of rules and entries.
 * @param precedence - The `precedence` parameter is an object that represents the precedence of
 * features. It has feature names as keys and an array of precedence values as values. The precedence
 * values can be either integers or strings starting with a "@" symbol, which indicate a reference to
 * another feature.
 * @param feat - The `feat` parameter represents a feature or entry that needs to be calculated in a
 * specific order.
 * @param calcOrder - The `calcOrder` parameter is an object that represents the calculation order for
 * each feature. It stores the feature name as the key and the calculation order as the value.
 * @param entries - The `entries` parameter is an array of strings representing the names of entries.
 */
async function calcOrderFeat(precedence, feat, calcOrder, entries) {
  const unresolvedPrecedences = precedence[feat].filter(
    (p) => !Number.isInteger(p)
  );
  if (unresolvedPrecedences.length != 0) {
    // FIXME Tratar a referência cíclica
    //   const cyclic = unresolvedPrecedences.filter(value => Object.keys(precedence).includes(value.substring(1)));
    //   if (JSON.stringify(cyclic)==JSON.stringify(unresolvedPrecedences)) {
    //       throw Error("Referência cíclica");
    //   }
    precedence[feat] = await Promise.all(
      precedence[feat].map(async (p) => {
        if (Number.isInteger(p)) return p;
        const name = p.substring(1);

        if (!entries.includes(name)) {
          throw Error(`Unresolvable entry: ${name}`);
        }

        if (name in calcOrder) return calcOrder[name];

        return p;
      })
    );
  } else {
    calcOrder[feat] = Math.max(...precedence[feat]) + 1;
    delete precedence[feat];
  }
}

/**
 * The function "buildVariables" takes in three arrays (features, parameters, and rulesPlain), extracts
 * the names from each array, combines them into one array, removes any duplicate values, and sorts the
 * final array.
 * @param features - An array of objects representing features. Each object has a property "name" which
 * represents the name of the feature.
 * @param parameters - An array of objects representing parameters. Each object has a property "name"
 * which represents the name of the parameter.
 * @param rulesPlain - An object containing rules.
 * @returns an array of variables.
 */
function buildVariables(features, parameters, rulesPlain) {
  return features
    .map((feat) => feat.name)
    .concat(parameters.map((param) => param.name))
    .concat(Object.keys(rulesPlain))
    .filter((value, index, self) => {
      return self.indexOf(value) === index;
    })
    .sort();
}

/**
 * The function `calcPrecedences` takes in a plain object of rules and returns a new object that maps
 * each feature to an array of precedence values extracted from the rules.
 * @param rulesPlain - The `rulesPlain` parameter is an object that contains rules for calculating
 * precedences. Each rule is associated with a feature and can have a condition and a value. The
 * `rulesPlain` object has the following structure:
 * @returns The function `calcPrecedences` returns an object `precedence` which contains the calculated
 * precedences for each feature.
 */
function calcPrecedences(rulesPlain) {
  const precedence = {};

  Object.keys(rulesPlain).forEach((feat) => {
    let rule = rulesPlain[feat];
    if (typeof rule === "object") {
      const condition = rule.condition;
      rule = JSON.stringify(rule.value);

      if (typeof condition != "undefined") {
        rule += ` ${condition}`;
      }
    }

    if (typeof rule !== "string") rule = JSON.stringify(rule);

    precedence[feat] = [];
    precedence[feat] = precedence[feat].concat(
      rule.match(/[#@](\w+)/g) || []
    );
    precedence[feat] = precedence[feat].concat(
      (rule.match(/%(\w+)/g) || []).map((g) => `$${g.substring(1)}_value`)
    );
  });
  return precedence;
}

/**
 * The function `setupSlices` takes in a set of rules, slices, and features, and modifies them to
 * include additional entries for each rule in the slices.
 * @param rulesPlain - The `rulesPlain` parameter is an object that contains rules for different
 * features. Each key in the object represents a feature, and the corresponding value is either a
 * single rule or an array of rules for that feature.
 * @param slices - The `slices` parameter is an array that contains the names of the slices.
 * @param features - An array of objects representing features. Each object has the following
 * properties:
 * @returns the updated `features` array.
 */
function setupSlices(rulesPlain, slices, features) {
  Object.keys(rulesPlain).forEach((feat) => {
    const rule = rulesPlain[feat];
    if (Array.isArray(rule)) {
      if (!slices.includes(feat)) {
        slices.push(feat);
      }
      rule.forEach((r, i) => {
        const entry_name = feat + "_" + i;
        features = features.concat([
          {
            name: entry_name,
            type: r.type,
            result: false,
          },
        ]);
        rulesPlain[entry_name] = {
          ...r,
          result: false,
        };
      });
      delete rulesPlain[feat];
      const feature = {
        name: feat,
        type: "slice",
        writeMethod: "AddItems",
        result: true,
      };
      rulesPlain[feat] = {
        ...feature,
        value: rule.map((_, i) => "#" + feat + "_" + i).join(", "),
      };
      features = features.concat([feature]);
    }
  });
  return features;
}

/**
 * The function `setupGroups` sets up group rules and features based on the provided groups, rules, and
 * features.
 * @param groups - An object containing groups and their corresponding rules. Each group is represented
 * by a key, and the value is an object containing rules for that group.
 * @param rulesPlain - `rulesPlain` is an object that contains the rules for each group. Each rule is
 * represented by a key-value pair, where the key is the rule name and the value is an object that
 * contains the rule details (value, type, result).
 * @param features - The `features` parameter is an array of objects that represent the features of the
 * groups. Each object has two properties: `name` and `type`. The `name` property represents the name
 * of the feature, and the `type` property represents the type of the feature (e.g., "
 * @returns the updated `features` array.
 */
function setupGroups(groups, rulesPlain, features) {
  Object.entries(groups).forEach(([group, rules]) => {
    const group_feats = Object.entries(rules).map(([rule, items], index) => {
      const group_feat = `${group}_${index}`;
      const group_feat_value = `${group_feat}_value`;
      rule = transpileGroupRule(rule);
      rulesPlain[group_feat_value] = {
        value: rule,
        type: "string",
        result: false,
      };
      rulesPlain[group_feat] = {
        value: `%${group_feat}`,
        type: "boolean",
        result: true,
      };
      features = features.concat([
        {
          name: group_feat,
          type: "boolean",
        },
      ]);
      return `#${group_feat}`;
    });
    features = features.concat([
      {
        name: group,
        type: "boolean",
      },
    ]);
    rulesPlain[group] = {
      value: group_feats.join(" && "),
      type: "boolean",
      result: true,
    };
  });
  return features;
}

/**
 * The transpileGroupRule function takes a rule as input and transpiles it into a string that can be
 * used in JavaScript code.
 * @param rule - The `rule` parameter is a string representing a group rule.
 * @returns The function `transpileGroupRule` returns the modified `rule` string.
 */
function transpileGroupRule(rule) {
  rule = `"${rule}"`;
  rule = rule.replace(/{/g, '"+');
  rule = rule.replace(/}/g, '+"');
  rule = rule.trim();
  rule = rule.replace(/^""\+/, "");
  rule = rule.replace(/\+""$/, "");
  return rule;
}

/* The above code is exporting an object with a property called `parser`. The value of `parser` is not
defined in the code snippet. */
module.exports = {
  parser,
};
