const url = require("url");
const path = require("path");
const fs = require("fs");

class SiteC {
	app = null;
	data = null;
	pattern = [];

	listings = new Map();

	constructor(_App, _Data) {
		this.app = _App;
		this.data = _Data;

		if (this.data.path.endsWith("/")) this.data.path = this.data.path.substr(0, this.data.path.length - 1);

		this.rootPath = path.resolve(this.data.path);
		this.pattern = this.data.hostname.split(".").reverse();

		console.log("SITE (@" + this.rootPath + "): " + JSON.stringify(this.data));

		fs.readdirSync("./backend/folder_listings").forEach((file) => {
			if (file.endsWith(".js")) {
				let name = file.substr(0, file.length - 3).toLowerCase();
				this.listings.set(name, require("./folder_listings/" + file));
			}
		});

		this.testMatchHostname();

		this.app.use(this.use.bind(this));
	}

	matchHostname(hostname, pattern) {
		const hostnameParts = hostname.split(".").reverse();
		if (pattern) pattern = pattern.split(".").reverse();
		else pattern = this.pattern;

		if (pattern.length == 1 && pattern[0] === "*") return true;
		if (hostnameParts.length != pattern.length) return false;

		for (let i = 0; i < pattern.length; i++) {
			if (pattern[i] === "*") {
				continue;
			} else if (pattern[i] !== hostnameParts[i]) {
				return false;
			}
		}

		return true;
	}

	use(req, res, next) {
		if (!this.matchHostname(req.hostname)) return next();

		try {

			console.log("SiteC.use(" + this.data.path + "): " + req.hostname + " " + req.path);

			const urlStr =
				req.protocol +
				"://" +
				req.hostname +
				(req.port ? ":" + req.port : "") +
				req.path +
				(Object.keys(req.query).length > 0
					? "?" +
					Object.keys(req.query)
						.map((key) => `${key}=${req.query[key]}`)
						.join("&")
					: "");

			const u = this.parseUrl(urlStr);
			const fullPath = path.join(this.data.path, u.pathname);
			let absolutePath = path.resolve(fullPath);
			if (!absolutePath.startsWith(this.rootPath)) return res.status(403).send("Forbidden");

			// Handle POST: save binary data to absolutePath
			if (req.method === "POST") {
				console.log("POST: " + fullPath);

				let body = [];
				req.on("data", (chunk) => {
					body.push(chunk);
				})
					.on("end", () => {
						const buffer = Buffer.concat(body);

						fs.promises.writeFile(fullPath, buffer)
							.then(() => res.status(200).send("Data saved"))
							.catch(err => {
								console.error(err);
								res.status(500).send("Failed to save data");
							});
					})
					.on("error", (err) => {
						console.error(err);
						res.status(400).send("Error receiving data");
					});

				return;
			}

			console.log("GET: " + fullPath);

			// Continue with GET/file logic
			if (u.pathname == "/")
				absolutePath += "/" + this.data.index;

			fs.promises
				.stat(absolutePath)
				.then((stats) => {
					if (stats.isDirectory()) {
						this.handle_folder(absolutePath, u)
							.then((data) => {
								let type = "html";
								if (u.query.listing) type = u.query.listing.toLowerCase();

								let listing = this.listings.get(type);
								if (!listing) return res.status(400).send("This server is missing listing option '" + type + "'");

								let d = listing(data);
								res.setHeader("Content-Type", d.contentType);

								return res.send(d.data);
							})
							.catch((e) => {
								console.error(e);
								return res.status(500).send("Internal server error");
							});
					} else if (stats.isFile()) {
						res.setHeader("Content-Size", stats.size);
						return res.sendFile(absolutePath);
					} else {
						return res.status(404).send("Not found");
					}
				})
				.catch((e) => {
					console.error(e);
					return res.status(404).send("Not found");
				});

		} catch (e) {
			console.error("Error in SiteC.use: ", e);
		}
	}

	handle_folder(_AbsolutePath, _URL) {
		return new Promise((resolve, reject) => {
			try {
				fs.promises
					.readdir(_AbsolutePath)
					.then(async (files) => {
						let pathname = _AbsolutePath.substr(this.rootPath.length).replace(/\\/g, "/");
						if (!pathname.endsWith("/")) pathname += "/";

						const data = {
							url: _URL.protocol + "://" + _URL.host + pathname,
							path: pathname,
							files: []
						};

						for (const file of files) {
							try {
								const filePath = path.join(_AbsolutePath, file);
								//const fileUrl = filePath.substr(this.rootPath.length).replace(/\\/g, "/");

								const stats = await fs.promises.stat(filePath);

								data.files.push({
									n: file,
									//url: fileUrl,
									d: stats.isDirectory()
								});
							} catch (err) {
								console.error(err);
							}
						}

						resolve(data);
					})
					.catch((e) => {
						console.error(e);
						reject({ error: e.message });
					});
			} catch (e) {
				console.error(e);
				reject({ error: e.message });
			}
		});
	}


	parseUrl(_URL) {
		var u = url.parse(_URL, true);

		u.protocol = u.protocol.toString().toLowerCase();

		if (u.protocol.substr(u.protocol.length - 1) == ":") u.protocol = u.protocol.substr(0, u.protocol.length - 1);

		if (u.port === null) {
			if (u.protocol == "https") u.port = 443;
			else u.port = 80;
		}

		return u;
	}
}

module.exports = SiteC;
