var MailParser = require("mailparser").MailParser;

var exports = module.exports = {};

function _parseHtml(headers, body) {
  console.log(body);
  var rows = $("table tr", body)
    .map(function() {
      return [$("td", this).map(function() {
        return $(this).text().trim();
      })];
    });
  rows = $(rows)
    .not(function() { return this.length != headers.length })
    .map(function(i, e) {
      var estate = {};
      for (var i = 0; i < e.length; i++)
        estate[headers[i]] = e[i];
      estate["Starting Bid"] = parseInt(estate["Starting Bid"]
                                .replace("$", "")
                                .replace(",", ""));
      estate["Zip"] = parseInt(estate["Zip"]);
      return estate;
    });
    return rows;
}

function _parseMailString(str, headers) {
  return new Promise(function(resolve, reject) {
    console.log(str);

    var mailparser = new MailParser();
    mailparser.on("end", function(mail_object){
        console.log("Subject:", mail_object.subject);
        var rows = _parseHtml(headers, mail_object.html);
        resolve(rows);
      });

    mailparser.write(str);
    mailparser.end();
  });
}

function _parseMailFile(path, headers) {
  return new Promise(function(resolve, reject) {
    var mailparser = new MailParser();
    var fs = require("fs");

    console.log(headers);

    mailparser.on("end", function(mail_object){
        console.log("Subject:", mail_object.subject);
        var rows = _parseHtml(headers, mail_object.html);
        //console.log("Contents:", mail_object.html);
        resolve(rows);
      });

    fs.createReadStream(path).pipe(mailparser);
  });
}

exports.parseMailFile = _parseMailFile;

exports.parseMailString = _parseMailString;
