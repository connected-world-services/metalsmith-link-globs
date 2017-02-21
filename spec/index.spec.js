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
    Object.keys(files).forEach(function (filename) {
        var content;

        if (typeof files[filename] !== "object") {
            // Using binary for the encoding test.
            content = Buffer.from(files[filename], "binary");
            files[filename] = {
                contents: content
            };
        }
    });

    // The plugin operates synchronously so we don't care much about the
    // "done" callback. Likewise, it does not use the Metalsmith object.
    plugin(options)(files, null, spy);

    // Convert the files back from Metalsmith objects to standard
    // strings. Much easier to compare. Using binary here to assist with
    // the encoding test.
    Object.keys(files).forEach(function (filename) {
        files[filename] = files[filename].contents.toString("binary");
    });

    // Ensure the plugin did not create nor remove any files.
    expect(Object.keys(files).sort()).toEqual(filenamesAtStart);
}

plugin = require("..");

describe("metalsmith-link-globs", function () {
    it("does not break with no files", function () {
        var files, spy;

        spy = jasmine.createSpy("done");
        files = {};
        callPlugin(files, null, spy);
        expect(spy).toHaveBeenCalled();
        expect(files).toEqual({});
    });
    it("removes when there are not matches", function () {
        var files;

        files = {
            "c.html": "<title>x</title><link href=\"*.css\"><div>y</div>"
        };
        callPlugin(files);
        expect(files["c.html"]).toEqual("<title>x</title><div>y</div>");
    });
    it("detects and properly uses globs", function () {
        var files;

        files = {
            "a.css": "",
            "bb.css": "",
            "untouched.html": "<link href=\"test.css\">",
            "untouched.htm": "<link href=\"**/*.css\">",
            "question.html": "<link href=\"?.css\">",
            "star.html": "<link href=\"*.css\">"
        };
        callPlugin(files);
        expect(files["untouched.html"]).toEqual("<link href=\"test.css\">");
        expect(files["untouched.htm"]).toEqual("<link href=\"**/*.css\">");
        expect(files["question.html"]).toEqual("<link href=\"a.css\">");
        expect(files["star.html"]).toEqual("<link href=\"a.css\"><link href=\"bb.css\">");
    });
    it("resolves path names", function () {
        var files;

        files = {
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
        };
        callPlugin(files);
        expect(files["place/relative.html"]).toEqual("<img src=\"dir/d.png\">");
        expect(files["place/root-relative.html"]).toEqual("<img src=\"../dir/b.png\">");
        expect(files["place/glob.html"]).toEqual("<img src=\"c.png\">");
        expect(files["place/root-glob.html"]).toEqual("<img src=\"../a.png\">");
        expect(files["place/superglob.html"]).toEqual("<img src=\"c.png\"><img src=\"dir/d.png\">");
        expect(files["place/root-superglob.html"]).toEqual("<img src=\"../a.png\"><img src=\"../dir/b.png\"><img src=\"c.png\"><img src=\"dir/d.png\">");
    });
    it("handles all of the necessary elements", function () {
        var files;

        files = {
            "hyperlink.html": "<a href=\"hyper*.html\">link</a>",
            "image.html": "<img src=\"*.png\">",
            "image.png": "",
            "link.html": "<link href=\"*.css\">",
            "script.html": "<script src=\"*.js\"></script>",
            "script.js": "",
            "site.css": ""
        };
        callPlugin(files);
        expect(files["hyperlink.html"]).toEqual("<a href=\"hyperlink.html\">link</a>");
        expect(files["image.html"]).toEqual("<img src=\"image.png\">");
        expect(files["link.html"]).toEqual("<link href=\"site.css\">");
        expect(files["script.html"]).toEqual("<script src=\"script.js\"></script>");
    });
    describe("options", function () {
        describe("elementMatchOptions", function () {
            it("skips hidden files with defaults", function () {
                var files;

                files = {
                    ".skip/skip.htm": "",
                    "x.html": "<img src=\"**/*.htm\">"
                };
                callPlugin(files);
                expect(files["x.html"]).toEqual("");
            });
            it("allows options to be set", function () {
                var files;

                files = {
                    ".hit/hit.htm": "",
                    "x.html": "<img src=\"**/*.htm\">"
                };
                callPlugin(files, {
                    elementMatchOptions: {
                        dot: true
                    }
                });
                expect(files["x.html"]).toEqual("<img src=\".hit/hit.htm\">");
            });
        });
        describe("encoding", function () {
            it("can be used to handle files in different encodings", function () {
                var files;

                files = {
                    "test.html": {
                        contents: "616263"
                    }
                };
                callPlugin(files, {
                    encoding: "hex"
                });
                expect(files["test.html"]).toEqual("abc");
            });
        });
        describe("match", function () {
            it("can match additional files", function () {
                var files;

                files = {
                    "a.png": "",
                    "abc.def": "<img src=\"*.png\">"
                };
                callPlugin(files, {
                    match: "**/*.def"
                });
                expect(files["abc.def"]).toEqual("<img src=\"a.png\">");
            });
        });
        describe("matchOptions", function () {
            it("changes minimatch's behavior", function () {
                var files;

                files = {
                    ".hidden/file.html": "<img src=\"*.gif\">"
                };
                callPlugin(files, {
                    matchOptions: {
                        dot: true
                    }
                });
                expect(files[".hidden/file.html"]).toEqual("");
            });
        });
        describe("nodes", function () {
            it("allows custom nodes to be changed", function () {
                var files;

                files = {
                    "a.json": "",
                    "index.html": "<div data-filename=\"*.json\"></div>"
                };
                callPlugin(files, {
                    nodes: [
                        {
                            element: "div",
                            property: "data-filename"
                        }
                    ]
                });
                expect(files["index.html"]).toEqual("<div data-filename=\"a.json\"></div>");
            });
        });
    });
});
