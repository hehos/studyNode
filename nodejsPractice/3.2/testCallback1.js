/**
 * Created by hehui on 2015/12/12.
 */

/*
* 为了在程序中演示回调的用法，我们来做一个简单的HTTP服务器
* */

var http = require('http');
var fs = require('fs');


http.createServer(function(req, res) {
    if(req.url == '/') {
        fs.readFile('./titles.json', function (err, data) {
            if(err) {
                console.error(err);
                res.end('server error');
            } else {
                var titles = JSON.parse(data.toString());
                fs.readFile('./template.html', function (err, data) {
                    if(err) {
                        console.error(err);
                        res.end('server error');
                    } else {
                        var tmpl = data.toString();

                        var html = tmpl.replace('%', titles.join('</li><li>'));
                        res.writeHead(200, {'Content-Type': 'text/html'});
                        res.end(html);
                    }
                });
            }
        });
    }
}).listen(8000, function() {
    console.log("Server listening on port 8000.");
});