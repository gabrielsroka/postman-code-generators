var _ = require('./lodash'),
  parseBody = require('./util/parseBody'),
  sanitize = require('./util/sanitize').sanitize,
  sanitizeOptions = require('./util/sanitize').sanitizeOptions,
  self;

/**
     * Used to parse the request headers
     *
     * @param  {Object} request - postman SDK-request object
     * @param  {String} indent - used for indenting snippet's structure
     * @returns {String} - request headers in the desired format
     */
function getHeaders (request, indent) {
  var header = request.getHeaders({enabled: true}),
    headerMap;

  if (!_.isEmpty(header)) {
    headerMap = _.map(Object.keys(header), function (key) {
      return `${indent.repeat(2)}"${sanitize(key, 'header')}": ` +
          `"${sanitize(header[key], 'header')}"`;
    });
    return `${indent}"headers": {\n${headerMap.join(',\n')}\n${indent}},\n`;
  }
  return '';
}

/**
     * Used to get the form-data
     *
     * @param  {Object} request - postman SDK-request object
     * @param  {String} trimRequestBody - whether to trim request body fields
     * @returns {String} - form-data in the desired format
     */
function createForm (request, trimRequestBody) {
  var form = '',
    enabledFormList,
    formMap;

  form += 'var form = new FormData();\n';
  enabledFormList = _.reject(request.body[request.body.mode], 'disabled');
  if (!_.isEmpty(enabledFormList)) {
    formMap = _.map(enabledFormList, function (value) {
      return (`form.append("${sanitize(value.key, request.body.mode, trimRequestBody)}", "` +
                    `${sanitize(value.value || value.src, request.body.mode, trimRequestBody)}");`);
    });
    form += `${formMap.join('\n')}\n\n`;
  }
  return form;
}

self = module.exports = {
  /**
     * Used to return options which are specific to a particular plugin
     *
     * @returns {Array}
     */
  getOptions: function () {
    return [{
      name: 'Set indentation count',
      id: 'indentCount',
      type: 'positiveInteger',
      default: 2,
      description: 'Set the number of indentation characters to add per code level'
    },
    {
      name: 'Set indentation type',
      id: 'indentType',
      type: 'enum',
      availableOptions: ['Tab', 'Space'],
      default: 'Space',
      description: 'Select the character used to indent lines of code'
    },
    {
      name: 'Set request timeout',
      id: 'requestTimeout',
      type: 'positiveInteger',
      default: 0,
      description: 'Set number of milliseconds the request should wait for a response' +
    ' before timing out (use 0 for infinity)'
    },
    {
      name: 'Trim request body fields',
      id: 'trimRequestBody',
      type: 'boolean',
      default: false,
      description: 'Remove white space and additional lines that may affect the server\'s response'
    }];
  },

  /**
    * Used to convert the postman sdk-request object in php-curl request snippet
    *
    * @param  {Object} request - postman SDK-request object
    * @param  {Object} options
    * @param  {String} options.indentType - type of indentation eg: Space / Tab (default: Space)
    * @param  {Number} options.indentCount - frequency of indent (default: 4 for indentType: Space,
                                                                    default: 1 for indentType: Tab)
    * @param {Number} options.requestTimeout : time in milli-seconds after which request will bail out
                                                (default: 0 -> never bail out)
    * @param {Boolean} options.trimRequestBody : whether to trim request body fields (default: false)
    * @param  {Function} callback - function with parameters (error, snippet)
    */
  convert: function (request, options, callback) {
    var jQueryCode = '',
      indentType = '',
      indent = '';

    if (_.isFunction(options)) {
      callback = options;
      options = null;
    }
    else if (!_.isFunction(callback)) {
      throw new Error('js-jQuery~convert: Callback is not a function');
    }
    options = sanitizeOptions(options, self.getOptions());
    indentType = (options.indentType === 'Tab') ? '\t' : ' ';

    indent = indentType.repeat(options.indentCount);

    if (request.body && request.body.mode === 'formdata') {
      jQueryCode = createForm(request.toJSON(), options.trimRequestBody);
    }
    jQueryCode += 'var settings = {\n';
    jQueryCode += `${indent}"url": "${sanitize(request.url.toString(), 'url')}",\n`;
    jQueryCode += `${indent}"method": "${request.method}",\n`;
    jQueryCode += `${indent}"timeout": ${options.requestTimeout},\n`;
    jQueryCode += `${getHeaders(request, indent)}`;
    jQueryCode += `${parseBody(request.toJSON(), options.trimRequestBody, indent)}};\n\n`;
    jQueryCode += `$.ajax(settings).done(function (response) {\n${indent}console.log(response);\n});`;

    return callback(null, jQueryCode);
  }
};
