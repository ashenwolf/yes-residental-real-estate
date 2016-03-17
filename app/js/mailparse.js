var MailParser = require("mailparser").MailParser;

var exports = module.exports = {};

function _parseMail(path, headers) {
  return new Promise(function(resolve, reject) {
    var mailparser = new MailParser();
    var fs = require("fs");

    console.log(headers);

    mailparser.on("end", function(mail_object){
        console.log("Subject:", mail_object.subject);
        //console.log("Contents:", mail_object.html);
        var rows = $("table tr", mail_object.html)
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
        resolve(rows);
      });

    fs.createReadStream(path).pipe(mailparser);
  });
}

exports.parseMail = _parseMail;
