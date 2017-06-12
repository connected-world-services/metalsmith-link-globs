/**
 * Metalsmith Link Globs will repeat HTML elements so you can link to
 * one or several files, based on what is in your build. Your debug build
 * may not combine and minify files but your production build does.
 * Eliminate the hassle and use a layout like this to link all files.
 *
 *     <script src="js/*.js"></script>
 *
 * @module metalsmith-link-globs
 */
"use strict";

/**
 * Metalsmith file object.
 *
 * @typedef metalsmithFile
 * @property {Buffer} contents
 * @property {string} mode
 */

/**
 * Metalsmith collection of files.
 *
 * @typedef {Object.<string,module:metalsmith-link-globs~metalsmithFile>} metalsmithFileCollection
 */
var cheerio, debug, path, pluginKit;

cheerio = require("cheerio");
debug = require("debug")("metalsmith-link-globs");
path = require("path");
pluginKit = require("metalsmith-plugin-kit");

/**
 * Defines a node name and the property that has the glob expression.  For
 * instance, images may look like `<img src="*.jpg">`. This would match all
 * jpeg files in the current folder. The definition for `img` tags should
 * look like this:
 *
 *     {
 *         element: "img",
 *         property: "src"
 *     }
 *
 * @typedef {Object} nodeDefinition
 * @property {string} element Name of element to fine.
 * @property {string} property Attribute or property name of the element that contains the glob expression.
 */

/**
 * Options for the middleware factory.
 *
 * @typedef {Object} options
 * @property {module:metalsmith-plugin-kit~matchOptions} [elementMatchOptions={}] Controls what files match the patterns found in the HTML elements.
 * @property {string} [encoding=utf8] Buffer encoding.
 * @property {module:metalsmith-plugin-kit~matchList} [match] Defaults to `*.html` in any folder.
 * @property {module:metalsmith-plugin-kit~matchOptions} [matchOptions={}] Controls how to find files that have elements to repeat.
 * @property {Array.<module:metalsmith-plugin-kit~nodeDefinition>} nodes What HTML elements to process. Defaults to a, img, link and script.
 */

/**
 * Factory to build middleware for Metalsmith.
 *
 * @param {module:metalsmith-link-globs~options} options
 * @return {Function}
 */
module.exports = function (options) {
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

        selector = `${node.element}[${node.property}*=`;
        selector = `${selector}\\*],${selector}\\?]`;
        debug("Detecting elements: %s", selector);
        content(selector).each((index, element) => {
            var basePath, elementGlob, elementMatcher, files, resolvedGlob, wrappedElement;

            wrappedElement = content(element);
            elementGlob = wrappedElement.attr(node.property);
            basePath = path.posix.dirname(path.posix.resolve(path.posix.sep, sourceFile));
            resolvedGlob = path.posix.resolve(basePath, elementGlob);
            elementMatcher = pluginKit.filenameMatcher(resolvedGlob, options.elementMatchOptions);
            files = fileList.map((filename) => {
                return path.posix.resolve(path.posix.sep, filename);
            }).filter(elementMatcher).map((filename) => {
                return path.posix.relative(basePath, filename);
            }).sort();
            debug("%s %s=%s: ", node.element, node.property, elementGlob, files);
            files.forEach((filename) => {
                var clone;

                clone = wrappedElement.clone();
                clone.attr(node.property, filename);
                clone.insertBefore(wrappedElement);
            });
            wrappedElement.remove();
        });
    }

    options = pluginKit.defaultOptions({
        elementMatchOptions: {},
        encoding: "utf8",
        match: "**/*.html",
        matchOptions: {},
        nodes: [
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
        ]
    }, options);

    return pluginKit.middleware({
        each: (filename, file, files) => {
            var content;

            debug("Processing %s", filename);
            content = cheerio.load(file.contents.toString(options.encoding));
            options.nodes.forEach((node) => {
                processNode(node, filename, content, Object.keys(files));
            });
            file.contents = Buffer.from(content.html(), options.encoding);
        },
        match: options.match,
        matchOptions: options.matchOptions,
        name: "metalsmith-link-globs"
    });
};
