class XMLNode {
  constructor(tagname, parent, val) {
    this.tagname = tagname;
    this.parent = parent;
    this.child = {};
    this.attrsMap = {};
    this.val = val;
  }

  addChild(child) {
    if (Array.isArray(this.child[child.tagname])) {
      this.child[child.tagname].push(child);
    } else {
      this.child[child.tagname] = [child];
    }
  }
}

const getAllMatches = function(string, regex) {
  const matches = [];
  let match = regex.exec(string);
  while (match) {
    const allmatches = [];
    const len = match.length;
    for (let index = 0; index < len; index++) {
      allmatches.push(match[index]);
    }
    matches.push(allmatches);
    match = regex.exec(string);
  }
  return matches;
};

const doesMatch = function(string, regex) {
  const match = regex.exec(string);
  return !(match === null || typeof match === 'undefined');
};

const doesNotMatch = function(string, regex) {
  return !doesMatch(string, regex);
};

const isExist = v => typeof v !== 'undefined';

const isEmptyObject = obj => Object.keys(obj).length === 0;

const getValue = v => {
  if (isExist(v)) {
    return v;
  } else {
    return '';
  }
};

const buildOptions = (options, defaultOptions, props) => {
  var newOptions = {};
  if (!options) {
    return defaultOptions; //if there are not options
  }

  for (let i = 0; i < props.length; i++) {
    if (options[props[i]] !== undefined) {
      newOptions[props[i]] = options[props[i]];
    } else {
      newOptions[props[i]] = defaultOptions[props[i]];
    }
  }
  return newOptions;
};

const TagType = {OPENING: 1, CLOSING: 2, SELF: 3, CDATA: 4};
let regx = '<((!\\[CDATA\\[([\\s\\S]*?)(]]>))|(([\\w:\\-._]*:)?([\\w:\\-._]+))([^>]*)>|((\\/)(([\\w:\\-._]*:)?([\\w:\\-._]+))\\s*>))([^<]*)';

const defaultOptions = {
  attrNodeName: false,
  textNodeName: '#text',
  ignoreNameSpace: false,
  parseNodeValue: true,
  parseAttributeValue: false,
  arrayMode: false,
  trimValues: true,
  cdataTagName: false,
  cdataPositionChar: '\\c',
  tagValueProcessor: function(a, tagName) {
    return a;
  },
  attrValueProcessor: function(a, attrName) {
    return a;
  },
  stopNodes: []
};

const props = [
  'attrNodeName',
  'textNodeName',
  'ignoreNameSpace',
  'parseNodeValue',
  'parseAttributeValue',
  'arrayMode',
  'trimValues',
  'cdataTagName',
  'cdataPositionChar',
  'tagValueProcessor',
  'attrValueProcessor',
  'parseTrueNumberOnly',
  'stopNodes'
];

const getTraversalObj = function(xmlData, options) {
  options = buildOptions(options, defaultOptions, props);
  xmlData = xmlData.replace(/<!--[\s\S]*?-->/g, ''); //Remove comments

  const xmlObj = new XMLNode('!xml');
  let currentNode = xmlObj;

  const tagsRegx = new RegExp(regx, 'g');
  let tag = tagsRegx.exec(xmlData);
  let nextTag = tagsRegx.exec(xmlData);
  while (tag) {
    const tagType = checkForTagType(tag);

    if (tagType === TagType.CLOSING) {
      //add parsed data to parent node
      if (currentNode.parent && tag[14]) {
        currentNode.parent.val = getValue(currentNode.parent.val) + '' + processTagValue(tag, options, currentNode.parent.tagname);
      }
      if (options.stopNodes.length && options.stopNodes.includes(currentNode.tagname)) {
        currentNode.child = []
        if (currentNode.attrsMap == undefined) { currentNode.attrsMap = {}}
        currentNode.val = xmlData.substr(currentNode.startIndex + 1, tag.index - currentNode.startIndex - 1)
      }
      currentNode = currentNode.parent;
    } else if (tagType === TagType.CDATA) {
      if (options.cdataTagName) {
        //add cdata node
        const childNode = new XMLNode(options.cdataTagName, currentNode, tag[3]);
        childNode.attrsMap = buildAttributesMap(tag[8], options);
        currentNode.addChild(childNode);
        //for backtracking
        currentNode.val = getValue(currentNode.val) + options.cdataPositionChar;
        //add rest value to parent node
        if (tag[14]) {
          currentNode.val += processTagValue(tag, options);
        }
      } else {
        currentNode.val = (currentNode.val || '') + (tag[3] || '') + processTagValue(tag, options);
      }
    } else if (tagType === TagType.SELF) {
      if (currentNode && tag[14]) {
        currentNode.val = getValue(currentNode.val) + '' + processTagValue(tag, options);
      }

      const childNode = new XMLNode(options.ignoreNameSpace ? tag[7] : tag[5], currentNode, '');
      if (tag[8] && tag[8].length > 0) {
        tag[8] = tag[8].substr(0, tag[8].length - 1);
      }
      childNode.attrsMap = buildAttributesMap(tag[8], options);
      currentNode.addChild(childNode);
    } else {
      //TagType.OPENING
      const childNode = new XMLNode(
        options.ignoreNameSpace ? tag[7] : tag[5],
        currentNode,
        processTagValue(tag, options)
      );
      if (options.stopNodes.length && options.stopNodes.includes(childNode.tagname)) {
        childNode.startIndex=tag.index + tag[1].length
      }
      childNode.attrsMap = buildAttributesMap(tag[8], options);
      currentNode.addChild(childNode);
      currentNode = childNode;
    }

    tag = nextTag;
    nextTag = tagsRegx.exec(xmlData);
  }

  return xmlObj;
};

function processTagValue(parsedTags, options, parentTagName) {
  const tagName = parsedTags[7] || parentTagName;
  let val = parsedTags[14];
  if (val) {
    if (options.trimValues) {
      val = val.trim();
    }
    val = options.tagValueProcessor(val, tagName);
    val = parseValue(val, options.parseNodeValue, options.parseTrueNumberOnly);
  }

  return val;
}

function checkForTagType(match) {
  if (match[4] === ']]>') {
    return TagType.CDATA;
  } else if (match[10] === '/') {
    return TagType.CLOSING;
  } else if (typeof match[8] !== 'undefined' && match[8].substr(match[8].length - 1) === '/') {
    return TagType.SELF;
  } else {
    return TagType.OPENING;
  }
}

function resolveNameSpace(tagname, options) {
  if (options.ignoreNameSpace) {
    const tags = tagname.split(':');
    const prefix = tagname.charAt(0) === '/' ? '/' : '';
    if (tags[0] === 'xmlns') {
      return '';
    }
    if (tags.length === 2) {
      tagname = prefix + tags[1];
    }
  }
  return tagname;
}

function parseValue(val, shouldParse, parseTrueNumberOnly) {
  if (shouldParse && typeof val === 'string') {
    let parsed;
    if (val.trim() === '' || isNaN(val)) {
      parsed = val === 'true' ? true : val === 'false' ? false : val;
    } else {
      if (val.indexOf('0x') !== -1) {
        //support hexa decimal
        parsed = Number.parseInt(val, 16);
      } else if (val.indexOf('.') !== -1) {
        parsed = Number.parseFloat(val);
      } else {
        parsed = Number.parseInt(val, 10);
      }
      if (parseTrueNumberOnly) {
        parsed = String(parsed) === val ? parsed : val;
      }
    }
    return parsed;
  }

  return typeof v !== "undefined" ? val : "";
}

const attrsRegx = new RegExp('([^\\s=]+)\\s*(=\\s*([\'"])(.*?)\\3)?', 'g');

function buildAttributesMap(attrStr, options) {
  if (typeof attrStr === 'string') {
    attrStr = attrStr.replace(/\r?\n/g, ' ');

    const matches = getAllMatches(attrStr, attrsRegx);
    const len = matches.length; //don't make it inline
    const attrs = {};
    for (let i = 0; i < len; i++) {
      const attrName = resolveNameSpace(matches[i][1], options);
      if (attrName.length) {
        if (matches[i][4] !== undefined) {
          if (options.trimValues) {
            matches[i][4] = matches[i][4].trim();
          }
          matches[i][4] = options.attrValueProcessor(matches[i][4], attrName);
          attrs[attrName] = parseValue(
            matches[i][4],
            options.parseAttributeValue,
            options.parseTrueNumberOnly
          );
        } else {
          attrs[attrName] = true;
        }
      }
    }
    if (!Object.keys(attrs).length) {
      return;
    }
    if (options.attrNodeName) {
      const attrCollection = {};
      attrCollection[options.attrNodeName] = attrs;
      return attrCollection;
    }
    return attrs;
  }
}

const parse = (text, _parsers, _opts) =>
  getTraversalObj(text, {
    cdataTagName: "#cdata",
    parseAttributeValue: true,
    textNodeName: "#text"
  });

module.exports = parse;
