var _ = require('./lodash'),
  sanitize = require('./util').sanitize,
  sanitizeOptions = require('./util').sanitizeOptions,
  isFile = false,
  self;

/**
 * Parses Raw data to fetch syntax
 *
 * @param {Object} body Raw body data
 * @param {boolean} trim trim body option
 */
function parseRawBody (body, trim) {
  var bodySnippet;
  bodySnippet = `payload := strings.NewReader("${sanitize(body.toString(), trim)}")`;
  return bodySnippet;
}

/**
 * Parses URLEncoded body from request to fetch syntax
 *
 * @param {Object} body URLEncoded Body
 * @param {boolean} trim trim body option
 */
function parseURLEncodedBody (body, trim) {
  var payload, bodySnippet;
  payload = _.reduce(body, function (accumulator, data) {
    if (!data.disabled) {
      accumulator.push(`${escape(data.key, trim)}=${escape(data.value, trim)}`);
    }
    return accumulator;
  }, []).join('&');

  bodySnippet = `payload := strings.NewReader("${payload}")`;
  return bodySnippet;
}

/**
 * Parses formData body from request to fetch syntax
 *
 * @param {Object} body formData Body
 * @param {boolean} trim trim body option
 * @param {string} indent indent string
 */
function parseFormData (body, trim, indent) {
  var bodySnippet = `payload := &bytes.Buffer{}\n${indent}writer := multipart.NewWriter(payload)\n`;
  _.forEach(body, function (data) {
    if (!data.disabled) {
      if (data.type === 'file') {
        isFile = true;
        bodySnippet += `${indent}file, err_file := os.Open("${data.src}")\n`;
        bodySnippet += `${indent}defer file.Close()\n`;
        bodySnippet += `${indent}part, err_file := writer.CreateFormFile("${sanitize(data.key, trim)}",` +
                        `filepath.Base("${data.src}"))\n`;
        bodySnippet += `${indent}_, err_file = io.Copy(part, file)\n`;
        bodySnippet += `${indent}if err_file !=nil {\n${indent.repeat(2)}fmt.Println(err_file)\n${indent}}\n`;
      }
      else {
        bodySnippet += `${indent}_ = writer.WriteField("${sanitize(data.key, trim)}",`;
        bodySnippet += ` "${sanitize(data.value, trim)}")\n`;
      }
    }
  });
  bodySnippet += `${indent}err := writer.Close()\n${indent}if err != nil ` +
  `{\n${indent.repeat(2)}fmt.Println(err)\n${indent}}\n`;
  return bodySnippet;
}

/**
 * Parses file body from the Request
 *
 */
function parseFile () {
  // var bodySnippet = `payload := &bytes.Buffer{}\n${indent}writer := multipart.NewWriter(payload)\n`;
  // isFile = true;
  // bodySnippet += `${indent}// add your file name in the next statement in place of path\n`;
  // bodySnippet += `${indent}file, err := os.Open(path)\n`;
  // bodySnippet += `${indent}defer file.Close()\n`;
  // bodySnippet += `${indent}part, err := writer.CreateFormFile("file", filepath.Base(path))\n`;
  // bodySnippet += `${indent}_, err := io.Copy(part, file)\n`;
  // bodySnippet += `${indent}err := writer.Close()\n${indent}if err != nil {${indent}fmt.Println(err)}\n`;
  var bodySnippet = 'payload := strings.NewReader("<file contents here>")\n';
  return bodySnippet;
}

/**
 * Parses Body from the Request
 *
 * @param {Object} body body object from request.
 * @param {boolean} trim trim body option
 * @param {string} indent indent string
 */
function parseBody (body, trim, indent) {
  if (!_.isEmpty(body)) {
    switch (body.mode) {
      case 'urlencoded':
        return parseURLEncodedBody(body.urlencoded, trim);
      case 'raw':
        return parseRawBody(body.raw, trim);
      case 'formdata':
        return parseFormData(body.formdata, trim, indent);
      case 'file':
        return parseFile(body.file, trim, indent);
      default:
        return '';
    }
  }
  return '';
}

/**
 * Parses headers from the request.
 *
 * @param {Object} headers headers from the request.
 * @param {string} indent indent string
 */
function parseHeaders (headers, indent) {
  var headerSnippet = '';
  if (!_.isEmpty(headers)) {
    headers = _.reject(headers, 'disabled');
    _.forEach(headers, function (header) {
      headerSnippet += `${indent}req.Header.Add("${sanitize(header.key, true)}", "${sanitize(header.value)}")\n`;
    });
  }
  return headerSnippet;
}

self = module.exports = {
  convert: function (request, options, callback) {

    if (!_.isFunction(callback)) {
      throw new Error('GoLang-Converter: callback is not valid function');
    }
    options = sanitizeOptions(options, self.getOptions());

    var codeSnippet, indent, trim, timeout, followRedirect,
      bodySnippet = '',
      responseSnippet = '',
      headerSnippet = '';

    indent = options.indentType === 'Tab' ? '\t' : ' ';
    indent = indent.repeat(options.indentCount);
    timeout = options.requestTimeout;
    followRedirect = options.followRedirect;
    trim = options.trimRequestBody;

    if (request.body) {
      bodySnippet = parseBody(request.body.toJSON(), trim, indent);
    }

    codeSnippet = 'package main\n\n';
    codeSnippet += `import (\n${indent}"fmt"\n`;
    if (timeout > 0) {
      codeSnippet += `${indent}"time"\n`;
    }
    if (request.body && request.body.toJSON().mode === 'formdata') {
      codeSnippet += `${indent}"bytes"\n${indent}"mime/multipart"\n`;
    }
    else if (bodySnippet !== '') {
      codeSnippet += `${indent}"strings"\n`;
    }
    if (isFile) {
      codeSnippet += `${indent}"os"\n${indent}"path/filepath"\n`;
      codeSnippet += `${indent}"io"\n`;
    }
    codeSnippet += `${indent}"net/http"\n${indent}"io/ioutil"\n)\n\n`;

    codeSnippet += `func main() {\n\n${indent}url := "${encodeURI(request.url.toString())}"\n`;
    codeSnippet += `${indent}method := "${request.method}"\n\n`;

    if (bodySnippet !== '') {
      codeSnippet += indent + bodySnippet + '\n\n';
    }

    if (timeout > 0) {
      codeSnippet += `${indent}timeout := time.Duration(${timeout / 1000} * time.Second)\n`;
    }

    codeSnippet += indent + 'client := &http.Client {\n';
    if (!followRedirect) {
      codeSnippet += indent.repeat(2) + 'CheckRedirect: func(req *http.Request, via []*http.Request) ';
      codeSnippet += 'error {\n';
      codeSnippet += `${indent.repeat(3)}return http.ErrUseLastResponse\n${indent.repeat(2)}},\n`;
    }
    if (timeout > 0) {
      codeSnippet += indent.repeat(2) + 'Timeout: timeout,\n';
    }
    codeSnippet += indent + '}\n';
    if (bodySnippet !== '') {
      codeSnippet += `${indent}req, err := http.NewRequest(method, url, payload)\n\n`;
    }
    else {
      codeSnippet += `${indent}req, err := http.NewRequest(method, url, nil)\n\n`;
    }
    codeSnippet += `${indent}if err != nil {\n${indent.repeat(2)}fmt.Println(err)\n${indent}}\n`;
    if (request.body && request.body.mode === 'file' && !request.headers.has('Content-Type')) {
      request.addHeader({
        key: 'Content-Type',
        value: 'text/plain'
      });
    }
    headerSnippet = parseHeaders(request.toJSON().header, indent);
    if (headerSnippet !== '') {
      codeSnippet += headerSnippet + '\n';
    }
    if (request.body && (request.body.toJSON().mode === 'formdata')) {
      codeSnippet += `${indent}req.Header.Set("Content-Type", writer.FormDataContentType())\n`;
    }
    responseSnippet = `${indent}res, err := client.Do(req)\n`;
    responseSnippet += `${indent}defer res.Body.Close()\n${indent}body, err := ioutil.ReadAll(res.Body)\n\n`;
    responseSnippet += `${indent}fmt.Println(string(body))\n}`;

    codeSnippet += responseSnippet;
    callback(null, codeSnippet);
  },
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
      description: 'Set number of milliseconds the request should wait for a ' +
        'response before timing out (use 0 for infinity)'
    },
    {
      name: 'Follow redirects',
      id: 'followRedirect',
      type: 'boolean',
      default: true,
      description: 'Automatically follow HTTP redirects'
    },
    {
      name: 'Trim request body fields',
      id: 'trimRequestBody',
      type: 'boolean',
      default: false,
      description: 'Remove white space and additional lines that may affect the server\'s response'
    }];
  }
};
