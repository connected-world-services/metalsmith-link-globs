"use strict";

var plugin;

/**
 * Calls the plugin with a given set of files. Before calling, this will
 * convert the files into what Metalsmith would provide. After the call,
 * the files are converted back to strings for easy testing.
 *
 * @param {Object.<string>} files
 * @param {Object} [options] Options for plugin initialization
 * @param {Function} [spy] Alternate done callback
 * @return {Promise.<Object.<string>>}
 */
function callPlugin(files, options, spy) {
    var filenamesAtStart;

    // Allow for a spy to be the done callback. Otherwise use an empty
    // function.
    if (!spy) {
        spy = function () {};
    }

    // Save a copy of the filenames.
    filenamesAtStart = Object.keys(files).sort();

    // Convert the files array into buffers and metadata, like what
    // Metalsmith will provide
    Object.keys(files).forEach((filename) => {
        var content;

        if (typeof files[filename] !== "object") {
            // Using binary for the encoding test.
            content = Buffer.from(files[filename], "binary");
            files[filename] = {
                contents: content
            };
        }
    });

    return new Promise((resolve, reject) => {
        plugin(options)(files, {}, (err) => {
            // Convert the files back from Metalsmith objects to standard
            // strings. Much easier to compare. Using binary here to assist with
            // the encoding test.
            Object.keys(files).forEach((filename) => {
                files[filename] = files[filename].contents.toString("binary");
            });

            // Ensure the plugin did not create nor remove any files.
            expect(Object.keys(files).sort()).toEqual(filenamesAtStart);

            if (err) {
                reject(err);
            } else {
                resolve(files);
            }
        });
    });
}

plugin = require("..");

describe("metalsmith-link-globs", () => {
    it("does not break with no files", () => {
        return callPlugin({}).then((files) => {
            expect(files).toEqual({});
        });
    });
    it("removes when there are not matches", () => {
        return callPlugin({
            "c.html": "<title>x</title><link href=\"*.css\"><div>y</div>"
        }).then((files) => {
            expect(files["c.html"]).toEqual("<title>x</title><div>y</div>");
        });
    });
    it("detects and properly uses globs", () => {
        return callPlugin({
            "a.css": "",
            "bb.css": "",
            "untouched.html": "<link href=\"test.css\">",
            "untouched.htm": "<link href=\"**/*.css\">",
            "question.html": "<link href=\"?.css\">",
            "star.html": "<link href=\"*.css\">"
        }).then((files) => {
            expect(files["untouched.html"]).toEqual("<link href=\"test.css\">");
            expect(files["untouched.htm"]).toEqual("<link href=\"**/*.css\">");
            expect(files["question.html"]).toEqual("<link href=\"a.css\">");
            expect(files["star.html"]).toEqual("<link href=\"a.css\"><link href=\"bb.css\">");
        });
    });
    it("resolves path names", () => {
        return callPlugin({
            "a.png": "",
            "dir/b.png": "",
            "place/c.png": "",
            "place/dir/d.png": "",
            "place/relative.html": "<img src=\"dir/*.png\">",
            "place/root-relative.html": "<img src=\"/dir/*.png\">",
            "place/glob.html": "<img src=\"*.png\">",
            "place/root-glob.html": "<img src=\"/*.png\">",
            "place/superglob.html": "<img src=\"**/*.png\">",
            "place/root-superglob.html": "<img src=\"/**/*.png\">"
        }).then((files) => {
            expect(files["place/relative.html"]).toEqual("<img src=\"dir/d.png\">");
            expect(files["place/root-relative.html"]).toEqual("<img src=\"../dir/b.png\">");
            expect(files["place/glob.html"]).toEqual("<img src=\"c.png\">");
            expect(files["place/root-glob.html"]).toEqual("<img src=\"../a.png\">");
            expect(files["place/superglob.html"]).toEqual("<img src=\"c.png\"><img src=\"dir/d.png\">");
            expect(files["place/root-superglob.html"]).toEqual("<img src=\"../a.png\"><img src=\"../dir/b.png\"><img src=\"c.png\"><img src=\"dir/d.png\">");
        });
    });
    it("handles all of the necessary elements", () => {
        return callPlugin({
            "hyperlink.html": "<a href=\"hyper*.html\">link</a>",
            "image.html": "<img src=\"*.png\">",
            "image.png": "",
            "link.html": "<link href=\"*.css\">",
            "script.html": "<script src=\"*.js\"></script>",
            "script.js": "",
            "site.css": ""
        }).then((files) => {
            expect(files["hyperlink.html"]).toEqual("<a href=\"hyperlink.html\">link</a>");
            expect(files["image.html"]).toEqual("<img src=\"image.png\">");
            expect(files["link.html"]).toEqual("<link href=\"site.css\">");
            expect(files["script.html"]).toEqual("<script src=\"script.js\"></script>");
        });
    });
    describe("options", () => {
        describe("elementMatchOptions", () => {
            it("skips hidden files with defaults", () => {
                return callPlugin({
                    ".skip/skip.htm": "",
                    "x.html": "<img src=\"**/*.htm\">"
                }).then((files) => {
                    expect(files["x.html"]).toEqual("");
                });
            });
            it("allows options to be set", () => {
                return callPlugin({
                    ".hit/hit.htm": "",
                    "x.html": "<img src=\"**/*.htm\">"
                }, {
                    elementMatchOptions: {
                        dot: true
                    }
                }).then((files) => {
                    expect(files["x.html"]).toEqual("<img src=\".hit/hit.htm\">");
                });
            });
        });
        describe("encoding", () => {
            it("can be used to handle files in different encodings", () => {
                return callPlugin({
                    "test.html": {
                        contents: "616263"
                    }
                }, {
                    encoding: "hex"
                }).then((files) => {
                    expect(files["test.html"]).toEqual("abc");
                });
            });
        });
        describe("match", () => {
            it("can match additional files", () => {
                return callPlugin({
                    "a.png": "",
                    "abc.def": "<img src=\"*.png\">"
                }, {
                    match: "**/*.def"
                }).then((files) => {
                    expect(files["abc.def"]).toEqual("<img src=\"a.png\">");
                });
            });
        });
        describe("matchOptions", () => {
            it("changes minimatch's behavior", () => {
                return callPlugin({
                    ".hidden/file.html": "<img src=\"*.gif\">"
                }, {
                    matchOptions: {
                        dot: true
                    }
                }).then((files) => {
                    expect(files[".hidden/file.html"]).toEqual("");
                });
            });
        });
        describe("nodes", () => {
            it("allows custom nodes to be changed", () => {
                return callPlugin({
                    "a.json": "",
                    "index.html": "<div data-filename=\"*.json\"></div>"
                }, {
                    nodes: [
                        {
                            element: "div",
                            property: "data-filename"
                        }
                    ]
                }).then((files) => {
                    expect(files["index.html"]).toEqual("<div data-filename=\"a.json\"></div>");
                });
            });
        });
    });
});
