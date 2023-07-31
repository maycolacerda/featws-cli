const featws = require("js-featws");
const fs = require("fs");

const base_salience = 1000;

const toBool = (s) => {
  if (typeof s === "string") {
    s = s.toLowerCase();
  }
  return s;
};

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



async function calcSaliences(rulesPlain, features, parameters) {
  const calcOrder = await calcOrders(rulesPlain, features, parameters);

  const maxLevel = Math.max(...Object.values(calcOrder));

  const saliences = {};

  Object.keys(calcOrder).forEach((feat) => {
    saliences[feat] = base_salience + maxLevel - calcOrder[feat];
  });
  return saliences;
}

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

function transpileGroupRule(rule) {
  rule = `"${rule}"`;
  rule = rule.replace(/{/g, '"+');
  rule = rule.replace(/}/g, '+"');
  rule = rule.trim();
  rule = rule.replace(/^""\+/, "");
  rule = rule.replace(/\+""$/, "");
  return rule;
}

module.exports = {
  parser,
};
