var expect = require('chai').expect,
  sdk = require('postman-collection'),
  convert = require('../../index').convert,
  getOptions = require('../../index').getOptions,
  sanitize = require('../../lib/util').sanitize,
  mainCollection = require('../../../../test/codegen/newman/fixtures/basicCollection.json');

describe('libcurl convert function', function () {
  describe('convert function', function () {
    it('should throw an error if callback is not a function', function () {
      var request = null,
        options = {
          indentCount: 1,
          indentType: 'Tab',
          requestTimeout: 200,
          trimRequestBody: true
        },
        callback = null;

      expect(function () { convert(request, options, callback); }).to.throw(Error);
    });

    it('should set CURLOPT_TIMEOUT_MS parameter when requestTimeout is set to non zero value', function () {
      var request = new sdk.Request(mainCollection.item[0].request),
        options = { requestTimeout: 3000 };

      convert(request, options, function (error, snippet) {
        if (error) {
          expect.fail(null, null, error);
        }
        expect(snippet).to.be.a('string');
        expect(snippet).to.include('curl_easy_setopt(curl, CURLOPT_TIMEOUT_MS, 3000L);');
      });
    });

    it('should trim header keys and not trim header values', function () {
      var request = new sdk.Request({
        'method': 'GET',
        'header': [
          {
            'key': '   key_containing_whitespaces  ',
            'value': '  value_containing_whitespaces  '
          }
        ],
        'url': {
          'raw': 'https://google.com',
          'protocol': 'https',
          'host': [
            'google',
            'com'
          ]
        }
      });
      convert(request, {}, function (error, snippet) {
        if (error) {
          expect.fail(null, null, error);
        }
        expect(snippet).to.be.a('string');
        expect(snippet).to.include('headers, "key_containing_whitespaces: ' +
        '  value_containing_whitespaces  "');
      });
    });
  });

  describe('getOptions function', function () {
    var options = getOptions();

    it('should return an array of specific options', function () {
      expect(options).to.be.an('array');
      expect(options[0]).to.have.property('id', 'includeBoilerplate');
      expect(options[1]).to.have.property('id', 'protocol');
      expect(options[2]).to.have.property('id', 'indentCount');
      expect(options[3]).to.have.property('id', 'indentType');
      expect(options[4]).to.have.property('id', 'followRedirect');
      expect(options[5]).to.have.property('id', 'trimRequestBody');
      expect(options[6]).to.have.property('id', 'useMimeType');
    });
  });

  describe('Sanitize function', function () {

    it('should return empty string when input is not a string type', function () {
      expect(sanitize(123, false)).to.equal('');
      expect(sanitize(null, false)).to.equal('');
      expect(sanitize({}, false)).to.equal('');
      expect(sanitize([], false)).to.equal('');
    });

    it('should trim input string when needed', function () {
      expect(sanitize('inputString     ', true)).to.equal('inputString');
    });

  });
});
