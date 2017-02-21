"use strict";

var cheerio, debug, minimatch, path;

cheerio = require("cheerio");
debug = require("debug")("metalsmith-link-globs");
minimatch = require("minimatch");
path = require("path");

/**
 * Factory to build middleware for Metalsmith.
 *
 * @param {Object} options
 * @return {Function}
 */
module.exports = function (options) {
    var matcher;

    /**
     * Rewrites element tags in the HTML for a given node definition.
     *
     * @param {Object} node
     * @param {string} sourceFile
     * @param {Cheerio} content
     * @param {string[]} fileList
     */
    function processNode(node, sourceFile, content, fileList) {
        var selector;

        selector = node.element + "[" + node.property + "*=";
        selector = selector + "\\*]," + selector + "\\?]";
        debug("Detecting elements: %s", selector);
        content(selector).each(function (index, element) {
            var basePath, elementGlob, elementMatcher, files, resolvedGlob, wrappedElement;

            wrappedElement = content(element);
            elementGlob = wrappedElement.attr(node.property);
            basePath = path.posix.dirname(path.posix.resolve(path.posix.sep, sourceFile));
            resolvedGlob = path.posix.resolve(basePath, elementGlob);
            elementMatcher = new minimatch.Minimatch(resolvedGlob, options.elementMatchOptions);
            files = fileList.map(function (filename) {
                return path.posix.resolve(path.posix.sep, filename);
            }).filter(function (filename) {
                return elementMatcher.match(filename);
            }).map(function (filename) {
                return path.posix.relative(basePath, filename);
            }).sort();
            debug("%s %s=%s: ", node.element, node.property, elementGlob, files);
            files.forEach(function (filename) {
                var clone;

                clone = wrappedElement.clone();
                clone.attr(node.property, filename);
                clone.insertBefore(wrappedElement);
            });
            wrappedElement.remove();
        });
    }

    options = options || {};
    options.elementMatchOptions = options.elementMatchOptions || {};
    options.encoding = options.encoding || "utf8";
    options.match = options.match || "**/*.html";
    options.matchOptions = options.matchOptions || {};
    options.nodes = options.nodes || [
        {
            element: "a",
            property: "href"
        },
        {
            element: "img",
            property: "src"
        },
        {
            element: "link",
            property: "href"
        },
        {
            element: "script",
            property: "src"
        }
    ];
    matcher = new minimatch.Minimatch(options.match, options.matchOptions);

    /**
     * Middleware function.
     *
     * @param {Object} files
     * @param {Object} metalsmith
     * @param {Function} done
     */
    return function (files, metalsmith, done) {
        var fileList;

        // Save a copy of the list of filenames for use later.
        fileList = Object.keys(files);

        // Iterate through the files and build jobs to process each one.
        Object.keys(files).forEach(function (sourceFile) {
            var content;

            if (matcher.match(sourceFile) && files[sourceFile]) {
                debug("Processing %s", sourceFile);
                content = cheerio.load(files[sourceFile].contents.toString(options.encoding));
                options.nodes.forEach(function (node) {
                    processNode(node, sourceFile, content, fileList);
                });
                files[sourceFile].contents = Buffer.from(content.html(), options.encoding);
            }
        });

        done();
    };
};
