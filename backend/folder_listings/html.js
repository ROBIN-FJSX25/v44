module.exports = (_Data) => {
	var html = "<HTML><HEAD></HEAD><BODY><br><br><center><b>" + _Data.path + "</b></center><br><hr><br>";

	let rootUrl = _Data.url.substr(0, _Data.url.length - _Data.path.length);
	let pathname = _Data.path;
	if (pathname.endsWith("/")) pathname = pathname.substr(0, pathname.length - 1);

	if (pathname != "") {
		let parentPath = pathname.substr(0, pathname.lastIndexOf("/"));
		let parentUrl = rootUrl + parentPath;
		html += '<a href="' + parentUrl + '"><---</a><br><ul>';
	}

	_Data.files.forEach((file) => {
		html += '<li><a href="' + _Data.url + file.n + (file.d ? "/" : "") + '"' + (file.d ? "" : " download") + ">" + file.n + "</a></li>";
	});

	html += "</ul><br><br><hr>v1.0.2</BODY></HTML>";

	return {
		data: html,
		contentType: "text/html"
	};
};
