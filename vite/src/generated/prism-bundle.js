// Auto-generated from prismjs@1.30.0 by scripts/bundle-prism.ts
// Do not edit manually. Re-run: pnpm -F @holocron.so/vite bundle-prism
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/prism.js
var require_prism = __commonJS({
  "../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/prism.js"(exports, module) {
    var _self = typeof window !== "undefined" ? window : typeof WorkerGlobalScope !== "undefined" && globalThis instanceof WorkerGlobalScope ? globalThis : {};
    var Prism3 = (function(_self2) {
      var lang = /(?:^|\s)lang(?:uage)?-([\w-]+)(?=\s|$)/i;
      var uniqueId = 0;
      var plainTextGrammar = {};
      var _ = {
        /**
         * By default, Prism will attempt to highlight all code elements (by calling {@link Prism.highlightAll}) on the
         * current page after the page finished loading. This might be a problem if e.g. you wanted to asynchronously load
         * additional languages or plugins yourself.
         *
         * By setting this value to `true`, Prism will not automatically highlight all code elements on the page.
         *
         * You obviously have to change this value before the automatic highlighting started. To do this, you can add an
         * empty Prism object into the global scope before loading the Prism script like this:
         *
         * ```js
         * window.Prism = window.Prism || {};
         * Prism.manual = true;
         * // add a new <script> to load Prism's script
         * ```
         *
         * @default false
         * @type {boolean}
         * @memberof Prism
         * @public
         */
        manual: _self2.Prism && _self2.Prism.manual,
        /**
         * By default, if Prism is in a web worker, it assumes that it is in a worker it created itself, so it uses
         * `addEventListener` to communicate with its parent instance. However, if you're using Prism manually in your
         * own worker, you don't want it to do this.
         *
         * By setting this value to `true`, Prism will not add its own listeners to the worker.
         *
         * You obviously have to change this value before Prism executes. To do this, you can add an
         * empty Prism object into the global scope before loading the Prism script like this:
         *
         * ```js
         * window.Prism = window.Prism || {};
         * Prism.disableWorkerMessageHandler = true;
         * // Load Prism's script
         * ```
         *
         * @default false
         * @type {boolean}
         * @memberof Prism
         * @public
         */
        disableWorkerMessageHandler: _self2.Prism && _self2.Prism.disableWorkerMessageHandler,
        /**
         * A namespace for utility methods.
         *
         * All function in this namespace that are not explicitly marked as _public_ are for __internal use only__ and may
         * change or disappear at any time.
         *
         * @namespace
         * @memberof Prism
         */
        util: {
          encode: function encode(tokens) {
            if (tokens instanceof Token) {
              return new Token(tokens.type, encode(tokens.content), tokens.alias);
            } else if (Array.isArray(tokens)) {
              return tokens.map(encode);
            } else {
              return tokens.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\u00a0/g, " ");
            }
          },
          /**
           * Returns the name of the type of the given value.
           *
           * @param {any} o
           * @returns {string}
           * @example
           * type(null)      === 'Null'
           * type(undefined) === 'Undefined'
           * type(123)       === 'Number'
           * type('foo')     === 'String'
           * type(true)      === 'Boolean'
           * type([1, 2])    === 'Array'
           * type({})        === 'Object'
           * type(String)    === 'Function'
           * type(/abc+/)    === 'RegExp'
           */
          type: function(o) {
            return Object.prototype.toString.call(o).slice(8, -1);
          },
          /**
           * Returns a unique number for the given object. Later calls will still return the same number.
           *
           * @param {Object} obj
           * @returns {number}
           */
          objId: function(obj) {
            if (!obj["__id"]) {
              Object.defineProperty(obj, "__id", { value: ++uniqueId });
            }
            return obj["__id"];
          },
          /**
           * Creates a deep clone of the given object.
           *
           * The main intended use of this function is to clone language definitions.
           *
           * @param {T} o
           * @param {Record<number, any>} [visited]
           * @returns {T}
           * @template T
           */
          clone: function deepClone(o, visited) {
            visited = visited || {};
            var clone;
            var id;
            switch (_.util.type(o)) {
              case "Object":
                id = _.util.objId(o);
                if (visited[id]) {
                  return visited[id];
                }
                clone = /** @type {Record<string, any>} */
                {};
                visited[id] = clone;
                for (var key in o) {
                  if (o.hasOwnProperty(key)) {
                    clone[key] = deepClone(o[key], visited);
                  }
                }
                return (
                  /** @type {any} */
                  clone
                );
              case "Array":
                id = _.util.objId(o);
                if (visited[id]) {
                  return visited[id];
                }
                clone = [];
                visited[id] = clone;
                /** @type {Array} */
                /** @type {any} */
                o.forEach(function(v, i) {
                  clone[i] = deepClone(v, visited);
                });
                return (
                  /** @type {any} */
                  clone
                );
              default:
                return o;
            }
          },
          /**
           * Returns the Prism language of the given element set by a `language-xxxx` or `lang-xxxx` class.
           *
           * If no language is set for the element or the element is `null` or `undefined`, `none` will be returned.
           *
           * @param {Element} element
           * @returns {string}
           */
          getLanguage: function(element) {
            while (element) {
              var m = lang.exec(element.className);
              if (m) {
                return m[1].toLowerCase();
              }
              element = element.parentElement;
            }
            return "none";
          },
          /**
           * Sets the Prism `language-xxxx` class of the given element.
           *
           * @param {Element} element
           * @param {string} language
           * @returns {void}
           */
          setLanguage: function(element, language) {
            element.className = element.className.replace(RegExp(lang, "gi"), "");
            element.classList.add("language-" + language);
          },
          /**
           * Returns the script element that is currently executing.
           *
           * This does __not__ work for line script element.
           *
           * @returns {HTMLScriptElement | null}
           */
          currentScript: function() {
            if (typeof document === "undefined") {
              return null;
            }
            if (document.currentScript && document.currentScript.tagName === "SCRIPT" && 1 < 2) {
              return (
                /** @type {any} */
                document.currentScript
              );
            }
            try {
              throw new Error();
            } catch (err) {
              var src = (/at [^(\r\n]*\((.*):[^:]+:[^:]+\)$/i.exec(err.stack) || [])[1];
              if (src) {
                var scripts = document.getElementsByTagName("script");
                for (var i in scripts) {
                  if (scripts[i].src == src) {
                    return scripts[i];
                  }
                }
              }
              return null;
            }
          },
          /**
           * Returns whether a given class is active for `element`.
           *
           * The class can be activated if `element` or one of its ancestors has the given class and it can be deactivated
           * if `element` or one of its ancestors has the negated version of the given class. The _negated version_ of the
           * given class is just the given class with a `no-` prefix.
           *
           * Whether the class is active is determined by the closest ancestor of `element` (where `element` itself is
           * closest ancestor) that has the given class or the negated version of it. If neither `element` nor any of its
           * ancestors have the given class or the negated version of it, then the default activation will be returned.
           *
           * In the paradoxical situation where the closest ancestor contains __both__ the given class and the negated
           * version of it, the class is considered active.
           *
           * @param {Element} element
           * @param {string} className
           * @param {boolean} [defaultActivation=false]
           * @returns {boolean}
           */
          isActive: function(element, className, defaultActivation) {
            var no = "no-" + className;
            while (element) {
              var classList = element.classList;
              if (classList.contains(className)) {
                return true;
              }
              if (classList.contains(no)) {
                return false;
              }
              element = element.parentElement;
            }
            return !!defaultActivation;
          }
        },
        /**
         * This namespace contains all currently loaded languages and the some helper functions to create and modify languages.
         *
         * @namespace
         * @memberof Prism
         * @public
         */
        languages: {
          /**
           * The grammar for plain, unformatted text.
           */
          plain: plainTextGrammar,
          plaintext: plainTextGrammar,
          text: plainTextGrammar,
          txt: plainTextGrammar,
          /**
           * Creates a deep copy of the language with the given id and appends the given tokens.
           *
           * If a token in `redef` also appears in the copied language, then the existing token in the copied language
           * will be overwritten at its original position.
           *
           * ## Best practices
           *
           * Since the position of overwriting tokens (token in `redef` that overwrite tokens in the copied language)
           * doesn't matter, they can technically be in any order. However, this can be confusing to others that trying to
           * understand the language definition because, normally, the order of tokens matters in Prism grammars.
           *
           * Therefore, it is encouraged to order overwriting tokens according to the positions of the overwritten tokens.
           * Furthermore, all non-overwriting tokens should be placed after the overwriting ones.
           *
           * @param {string} id The id of the language to extend. This has to be a key in `Prism.languages`.
           * @param {Grammar} redef The new tokens to append.
           * @returns {Grammar} The new language created.
           * @public
           * @example
           * Prism.languages['css-with-colors'] = Prism.languages.extend('css', {
           *     // Prism.languages.css already has a 'comment' token, so this token will overwrite CSS' 'comment' token
           *     // at its original position
           *     'comment': { ... },
           *     // CSS doesn't have a 'color' token, so this token will be appended
           *     'color': /\b(?:red|green|blue)\b/
           * });
           */
          extend: function(id, redef) {
            var lang2 = _.util.clone(_.languages[id]);
            for (var key in redef) {
              lang2[key] = redef[key];
            }
            return lang2;
          },
          /**
           * Inserts tokens _before_ another token in a language definition or any other grammar.
           *
           * ## Usage
           *
           * This helper method makes it easy to modify existing languages. For example, the CSS language definition
           * not only defines CSS highlighting for CSS documents, but also needs to define highlighting for CSS embedded
           * in HTML through `<style>` elements. To do this, it needs to modify `Prism.languages.markup` and add the
           * appropriate tokens. However, `Prism.languages.markup` is a regular JavaScript object literal, so if you do
           * this:
           *
           * ```js
           * Prism.languages.markup.style = {
           *     // token
           * };
           * ```
           *
           * then the `style` token will be added (and processed) at the end. `insertBefore` allows you to insert tokens
           * before existing tokens. For the CSS example above, you would use it like this:
           *
           * ```js
           * Prism.languages.insertBefore('markup', 'cdata', {
           *     'style': {
           *         // token
           *     }
           * });
           * ```
           *
           * ## Special cases
           *
           * If the grammars of `inside` and `insert` have tokens with the same name, the tokens in `inside`'s grammar
           * will be ignored.
           *
           * This behavior can be used to insert tokens after `before`:
           *
           * ```js
           * Prism.languages.insertBefore('markup', 'comment', {
           *     'comment': Prism.languages.markup.comment,
           *     // tokens after 'comment'
           * });
           * ```
           *
           * ## Limitations
           *
           * The main problem `insertBefore` has to solve is iteration order. Since ES2015, the iteration order for object
           * properties is guaranteed to be the insertion order (except for integer keys) but some browsers behave
           * differently when keys are deleted and re-inserted. So `insertBefore` can't be implemented by temporarily
           * deleting properties which is necessary to insert at arbitrary positions.
           *
           * To solve this problem, `insertBefore` doesn't actually insert the given tokens into the target object.
           * Instead, it will create a new object and replace all references to the target object with the new one. This
           * can be done without temporarily deleting properties, so the iteration order is well-defined.
           *
           * However, only references that can be reached from `Prism.languages` or `insert` will be replaced. I.e. if
           * you hold the target object in a variable, then the value of the variable will not change.
           *
           * ```js
           * var oldMarkup = Prism.languages.markup;
           * var newMarkup = Prism.languages.insertBefore('markup', 'comment', { ... });
           *
           * assert(oldMarkup !== Prism.languages.markup);
           * assert(newMarkup === Prism.languages.markup);
           * ```
           *
           * @param {string} inside The property of `root` (e.g. a language id in `Prism.languages`) that contains the
           * object to be modified.
           * @param {string} before The key to insert before.
           * @param {Grammar} insert An object containing the key-value pairs to be inserted.
           * @param {Object<string, any>} [root] The object containing `inside`, i.e. the object that contains the
           * object to be modified.
           *
           * Defaults to `Prism.languages`.
           * @returns {Grammar} The new grammar object.
           * @public
           */
          insertBefore: function(inside, before, insert, root) {
            root = root || /** @type {any} */
            _.languages;
            var grammar = root[inside];
            var ret = {};
            for (var token in grammar) {
              if (grammar.hasOwnProperty(token)) {
                if (token == before) {
                  for (var newToken in insert) {
                    if (insert.hasOwnProperty(newToken)) {
                      ret[newToken] = insert[newToken];
                    }
                  }
                }
                if (!insert.hasOwnProperty(token)) {
                  ret[token] = grammar[token];
                }
              }
            }
            var old = root[inside];
            root[inside] = ret;
            _.languages.DFS(_.languages, function(key, value) {
              if (value === old && key != inside) {
                this[key] = ret;
              }
            });
            return ret;
          },
          // Traverse a language definition with Depth First Search
          DFS: function DFS(o, callback, type, visited) {
            visited = visited || {};
            var objId = _.util.objId;
            for (var i in o) {
              if (o.hasOwnProperty(i)) {
                callback.call(o, i, o[i], type || i);
                var property = o[i];
                var propertyType = _.util.type(property);
                if (propertyType === "Object" && !visited[objId(property)]) {
                  visited[objId(property)] = true;
                  DFS(property, callback, null, visited);
                } else if (propertyType === "Array" && !visited[objId(property)]) {
                  visited[objId(property)] = true;
                  DFS(property, callback, i, visited);
                }
              }
            }
          }
        },
        plugins: {},
        /**
         * This is the most high-level function in Prism’s API.
         * It fetches all the elements that have a `.language-xxxx` class and then calls {@link Prism.highlightElement} on
         * each one of them.
         *
         * This is equivalent to `Prism.highlightAllUnder(document, async, callback)`.
         *
         * @param {boolean} [async=false] Same as in {@link Prism.highlightAllUnder}.
         * @param {HighlightCallback} [callback] Same as in {@link Prism.highlightAllUnder}.
         * @memberof Prism
         * @public
         */
        highlightAll: function(async, callback) {
          _.highlightAllUnder(document, async, callback);
        },
        /**
         * Fetches all the descendants of `container` that have a `.language-xxxx` class and then calls
         * {@link Prism.highlightElement} on each one of them.
         *
         * The following hooks will be run:
         * 1. `before-highlightall`
         * 2. `before-all-elements-highlight`
         * 3. All hooks of {@link Prism.highlightElement} for each element.
         *
         * @param {ParentNode} container The root element, whose descendants that have a `.language-xxxx` class will be highlighted.
         * @param {boolean} [async=false] Whether each element is to be highlighted asynchronously using Web Workers.
         * @param {HighlightCallback} [callback] An optional callback to be invoked on each element after its highlighting is done.
         * @memberof Prism
         * @public
         */
        highlightAllUnder: function(container, async, callback) {
          var env = {
            callback,
            container,
            selector: 'code[class*="language-"], [class*="language-"] code, code[class*="lang-"], [class*="lang-"] code'
          };
          _.hooks.run("before-highlightall", env);
          env.elements = Array.prototype.slice.apply(env.container.querySelectorAll(env.selector));
          _.hooks.run("before-all-elements-highlight", env);
          for (var i = 0, element; element = env.elements[i++]; ) {
            _.highlightElement(element, async === true, env.callback);
          }
        },
        /**
         * Highlights the code inside a single element.
         *
         * The following hooks will be run:
         * 1. `before-sanity-check`
         * 2. `before-highlight`
         * 3. All hooks of {@link Prism.highlight}. These hooks will be run by an asynchronous worker if `async` is `true`.
         * 4. `before-insert`
         * 5. `after-highlight`
         * 6. `complete`
         *
         * Some the above hooks will be skipped if the element doesn't contain any text or there is no grammar loaded for
         * the element's language.
         *
         * @param {Element} element The element containing the code.
         * It must have a class of `language-xxxx` to be processed, where `xxxx` is a valid language identifier.
         * @param {boolean} [async=false] Whether the element is to be highlighted asynchronously using Web Workers
         * to improve performance and avoid blocking the UI when highlighting very large chunks of code. This option is
         * [disabled by default](https://prismjs.com/faq.html#why-is-asynchronous-highlighting-disabled-by-default).
         *
         * Note: All language definitions required to highlight the code must be included in the main `prism.js` file for
         * asynchronous highlighting to work. You can build your own bundle on the
         * [Download page](https://prismjs.com/download.html).
         * @param {HighlightCallback} [callback] An optional callback to be invoked after the highlighting is done.
         * Mostly useful when `async` is `true`, since in that case, the highlighting is done asynchronously.
         * @memberof Prism
         * @public
         */
        highlightElement: function(element, async, callback) {
          var language = _.util.getLanguage(element);
          var grammar = _.languages[language];
          _.util.setLanguage(element, language);
          var parent = element.parentElement;
          if (parent && parent.nodeName.toLowerCase() === "pre") {
            _.util.setLanguage(parent, language);
          }
          var code = element.textContent;
          var env = {
            element,
            language,
            grammar,
            code
          };
          function insertHighlightedCode(highlightedCode) {
            env.highlightedCode = highlightedCode;
            _.hooks.run("before-insert", env);
            env.element.innerHTML = env.highlightedCode;
            _.hooks.run("after-highlight", env);
            _.hooks.run("complete", env);
            callback && callback.call(env.element);
          }
          _.hooks.run("before-sanity-check", env);
          parent = env.element.parentElement;
          if (parent && parent.nodeName.toLowerCase() === "pre" && !parent.hasAttribute("tabindex")) {
            parent.setAttribute("tabindex", "0");
          }
          if (!env.code) {
            _.hooks.run("complete", env);
            callback && callback.call(env.element);
            return;
          }
          _.hooks.run("before-highlight", env);
          if (!env.grammar) {
            insertHighlightedCode(_.util.encode(env.code));
            return;
          }
          if (async && _self2.Worker) {
            var worker = new Worker(_.filename);
            worker.onmessage = function(evt) {
              insertHighlightedCode(evt.data);
            };
            worker.postMessage(JSON.stringify({
              language: env.language,
              code: env.code,
              immediateClose: true
            }));
          } else {
            insertHighlightedCode(_.highlight(env.code, env.grammar, env.language));
          }
        },
        /**
         * Low-level function, only use if you know what you’re doing. It accepts a string of text as input
         * and the language definitions to use, and returns a string with the HTML produced.
         *
         * The following hooks will be run:
         * 1. `before-tokenize`
         * 2. `after-tokenize`
         * 3. `wrap`: On each {@link Token}.
         *
         * @param {string} text A string with the code to be highlighted.
         * @param {Grammar} grammar An object containing the tokens to use.
         *
         * Usually a language definition like `Prism.languages.markup`.
         * @param {string} language The name of the language definition passed to `grammar`.
         * @returns {string} The highlighted HTML.
         * @memberof Prism
         * @public
         * @example
         * Prism.highlight('var foo = true;', Prism.languages.javascript, 'javascript');
         */
        highlight: function(text, grammar, language) {
          var env = {
            code: text,
            grammar,
            language
          };
          _.hooks.run("before-tokenize", env);
          if (!env.grammar) {
            throw new Error('The language "' + env.language + '" has no grammar.');
          }
          env.tokens = _.tokenize(env.code, env.grammar);
          _.hooks.run("after-tokenize", env);
          return Token.stringify(_.util.encode(env.tokens), env.language);
        },
        /**
         * This is the heart of Prism, and the most low-level function you can use. It accepts a string of text as input
         * and the language definitions to use, and returns an array with the tokenized code.
         *
         * When the language definition includes nested tokens, the function is called recursively on each of these tokens.
         *
         * This method could be useful in other contexts as well, as a very crude parser.
         *
         * @param {string} text A string with the code to be highlighted.
         * @param {Grammar} grammar An object containing the tokens to use.
         *
         * Usually a language definition like `Prism.languages.markup`.
         * @returns {TokenStream} An array of strings and tokens, a token stream.
         * @memberof Prism
         * @public
         * @example
         * let code = `var foo = 0;`;
         * let tokens = Prism.tokenize(code, Prism.languages.javascript);
         * tokens.forEach(token => {
         *     if (token instanceof Prism.Token && token.type === 'number') {
         *         console.log(`Found numeric literal: ${token.content}`);
         *     }
         * });
         */
        tokenize: function(text, grammar) {
          var rest = grammar.rest;
          if (rest) {
            for (var token in rest) {
              grammar[token] = rest[token];
            }
            delete grammar.rest;
          }
          var tokenList = new LinkedList();
          addAfter(tokenList, tokenList.head, text);
          matchGrammar(text, tokenList, grammar, tokenList.head, 0);
          return toArray(tokenList);
        },
        /**
         * @namespace
         * @memberof Prism
         * @public
         */
        hooks: {
          all: {},
          /**
           * Adds the given callback to the list of callbacks for the given hook.
           *
           * The callback will be invoked when the hook it is registered for is run.
           * Hooks are usually directly run by a highlight function but you can also run hooks yourself.
           *
           * One callback function can be registered to multiple hooks and the same hook multiple times.
           *
           * @param {string} name The name of the hook.
           * @param {HookCallback} callback The callback function which is given environment variables.
           * @public
           */
          add: function(name, callback) {
            var hooks = _.hooks.all;
            hooks[name] = hooks[name] || [];
            hooks[name].push(callback);
          },
          /**
           * Runs a hook invoking all registered callbacks with the given environment variables.
           *
           * Callbacks will be invoked synchronously and in the order in which they were registered.
           *
           * @param {string} name The name of the hook.
           * @param {Object<string, any>} env The environment variables of the hook passed to all callbacks registered.
           * @public
           */
          run: function(name, env) {
            var callbacks = _.hooks.all[name];
            if (!callbacks || !callbacks.length) {
              return;
            }
            for (var i = 0, callback; callback = callbacks[i++]; ) {
              callback(env);
            }
          }
        },
        Token
      };
      _self2.Prism = _;
      function Token(type, content, alias, matchedStr) {
        this.type = type;
        this.content = content;
        this.alias = alias;
        this.length = (matchedStr || "").length | 0;
      }
      Token.stringify = function stringify(o, language) {
        if (typeof o == "string") {
          return o;
        }
        if (Array.isArray(o)) {
          var s = "";
          o.forEach(function(e) {
            s += stringify(e, language);
          });
          return s;
        }
        var env = {
          type: o.type,
          content: stringify(o.content, language),
          tag: "span",
          classes: ["token", o.type],
          attributes: {},
          language
        };
        var aliases = o.alias;
        if (aliases) {
          if (Array.isArray(aliases)) {
            Array.prototype.push.apply(env.classes, aliases);
          } else {
            env.classes.push(aliases);
          }
        }
        _.hooks.run("wrap", env);
        var attributes = "";
        for (var name in env.attributes) {
          attributes += " " + name + '="' + (env.attributes[name] || "").replace(/"/g, "&quot;") + '"';
        }
        return "<" + env.tag + ' class="' + env.classes.join(" ") + '"' + attributes + ">" + env.content + "</" + env.tag + ">";
      };
      function matchPattern(pattern, pos, text, lookbehind) {
        pattern.lastIndex = pos;
        var match = pattern.exec(text);
        if (match && lookbehind && match[1]) {
          var lookbehindLength = match[1].length;
          match.index += lookbehindLength;
          match[0] = match[0].slice(lookbehindLength);
        }
        return match;
      }
      function matchGrammar(text, tokenList, grammar, startNode, startPos, rematch) {
        for (var token in grammar) {
          if (!grammar.hasOwnProperty(token) || !grammar[token]) {
            continue;
          }
          var patterns = grammar[token];
          patterns = Array.isArray(patterns) ? patterns : [patterns];
          for (var j = 0; j < patterns.length; ++j) {
            if (rematch && rematch.cause == token + "," + j) {
              return;
            }
            var patternObj = patterns[j];
            var inside = patternObj.inside;
            var lookbehind = !!patternObj.lookbehind;
            var greedy = !!patternObj.greedy;
            var alias = patternObj.alias;
            if (greedy && !patternObj.pattern.global) {
              var flags = patternObj.pattern.toString().match(/[imsuy]*$/)[0];
              patternObj.pattern = RegExp(patternObj.pattern.source, flags + "g");
            }
            var pattern = patternObj.pattern || patternObj;
            for (var currentNode = startNode.next, pos = startPos; currentNode !== tokenList.tail; pos += currentNode.value.length, currentNode = currentNode.next) {
              if (rematch && pos >= rematch.reach) {
                break;
              }
              var str = currentNode.value;
              if (tokenList.length > text.length) {
                return;
              }
              if (str instanceof Token) {
                continue;
              }
              var removeCount = 1;
              var match;
              if (greedy) {
                match = matchPattern(pattern, pos, text, lookbehind);
                if (!match || match.index >= text.length) {
                  break;
                }
                var from = match.index;
                var to = match.index + match[0].length;
                var p = pos;
                p += currentNode.value.length;
                while (from >= p) {
                  currentNode = currentNode.next;
                  p += currentNode.value.length;
                }
                p -= currentNode.value.length;
                pos = p;
                if (currentNode.value instanceof Token) {
                  continue;
                }
                for (var k = currentNode; k !== tokenList.tail && (p < to || typeof k.value === "string"); k = k.next) {
                  removeCount++;
                  p += k.value.length;
                }
                removeCount--;
                str = text.slice(pos, p);
                match.index -= pos;
              } else {
                match = matchPattern(pattern, 0, str, lookbehind);
                if (!match) {
                  continue;
                }
              }
              var from = match.index;
              var matchStr = match[0];
              var before = str.slice(0, from);
              var after = str.slice(from + matchStr.length);
              var reach = pos + str.length;
              if (rematch && reach > rematch.reach) {
                rematch.reach = reach;
              }
              var removeFrom = currentNode.prev;
              if (before) {
                removeFrom = addAfter(tokenList, removeFrom, before);
                pos += before.length;
              }
              removeRange(tokenList, removeFrom, removeCount);
              var wrapped = new Token(token, inside ? _.tokenize(matchStr, inside) : matchStr, alias, matchStr);
              currentNode = addAfter(tokenList, removeFrom, wrapped);
              if (after) {
                addAfter(tokenList, currentNode, after);
              }
              if (removeCount > 1) {
                var nestedRematch = {
                  cause: token + "," + j,
                  reach
                };
                matchGrammar(text, tokenList, grammar, currentNode.prev, pos, nestedRematch);
                if (rematch && nestedRematch.reach > rematch.reach) {
                  rematch.reach = nestedRematch.reach;
                }
              }
            }
          }
        }
      }
      function LinkedList() {
        var head = { value: null, prev: null, next: null };
        var tail = { value: null, prev: head, next: null };
        head.next = tail;
        this.head = head;
        this.tail = tail;
        this.length = 0;
      }
      function addAfter(list, node, value) {
        var next = node.next;
        var newNode = { value, prev: node, next };
        node.next = newNode;
        next.prev = newNode;
        list.length++;
        return newNode;
      }
      function removeRange(list, node, count) {
        var next = node.next;
        for (var i = 0; i < count && next !== list.tail; i++) {
          next = next.next;
        }
        node.next = next;
        next.prev = node;
        list.length -= i;
      }
      function toArray(list) {
        var array = [];
        var node = list.head.next;
        while (node !== list.tail) {
          array.push(node.value);
          node = node.next;
        }
        return array;
      }
      if (!_self2.document) {
        if (!_self2.addEventListener) {
          return _;
        }
        if (!_.disableWorkerMessageHandler) {
          _self2.addEventListener("message", function(evt) {
            var message = JSON.parse(evt.data);
            var lang2 = message.language;
            var code = message.code;
            var immediateClose = message.immediateClose;
            _self2.postMessage(_.highlight(code, _.languages[lang2], lang2));
            if (immediateClose) {
              _self2.close();
            }
          }, false);
        }
        return _;
      }
      var script = _.util.currentScript();
      if (script) {
        _.filename = script.src;
        if (script.hasAttribute("data-manual")) {
          _.manual = true;
        }
      }
      function highlightAutomaticallyCallback() {
        if (!_.manual) {
          _.highlightAll();
        }
      }
      if (!_.manual) {
        var readyState = document.readyState;
        if (readyState === "loading" || readyState === "interactive" && script && script.defer) {
          document.addEventListener("DOMContentLoaded", highlightAutomaticallyCallback);
        } else {
          if (window.requestAnimationFrame) {
            window.requestAnimationFrame(highlightAutomaticallyCallback);
          } else {
            window.setTimeout(highlightAutomaticallyCallback, 16);
          }
        }
      }
      return _;
    })(_self);
    if (typeof module !== "undefined" && module.exports) {
      module.exports = Prism3;
    }
    if (typeof global !== "undefined") {
      global.Prism = Prism3;
    }
    Prism3.languages.markup = {
      "comment": {
        pattern: /<!--(?:(?!<!--)[\s\S])*?-->/,
        greedy: true
      },
      "prolog": {
        pattern: /<\?[\s\S]+?\?>/,
        greedy: true
      },
      "doctype": {
        // https://www.w3.org/TR/xml/#NT-doctypedecl
        pattern: /<!DOCTYPE(?:[^>"'[\]]|"[^"]*"|'[^']*')+(?:\[(?:[^<"'\]]|"[^"]*"|'[^']*'|<(?!!--)|<!--(?:[^-]|-(?!->))*-->)*\]\s*)?>/i,
        greedy: true,
        inside: {
          "internal-subset": {
            pattern: /(^[^\[]*\[)[\s\S]+(?=\]>$)/,
            lookbehind: true,
            greedy: true,
            inside: null
            // see below
          },
          "string": {
            pattern: /"[^"]*"|'[^']*'/,
            greedy: true
          },
          "punctuation": /^<!|>$|[[\]]/,
          "doctype-tag": /^DOCTYPE/i,
          "name": /[^\s<>'"]+/
        }
      },
      "cdata": {
        pattern: /<!\[CDATA\[[\s\S]*?\]\]>/i,
        greedy: true
      },
      "tag": {
        pattern: /<\/?(?!\d)[^\s>\/=$<%]+(?:\s(?:\s*[^\s>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+(?=[\s>]))|(?=[\s/>])))+)?\s*\/?>/,
        greedy: true,
        inside: {
          "tag": {
            pattern: /^<\/?[^\s>\/]+/,
            inside: {
              "punctuation": /^<\/?/,
              "namespace": /^[^\s>\/:]+:/
            }
          },
          "special-attr": [],
          "attr-value": {
            pattern: /=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+)/,
            inside: {
              "punctuation": [
                {
                  pattern: /^=/,
                  alias: "attr-equals"
                },
                {
                  pattern: /^(\s*)["']|["']$/,
                  lookbehind: true
                }
              ]
            }
          },
          "punctuation": /\/?>/,
          "attr-name": {
            pattern: /[^\s>\/]+/,
            inside: {
              "namespace": /^[^\s>\/:]+:/
            }
          }
        }
      },
      "entity": [
        {
          pattern: /&[\da-z]{1,8};/i,
          alias: "named-entity"
        },
        /&#x?[\da-f]{1,8};/i
      ]
    };
    Prism3.languages.markup["tag"].inside["attr-value"].inside["entity"] = Prism3.languages.markup["entity"];
    Prism3.languages.markup["doctype"].inside["internal-subset"].inside = Prism3.languages.markup;
    Prism3.hooks.add("wrap", function(env) {
      if (env.type === "entity") {
        env.attributes["title"] = env.content.replace(/&amp;/, "&");
      }
    });
    Object.defineProperty(Prism3.languages.markup.tag, "addInlined", {
      /**
       * Adds an inlined language to markup.
       *
       * An example of an inlined language is CSS with `<style>` tags.
       *
       * @param {string} tagName The name of the tag that contains the inlined language. This name will be treated as
       * case insensitive.
       * @param {string} lang The language key.
       * @example
       * addInlined('style', 'css');
       */
      value: function addInlined2(tagName, lang) {
        var includedCdataInside = {};
        includedCdataInside["language-" + lang] = {
          pattern: /(^<!\[CDATA\[)[\s\S]+?(?=\]\]>$)/i,
          lookbehind: true,
          inside: Prism3.languages[lang]
        };
        includedCdataInside["cdata"] = /^<!\[CDATA\[|\]\]>$/i;
        var inside = {
          "included-cdata": {
            pattern: /<!\[CDATA\[[\s\S]*?\]\]>/i,
            inside: includedCdataInside
          }
        };
        inside["language-" + lang] = {
          pattern: /[\s\S]+/,
          inside: Prism3.languages[lang]
        };
        var def = {};
        def[tagName] = {
          pattern: RegExp(/(<__[^>]*>)(?:<!\[CDATA\[(?:[^\]]|\](?!\]>))*\]\]>|(?!<!\[CDATA\[)[\s\S])*?(?=<\/__>)/.source.replace(/__/g, function() {
            return tagName;
          }), "i"),
          lookbehind: true,
          greedy: true,
          inside
        };
        Prism3.languages.insertBefore("markup", "cdata", def);
      }
    });
    Object.defineProperty(Prism3.languages.markup.tag, "addAttribute", {
      /**
       * Adds an pattern to highlight languages embedded in HTML attributes.
       *
       * An example of an inlined language is CSS with `style` attributes.
       *
       * @param {string} attrName The name of the tag that contains the inlined language. This name will be treated as
       * case insensitive.
       * @param {string} lang The language key.
       * @example
       * addAttribute('style', 'css');
       */
      value: function(attrName, lang) {
        Prism3.languages.markup.tag.inside["special-attr"].push({
          pattern: RegExp(
            /(^|["'\s])/.source + "(?:" + attrName + ")" + /\s*=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+(?=[\s>]))/.source,
            "i"
          ),
          lookbehind: true,
          inside: {
            "attr-name": /^[^\s=]+/,
            "attr-value": {
              pattern: /=[\s\S]+/,
              inside: {
                "value": {
                  pattern: /(^=\s*(["']|(?!["'])))\S[\s\S]*(?=\2$)/,
                  lookbehind: true,
                  alias: [lang, "language-" + lang],
                  inside: Prism3.languages[lang]
                },
                "punctuation": [
                  {
                    pattern: /^=/,
                    alias: "attr-equals"
                  },
                  /"|'/
                ]
              }
            }
          }
        });
      }
    });
    Prism3.languages.html = Prism3.languages.markup;
    Prism3.languages.mathml = Prism3.languages.markup;
    Prism3.languages.svg = Prism3.languages.markup;
    Prism3.languages.xml = Prism3.languages.extend("markup", {});
    Prism3.languages.ssml = Prism3.languages.xml;
    Prism3.languages.atom = Prism3.languages.xml;
    Prism3.languages.rss = Prism3.languages.xml;
    (function(Prism4) {
      var string = /(?:"(?:\\(?:\r\n|[\s\S])|[^"\\\r\n])*"|'(?:\\(?:\r\n|[\s\S])|[^'\\\r\n])*')/;
      Prism4.languages.css = {
        "comment": /\/\*[\s\S]*?\*\//,
        "atrule": {
          pattern: RegExp("@[\\w-](?:" + /[^;{\s"']|\s+(?!\s)/.source + "|" + string.source + ")*?" + /(?:;|(?=\s*\{))/.source),
          inside: {
            "rule": /^@[\w-]+/,
            "selector-function-argument": {
              pattern: /(\bselector\s*\(\s*(?![\s)]))(?:[^()\s]|\s+(?![\s)])|\((?:[^()]|\([^()]*\))*\))+(?=\s*\))/,
              lookbehind: true,
              alias: "selector"
            },
            "keyword": {
              pattern: /(^|[^\w-])(?:and|not|only|or)(?![\w-])/,
              lookbehind: true
            }
            // See rest below
          }
        },
        "url": {
          // https://drafts.csswg.org/css-values-3/#urls
          pattern: RegExp("\\burl\\((?:" + string.source + "|" + /(?:[^\\\r\n()"']|\\[\s\S])*/.source + ")\\)", "i"),
          greedy: true,
          inside: {
            "function": /^url/i,
            "punctuation": /^\(|\)$/,
            "string": {
              pattern: RegExp("^" + string.source + "$"),
              alias: "url"
            }
          }
        },
        "selector": {
          pattern: RegExp(`(^|[{}\\s])[^{}\\s](?:[^{};"'\\s]|\\s+(?![\\s{])|` + string.source + ")*(?=\\s*\\{)"),
          lookbehind: true
        },
        "string": {
          pattern: string,
          greedy: true
        },
        "property": {
          pattern: /(^|[^-\w\xA0-\uFFFF])(?!\s)[-_a-z\xA0-\uFFFF](?:(?!\s)[-\w\xA0-\uFFFF])*(?=\s*:)/i,
          lookbehind: true
        },
        "important": /!important\b/i,
        "function": {
          pattern: /(^|[^-a-z0-9])[-a-z0-9]+(?=\()/i,
          lookbehind: true
        },
        "punctuation": /[(){};:,]/
      };
      Prism4.languages.css["atrule"].inside.rest = Prism4.languages.css;
      var markup = Prism4.languages.markup;
      if (markup) {
        markup.tag.addInlined("style", "css");
        markup.tag.addAttribute("style", "css");
      }
    })(Prism3);
    Prism3.languages.clike = {
      "comment": [
        {
          pattern: /(^|[^\\])\/\*[\s\S]*?(?:\*\/|$)/,
          lookbehind: true,
          greedy: true
        },
        {
          pattern: /(^|[^\\:])\/\/.*/,
          lookbehind: true,
          greedy: true
        }
      ],
      "string": {
        pattern: /(["'])(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
        greedy: true
      },
      "class-name": {
        pattern: /(\b(?:class|extends|implements|instanceof|interface|new|trait)\s+|\bcatch\s+\()[\w.\\]+/i,
        lookbehind: true,
        inside: {
          "punctuation": /[.\\]/
        }
      },
      "keyword": /\b(?:break|catch|continue|do|else|finally|for|function|if|in|instanceof|new|null|return|throw|try|while)\b/,
      "boolean": /\b(?:false|true)\b/,
      "function": /\b\w+(?=\()/,
      "number": /\b0x[\da-f]+\b|(?:\b\d+(?:\.\d*)?|\B\.\d+)(?:e[+-]?\d+)?/i,
      "operator": /[<>]=?|[!=]=?=?|--?|\+\+?|&&?|\|\|?|[?*/~^%]/,
      "punctuation": /[{}[\];(),.:]/
    };
    Prism3.languages.javascript = Prism3.languages.extend("clike", {
      "class-name": [
        Prism3.languages.clike["class-name"],
        {
          pattern: /(^|[^$\w\xA0-\uFFFF])(?!\s)[_$A-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\.(?:constructor|prototype))/,
          lookbehind: true
        }
      ],
      "keyword": [
        {
          pattern: /((?:^|\})\s*)catch\b/,
          lookbehind: true
        },
        {
          pattern: /(^|[^.]|\.\.\.\s*)\b(?:as|assert(?=\s*\{)|async(?=\s*(?:function\b|\(|[$\w\xA0-\uFFFF]|$))|await|break|case|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally(?=\s*(?:\{|$))|for|from(?=\s*(?:['"]|$))|function|(?:get|set)(?=\s*(?:[#\[$\w\xA0-\uFFFF]|$))|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|static|super|switch|this|throw|try|typeof|undefined|var|void|while|with|yield)\b/,
          lookbehind: true
        }
      ],
      // Allow for all non-ASCII characters (See http://stackoverflow.com/a/2008444)
      "function": /#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*(?:\.\s*(?:apply|bind|call)\s*)?\()/,
      "number": {
        pattern: RegExp(
          /(^|[^\w$])/.source + "(?:" + // constant
          (/NaN|Infinity/.source + "|" + // binary integer
          /0[bB][01]+(?:_[01]+)*n?/.source + "|" + // octal integer
          /0[oO][0-7]+(?:_[0-7]+)*n?/.source + "|" + // hexadecimal integer
          /0[xX][\dA-Fa-f]+(?:_[\dA-Fa-f]+)*n?/.source + "|" + // decimal bigint
          /\d+(?:_\d+)*n/.source + "|" + // decimal number (integer or float) but no bigint
          /(?:\d+(?:_\d+)*(?:\.(?:\d+(?:_\d+)*)?)?|\.\d+(?:_\d+)*)(?:[Ee][+-]?\d+(?:_\d+)*)?/.source) + ")" + /(?![\w$])/.source
        ),
        lookbehind: true
      },
      "operator": /--|\+\+|\*\*=?|=>|&&=?|\|\|=?|[!=]==|<<=?|>>>?=?|[-+*/%&|^!=<>]=?|\.{3}|\?\?=?|\?\.?|[~:]/
    });
    Prism3.languages.javascript["class-name"][0].pattern = /(\b(?:class|extends|implements|instanceof|interface|new)\s+)[\w.\\]+/;
    Prism3.languages.insertBefore("javascript", "keyword", {
      "regex": {
        pattern: RegExp(
          // lookbehind
          // eslint-disable-next-line regexp/no-dupe-characters-character-class
          /((?:^|[^$\w\xA0-\uFFFF."'\])\s]|\b(?:return|yield))\s*)/.source + // Regex pattern:
          // There are 2 regex patterns here. The RegExp set notation proposal added support for nested character
          // classes if the `v` flag is present. Unfortunately, nested CCs are both context-free and incompatible
          // with the only syntax, so we have to define 2 different regex patterns.
          /\//.source + "(?:" + /(?:\[(?:[^\]\\\r\n]|\\.)*\]|\\.|[^/\\\[\r\n])+\/[dgimyus]{0,7}/.source + "|" + // `v` flag syntax. This supports 3 levels of nested character classes.
          /(?:\[(?:[^[\]\\\r\n]|\\.|\[(?:[^[\]\\\r\n]|\\.|\[(?:[^[\]\\\r\n]|\\.)*\])*\])*\]|\\.|[^/\\\[\r\n])+\/[dgimyus]{0,7}v[dgimyus]{0,7}/.source + ")" + // lookahead
          /(?=(?:\s|\/\*(?:[^*]|\*(?!\/))*\*\/)*(?:$|[\r\n,.;:})\]]|\/\/))/.source
        ),
        lookbehind: true,
        greedy: true,
        inside: {
          "regex-source": {
            pattern: /^(\/)[\s\S]+(?=\/[a-z]*$)/,
            lookbehind: true,
            alias: "language-regex",
            inside: Prism3.languages.regex
          },
          "regex-delimiter": /^\/|\/$/,
          "regex-flags": /^[a-z]+$/
        }
      },
      // This must be declared before keyword because we use "function" inside the look-forward
      "function-variable": {
        pattern: /#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*[=:]\s*(?:async\s*)?(?:\bfunction\b|(?:\((?:[^()]|\([^()]*\))*\)|(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*)\s*=>))/,
        alias: "function"
      },
      "parameter": [
        {
          pattern: /(function(?:\s+(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*)?\s*\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\))/,
          lookbehind: true,
          inside: Prism3.languages.javascript
        },
        {
          pattern: /(^|[^$\w\xA0-\uFFFF])(?!\s)[_$a-z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*=>)/i,
          lookbehind: true,
          inside: Prism3.languages.javascript
        },
        {
          pattern: /(\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\)\s*=>)/,
          lookbehind: true,
          inside: Prism3.languages.javascript
        },
        {
          pattern: /((?:\b|\s|^)(?!(?:as|async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally|for|from|function|get|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|set|static|super|switch|this|throw|try|typeof|undefined|var|void|while|with|yield)(?![$\w\xA0-\uFFFF]))(?:(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*\s*)\(\s*|\]\s*\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\)\s*\{)/,
          lookbehind: true,
          inside: Prism3.languages.javascript
        }
      ],
      "constant": /\b[A-Z](?:[A-Z_]|\dx?)*\b/
    });
    Prism3.languages.insertBefore("javascript", "string", {
      "hashbang": {
        pattern: /^#!.*/,
        greedy: true,
        alias: "comment"
      },
      "template-string": {
        pattern: /`(?:\\[\s\S]|\$\{(?:[^{}]|\{(?:[^{}]|\{[^}]*\})*\})+\}|(?!\$\{)[^\\`])*`/,
        greedy: true,
        inside: {
          "template-punctuation": {
            pattern: /^`|`$/,
            alias: "string"
          },
          "interpolation": {
            pattern: /((?:^|[^\\])(?:\\{2})*)\$\{(?:[^{}]|\{(?:[^{}]|\{[^}]*\})*\})+\}/,
            lookbehind: true,
            inside: {
              "interpolation-punctuation": {
                pattern: /^\$\{|\}$/,
                alias: "punctuation"
              },
              rest: Prism3.languages.javascript
            }
          },
          "string": /[\s\S]+/
        }
      },
      "string-property": {
        pattern: /((?:^|[,{])[ \t]*)(["'])(?:\\(?:\r\n|[\s\S])|(?!\2)[^\\\r\n])*\2(?=\s*:)/m,
        lookbehind: true,
        greedy: true,
        alias: "property"
      }
    });
    Prism3.languages.insertBefore("javascript", "operator", {
      "literal-property": {
        pattern: /((?:^|[,{])[ \t]*)(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*:)/m,
        lookbehind: true,
        alias: "property"
      }
    });
    if (Prism3.languages.markup) {
      Prism3.languages.markup.tag.addInlined("script", "javascript");
      Prism3.languages.markup.tag.addAttribute(
        /on(?:abort|blur|change|click|composition(?:end|start|update)|dblclick|error|focus(?:in|out)?|key(?:down|up)|load|mouse(?:down|enter|leave|move|out|over|up)|reset|resize|scroll|select|slotchange|submit|unload|wheel)/.source,
        "javascript"
      );
    }
    Prism3.languages.js = Prism3.languages.javascript;
    (function() {
      if (typeof Prism3 === "undefined" || typeof document === "undefined") {
        return;
      }
      if (!Element.prototype.matches) {
        Element.prototype.matches = Element.prototype.msMatchesSelector || Element.prototype.webkitMatchesSelector;
      }
      var LOADING_MESSAGE = "Loading\u2026";
      var FAILURE_MESSAGE = function(status, message) {
        return "\u2716 Error " + status + " while fetching file: " + message;
      };
      var FAILURE_EMPTY_MESSAGE = "\u2716 Error: File does not exist or is empty";
      var EXTENSIONS = {
        "js": "javascript",
        "py": "python",
        "rb": "ruby",
        "ps1": "powershell",
        "psm1": "powershell",
        "sh": "bash",
        "bat": "batch",
        "h": "c",
        "tex": "latex"
      };
      var STATUS_ATTR = "data-src-status";
      var STATUS_LOADING = "loading";
      var STATUS_LOADED = "loaded";
      var STATUS_FAILED = "failed";
      var SELECTOR = "pre[data-src]:not([" + STATUS_ATTR + '="' + STATUS_LOADED + '"]):not([' + STATUS_ATTR + '="' + STATUS_LOADING + '"])';
      function loadFile(src, success, error) {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", src, true);
        xhr.onreadystatechange = function() {
          if (xhr.readyState == 4) {
            if (xhr.status < 400 && xhr.responseText) {
              success(xhr.responseText);
            } else {
              if (xhr.status >= 400) {
                error(FAILURE_MESSAGE(xhr.status, xhr.statusText));
              } else {
                error(FAILURE_EMPTY_MESSAGE);
              }
            }
          }
        };
        xhr.send(null);
      }
      function parseRange(range) {
        var m = /^\s*(\d+)\s*(?:(,)\s*(?:(\d+)\s*)?)?$/.exec(range || "");
        if (m) {
          var start = Number(m[1]);
          var comma = m[2];
          var end = m[3];
          if (!comma) {
            return [start, start];
          }
          if (!end) {
            return [start, void 0];
          }
          return [start, Number(end)];
        }
        return void 0;
      }
      Prism3.hooks.add("before-highlightall", function(env) {
        env.selector += ", " + SELECTOR;
      });
      Prism3.hooks.add("before-sanity-check", function(env) {
        var pre = (
          /** @type {HTMLPreElement} */
          env.element
        );
        if (pre.matches(SELECTOR)) {
          env.code = "";
          pre.setAttribute(STATUS_ATTR, STATUS_LOADING);
          var code = pre.appendChild(document.createElement("CODE"));
          code.textContent = LOADING_MESSAGE;
          var src = pre.getAttribute("data-src");
          var language = env.language;
          if (language === "none") {
            var extension = (/\.(\w+)$/.exec(src) || [, "none"])[1];
            language = EXTENSIONS[extension] || extension;
          }
          Prism3.util.setLanguage(code, language);
          Prism3.util.setLanguage(pre, language);
          var autoloader = Prism3.plugins.autoloader;
          if (autoloader) {
            autoloader.loadLanguages(language);
          }
          loadFile(
            src,
            function(text) {
              pre.setAttribute(STATUS_ATTR, STATUS_LOADED);
              var range = parseRange(pre.getAttribute("data-range"));
              if (range) {
                var lines = text.split(/\r\n?|\n/g);
                var start = range[0];
                var end = range[1] == null ? lines.length : range[1];
                if (start < 0) {
                  start += lines.length;
                }
                start = Math.max(0, Math.min(start - 1, lines.length));
                if (end < 0) {
                  end += lines.length;
                }
                end = Math.max(0, Math.min(end, lines.length));
                text = lines.slice(start, end).join("\n");
                if (!pre.hasAttribute("data-start")) {
                  pre.setAttribute("data-start", String(start + 1));
                }
              }
              code.textContent = text;
              Prism3.highlightElement(code);
            },
            function(error) {
              pre.setAttribute(STATUS_ATTR, STATUS_FAILED);
              code.textContent = error;
            }
          );
        }
      });
      Prism3.plugins.fileHighlight = {
        /**
         * Executes the File Highlight plugin for all matching `pre` elements under the given container.
         *
         * Note: Elements which are already loaded or currently loading will not be touched by this method.
         *
         * @param {ParentNode} [container=document]
         */
        highlight: function highlight(container) {
          var elements = (container || document).querySelectorAll(SELECTOR);
          for (var i = 0, element; element = elements[i++]; ) {
            Prism3.highlightElement(element);
          }
        }
      };
      var logged = false;
      Prism3.fileHighlight = function() {
        if (!logged) {
          console.warn("Prism.fileHighlight is deprecated. Use `Prism.plugins.fileHighlight.highlight` instead.");
          logged = true;
        }
        Prism3.plugins.fileHighlight.highlight.apply(this, arguments);
      };
    })();
  }
});

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components.json
var components_default = {
  core: {
    meta: {
      path: "components/prism-core.js",
      option: "mandatory"
    },
    core: "Core"
  },
  themes: {
    meta: {
      path: "themes/{id}.css",
      link: "index.html?theme={id}",
      exclusive: true
    },
    prism: {
      title: "Default",
      option: "default"
    },
    "prism-dark": "Dark",
    "prism-funky": "Funky",
    "prism-okaidia": {
      title: "Okaidia",
      owner: "ocodia"
    },
    "prism-twilight": {
      title: "Twilight",
      owner: "remybach"
    },
    "prism-coy": {
      title: "Coy",
      owner: "tshedor"
    },
    "prism-solarizedlight": {
      title: "Solarized Light",
      owner: "hectormatos2011 "
    },
    "prism-tomorrow": {
      title: "Tomorrow Night",
      owner: "Rosey"
    }
  },
  languages: {
    meta: {
      path: "components/prism-{id}",
      noCSS: true,
      examplesPath: "examples/prism-{id}",
      addCheckAll: true
    },
    markup: {
      title: "Markup",
      alias: ["html", "xml", "svg", "mathml", "ssml", "atom", "rss"],
      aliasTitles: {
        html: "HTML",
        xml: "XML",
        svg: "SVG",
        mathml: "MathML",
        ssml: "SSML",
        atom: "Atom",
        rss: "RSS"
      },
      option: "default"
    },
    css: {
      title: "CSS",
      option: "default",
      modify: "markup"
    },
    clike: {
      title: "C-like",
      option: "default"
    },
    javascript: {
      title: "JavaScript",
      require: "clike",
      modify: "markup",
      optional: "regex",
      alias: "js",
      option: "default"
    },
    abap: {
      title: "ABAP",
      owner: "dellagustin"
    },
    abnf: {
      title: "ABNF",
      owner: "RunDevelopment"
    },
    actionscript: {
      title: "ActionScript",
      require: "javascript",
      modify: "markup",
      owner: "Golmote"
    },
    ada: {
      title: "Ada",
      owner: "Lucretia"
    },
    agda: {
      title: "Agda",
      owner: "xy-ren"
    },
    al: {
      title: "AL",
      owner: "RunDevelopment"
    },
    antlr4: {
      title: "ANTLR4",
      alias: "g4",
      owner: "RunDevelopment"
    },
    apacheconf: {
      title: "Apache Configuration",
      owner: "GuiTeK"
    },
    apex: {
      title: "Apex",
      require: ["clike", "sql"],
      owner: "RunDevelopment"
    },
    apl: {
      title: "APL",
      owner: "ngn"
    },
    applescript: {
      title: "AppleScript",
      owner: "Golmote"
    },
    aql: {
      title: "AQL",
      owner: "RunDevelopment"
    },
    arduino: {
      title: "Arduino",
      require: "cpp",
      alias: "ino",
      owner: "dkern"
    },
    arff: {
      title: "ARFF",
      owner: "Golmote"
    },
    armasm: {
      title: "ARM Assembly",
      alias: "arm-asm",
      owner: "RunDevelopment"
    },
    arturo: {
      title: "Arturo",
      alias: "art",
      optional: [
        "bash",
        "css",
        "javascript",
        "markup",
        "markdown",
        "sql"
      ],
      owner: "drkameleon"
    },
    asciidoc: {
      alias: "adoc",
      title: "AsciiDoc",
      owner: "Golmote"
    },
    aspnet: {
      title: "ASP.NET (C#)",
      require: ["markup", "csharp"],
      owner: "nauzilus"
    },
    asm6502: {
      title: "6502 Assembly",
      owner: "kzurawel"
    },
    asmatmel: {
      title: "Atmel AVR Assembly",
      owner: "cerkit"
    },
    autohotkey: {
      title: "AutoHotkey",
      owner: "aviaryan"
    },
    autoit: {
      title: "AutoIt",
      owner: "Golmote"
    },
    avisynth: {
      title: "AviSynth",
      alias: "avs",
      owner: "Zinfidel"
    },
    "avro-idl": {
      title: "Avro IDL",
      alias: "avdl",
      owner: "RunDevelopment"
    },
    awk: {
      title: "AWK",
      alias: "gawk",
      aliasTitles: {
        gawk: "GAWK"
      },
      owner: "RunDevelopment"
    },
    bash: {
      title: "Bash",
      alias: ["sh", "shell"],
      aliasTitles: {
        sh: "Shell",
        shell: "Shell"
      },
      owner: "zeitgeist87"
    },
    basic: {
      title: "BASIC",
      owner: "Golmote"
    },
    batch: {
      title: "Batch",
      owner: "Golmote"
    },
    bbcode: {
      title: "BBcode",
      alias: "shortcode",
      aliasTitles: {
        shortcode: "Shortcode"
      },
      owner: "RunDevelopment"
    },
    bbj: {
      title: "BBj",
      owner: "hyyan"
    },
    bicep: {
      title: "Bicep",
      owner: "johnnyreilly"
    },
    birb: {
      title: "Birb",
      require: "clike",
      owner: "Calamity210"
    },
    bison: {
      title: "Bison",
      require: "c",
      owner: "Golmote"
    },
    bnf: {
      title: "BNF",
      alias: "rbnf",
      aliasTitles: {
        rbnf: "RBNF"
      },
      owner: "RunDevelopment"
    },
    bqn: {
      title: "BQN",
      owner: "yewscion"
    },
    brainfuck: {
      title: "Brainfuck",
      owner: "Golmote"
    },
    brightscript: {
      title: "BrightScript",
      owner: "RunDevelopment"
    },
    bro: {
      title: "Bro",
      owner: "wayward710"
    },
    bsl: {
      title: "BSL (1C:Enterprise)",
      alias: "oscript",
      aliasTitles: {
        oscript: "OneScript"
      },
      owner: "Diversus23"
    },
    c: {
      title: "C",
      require: "clike",
      owner: "zeitgeist87"
    },
    csharp: {
      title: "C#",
      require: "clike",
      alias: ["cs", "dotnet"],
      owner: "mvalipour"
    },
    cpp: {
      title: "C++",
      require: "c",
      owner: "zeitgeist87"
    },
    cfscript: {
      title: "CFScript",
      require: "clike",
      alias: "cfc",
      owner: "mjclemente"
    },
    chaiscript: {
      title: "ChaiScript",
      require: ["clike", "cpp"],
      owner: "RunDevelopment"
    },
    cil: {
      title: "CIL",
      owner: "sbrl"
    },
    cilkc: {
      title: "Cilk/C",
      require: "c",
      alias: "cilk-c",
      owner: "OpenCilk"
    },
    cilkcpp: {
      title: "Cilk/C++",
      require: "cpp",
      alias: ["cilk-cpp", "cilk"],
      owner: "OpenCilk"
    },
    clojure: {
      title: "Clojure",
      owner: "troglotit"
    },
    cmake: {
      title: "CMake",
      owner: "mjrogozinski"
    },
    cobol: {
      title: "COBOL",
      owner: "RunDevelopment"
    },
    coffeescript: {
      title: "CoffeeScript",
      require: "javascript",
      alias: "coffee",
      owner: "R-osey"
    },
    concurnas: {
      title: "Concurnas",
      alias: "conc",
      owner: "jasontatton"
    },
    csp: {
      title: "Content-Security-Policy",
      owner: "ScottHelme"
    },
    cooklang: {
      title: "Cooklang",
      owner: "ahue"
    },
    coq: {
      title: "Coq",
      owner: "RunDevelopment"
    },
    crystal: {
      title: "Crystal",
      require: "ruby",
      owner: "MakeNowJust"
    },
    "css-extras": {
      title: "CSS Extras",
      require: "css",
      modify: "css",
      owner: "milesj"
    },
    csv: {
      title: "CSV",
      owner: "RunDevelopment"
    },
    cue: {
      title: "CUE",
      owner: "RunDevelopment"
    },
    cypher: {
      title: "Cypher",
      owner: "RunDevelopment"
    },
    d: {
      title: "D",
      require: "clike",
      owner: "Golmote"
    },
    dart: {
      title: "Dart",
      require: "clike",
      owner: "Golmote"
    },
    dataweave: {
      title: "DataWeave",
      owner: "machaval"
    },
    dax: {
      title: "DAX",
      owner: "peterbud"
    },
    dhall: {
      title: "Dhall",
      owner: "RunDevelopment"
    },
    diff: {
      title: "Diff",
      owner: "uranusjr"
    },
    django: {
      title: "Django/Jinja2",
      require: "markup-templating",
      alias: "jinja2",
      owner: "romanvm"
    },
    "dns-zone-file": {
      title: "DNS zone file",
      owner: "RunDevelopment",
      alias: "dns-zone"
    },
    docker: {
      title: "Docker",
      alias: "dockerfile",
      owner: "JustinBeckwith"
    },
    dot: {
      title: "DOT (Graphviz)",
      alias: "gv",
      optional: "markup",
      owner: "RunDevelopment"
    },
    ebnf: {
      title: "EBNF",
      owner: "RunDevelopment"
    },
    editorconfig: {
      title: "EditorConfig",
      owner: "osipxd"
    },
    eiffel: {
      title: "Eiffel",
      owner: "Conaclos"
    },
    ejs: {
      title: "EJS",
      require: ["javascript", "markup-templating"],
      owner: "RunDevelopment",
      alias: "eta",
      aliasTitles: {
        eta: "Eta"
      }
    },
    elixir: {
      title: "Elixir",
      owner: "Golmote"
    },
    elm: {
      title: "Elm",
      owner: "zwilias"
    },
    etlua: {
      title: "Embedded Lua templating",
      require: ["lua", "markup-templating"],
      owner: "RunDevelopment"
    },
    erb: {
      title: "ERB",
      require: ["ruby", "markup-templating"],
      owner: "Golmote"
    },
    erlang: {
      title: "Erlang",
      owner: "Golmote"
    },
    "excel-formula": {
      title: "Excel Formula",
      alias: ["xlsx", "xls"],
      owner: "RunDevelopment"
    },
    fsharp: {
      title: "F#",
      require: "clike",
      owner: "simonreynolds7"
    },
    factor: {
      title: "Factor",
      owner: "catb0t"
    },
    false: {
      title: "False",
      owner: "edukisto"
    },
    "firestore-security-rules": {
      title: "Firestore security rules",
      require: "clike",
      owner: "RunDevelopment"
    },
    flow: {
      title: "Flow",
      require: "javascript",
      owner: "Golmote"
    },
    fortran: {
      title: "Fortran",
      owner: "Golmote"
    },
    ftl: {
      title: "FreeMarker Template Language",
      require: "markup-templating",
      owner: "RunDevelopment"
    },
    gml: {
      title: "GameMaker Language",
      alias: "gamemakerlanguage",
      require: "clike",
      owner: "LiarOnce"
    },
    gap: {
      title: "GAP (CAS)",
      owner: "RunDevelopment"
    },
    gcode: {
      title: "G-code",
      owner: "RunDevelopment"
    },
    gdscript: {
      title: "GDScript",
      owner: "RunDevelopment"
    },
    gedcom: {
      title: "GEDCOM",
      owner: "Golmote"
    },
    gettext: {
      title: "gettext",
      alias: "po",
      owner: "RunDevelopment"
    },
    gherkin: {
      title: "Gherkin",
      owner: "hason"
    },
    git: {
      title: "Git",
      owner: "lgiraudel"
    },
    glsl: {
      title: "GLSL",
      require: "c",
      owner: "Golmote"
    },
    gn: {
      title: "GN",
      alias: "gni",
      owner: "RunDevelopment"
    },
    "linker-script": {
      title: "GNU Linker Script",
      alias: "ld",
      owner: "RunDevelopment"
    },
    go: {
      title: "Go",
      require: "clike",
      owner: "arnehormann"
    },
    "go-module": {
      title: "Go module",
      alias: "go-mod",
      owner: "RunDevelopment"
    },
    gradle: {
      title: "Gradle",
      require: "clike",
      owner: "zeabdelkhalek-badido18"
    },
    graphql: {
      title: "GraphQL",
      optional: "markdown",
      owner: "Golmote"
    },
    groovy: {
      title: "Groovy",
      require: "clike",
      owner: "robfletcher"
    },
    haml: {
      title: "Haml",
      require: "ruby",
      optional: [
        "css",
        "css-extras",
        "coffeescript",
        "erb",
        "javascript",
        "less",
        "markdown",
        "scss",
        "textile"
      ],
      owner: "Golmote"
    },
    handlebars: {
      title: "Handlebars",
      require: "markup-templating",
      alias: ["hbs", "mustache"],
      aliasTitles: {
        mustache: "Mustache"
      },
      owner: "Golmote"
    },
    haskell: {
      title: "Haskell",
      alias: "hs",
      owner: "bholst"
    },
    haxe: {
      title: "Haxe",
      require: "clike",
      optional: "regex",
      owner: "Golmote"
    },
    hcl: {
      title: "HCL",
      owner: "outsideris"
    },
    hlsl: {
      title: "HLSL",
      require: "c",
      owner: "RunDevelopment"
    },
    hoon: {
      title: "Hoon",
      owner: "matildepark"
    },
    http: {
      title: "HTTP",
      optional: [
        "csp",
        "css",
        "hpkp",
        "hsts",
        "javascript",
        "json",
        "markup",
        "uri"
      ],
      owner: "danielgtaylor"
    },
    hpkp: {
      title: "HTTP Public-Key-Pins",
      owner: "ScottHelme"
    },
    hsts: {
      title: "HTTP Strict-Transport-Security",
      owner: "ScottHelme"
    },
    ichigojam: {
      title: "IchigoJam",
      owner: "BlueCocoa"
    },
    icon: {
      title: "Icon",
      owner: "Golmote"
    },
    "icu-message-format": {
      title: "ICU Message Format",
      owner: "RunDevelopment"
    },
    idris: {
      title: "Idris",
      alias: "idr",
      owner: "KeenS",
      require: "haskell"
    },
    ignore: {
      title: ".ignore",
      owner: "osipxd",
      alias: [
        "gitignore",
        "hgignore",
        "npmignore"
      ],
      aliasTitles: {
        gitignore: ".gitignore",
        hgignore: ".hgignore",
        npmignore: ".npmignore"
      }
    },
    inform7: {
      title: "Inform 7",
      owner: "Golmote"
    },
    ini: {
      title: "Ini",
      owner: "aviaryan"
    },
    io: {
      title: "Io",
      owner: "AlesTsurko"
    },
    j: {
      title: "J",
      owner: "Golmote"
    },
    java: {
      title: "Java",
      require: "clike",
      owner: "sherblot"
    },
    javadoc: {
      title: "JavaDoc",
      require: ["markup", "java", "javadoclike"],
      modify: "java",
      optional: "scala",
      owner: "RunDevelopment"
    },
    javadoclike: {
      title: "JavaDoc-like",
      modify: [
        "java",
        "javascript",
        "php"
      ],
      owner: "RunDevelopment"
    },
    javastacktrace: {
      title: "Java stack trace",
      owner: "RunDevelopment"
    },
    jexl: {
      title: "Jexl",
      owner: "czosel"
    },
    jolie: {
      title: "Jolie",
      require: "clike",
      owner: "thesave"
    },
    jq: {
      title: "JQ",
      owner: "RunDevelopment"
    },
    jsdoc: {
      title: "JSDoc",
      require: ["javascript", "javadoclike", "typescript"],
      modify: "javascript",
      optional: [
        "actionscript",
        "coffeescript"
      ],
      owner: "RunDevelopment"
    },
    "js-extras": {
      title: "JS Extras",
      require: "javascript",
      modify: "javascript",
      optional: [
        "actionscript",
        "coffeescript",
        "flow",
        "n4js",
        "typescript"
      ],
      owner: "RunDevelopment"
    },
    json: {
      title: "JSON",
      alias: "webmanifest",
      aliasTitles: {
        webmanifest: "Web App Manifest"
      },
      owner: "CupOfTea696"
    },
    json5: {
      title: "JSON5",
      require: "json",
      owner: "RunDevelopment"
    },
    jsonp: {
      title: "JSONP",
      require: "json",
      owner: "RunDevelopment"
    },
    jsstacktrace: {
      title: "JS stack trace",
      owner: "sbrl"
    },
    "js-templates": {
      title: "JS Templates",
      require: "javascript",
      modify: "javascript",
      optional: [
        "css",
        "css-extras",
        "graphql",
        "markdown",
        "markup",
        "sql"
      ],
      owner: "RunDevelopment"
    },
    julia: {
      title: "Julia",
      owner: "cdagnino"
    },
    keepalived: {
      title: "Keepalived Configure",
      owner: "dev-itsheng"
    },
    keyman: {
      title: "Keyman",
      owner: "mcdurdin"
    },
    kotlin: {
      title: "Kotlin",
      alias: ["kt", "kts"],
      aliasTitles: {
        kts: "Kotlin Script"
      },
      require: "clike",
      owner: "Golmote"
    },
    kumir: {
      title: "KuMir (\u041A\u0443\u041C\u0438\u0440)",
      alias: "kum",
      owner: "edukisto"
    },
    kusto: {
      title: "Kusto",
      owner: "RunDevelopment"
    },
    latex: {
      title: "LaTeX",
      alias: ["tex", "context"],
      aliasTitles: {
        tex: "TeX",
        context: "ConTeXt"
      },
      owner: "japborst"
    },
    latte: {
      title: "Latte",
      require: ["clike", "markup-templating", "php"],
      owner: "nette"
    },
    less: {
      title: "Less",
      require: "css",
      optional: "css-extras",
      owner: "Golmote"
    },
    lilypond: {
      title: "LilyPond",
      require: "scheme",
      alias: "ly",
      owner: "RunDevelopment"
    },
    liquid: {
      title: "Liquid",
      require: "markup-templating",
      owner: "cinhtau"
    },
    lisp: {
      title: "Lisp",
      alias: ["emacs", "elisp", "emacs-lisp"],
      owner: "JuanCaicedo"
    },
    livescript: {
      title: "LiveScript",
      owner: "Golmote"
    },
    llvm: {
      title: "LLVM IR",
      owner: "porglezomp"
    },
    log: {
      title: "Log file",
      optional: "javastacktrace",
      owner: "RunDevelopment"
    },
    lolcode: {
      title: "LOLCODE",
      owner: "Golmote"
    },
    lua: {
      title: "Lua",
      owner: "Golmote"
    },
    magma: {
      title: "Magma (CAS)",
      owner: "RunDevelopment"
    },
    makefile: {
      title: "Makefile",
      owner: "Golmote"
    },
    markdown: {
      title: "Markdown",
      require: "markup",
      optional: "yaml",
      alias: "md",
      owner: "Golmote"
    },
    "markup-templating": {
      title: "Markup templating",
      require: "markup",
      owner: "Golmote"
    },
    mata: {
      title: "Mata",
      owner: "RunDevelopment"
    },
    matlab: {
      title: "MATLAB",
      owner: "Golmote"
    },
    maxscript: {
      title: "MAXScript",
      owner: "RunDevelopment"
    },
    mel: {
      title: "MEL",
      owner: "Golmote"
    },
    mermaid: {
      title: "Mermaid",
      owner: "RunDevelopment"
    },
    metafont: {
      title: "METAFONT",
      owner: "LaeriExNihilo"
    },
    mizar: {
      title: "Mizar",
      owner: "Golmote"
    },
    mongodb: {
      title: "MongoDB",
      owner: "airs0urce",
      require: "javascript"
    },
    monkey: {
      title: "Monkey",
      owner: "Golmote"
    },
    moonscript: {
      title: "MoonScript",
      alias: "moon",
      owner: "RunDevelopment"
    },
    n1ql: {
      title: "N1QL",
      owner: "TMWilds"
    },
    n4js: {
      title: "N4JS",
      require: "javascript",
      optional: "jsdoc",
      alias: "n4jsd",
      owner: "bsmith-n4"
    },
    "nand2tetris-hdl": {
      title: "Nand To Tetris HDL",
      owner: "stephanmax"
    },
    naniscript: {
      title: "Naninovel Script",
      owner: "Elringus",
      alias: "nani"
    },
    nasm: {
      title: "NASM",
      owner: "rbmj"
    },
    neon: {
      title: "NEON",
      owner: "nette"
    },
    nevod: {
      title: "Nevod",
      owner: "nezaboodka"
    },
    nginx: {
      title: "nginx",
      owner: "volado"
    },
    nim: {
      title: "Nim",
      owner: "Golmote"
    },
    nix: {
      title: "Nix",
      owner: "Golmote"
    },
    nsis: {
      title: "NSIS",
      owner: "idleberg"
    },
    objectivec: {
      title: "Objective-C",
      require: "c",
      alias: "objc",
      owner: "uranusjr"
    },
    ocaml: {
      title: "OCaml",
      owner: "Golmote"
    },
    odin: {
      title: "Odin",
      owner: "edukisto"
    },
    opencl: {
      title: "OpenCL",
      require: "c",
      modify: [
        "c",
        "cpp"
      ],
      owner: "Milania1"
    },
    openqasm: {
      title: "OpenQasm",
      alias: "qasm",
      owner: "RunDevelopment"
    },
    oz: {
      title: "Oz",
      owner: "Golmote"
    },
    parigp: {
      title: "PARI/GP",
      owner: "Golmote"
    },
    parser: {
      title: "Parser",
      require: "markup",
      owner: "Golmote"
    },
    pascal: {
      title: "Pascal",
      alias: "objectpascal",
      aliasTitles: {
        objectpascal: "Object Pascal"
      },
      owner: "Golmote"
    },
    pascaligo: {
      title: "Pascaligo",
      owner: "DefinitelyNotAGoat"
    },
    psl: {
      title: "PATROL Scripting Language",
      owner: "bertysentry"
    },
    pcaxis: {
      title: "PC-Axis",
      alias: "px",
      owner: "RunDevelopment"
    },
    peoplecode: {
      title: "PeopleCode",
      alias: "pcode",
      owner: "RunDevelopment"
    },
    perl: {
      title: "Perl",
      owner: "Golmote"
    },
    php: {
      title: "PHP",
      require: "markup-templating",
      owner: "milesj"
    },
    phpdoc: {
      title: "PHPDoc",
      require: ["php", "javadoclike"],
      modify: "php",
      owner: "RunDevelopment"
    },
    "php-extras": {
      title: "PHP Extras",
      require: "php",
      modify: "php",
      owner: "milesj"
    },
    "plant-uml": {
      title: "PlantUML",
      alias: "plantuml",
      owner: "RunDevelopment"
    },
    plsql: {
      title: "PL/SQL",
      require: "sql",
      owner: "Golmote"
    },
    powerquery: {
      title: "PowerQuery",
      alias: ["pq", "mscript"],
      owner: "peterbud"
    },
    powershell: {
      title: "PowerShell",
      owner: "nauzilus"
    },
    processing: {
      title: "Processing",
      require: "clike",
      owner: "Golmote"
    },
    prolog: {
      title: "Prolog",
      owner: "Golmote"
    },
    promql: {
      title: "PromQL",
      owner: "arendjr"
    },
    properties: {
      title: ".properties",
      owner: "Golmote"
    },
    protobuf: {
      title: "Protocol Buffers",
      require: "clike",
      owner: "just-boris"
    },
    pug: {
      title: "Pug",
      require: ["markup", "javascript"],
      optional: [
        "coffeescript",
        "ejs",
        "handlebars",
        "less",
        "livescript",
        "markdown",
        "scss",
        "stylus",
        "twig"
      ],
      owner: "Golmote"
    },
    puppet: {
      title: "Puppet",
      owner: "Golmote"
    },
    pure: {
      title: "Pure",
      optional: [
        "c",
        "cpp",
        "fortran"
      ],
      owner: "Golmote"
    },
    purebasic: {
      title: "PureBasic",
      require: "clike",
      alias: "pbfasm",
      owner: "HeX0R101"
    },
    purescript: {
      title: "PureScript",
      require: "haskell",
      alias: "purs",
      owner: "sriharshachilakapati"
    },
    python: {
      title: "Python",
      alias: "py",
      owner: "multipetros"
    },
    qsharp: {
      title: "Q#",
      require: "clike",
      alias: "qs",
      owner: "fedonman"
    },
    q: {
      title: "Q (kdb+ database)",
      owner: "Golmote"
    },
    qml: {
      title: "QML",
      require: "javascript",
      owner: "RunDevelopment"
    },
    qore: {
      title: "Qore",
      require: "clike",
      owner: "temnroegg"
    },
    r: {
      title: "R",
      owner: "Golmote"
    },
    racket: {
      title: "Racket",
      require: "scheme",
      alias: "rkt",
      owner: "RunDevelopment"
    },
    cshtml: {
      title: "Razor C#",
      alias: "razor",
      require: ["markup", "csharp"],
      optional: [
        "css",
        "css-extras",
        "javascript",
        "js-extras"
      ],
      owner: "RunDevelopment"
    },
    jsx: {
      title: "React JSX",
      require: ["markup", "javascript"],
      optional: [
        "jsdoc",
        "js-extras",
        "js-templates"
      ],
      owner: "vkbansal"
    },
    tsx: {
      title: "React TSX",
      require: ["jsx", "typescript"]
    },
    reason: {
      title: "Reason",
      require: "clike",
      owner: "Golmote"
    },
    regex: {
      title: "Regex",
      owner: "RunDevelopment"
    },
    rego: {
      title: "Rego",
      owner: "JordanSh"
    },
    renpy: {
      title: "Ren'py",
      alias: "rpy",
      owner: "HyuchiaDiego"
    },
    rescript: {
      title: "ReScript",
      alias: "res",
      owner: "vmarcosp"
    },
    rest: {
      title: "reST (reStructuredText)",
      owner: "Golmote"
    },
    rip: {
      title: "Rip",
      owner: "ravinggenius"
    },
    roboconf: {
      title: "Roboconf",
      owner: "Golmote"
    },
    robotframework: {
      title: "Robot Framework",
      alias: "robot",
      owner: "RunDevelopment"
    },
    ruby: {
      title: "Ruby",
      require: "clike",
      alias: "rb",
      owner: "samflores"
    },
    rust: {
      title: "Rust",
      owner: "Golmote"
    },
    sas: {
      title: "SAS",
      optional: ["groovy", "lua", "sql"],
      owner: "Golmote"
    },
    sass: {
      title: "Sass (Sass)",
      require: "css",
      optional: "css-extras",
      owner: "Golmote"
    },
    scss: {
      title: "Sass (SCSS)",
      require: "css",
      optional: "css-extras",
      owner: "MoOx"
    },
    scala: {
      title: "Scala",
      require: "java",
      owner: "jozic"
    },
    scheme: {
      title: "Scheme",
      owner: "bacchus123"
    },
    "shell-session": {
      title: "Shell session",
      require: "bash",
      alias: ["sh-session", "shellsession"],
      owner: "RunDevelopment"
    },
    smali: {
      title: "Smali",
      owner: "RunDevelopment"
    },
    smalltalk: {
      title: "Smalltalk",
      owner: "Golmote"
    },
    smarty: {
      title: "Smarty",
      require: "markup-templating",
      optional: "php",
      owner: "Golmote"
    },
    sml: {
      title: "SML",
      alias: "smlnj",
      aliasTitles: {
        smlnj: "SML/NJ"
      },
      owner: "RunDevelopment"
    },
    solidity: {
      title: "Solidity (Ethereum)",
      alias: "sol",
      require: "clike",
      owner: "glachaud"
    },
    "solution-file": {
      title: "Solution file",
      alias: "sln",
      owner: "RunDevelopment"
    },
    soy: {
      title: "Soy (Closure Template)",
      require: "markup-templating",
      owner: "Golmote"
    },
    sparql: {
      title: "SPARQL",
      require: "turtle",
      owner: "Triply-Dev",
      alias: "rq"
    },
    "splunk-spl": {
      title: "Splunk SPL",
      owner: "RunDevelopment"
    },
    sqf: {
      title: "SQF: Status Quo Function (Arma 3)",
      require: "clike",
      owner: "RunDevelopment"
    },
    sql: {
      title: "SQL",
      owner: "multipetros"
    },
    squirrel: {
      title: "Squirrel",
      require: "clike",
      owner: "RunDevelopment"
    },
    stan: {
      title: "Stan",
      owner: "RunDevelopment"
    },
    stata: {
      title: "Stata Ado",
      require: ["mata", "java", "python"],
      owner: "RunDevelopment"
    },
    iecst: {
      title: "Structured Text (IEC 61131-3)",
      owner: "serhioromano"
    },
    stylus: {
      title: "Stylus",
      owner: "vkbansal"
    },
    supercollider: {
      title: "SuperCollider",
      alias: "sclang",
      owner: "RunDevelopment"
    },
    swift: {
      title: "Swift",
      owner: "chrischares"
    },
    systemd: {
      title: "Systemd configuration file",
      owner: "RunDevelopment"
    },
    "t4-templating": {
      title: "T4 templating",
      owner: "RunDevelopment"
    },
    "t4-cs": {
      title: "T4 Text Templates (C#)",
      require: ["t4-templating", "csharp"],
      alias: "t4",
      owner: "RunDevelopment"
    },
    "t4-vb": {
      title: "T4 Text Templates (VB)",
      require: ["t4-templating", "vbnet"],
      owner: "RunDevelopment"
    },
    tap: {
      title: "TAP",
      owner: "isaacs",
      require: "yaml"
    },
    tcl: {
      title: "Tcl",
      owner: "PeterChaplin"
    },
    tt2: {
      title: "Template Toolkit 2",
      require: ["clike", "markup-templating"],
      owner: "gflohr"
    },
    textile: {
      title: "Textile",
      require: "markup",
      optional: "css",
      owner: "Golmote"
    },
    toml: {
      title: "TOML",
      owner: "RunDevelopment"
    },
    tremor: {
      title: "Tremor",
      alias: [
        "trickle",
        "troy"
      ],
      owner: "darach",
      aliasTitles: {
        trickle: "trickle",
        troy: "troy"
      }
    },
    turtle: {
      title: "Turtle",
      alias: "trig",
      aliasTitles: {
        trig: "TriG"
      },
      owner: "jakubklimek"
    },
    twig: {
      title: "Twig",
      require: "markup-templating",
      owner: "brandonkelly"
    },
    typescript: {
      title: "TypeScript",
      require: "javascript",
      optional: "js-templates",
      alias: "ts",
      owner: "vkbansal"
    },
    typoscript: {
      title: "TypoScript",
      alias: "tsconfig",
      aliasTitles: {
        tsconfig: "TSConfig"
      },
      owner: "dkern"
    },
    unrealscript: {
      title: "UnrealScript",
      alias: ["uscript", "uc"],
      owner: "RunDevelopment"
    },
    uorazor: {
      title: "UO Razor Script",
      owner: "jaseowns"
    },
    uri: {
      title: "URI",
      alias: "url",
      aliasTitles: {
        url: "URL"
      },
      owner: "RunDevelopment"
    },
    v: {
      title: "V",
      require: "clike",
      owner: "taggon"
    },
    vala: {
      title: "Vala",
      require: "clike",
      optional: "regex",
      owner: "TemplarVolk"
    },
    vbnet: {
      title: "VB.Net",
      require: "basic",
      owner: "Bigsby"
    },
    velocity: {
      title: "Velocity",
      require: "markup",
      owner: "Golmote"
    },
    verilog: {
      title: "Verilog",
      owner: "a-rey"
    },
    vhdl: {
      title: "VHDL",
      owner: "a-rey"
    },
    vim: {
      title: "vim",
      owner: "westonganger"
    },
    "visual-basic": {
      title: "Visual Basic",
      alias: ["vb", "vba"],
      aliasTitles: {
        vba: "VBA"
      },
      owner: "Golmote"
    },
    warpscript: {
      title: "WarpScript",
      owner: "RunDevelopment"
    },
    wasm: {
      title: "WebAssembly",
      owner: "Golmote"
    },
    "web-idl": {
      title: "Web IDL",
      alias: "webidl",
      owner: "RunDevelopment"
    },
    wgsl: {
      title: "WGSL",
      owner: "Dr4gonthree"
    },
    wiki: {
      title: "Wiki markup",
      require: "markup",
      owner: "Golmote"
    },
    wolfram: {
      title: "Wolfram language",
      alias: ["mathematica", "nb", "wl"],
      aliasTitles: {
        mathematica: "Mathematica",
        nb: "Mathematica Notebook"
      },
      owner: "msollami"
    },
    wren: {
      title: "Wren",
      owner: "clsource"
    },
    xeora: {
      title: "Xeora",
      require: "markup",
      alias: "xeoracube",
      aliasTitles: {
        xeoracube: "XeoraCube"
      },
      owner: "freakmaxi"
    },
    "xml-doc": {
      title: "XML doc (.net)",
      require: "markup",
      modify: ["csharp", "fsharp", "vbnet"],
      owner: "RunDevelopment"
    },
    xojo: {
      title: "Xojo (REALbasic)",
      owner: "Golmote"
    },
    xquery: {
      title: "XQuery",
      require: "markup",
      owner: "Golmote"
    },
    yaml: {
      title: "YAML",
      alias: "yml",
      owner: "hason"
    },
    yang: {
      title: "YANG",
      owner: "RunDevelopment"
    },
    zig: {
      title: "Zig",
      owner: "RunDevelopment"
    }
  },
  plugins: {
    meta: {
      path: "plugins/{id}/prism-{id}",
      link: "plugins/{id}/"
    },
    "line-highlight": {
      title: "Line Highlight",
      description: "Highlights specific lines and/or line ranges."
    },
    "line-numbers": {
      title: "Line Numbers",
      description: "Line number at the beginning of code lines.",
      owner: "kuba-kubula"
    },
    "show-invisibles": {
      title: "Show Invisibles",
      description: "Show hidden characters such as tabs and line breaks.",
      optional: [
        "autolinker",
        "data-uri-highlight"
      ]
    },
    autolinker: {
      title: "Autolinker",
      description: "Converts URLs and emails in code to clickable links. Parses Markdown links in comments."
    },
    wpd: {
      title: "WebPlatform Docs",
      description: 'Makes tokens link to <a href="https://webplatform.github.io/docs/">WebPlatform.org documentation</a>. The links open in a new tab.'
    },
    "custom-class": {
      title: "Custom Class",
      description: "This plugin allows you to prefix Prism's default classes (<code>.comment</code> can become <code>.namespace--comment</code>) or replace them with your defined ones (like <code>.editor__comment</code>). You can even add new classes.",
      owner: "dvkndn",
      noCSS: true
    },
    "file-highlight": {
      title: "File Highlight",
      description: "Fetch external files and highlight them with Prism. Used on the Prism website itself.",
      noCSS: true
    },
    "show-language": {
      title: "Show Language",
      description: "Display the highlighted language in code blocks (inline code does not show the label).",
      owner: "nauzilus",
      noCSS: true,
      require: "toolbar"
    },
    "jsonp-highlight": {
      title: "JSONP Highlight",
      description: "Fetch content with JSONP and highlight some interesting content (e.g. GitHub/Gists or Bitbucket API).",
      noCSS: true,
      owner: "nauzilus"
    },
    "highlight-keywords": {
      title: "Highlight Keywords",
      description: "Adds special CSS classes for each keyword for fine-grained highlighting.",
      owner: "vkbansal",
      noCSS: true
    },
    "remove-initial-line-feed": {
      title: "Remove initial line feed",
      description: "Removes the initial line feed in code blocks.",
      owner: "Golmote",
      noCSS: true
    },
    "inline-color": {
      title: "Inline color",
      description: "Adds a small inline preview for colors in style sheets.",
      require: "css-extras",
      owner: "RunDevelopment"
    },
    previewers: {
      title: "Previewers",
      description: "Previewers for angles, colors, gradients, easing and time.",
      require: "css-extras",
      owner: "Golmote"
    },
    autoloader: {
      title: "Autoloader",
      description: "Automatically loads the needed languages to highlight the code blocks.",
      owner: "Golmote",
      noCSS: true
    },
    "keep-markup": {
      title: "Keep Markup",
      description: "Prevents custom markup from being dropped out during highlighting.",
      owner: "Golmote",
      optional: "normalize-whitespace",
      noCSS: true
    },
    "command-line": {
      title: "Command Line",
      description: "Display a command line with a prompt and, optionally, the output/response from the commands.",
      owner: "chriswells0"
    },
    "unescaped-markup": {
      title: "Unescaped Markup",
      description: "Write markup without having to escape anything."
    },
    "normalize-whitespace": {
      title: "Normalize Whitespace",
      description: "Supports multiple operations to normalize whitespace in code blocks.",
      owner: "zeitgeist87",
      optional: "unescaped-markup",
      noCSS: true
    },
    "data-uri-highlight": {
      title: "Data-URI Highlight",
      description: "Highlights data-URI contents.",
      owner: "Golmote",
      noCSS: true
    },
    toolbar: {
      title: "Toolbar",
      description: "Attach a toolbar for plugins to easily register buttons on the top of a code block.",
      owner: "mAAdhaTTah"
    },
    "copy-to-clipboard": {
      title: "Copy to Clipboard Button",
      description: "Add a button that copies the code block to the clipboard when clicked.",
      owner: "mAAdhaTTah",
      require: "toolbar",
      noCSS: true
    },
    "download-button": {
      title: "Download Button",
      description: "A button in the toolbar of a code block adding a convenient way to download a code file.",
      owner: "Golmote",
      require: "toolbar",
      noCSS: true
    },
    "match-braces": {
      title: "Match braces",
      description: "Highlights matching braces.",
      owner: "RunDevelopment"
    },
    "diff-highlight": {
      title: "Diff Highlight",
      description: "Highlights the code inside diff blocks.",
      owner: "RunDevelopment",
      require: "diff"
    },
    "filter-highlight-all": {
      title: "Filter highlightAll",
      description: "Filters the elements the <code>highlightAll</code> and <code>highlightAllUnder</code> methods actually highlight.",
      owner: "RunDevelopment",
      noCSS: true
    },
    treeview: {
      title: "Treeview",
      description: "A language with special styles to highlight file system tree structures.",
      owner: "Golmote"
    }
  }
};

// scripts/prism-entry.ts
var import_prismjs = __toESM(require_prism(), 1);
var PrismModule = __toESM(require_prism(), 1);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-markup.js
Prism.languages.markup = {
  "comment": {
    pattern: /<!--(?:(?!<!--)[\s\S])*?-->/,
    greedy: true
  },
  "prolog": {
    pattern: /<\?[\s\S]+?\?>/,
    greedy: true
  },
  "doctype": {
    // https://www.w3.org/TR/xml/#NT-doctypedecl
    pattern: /<!DOCTYPE(?:[^>"'[\]]|"[^"]*"|'[^']*')+(?:\[(?:[^<"'\]]|"[^"]*"|'[^']*'|<(?!!--)|<!--(?:[^-]|-(?!->))*-->)*\]\s*)?>/i,
    greedy: true,
    inside: {
      "internal-subset": {
        pattern: /(^[^\[]*\[)[\s\S]+(?=\]>$)/,
        lookbehind: true,
        greedy: true,
        inside: null
        // see below
      },
      "string": {
        pattern: /"[^"]*"|'[^']*'/,
        greedy: true
      },
      "punctuation": /^<!|>$|[[\]]/,
      "doctype-tag": /^DOCTYPE/i,
      "name": /[^\s<>'"]+/
    }
  },
  "cdata": {
    pattern: /<!\[CDATA\[[\s\S]*?\]\]>/i,
    greedy: true
  },
  "tag": {
    pattern: /<\/?(?!\d)[^\s>\/=$<%]+(?:\s(?:\s*[^\s>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+(?=[\s>]))|(?=[\s/>])))+)?\s*\/?>/,
    greedy: true,
    inside: {
      "tag": {
        pattern: /^<\/?[^\s>\/]+/,
        inside: {
          "punctuation": /^<\/?/,
          "namespace": /^[^\s>\/:]+:/
        }
      },
      "special-attr": [],
      "attr-value": {
        pattern: /=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+)/,
        inside: {
          "punctuation": [
            {
              pattern: /^=/,
              alias: "attr-equals"
            },
            {
              pattern: /^(\s*)["']|["']$/,
              lookbehind: true
            }
          ]
        }
      },
      "punctuation": /\/?>/,
      "attr-name": {
        pattern: /[^\s>\/]+/,
        inside: {
          "namespace": /^[^\s>\/:]+:/
        }
      }
    }
  },
  "entity": [
    {
      pattern: /&[\da-z]{1,8};/i,
      alias: "named-entity"
    },
    /&#x?[\da-f]{1,8};/i
  ]
};
Prism.languages.markup["tag"].inside["attr-value"].inside["entity"] = Prism.languages.markup["entity"];
Prism.languages.markup["doctype"].inside["internal-subset"].inside = Prism.languages.markup;
Prism.hooks.add("wrap", function(env) {
  if (env.type === "entity") {
    env.attributes["title"] = env.content.replace(/&amp;/, "&");
  }
});
Object.defineProperty(Prism.languages.markup.tag, "addInlined", {
  /**
   * Adds an inlined language to markup.
   *
   * An example of an inlined language is CSS with `<style>` tags.
   *
   * @param {string} tagName The name of the tag that contains the inlined language. This name will be treated as
   * case insensitive.
   * @param {string} lang The language key.
   * @example
   * addInlined('style', 'css');
   */
  value: function addInlined(tagName, lang) {
    var includedCdataInside = {};
    includedCdataInside["language-" + lang] = {
      pattern: /(^<!\[CDATA\[)[\s\S]+?(?=\]\]>$)/i,
      lookbehind: true,
      inside: Prism.languages[lang]
    };
    includedCdataInside["cdata"] = /^<!\[CDATA\[|\]\]>$/i;
    var inside = {
      "included-cdata": {
        pattern: /<!\[CDATA\[[\s\S]*?\]\]>/i,
        inside: includedCdataInside
      }
    };
    inside["language-" + lang] = {
      pattern: /[\s\S]+/,
      inside: Prism.languages[lang]
    };
    var def = {};
    def[tagName] = {
      pattern: RegExp(/(<__[^>]*>)(?:<!\[CDATA\[(?:[^\]]|\](?!\]>))*\]\]>|(?!<!\[CDATA\[)[\s\S])*?(?=<\/__>)/.source.replace(/__/g, function() {
        return tagName;
      }), "i"),
      lookbehind: true,
      greedy: true,
      inside
    };
    Prism.languages.insertBefore("markup", "cdata", def);
  }
});
Object.defineProperty(Prism.languages.markup.tag, "addAttribute", {
  /**
   * Adds an pattern to highlight languages embedded in HTML attributes.
   *
   * An example of an inlined language is CSS with `style` attributes.
   *
   * @param {string} attrName The name of the tag that contains the inlined language. This name will be treated as
   * case insensitive.
   * @param {string} lang The language key.
   * @example
   * addAttribute('style', 'css');
   */
  value: function(attrName, lang) {
    Prism.languages.markup.tag.inside["special-attr"].push({
      pattern: RegExp(
        /(^|["'\s])/.source + "(?:" + attrName + ")" + /\s*=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+(?=[\s>]))/.source,
        "i"
      ),
      lookbehind: true,
      inside: {
        "attr-name": /^[^\s=]+/,
        "attr-value": {
          pattern: /=[\s\S]+/,
          inside: {
            "value": {
              pattern: /(^=\s*(["']|(?!["'])))\S[\s\S]*(?=\2$)/,
              lookbehind: true,
              alias: [lang, "language-" + lang],
              inside: Prism.languages[lang]
            },
            "punctuation": [
              {
                pattern: /^=/,
                alias: "attr-equals"
              },
              /"|'/
            ]
          }
        }
      }
    });
  }
});
Prism.languages.html = Prism.languages.markup;
Prism.languages.mathml = Prism.languages.markup;
Prism.languages.svg = Prism.languages.markup;
Prism.languages.xml = Prism.languages.extend("markup", {});
Prism.languages.ssml = Prism.languages.xml;
Prism.languages.atom = Prism.languages.xml;
Prism.languages.rss = Prism.languages.xml;

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-css.js
(function(Prism3) {
  var string = /(?:"(?:\\(?:\r\n|[\s\S])|[^"\\\r\n])*"|'(?:\\(?:\r\n|[\s\S])|[^'\\\r\n])*')/;
  Prism3.languages.css = {
    "comment": /\/\*[\s\S]*?\*\//,
    "atrule": {
      pattern: RegExp("@[\\w-](?:" + /[^;{\s"']|\s+(?!\s)/.source + "|" + string.source + ")*?" + /(?:;|(?=\s*\{))/.source),
      inside: {
        "rule": /^@[\w-]+/,
        "selector-function-argument": {
          pattern: /(\bselector\s*\(\s*(?![\s)]))(?:[^()\s]|\s+(?![\s)])|\((?:[^()]|\([^()]*\))*\))+(?=\s*\))/,
          lookbehind: true,
          alias: "selector"
        },
        "keyword": {
          pattern: /(^|[^\w-])(?:and|not|only|or)(?![\w-])/,
          lookbehind: true
        }
        // See rest below
      }
    },
    "url": {
      // https://drafts.csswg.org/css-values-3/#urls
      pattern: RegExp("\\burl\\((?:" + string.source + "|" + /(?:[^\\\r\n()"']|\\[\s\S])*/.source + ")\\)", "i"),
      greedy: true,
      inside: {
        "function": /^url/i,
        "punctuation": /^\(|\)$/,
        "string": {
          pattern: RegExp("^" + string.source + "$"),
          alias: "url"
        }
      }
    },
    "selector": {
      pattern: RegExp(`(^|[{}\\s])[^{}\\s](?:[^{};"'\\s]|\\s+(?![\\s{])|` + string.source + ")*(?=\\s*\\{)"),
      lookbehind: true
    },
    "string": {
      pattern: string,
      greedy: true
    },
    "property": {
      pattern: /(^|[^-\w\xA0-\uFFFF])(?!\s)[-_a-z\xA0-\uFFFF](?:(?!\s)[-\w\xA0-\uFFFF])*(?=\s*:)/i,
      lookbehind: true
    },
    "important": /!important\b/i,
    "function": {
      pattern: /(^|[^-a-z0-9])[-a-z0-9]+(?=\()/i,
      lookbehind: true
    },
    "punctuation": /[(){};:,]/
  };
  Prism3.languages.css["atrule"].inside.rest = Prism3.languages.css;
  var markup = Prism3.languages.markup;
  if (markup) {
    markup.tag.addInlined("style", "css");
    markup.tag.addAttribute("style", "css");
  }
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-clike.js
Prism.languages.clike = {
  "comment": [
    {
      pattern: /(^|[^\\])\/\*[\s\S]*?(?:\*\/|$)/,
      lookbehind: true,
      greedy: true
    },
    {
      pattern: /(^|[^\\:])\/\/.*/,
      lookbehind: true,
      greedy: true
    }
  ],
  "string": {
    pattern: /(["'])(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
    greedy: true
  },
  "class-name": {
    pattern: /(\b(?:class|extends|implements|instanceof|interface|new|trait)\s+|\bcatch\s+\()[\w.\\]+/i,
    lookbehind: true,
    inside: {
      "punctuation": /[.\\]/
    }
  },
  "keyword": /\b(?:break|catch|continue|do|else|finally|for|function|if|in|instanceof|new|null|return|throw|try|while)\b/,
  "boolean": /\b(?:false|true)\b/,
  "function": /\b\w+(?=\()/,
  "number": /\b0x[\da-f]+\b|(?:\b\d+(?:\.\d*)?|\B\.\d+)(?:e[+-]?\d+)?/i,
  "operator": /[<>]=?|[!=]=?=?|--?|\+\+?|&&?|\|\|?|[?*/~^%]/,
  "punctuation": /[{}[\];(),.:]/
};

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-regex.js
(function(Prism3) {
  var specialEscape = {
    pattern: /\\[\\(){}[\]^$+*?|.]/,
    alias: "escape"
  };
  var escape = /\\(?:x[\da-fA-F]{2}|u[\da-fA-F]{4}|u\{[\da-fA-F]+\}|0[0-7]{0,2}|[123][0-7]{2}|c[a-zA-Z]|.)/;
  var charSet = {
    pattern: /\.|\\[wsd]|\\p\{[^{}]+\}/i,
    alias: "class-name"
  };
  var charSetWithoutDot = {
    pattern: /\\[wsd]|\\p\{[^{}]+\}/i,
    alias: "class-name"
  };
  var rangeChar = "(?:[^\\\\-]|" + escape.source + ")";
  var range = RegExp(rangeChar + "-" + rangeChar);
  var groupName = {
    pattern: /(<|')[^<>']+(?=[>']$)/,
    lookbehind: true,
    alias: "variable"
  };
  Prism3.languages.regex = {
    "char-class": {
      pattern: /((?:^|[^\\])(?:\\\\)*)\[(?:[^\\\]]|\\[\s\S])*\]/,
      lookbehind: true,
      inside: {
        "char-class-negation": {
          pattern: /(^\[)\^/,
          lookbehind: true,
          alias: "operator"
        },
        "char-class-punctuation": {
          pattern: /^\[|\]$/,
          alias: "punctuation"
        },
        "range": {
          pattern: range,
          inside: {
            "escape": escape,
            "range-punctuation": {
              pattern: /-/,
              alias: "operator"
            }
          }
        },
        "special-escape": specialEscape,
        "char-set": charSetWithoutDot,
        "escape": escape
      }
    },
    "special-escape": specialEscape,
    "char-set": charSet,
    "backreference": [
      {
        // a backreference which is not an octal escape
        pattern: /\\(?![123][0-7]{2})[1-9]/,
        alias: "keyword"
      },
      {
        pattern: /\\k<[^<>']+>/,
        alias: "keyword",
        inside: {
          "group-name": groupName
        }
      }
    ],
    "anchor": {
      pattern: /[$^]|\\[ABbGZz]/,
      alias: "function"
    },
    "escape": escape,
    "group": [
      {
        // https://docs.oracle.com/javase/10/docs/api/java/util/regex/Pattern.html
        // https://docs.microsoft.com/en-us/dotnet/standard/base-types/regular-expression-language-quick-reference?view=netframework-4.7.2#grouping-constructs
        // (), (?<name>), (?'name'), (?>), (?:), (?=), (?!), (?<=), (?<!), (?is-m), (?i-m:)
        pattern: /\((?:\?(?:<[^<>']+>|'[^<>']+'|[>:]|<?[=!]|[idmnsuxU]+(?:-[idmnsuxU]+)?:?))?/,
        alias: "punctuation",
        inside: {
          "group-name": groupName
        }
      },
      {
        pattern: /\)/,
        alias: "punctuation"
      }
    ],
    "quantifier": {
      pattern: /(?:[+*?]|\{\d+(?:,\d*)?\})[?+]?/,
      alias: "number"
    },
    "alternation": {
      pattern: /\|/,
      alias: "keyword"
    }
  };
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-javascript.js
Prism.languages.javascript = Prism.languages.extend("clike", {
  "class-name": [
    Prism.languages.clike["class-name"],
    {
      pattern: /(^|[^$\w\xA0-\uFFFF])(?!\s)[_$A-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\.(?:constructor|prototype))/,
      lookbehind: true
    }
  ],
  "keyword": [
    {
      pattern: /((?:^|\})\s*)catch\b/,
      lookbehind: true
    },
    {
      pattern: /(^|[^.]|\.\.\.\s*)\b(?:as|assert(?=\s*\{)|async(?=\s*(?:function\b|\(|[$\w\xA0-\uFFFF]|$))|await|break|case|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally(?=\s*(?:\{|$))|for|from(?=\s*(?:['"]|$))|function|(?:get|set)(?=\s*(?:[#\[$\w\xA0-\uFFFF]|$))|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|static|super|switch|this|throw|try|typeof|undefined|var|void|while|with|yield)\b/,
      lookbehind: true
    }
  ],
  // Allow for all non-ASCII characters (See http://stackoverflow.com/a/2008444)
  "function": /#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*(?:\.\s*(?:apply|bind|call)\s*)?\()/,
  "number": {
    pattern: RegExp(
      /(^|[^\w$])/.source + "(?:" + // constant
      (/NaN|Infinity/.source + "|" + // binary integer
      /0[bB][01]+(?:_[01]+)*n?/.source + "|" + // octal integer
      /0[oO][0-7]+(?:_[0-7]+)*n?/.source + "|" + // hexadecimal integer
      /0[xX][\dA-Fa-f]+(?:_[\dA-Fa-f]+)*n?/.source + "|" + // decimal bigint
      /\d+(?:_\d+)*n/.source + "|" + // decimal number (integer or float) but no bigint
      /(?:\d+(?:_\d+)*(?:\.(?:\d+(?:_\d+)*)?)?|\.\d+(?:_\d+)*)(?:[Ee][+-]?\d+(?:_\d+)*)?/.source) + ")" + /(?![\w$])/.source
    ),
    lookbehind: true
  },
  "operator": /--|\+\+|\*\*=?|=>|&&=?|\|\|=?|[!=]==|<<=?|>>>?=?|[-+*/%&|^!=<>]=?|\.{3}|\?\?=?|\?\.?|[~:]/
});
Prism.languages.javascript["class-name"][0].pattern = /(\b(?:class|extends|implements|instanceof|interface|new)\s+)[\w.\\]+/;
Prism.languages.insertBefore("javascript", "keyword", {
  "regex": {
    pattern: RegExp(
      // lookbehind
      // eslint-disable-next-line regexp/no-dupe-characters-character-class
      /((?:^|[^$\w\xA0-\uFFFF."'\])\s]|\b(?:return|yield))\s*)/.source + // Regex pattern:
      // There are 2 regex patterns here. The RegExp set notation proposal added support for nested character
      // classes if the `v` flag is present. Unfortunately, nested CCs are both context-free and incompatible
      // with the only syntax, so we have to define 2 different regex patterns.
      /\//.source + "(?:" + /(?:\[(?:[^\]\\\r\n]|\\.)*\]|\\.|[^/\\\[\r\n])+\/[dgimyus]{0,7}/.source + "|" + // `v` flag syntax. This supports 3 levels of nested character classes.
      /(?:\[(?:[^[\]\\\r\n]|\\.|\[(?:[^[\]\\\r\n]|\\.|\[(?:[^[\]\\\r\n]|\\.)*\])*\])*\]|\\.|[^/\\\[\r\n])+\/[dgimyus]{0,7}v[dgimyus]{0,7}/.source + ")" + // lookahead
      /(?=(?:\s|\/\*(?:[^*]|\*(?!\/))*\*\/)*(?:$|[\r\n,.;:})\]]|\/\/))/.source
    ),
    lookbehind: true,
    greedy: true,
    inside: {
      "regex-source": {
        pattern: /^(\/)[\s\S]+(?=\/[a-z]*$)/,
        lookbehind: true,
        alias: "language-regex",
        inside: Prism.languages.regex
      },
      "regex-delimiter": /^\/|\/$/,
      "regex-flags": /^[a-z]+$/
    }
  },
  // This must be declared before keyword because we use "function" inside the look-forward
  "function-variable": {
    pattern: /#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*[=:]\s*(?:async\s*)?(?:\bfunction\b|(?:\((?:[^()]|\([^()]*\))*\)|(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*)\s*=>))/,
    alias: "function"
  },
  "parameter": [
    {
      pattern: /(function(?:\s+(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*)?\s*\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\))/,
      lookbehind: true,
      inside: Prism.languages.javascript
    },
    {
      pattern: /(^|[^$\w\xA0-\uFFFF])(?!\s)[_$a-z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*=>)/i,
      lookbehind: true,
      inside: Prism.languages.javascript
    },
    {
      pattern: /(\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\)\s*=>)/,
      lookbehind: true,
      inside: Prism.languages.javascript
    },
    {
      pattern: /((?:\b|\s|^)(?!(?:as|async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally|for|from|function|get|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|set|static|super|switch|this|throw|try|typeof|undefined|var|void|while|with|yield)(?![$\w\xA0-\uFFFF]))(?:(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*\s*)\(\s*|\]\s*\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\)\s*\{)/,
      lookbehind: true,
      inside: Prism.languages.javascript
    }
  ],
  "constant": /\b[A-Z](?:[A-Z_]|\dx?)*\b/
});
Prism.languages.insertBefore("javascript", "string", {
  "hashbang": {
    pattern: /^#!.*/,
    greedy: true,
    alias: "comment"
  },
  "template-string": {
    pattern: /`(?:\\[\s\S]|\$\{(?:[^{}]|\{(?:[^{}]|\{[^}]*\})*\})+\}|(?!\$\{)[^\\`])*`/,
    greedy: true,
    inside: {
      "template-punctuation": {
        pattern: /^`|`$/,
        alias: "string"
      },
      "interpolation": {
        pattern: /((?:^|[^\\])(?:\\{2})*)\$\{(?:[^{}]|\{(?:[^{}]|\{[^}]*\})*\})+\}/,
        lookbehind: true,
        inside: {
          "interpolation-punctuation": {
            pattern: /^\$\{|\}$/,
            alias: "punctuation"
          },
          rest: Prism.languages.javascript
        }
      },
      "string": /[\s\S]+/
    }
  },
  "string-property": {
    pattern: /((?:^|[,{])[ \t]*)(["'])(?:\\(?:\r\n|[\s\S])|(?!\2)[^\\\r\n])*\2(?=\s*:)/m,
    lookbehind: true,
    greedy: true,
    alias: "property"
  }
});
Prism.languages.insertBefore("javascript", "operator", {
  "literal-property": {
    pattern: /((?:^|[,{])[ \t]*)(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*:)/m,
    lookbehind: true,
    alias: "property"
  }
});
if (Prism.languages.markup) {
  Prism.languages.markup.tag.addInlined("script", "javascript");
  Prism.languages.markup.tag.addAttribute(
    /on(?:abort|blur|change|click|composition(?:end|start|update)|dblclick|error|focus(?:in|out)?|key(?:down|up)|load|mouse(?:down|enter|leave|move|out|over|up)|reset|resize|scroll|select|slotchange|submit|unload|wheel)/.source,
    "javascript"
  );
}
Prism.languages.js = Prism.languages.javascript;

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-c.js
Prism.languages.c = Prism.languages.extend("clike", {
  "comment": {
    pattern: /\/\/(?:[^\r\n\\]|\\(?:\r\n?|\n|(?![\r\n])))*|\/\*[\s\S]*?(?:\*\/|$)/,
    greedy: true
  },
  "string": {
    // https://en.cppreference.com/w/c/language/string_literal
    pattern: /"(?:\\(?:\r\n|[\s\S])|[^"\\\r\n])*"/,
    greedy: true
  },
  "class-name": {
    pattern: /(\b(?:enum|struct)\s+(?:__attribute__\s*\(\([\s\S]*?\)\)\s*)?)\w+|\b[a-z]\w*_t\b/,
    lookbehind: true
  },
  "keyword": /\b(?:_Alignas|_Alignof|_Atomic|_Bool|_Complex|_Generic|_Imaginary|_Noreturn|_Static_assert|_Thread_local|__attribute__|asm|auto|break|case|char|const|continue|default|do|double|else|enum|extern|float|for|goto|if|inline|int|long|register|return|short|signed|sizeof|static|struct|switch|typedef|typeof|union|unsigned|void|volatile|while)\b/,
  "function": /\b[a-z_]\w*(?=\s*\()/i,
  "number": /(?:\b0x(?:[\da-f]+(?:\.[\da-f]*)?|\.[\da-f]+)(?:p[+-]?\d+)?|(?:\b\d+(?:\.\d*)?|\B\.\d+)(?:e[+-]?\d+)?)[ful]{0,4}/i,
  "operator": />>=?|<<=?|->|([-+&|:])\1|[?:~]|[-+*/%&|^!=<>]=?/
});
Prism.languages.insertBefore("c", "string", {
  "char": {
    // https://en.cppreference.com/w/c/language/character_constant
    pattern: /'(?:\\(?:\r\n|[\s\S])|[^'\\\r\n]){0,32}'/,
    greedy: true
  }
});
Prism.languages.insertBefore("c", "string", {
  "macro": {
    // allow for multiline macro definitions
    // spaces after the # character compile fine with gcc
    pattern: /(^[\t ]*)#\s*[a-z](?:[^\r\n\\/]|\/(?!\*)|\/\*(?:[^*]|\*(?!\/))*\*\/|\\(?:\r\n|[\s\S]))*/im,
    lookbehind: true,
    greedy: true,
    alias: "property",
    inside: {
      "string": [
        {
          // highlight the path of the include statement as a string
          pattern: /^(#\s*include\s*)<[^>]+>/,
          lookbehind: true
        },
        Prism.languages.c["string"]
      ],
      "char": Prism.languages.c["char"],
      "comment": Prism.languages.c["comment"],
      "macro-name": [
        {
          pattern: /(^#\s*define\s+)\w+\b(?!\()/i,
          lookbehind: true
        },
        {
          pattern: /(^#\s*define\s+)\w+\b(?=\()/i,
          lookbehind: true,
          alias: "function"
        }
      ],
      // highlight macro directives as keywords
      "directive": {
        pattern: /^(#\s*)[a-z]+/,
        lookbehind: true,
        alias: "keyword"
      },
      "directive-hash": /^#/,
      "punctuation": /##|\\(?=[\r\n])/,
      "expression": {
        pattern: /\S[\s\S]*/,
        inside: Prism.languages.c
      }
    }
  }
});
Prism.languages.insertBefore("c", "function", {
  // highlight predefined macros as constants
  "constant": /\b(?:EOF|NULL|SEEK_CUR|SEEK_END|SEEK_SET|__DATE__|__FILE__|__LINE__|__TIMESTAMP__|__TIME__|__func__|stderr|stdin|stdout)\b/
});
delete Prism.languages.c["boolean"];

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-markup-templating.js
(function(Prism3) {
  function getPlaceholder(language, index) {
    return "___" + language.toUpperCase() + index + "___";
  }
  Object.defineProperties(Prism3.languages["markup-templating"] = {}, {
    buildPlaceholders: {
      /**
       * Tokenize all inline templating expressions matching `placeholderPattern`.
       *
       * If `replaceFilter` is provided, only matches of `placeholderPattern` for which `replaceFilter` returns
       * `true` will be replaced.
       *
       * @param {object} env The environment of the `before-tokenize` hook.
       * @param {string} language The language id.
       * @param {RegExp} placeholderPattern The matches of this pattern will be replaced by placeholders.
       * @param {(match: string) => boolean} [replaceFilter]
       */
      value: function(env, language, placeholderPattern, replaceFilter) {
        if (env.language !== language) {
          return;
        }
        var tokenStack = env.tokenStack = [];
        env.code = env.code.replace(placeholderPattern, function(match) {
          if (typeof replaceFilter === "function" && !replaceFilter(match)) {
            return match;
          }
          var i = tokenStack.length;
          var placeholder;
          while (env.code.indexOf(placeholder = getPlaceholder(language, i)) !== -1) {
            ++i;
          }
          tokenStack[i] = match;
          return placeholder;
        });
        env.grammar = Prism3.languages.markup;
      }
    },
    tokenizePlaceholders: {
      /**
       * Replace placeholders with proper tokens after tokenizing.
       *
       * @param {object} env The environment of the `after-tokenize` hook.
       * @param {string} language The language id.
       */
      value: function(env, language) {
        if (env.language !== language || !env.tokenStack) {
          return;
        }
        env.grammar = Prism3.languages[language];
        var j = 0;
        var keys = Object.keys(env.tokenStack);
        function walkTokens(tokens) {
          for (var i = 0; i < tokens.length; i++) {
            if (j >= keys.length) {
              break;
            }
            var token = tokens[i];
            if (typeof token === "string" || token.content && typeof token.content === "string") {
              var k = keys[j];
              var t = env.tokenStack[k];
              var s = typeof token === "string" ? token : token.content;
              var placeholder = getPlaceholder(language, k);
              var index = s.indexOf(placeholder);
              if (index > -1) {
                ++j;
                var before = s.substring(0, index);
                var middle = new Prism3.Token(language, Prism3.tokenize(t, env.grammar), "language-" + language, t);
                var after = s.substring(index + placeholder.length);
                var replacement = [];
                if (before) {
                  replacement.push.apply(replacement, walkTokens([before]));
                }
                replacement.push(middle);
                if (after) {
                  replacement.push.apply(replacement, walkTokens([after]));
                }
                if (typeof token === "string") {
                  tokens.splice.apply(tokens, [i, 1].concat(replacement));
                } else {
                  token.content = replacement;
                }
              }
            } else if (token.content) {
              walkTokens(token.content);
            }
          }
          return tokens;
        }
        walkTokens(env.tokens);
      }
    }
  });
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-css-extras.js
(function(Prism3) {
  var string = /("|')(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/;
  var selectorInside;
  Prism3.languages.css.selector = {
    pattern: Prism3.languages.css.selector.pattern,
    lookbehind: true,
    inside: selectorInside = {
      "pseudo-element": /:(?:after|before|first-letter|first-line|selection)|::[-\w]+/,
      "pseudo-class": /:[-\w]+/,
      "class": /\.[-\w]+/,
      "id": /#[-\w]+/,
      "attribute": {
        pattern: RegExp(`\\[(?:[^[\\]"']|` + string.source + ")*\\]"),
        greedy: true,
        inside: {
          "punctuation": /^\[|\]$/,
          "case-sensitivity": {
            pattern: /(\s)[si]$/i,
            lookbehind: true,
            alias: "keyword"
          },
          "namespace": {
            pattern: /^(\s*)(?:(?!\s)[-*\w\xA0-\uFFFF])*\|(?!=)/,
            lookbehind: true,
            inside: {
              "punctuation": /\|$/
            }
          },
          "attr-name": {
            pattern: /^(\s*)(?:(?!\s)[-\w\xA0-\uFFFF])+/,
            lookbehind: true
          },
          "attr-value": [
            string,
            {
              pattern: /(=\s*)(?:(?!\s)[-\w\xA0-\uFFFF])+(?=\s*$)/,
              lookbehind: true
            }
          ],
          "operator": /[|~*^$]?=/
        }
      },
      "n-th": [
        {
          pattern: /(\(\s*)[+-]?\d*[\dn](?:\s*[+-]\s*\d+)?(?=\s*\))/,
          lookbehind: true,
          inside: {
            "number": /[\dn]+/,
            "operator": /[+-]/
          }
        },
        {
          pattern: /(\(\s*)(?:even|odd)(?=\s*\))/i,
          lookbehind: true
        }
      ],
      "combinator": />|\+|~|\|\|/,
      // the `tag` token has been existed and removed.
      // because we can't find a perfect tokenize to match it.
      // if you want to add it, please read https://github.com/PrismJS/prism/pull/2373 first.
      "punctuation": /[(),]/
    }
  };
  Prism3.languages.css["atrule"].inside["selector-function-argument"].inside = selectorInside;
  Prism3.languages.insertBefore("css", "property", {
    "variable": {
      pattern: /(^|[^-\w\xA0-\uFFFF])--(?!\s)[-_a-z\xA0-\uFFFF](?:(?!\s)[-\w\xA0-\uFFFF])*/i,
      lookbehind: true
    }
  });
  var unit = {
    pattern: /(\b\d+)(?:%|[a-z]+(?![\w-]))/,
    lookbehind: true
  };
  var number = {
    pattern: /(^|[^\w.-])-?(?:\d+(?:\.\d+)?|\.\d+)/,
    lookbehind: true
  };
  Prism3.languages.insertBefore("css", "function", {
    "operator": {
      pattern: /(\s)[+\-*\/](?=\s)/,
      lookbehind: true
    },
    // CAREFUL!
    // Previewers and Inline color use hexcode and color.
    "hexcode": {
      pattern: /\B#[\da-f]{3,8}\b/i,
      alias: "color"
    },
    "color": [
      {
        pattern: /(^|[^\w-])(?:AliceBlue|AntiqueWhite|Aqua|Aquamarine|Azure|Beige|Bisque|Black|BlanchedAlmond|Blue|BlueViolet|Brown|BurlyWood|CadetBlue|Chartreuse|Chocolate|Coral|CornflowerBlue|Cornsilk|Crimson|Cyan|DarkBlue|DarkCyan|DarkGoldenRod|DarkGr[ae]y|DarkGreen|DarkKhaki|DarkMagenta|DarkOliveGreen|DarkOrange|DarkOrchid|DarkRed|DarkSalmon|DarkSeaGreen|DarkSlateBlue|DarkSlateGr[ae]y|DarkTurquoise|DarkViolet|DeepPink|DeepSkyBlue|DimGr[ae]y|DodgerBlue|FireBrick|FloralWhite|ForestGreen|Fuchsia|Gainsboro|GhostWhite|Gold|GoldenRod|Gr[ae]y|Green|GreenYellow|HoneyDew|HotPink|IndianRed|Indigo|Ivory|Khaki|Lavender|LavenderBlush|LawnGreen|LemonChiffon|LightBlue|LightCoral|LightCyan|LightGoldenRodYellow|LightGr[ae]y|LightGreen|LightPink|LightSalmon|LightSeaGreen|LightSkyBlue|LightSlateGr[ae]y|LightSteelBlue|LightYellow|Lime|LimeGreen|Linen|Magenta|Maroon|MediumAquaMarine|MediumBlue|MediumOrchid|MediumPurple|MediumSeaGreen|MediumSlateBlue|MediumSpringGreen|MediumTurquoise|MediumVioletRed|MidnightBlue|MintCream|MistyRose|Moccasin|NavajoWhite|Navy|OldLace|Olive|OliveDrab|Orange|OrangeRed|Orchid|PaleGoldenRod|PaleGreen|PaleTurquoise|PaleVioletRed|PapayaWhip|PeachPuff|Peru|Pink|Plum|PowderBlue|Purple|RebeccaPurple|Red|RosyBrown|RoyalBlue|SaddleBrown|Salmon|SandyBrown|SeaGreen|SeaShell|Sienna|Silver|SkyBlue|SlateBlue|SlateGr[ae]y|Snow|SpringGreen|SteelBlue|Tan|Teal|Thistle|Tomato|Transparent|Turquoise|Violet|Wheat|White|WhiteSmoke|Yellow|YellowGreen)(?![\w-])/i,
        lookbehind: true
      },
      {
        pattern: /\b(?:hsl|rgb)\(\s*\d{1,3}\s*,\s*\d{1,3}%?\s*,\s*\d{1,3}%?\s*\)\B|\b(?:hsl|rgb)a\(\s*\d{1,3}\s*,\s*\d{1,3}%?\s*,\s*\d{1,3}%?\s*,\s*(?:0|0?\.\d+|1)\s*\)\B/i,
        inside: {
          "unit": unit,
          "number": number,
          "function": /[\w-]+(?=\()/,
          "punctuation": /[(),]/
        }
      }
    ],
    // it's important that there is no boundary assertion after the hex digits
    "entity": /\\[\da-f]{1,8}/i,
    "unit": unit,
    "number": number
  });
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-less.js
Prism.languages.less = Prism.languages.extend("css", {
  "comment": [
    /\/\*[\s\S]*?\*\//,
    {
      pattern: /(^|[^\\])\/\/.*/,
      lookbehind: true
    }
  ],
  "atrule": {
    pattern: /@[\w-](?:\((?:[^(){}]|\([^(){}]*\))*\)|[^(){};\s]|\s+(?!\s))*?(?=\s*\{)/,
    inside: {
      "punctuation": /[:()]/
    }
  },
  // selectors and mixins are considered the same
  "selector": {
    pattern: /(?:@\{[\w-]+\}|[^{};\s@])(?:@\{[\w-]+\}|\((?:[^(){}]|\([^(){}]*\))*\)|[^(){};@\s]|\s+(?!\s))*?(?=\s*\{)/,
    inside: {
      // mixin parameters
      "variable": /@+[\w-]+/
    }
  },
  "property": /(?:@\{[\w-]+\}|[\w-])+(?:\+_?)?(?=\s*:)/,
  "operator": /[+\-*\/]/
});
Prism.languages.insertBefore("less", "property", {
  "variable": [
    // Variable declaration (the colon must be consumed!)
    {
      pattern: /@[\w-]+\s*:/,
      inside: {
        "punctuation": /:/
      }
    },
    // Variable usage
    /@@?[\w-]+/
  ],
  "mixin-usage": {
    pattern: /([{;]\s*)[.#](?!\d)[\w-].*?(?=[(;])/,
    lookbehind: true,
    alias: "function"
  }
});

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-scss.js
Prism.languages.scss = Prism.languages.extend("css", {
  "comment": {
    pattern: /(^|[^\\])(?:\/\*[\s\S]*?\*\/|\/\/.*)/,
    lookbehind: true
  },
  "atrule": {
    pattern: /@[\w-](?:\([^()]+\)|[^()\s]|\s+(?!\s))*?(?=\s+[{;])/,
    inside: {
      "rule": /@[\w-]+/
      // See rest below
    }
  },
  // url, compassified
  "url": /(?:[-a-z]+-)?url(?=\()/i,
  // CSS selector regex is not appropriate for Sass
  // since there can be lot more things (var, @ directive, nesting..)
  // a selector must start at the end of a property or after a brace (end of other rules or nesting)
  // it can contain some characters that aren't used for defining rules or end of selector, & (parent selector), or interpolated variable
  // the end of a selector is found when there is no rules in it ( {} or {\s}) or if there is a property (because an interpolated var
  // can "pass" as a selector- e.g: proper#{$erty})
  // this one was hard to do, so please be careful if you edit this one :)
  "selector": {
    // Initial look-ahead is used to prevent matching of blank selectors
    pattern: /(?=\S)[^@;{}()]?(?:[^@;{}()\s]|\s+(?!\s)|#\{\$[-\w]+\})+(?=\s*\{(?:\}|\s|[^}][^:{}]*[:{][^}]))/,
    inside: {
      "parent": {
        pattern: /&/,
        alias: "important"
      },
      "placeholder": /%[-\w]+/,
      "variable": /\$[-\w]+|#\{\$[-\w]+\}/
    }
  },
  "property": {
    pattern: /(?:[-\w]|\$[-\w]|#\{\$[-\w]+\})+(?=\s*:)/,
    inside: {
      "variable": /\$[-\w]+|#\{\$[-\w]+\}/
    }
  }
});
Prism.languages.insertBefore("scss", "atrule", {
  "keyword": [
    /@(?:content|debug|each|else(?: if)?|extend|for|forward|function|if|import|include|mixin|return|use|warn|while)\b/i,
    {
      pattern: /( )(?:from|through)(?= )/,
      lookbehind: true
    }
  ]
});
Prism.languages.insertBefore("scss", "important", {
  // var and interpolated vars
  "variable": /\$[-\w]+|#\{\$[-\w]+\}/
});
Prism.languages.insertBefore("scss", "function", {
  "module-modifier": {
    pattern: /\b(?:as|hide|show|with)\b/i,
    alias: "keyword"
  },
  "placeholder": {
    pattern: /%[-\w]+/,
    alias: "selector"
  },
  "statement": {
    pattern: /\B!(?:default|optional)\b/i,
    alias: "keyword"
  },
  "boolean": /\b(?:false|true)\b/,
  "null": {
    pattern: /\bnull\b/,
    alias: "keyword"
  },
  "operator": {
    pattern: /(\s)(?:[-+*\/%]|[=!]=|<=?|>=?|and|not|or)(?=\s)/,
    lookbehind: true
  }
});
Prism.languages.scss["atrule"].inside.rest = Prism.languages.scss;

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-sass.js
(function(Prism3) {
  Prism3.languages.sass = Prism3.languages.extend("css", {
    // Sass comments don't need to be closed, only indented
    "comment": {
      pattern: /^([ \t]*)\/[\/*].*(?:(?:\r?\n|\r)\1[ \t].+)*/m,
      lookbehind: true,
      greedy: true
    }
  });
  Prism3.languages.insertBefore("sass", "atrule", {
    // We want to consume the whole line
    "atrule-line": {
      // Includes support for = and + shortcuts
      pattern: /^(?:[ \t]*)[@+=].+/m,
      greedy: true,
      inside: {
        "atrule": /(?:@[\w-]+|[+=])/
      }
    }
  });
  delete Prism3.languages.sass.atrule;
  var variable = /\$[-\w]+|#\{\$[-\w]+\}/;
  var operator = [
    /[+*\/%]|[=!]=|<=?|>=?|\b(?:and|not|or)\b/,
    {
      pattern: /(\s)-(?=\s)/,
      lookbehind: true
    }
  ];
  Prism3.languages.insertBefore("sass", "property", {
    // We want to consume the whole line
    "variable-line": {
      pattern: /^[ \t]*\$.+/m,
      greedy: true,
      inside: {
        "punctuation": /:/,
        "variable": variable,
        "operator": operator
      }
    },
    // We want to consume the whole line
    "property-line": {
      pattern: /^[ \t]*(?:[^:\s]+ *:.*|:[^:\s].*)/m,
      greedy: true,
      inside: {
        "property": [
          /[^:\s]+(?=\s*:)/,
          {
            pattern: /(:)[^:\s]+/,
            lookbehind: true
          }
        ],
        "punctuation": /:/,
        "variable": variable,
        "operator": operator,
        "important": Prism3.languages.sass.important
      }
    }
  });
  delete Prism3.languages.sass.property;
  delete Prism3.languages.sass.important;
  Prism3.languages.insertBefore("sass", "punctuation", {
    "selector": {
      pattern: /^([ \t]*)\S(?:,[^,\r\n]+|[^,\r\n]*)(?:,[^,\r\n]+)*(?:,(?:\r?\n|\r)\1[ \t]+\S(?:,[^,\r\n]+|[^,\r\n]*)(?:,[^,\r\n]+)*)*/m,
      lookbehind: true,
      greedy: true
    }
  });
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-textile.js
(function(Prism3) {
  var modifierRegex = /\([^|()\n]+\)|\[[^\]\n]+\]|\{[^}\n]+\}/.source;
  var parenthesesRegex = /\)|\((?![^|()\n]+\))/.source;
  function withModifier(source, flags) {
    return RegExp(
      source.replace(/<MOD>/g, function() {
        return "(?:" + modifierRegex + ")";
      }).replace(/<PAR>/g, function() {
        return "(?:" + parenthesesRegex + ")";
      }),
      flags || ""
    );
  }
  var modifierTokens = {
    "css": {
      pattern: /\{[^{}]+\}/,
      inside: {
        rest: Prism3.languages.css
      }
    },
    "class-id": {
      pattern: /(\()[^()]+(?=\))/,
      lookbehind: true,
      alias: "attr-value"
    },
    "lang": {
      pattern: /(\[)[^\[\]]+(?=\])/,
      lookbehind: true,
      alias: "attr-value"
    },
    // Anything else is punctuation (the first pattern is for row/col spans inside tables)
    "punctuation": /[\\\/]\d+|\S/
  };
  var textile = Prism3.languages.textile = Prism3.languages.extend("markup", {
    "phrase": {
      pattern: /(^|\r|\n)\S[\s\S]*?(?=$|\r?\n\r?\n|\r\r)/,
      lookbehind: true,
      inside: {
        // h1. Header 1
        "block-tag": {
          pattern: withModifier(/^[a-z]\w*(?:<MOD>|<PAR>|[<>=])*\./.source),
          inside: {
            "modifier": {
              pattern: withModifier(/(^[a-z]\w*)(?:<MOD>|<PAR>|[<>=])+(?=\.)/.source),
              lookbehind: true,
              inside: modifierTokens
            },
            "tag": /^[a-z]\w*/,
            "punctuation": /\.$/
          }
        },
        // # List item
        // * List item
        "list": {
          pattern: withModifier(/^[*#]+<MOD>*\s+\S.*/.source, "m"),
          inside: {
            "modifier": {
              pattern: withModifier(/(^[*#]+)<MOD>+/.source),
              lookbehind: true,
              inside: modifierTokens
            },
            "punctuation": /^[*#]+/
          }
        },
        // | cell | cell | cell |
        "table": {
          // Modifiers can be applied to the row: {color:red}.|1|2|3|
          // or the cell: |{color:red}.1|2|3|
          pattern: withModifier(/^(?:(?:<MOD>|<PAR>|[<>=^~])+\.\s*)?(?:\|(?:(?:<MOD>|<PAR>|[<>=^~_]|[\\/]\d+)+\.|(?!(?:<MOD>|<PAR>|[<>=^~_]|[\\/]\d+)+\.))[^|]*)+\|/.source, "m"),
          inside: {
            "modifier": {
              // Modifiers for rows after the first one are
              // preceded by a pipe and a line feed
              pattern: withModifier(/(^|\|(?:\r?\n|\r)?)(?:<MOD>|<PAR>|[<>=^~_]|[\\/]\d+)+(?=\.)/.source),
              lookbehind: true,
              inside: modifierTokens
            },
            "punctuation": /\||^\./
          }
        },
        "inline": {
          // eslint-disable-next-line regexp/no-super-linear-backtracking
          pattern: withModifier(/(^|[^a-zA-Z\d])(\*\*|__|\?\?|[*_%@+\-^~])<MOD>*.+?\2(?![a-zA-Z\d])/.source),
          lookbehind: true,
          inside: {
            // Note: superscripts and subscripts are not handled specifically
            // *bold*, **bold**
            "bold": {
              // eslint-disable-next-line regexp/no-super-linear-backtracking
              pattern: withModifier(/(^(\*\*?)<MOD>*).+?(?=\2)/.source),
              lookbehind: true
            },
            // _italic_, __italic__
            "italic": {
              // eslint-disable-next-line regexp/no-super-linear-backtracking
              pattern: withModifier(/(^(__?)<MOD>*).+?(?=\2)/.source),
              lookbehind: true
            },
            // ??cite??
            "cite": {
              // eslint-disable-next-line regexp/no-super-linear-backtracking
              pattern: withModifier(/(^\?\?<MOD>*).+?(?=\?\?)/.source),
              lookbehind: true,
              alias: "string"
            },
            // @code@
            "code": {
              // eslint-disable-next-line regexp/no-super-linear-backtracking
              pattern: withModifier(/(^@<MOD>*).+?(?=@)/.source),
              lookbehind: true,
              alias: "keyword"
            },
            // +inserted+
            "inserted": {
              // eslint-disable-next-line regexp/no-super-linear-backtracking
              pattern: withModifier(/(^\+<MOD>*).+?(?=\+)/.source),
              lookbehind: true
            },
            // -deleted-
            "deleted": {
              // eslint-disable-next-line regexp/no-super-linear-backtracking
              pattern: withModifier(/(^-<MOD>*).+?(?=-)/.source),
              lookbehind: true
            },
            // %span%
            "span": {
              // eslint-disable-next-line regexp/no-super-linear-backtracking
              pattern: withModifier(/(^%<MOD>*).+?(?=%)/.source),
              lookbehind: true
            },
            "modifier": {
              pattern: withModifier(/(^\*\*|__|\?\?|[*_%@+\-^~])<MOD>+/.source),
              lookbehind: true,
              inside: modifierTokens
            },
            "punctuation": /[*_%?@+\-^~]+/
          }
        },
        // [alias]http://example.com
        "link-ref": {
          pattern: /^\[[^\]]+\]\S+$/m,
          inside: {
            "string": {
              pattern: /(^\[)[^\]]+(?=\])/,
              lookbehind: true
            },
            "url": {
              pattern: /(^\])\S+$/,
              lookbehind: true
            },
            "punctuation": /[\[\]]/
          }
        },
        // "text":http://example.com
        // "text":link-ref
        "link": {
          // eslint-disable-next-line regexp/no-super-linear-backtracking
          pattern: withModifier(/"<MOD>*[^"]+":.+?(?=[^\w/]?(?:\s|$))/.source),
          inside: {
            "text": {
              // eslint-disable-next-line regexp/no-super-linear-backtracking
              pattern: withModifier(/(^"<MOD>*)[^"]+(?=")/.source),
              lookbehind: true
            },
            "modifier": {
              pattern: withModifier(/(^")<MOD>+/.source),
              lookbehind: true,
              inside: modifierTokens
            },
            "url": {
              pattern: /(:).+/,
              lookbehind: true
            },
            "punctuation": /[":]/
          }
        },
        // !image.jpg!
        // !image.jpg(Title)!:http://example.com
        "image": {
          pattern: withModifier(/!(?:<MOD>|<PAR>|[<>=])*(?![<>=])[^!\s()]+(?:\([^)]+\))?!(?::.+?(?=[^\w/]?(?:\s|$)))?/.source),
          inside: {
            "source": {
              pattern: withModifier(/(^!(?:<MOD>|<PAR>|[<>=])*)(?![<>=])[^!\s()]+(?:\([^)]+\))?(?=!)/.source),
              lookbehind: true,
              alias: "url"
            },
            "modifier": {
              pattern: withModifier(/(^!)(?:<MOD>|<PAR>|[<>=])+/.source),
              lookbehind: true,
              inside: modifierTokens
            },
            "url": {
              pattern: /(:).+/,
              lookbehind: true
            },
            "punctuation": /[!:]/
          }
        },
        // Footnote[1]
        "footnote": {
          pattern: /\b\[\d+\]/,
          alias: "comment",
          inside: {
            "punctuation": /\[|\]/
          }
        },
        // CSS(Cascading Style Sheet)
        "acronym": {
          pattern: /\b[A-Z\d]+\([^)]+\)/,
          inside: {
            "comment": {
              pattern: /(\()[^()]+(?=\))/,
              lookbehind: true
            },
            "punctuation": /[()]/
          }
        },
        // Prism(C)
        "mark": {
          pattern: /\b\((?:C|R|TM)\)/,
          alias: "comment",
          inside: {
            "punctuation": /[()]/
          }
        }
      }
    }
  });
  var phraseInside = textile["phrase"].inside;
  var nestedPatterns = {
    "inline": phraseInside["inline"],
    "link": phraseInside["link"],
    "image": phraseInside["image"],
    "footnote": phraseInside["footnote"],
    "acronym": phraseInside["acronym"],
    "mark": phraseInside["mark"]
  };
  textile.tag.pattern = /<\/?(?!\d)[a-z0-9]+(?:\s+[^\s>\/=]+(?:=(?:("|')(?:\\[\s\S]|(?!\1)[^\\])*\1|[^\s'">=]+))?)*\s*\/?>/i;
  var phraseInlineInside = phraseInside["inline"].inside;
  phraseInlineInside["bold"].inside = nestedPatterns;
  phraseInlineInside["italic"].inside = nestedPatterns;
  phraseInlineInside["inserted"].inside = nestedPatterns;
  phraseInlineInside["deleted"].inside = nestedPatterns;
  phraseInlineInside["span"].inside = nestedPatterns;
  var phraseTableInside = phraseInside["table"].inside;
  phraseTableInside["inline"] = nestedPatterns["inline"];
  phraseTableInside["link"] = nestedPatterns["link"];
  phraseTableInside["image"] = nestedPatterns["image"];
  phraseTableInside["footnote"] = nestedPatterns["footnote"];
  phraseTableInside["acronym"] = nestedPatterns["acronym"];
  phraseTableInside["mark"] = nestedPatterns["mark"];
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-json.js
Prism.languages.json = {
  "property": {
    pattern: /(^|[^\\])"(?:\\.|[^\\"\r\n])*"(?=\s*:)/,
    lookbehind: true,
    greedy: true
  },
  "string": {
    pattern: /(^|[^\\])"(?:\\.|[^\\"\r\n])*"(?!\s*:)/,
    lookbehind: true,
    greedy: true
  },
  "comment": {
    pattern: /\/\/.*|\/\*[\s\S]*?(?:\*\/|$)/,
    greedy: true
  },
  "number": /-?\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/i,
  "punctuation": /[{}[\],]/,
  "operator": /:/,
  "boolean": /\b(?:false|true)\b/,
  "null": {
    pattern: /\bnull\b/,
    alias: "keyword"
  }
};
Prism.languages.webmanifest = Prism.languages.json;

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-xml-doc.js
(function(Prism3) {
  function insertDocComment(lang, docComment) {
    if (Prism3.languages[lang]) {
      Prism3.languages.insertBefore(lang, "comment", {
        "doc-comment": docComment
      });
    }
  }
  var tag = Prism3.languages.markup.tag;
  var slashDocComment = {
    pattern: /\/\/\/.*/,
    greedy: true,
    alias: "comment",
    inside: {
      "tag": tag
    }
  };
  var tickDocComment = {
    pattern: /'''.*/,
    greedy: true,
    alias: "comment",
    inside: {
      "tag": tag
    }
  };
  insertDocComment("csharp", slashDocComment);
  insertDocComment("fsharp", slashDocComment);
  insertDocComment("vbnet", tickDocComment);
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-markdown.js
(function(Prism3) {
  var inner = /(?:\\.|[^\\\n\r]|(?:\n|\r\n?)(?![\r\n]))/.source;
  function createInline(pattern) {
    pattern = pattern.replace(/<inner>/g, function() {
      return inner;
    });
    return RegExp(/((?:^|[^\\])(?:\\{2})*)/.source + "(?:" + pattern + ")");
  }
  var tableCell = /(?:\\.|``(?:[^`\r\n]|`(?!`))+``|`[^`\r\n]+`|[^\\|\r\n`])+/.source;
  var tableRow = /\|?__(?:\|__)+\|?(?:(?:\n|\r\n?)|(?![\s\S]))/.source.replace(/__/g, function() {
    return tableCell;
  });
  var tableLine = /\|?[ \t]*:?-{3,}:?[ \t]*(?:\|[ \t]*:?-{3,}:?[ \t]*)+\|?(?:\n|\r\n?)/.source;
  Prism3.languages.markdown = Prism3.languages.extend("markup", {});
  Prism3.languages.insertBefore("markdown", "prolog", {
    "front-matter-block": {
      pattern: /(^(?:\s*[\r\n])?)---(?!.)[\s\S]*?[\r\n]---(?!.)/,
      lookbehind: true,
      greedy: true,
      inside: {
        "punctuation": /^---|---$/,
        "front-matter": {
          pattern: /\S+(?:\s+\S+)*/,
          alias: ["yaml", "language-yaml"],
          inside: Prism3.languages.yaml
        }
      }
    },
    "blockquote": {
      // > ...
      pattern: /^>(?:[\t ]*>)*/m,
      alias: "punctuation"
    },
    "table": {
      pattern: RegExp("^" + tableRow + tableLine + "(?:" + tableRow + ")*", "m"),
      inside: {
        "table-data-rows": {
          pattern: RegExp("^(" + tableRow + tableLine + ")(?:" + tableRow + ")*$"),
          lookbehind: true,
          inside: {
            "table-data": {
              pattern: RegExp(tableCell),
              inside: Prism3.languages.markdown
            },
            "punctuation": /\|/
          }
        },
        "table-line": {
          pattern: RegExp("^(" + tableRow + ")" + tableLine + "$"),
          lookbehind: true,
          inside: {
            "punctuation": /\||:?-{3,}:?/
          }
        },
        "table-header-row": {
          pattern: RegExp("^" + tableRow + "$"),
          inside: {
            "table-header": {
              pattern: RegExp(tableCell),
              alias: "important",
              inside: Prism3.languages.markdown
            },
            "punctuation": /\|/
          }
        }
      }
    },
    "code": [
      {
        // Prefixed by 4 spaces or 1 tab and preceded by an empty line
        pattern: /((?:^|\n)[ \t]*\n|(?:^|\r\n?)[ \t]*\r\n?)(?: {4}|\t).+(?:(?:\n|\r\n?)(?: {4}|\t).+)*/,
        lookbehind: true,
        alias: "keyword"
      },
      {
        // ```optional language
        // code block
        // ```
        pattern: /^```[\s\S]*?^```$/m,
        greedy: true,
        inside: {
          "code-block": {
            pattern: /^(```.*(?:\n|\r\n?))[\s\S]+?(?=(?:\n|\r\n?)^```$)/m,
            lookbehind: true
          },
          "code-language": {
            pattern: /^(```).+/,
            lookbehind: true
          },
          "punctuation": /```/
        }
      }
    ],
    "title": [
      {
        // title 1
        // =======
        // title 2
        // -------
        pattern: /\S.*(?:\n|\r\n?)(?:==+|--+)(?=[ \t]*$)/m,
        alias: "important",
        inside: {
          punctuation: /==+$|--+$/
        }
      },
      {
        // # title 1
        // ###### title 6
        pattern: /(^\s*)#.+/m,
        lookbehind: true,
        alias: "important",
        inside: {
          punctuation: /^#+|#+$/
        }
      }
    ],
    "hr": {
      // ***
      // ---
      // * * *
      // -----------
      pattern: /(^\s*)([*-])(?:[\t ]*\2){2,}(?=\s*$)/m,
      lookbehind: true,
      alias: "punctuation"
    },
    "list": {
      // * item
      // + item
      // - item
      // 1. item
      pattern: /(^\s*)(?:[*+-]|\d+\.)(?=[\t ].)/m,
      lookbehind: true,
      alias: "punctuation"
    },
    "url-reference": {
      // [id]: http://example.com "Optional title"
      // [id]: http://example.com 'Optional title'
      // [id]: http://example.com (Optional title)
      // [id]: <http://example.com> "Optional title"
      pattern: /!?\[[^\]]+\]:[\t ]+(?:\S+|<(?:\\.|[^>\\])+>)(?:[\t ]+(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\((?:\\.|[^)\\])*\)))?/,
      inside: {
        "variable": {
          pattern: /^(!?\[)[^\]]+/,
          lookbehind: true
        },
        "string": /(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\((?:\\.|[^)\\])*\))$/,
        "punctuation": /^[\[\]!:]|[<>]/
      },
      alias: "url"
    },
    "bold": {
      // **strong**
      // __strong__
      // allow one nested instance of italic text using the same delimiter
      pattern: createInline(/\b__(?:(?!_)<inner>|_(?:(?!_)<inner>)+_)+__\b|\*\*(?:(?!\*)<inner>|\*(?:(?!\*)<inner>)+\*)+\*\*/.source),
      lookbehind: true,
      greedy: true,
      inside: {
        "content": {
          pattern: /(^..)[\s\S]+(?=..$)/,
          lookbehind: true,
          inside: {}
          // see below
        },
        "punctuation": /\*\*|__/
      }
    },
    "italic": {
      // *em*
      // _em_
      // allow one nested instance of bold text using the same delimiter
      pattern: createInline(/\b_(?:(?!_)<inner>|__(?:(?!_)<inner>)+__)+_\b|\*(?:(?!\*)<inner>|\*\*(?:(?!\*)<inner>)+\*\*)+\*/.source),
      lookbehind: true,
      greedy: true,
      inside: {
        "content": {
          pattern: /(^.)[\s\S]+(?=.$)/,
          lookbehind: true,
          inside: {}
          // see below
        },
        "punctuation": /[*_]/
      }
    },
    "strike": {
      // ~~strike through~~
      // ~strike~
      // eslint-disable-next-line regexp/strict
      pattern: createInline(/(~~?)(?:(?!~)<inner>)+\2/.source),
      lookbehind: true,
      greedy: true,
      inside: {
        "content": {
          pattern: /(^~~?)[\s\S]+(?=\1$)/,
          lookbehind: true,
          inside: {}
          // see below
        },
        "punctuation": /~~?/
      }
    },
    "code-snippet": {
      // `code`
      // ``code``
      pattern: /(^|[^\\`])(?:``[^`\r\n]+(?:`[^`\r\n]+)*``(?!`)|`[^`\r\n]+`(?!`))/,
      lookbehind: true,
      greedy: true,
      alias: ["code", "keyword"]
    },
    "url": {
      // [example](http://example.com "Optional title")
      // [example][id]
      // [example] [id]
      pattern: createInline(/!?\[(?:(?!\])<inner>)+\](?:\([^\s)]+(?:[\t ]+"(?:\\.|[^"\\])*")?\)|[ \t]?\[(?:(?!\])<inner>)+\])/.source),
      lookbehind: true,
      greedy: true,
      inside: {
        "operator": /^!/,
        "content": {
          pattern: /(^\[)[^\]]+(?=\])/,
          lookbehind: true,
          inside: {}
          // see below
        },
        "variable": {
          pattern: /(^\][ \t]?\[)[^\]]+(?=\]$)/,
          lookbehind: true
        },
        "url": {
          pattern: /(^\]\()[^\s)]+/,
          lookbehind: true
        },
        "string": {
          pattern: /(^[ \t]+)"(?:\\.|[^"\\])*"(?=\)$)/,
          lookbehind: true
        }
      }
    }
  });
  ["url", "bold", "italic", "strike"].forEach(function(token) {
    ["url", "bold", "italic", "strike", "code-snippet"].forEach(function(inside) {
      if (token !== inside) {
        Prism3.languages.markdown[token].inside.content.inside[inside] = Prism3.languages.markdown[inside];
      }
    });
  });
  Prism3.hooks.add("after-tokenize", function(env) {
    if (env.language !== "markdown" && env.language !== "md") {
      return;
    }
    function walkTokens(tokens) {
      if (!tokens || typeof tokens === "string") {
        return;
      }
      for (var i = 0, l = tokens.length; i < l; i++) {
        var token = tokens[i];
        if (token.type !== "code") {
          walkTokens(token.content);
          continue;
        }
        var codeLang = token.content[1];
        var codeBlock = token.content[3];
        if (codeLang && codeBlock && codeLang.type === "code-language" && codeBlock.type === "code-block" && typeof codeLang.content === "string") {
          var lang = codeLang.content.replace(/\b#/g, "sharp").replace(/\b\+\+/g, "pp");
          lang = (/[a-z][\w-]*/i.exec(lang) || [""])[0].toLowerCase();
          var alias = "language-" + lang;
          if (!codeBlock.alias) {
            codeBlock.alias = [alias];
          } else if (typeof codeBlock.alias === "string") {
            codeBlock.alias = [codeBlock.alias, alias];
          } else {
            codeBlock.alias.push(alias);
          }
        }
      }
    }
    walkTokens(env.tokens);
  });
  Prism3.hooks.add("wrap", function(env) {
    if (env.type !== "code-block") {
      return;
    }
    var codeLang = "";
    for (var i = 0, l = env.classes.length; i < l; i++) {
      var cls = env.classes[i];
      var match = /language-(.+)/.exec(cls);
      if (match) {
        codeLang = match[1];
        break;
      }
    }
    var grammar = Prism3.languages[codeLang];
    if (!grammar) {
      if (codeLang && codeLang !== "none" && Prism3.plugins.autoloader) {
        var id = "md-" + (/* @__PURE__ */ new Date()).valueOf() + "-" + Math.floor(Math.random() * 1e16);
        env.attributes["id"] = id;
        Prism3.plugins.autoloader.loadLanguages(codeLang, function() {
          var ele = document.getElementById(id);
          if (ele) {
            ele.innerHTML = Prism3.highlight(ele.textContent, Prism3.languages[codeLang], codeLang);
          }
        });
      }
    } else {
      env.content = Prism3.highlight(textContent(env.content), grammar, codeLang);
    }
  });
  var tagPattern = RegExp(Prism3.languages.markup.tag.pattern.source, "gi");
  var KNOWN_ENTITY_NAMES = {
    "amp": "&",
    "lt": "<",
    "gt": ">",
    "quot": '"'
  };
  var fromCodePoint = String.fromCodePoint || String.fromCharCode;
  function textContent(html) {
    var text = html.replace(tagPattern, "");
    text = text.replace(/&(\w{1,8}|#x?[\da-f]{1,8});/gi, function(m, code) {
      code = code.toLowerCase();
      if (code[0] === "#") {
        var value;
        if (code[1] === "x") {
          value = parseInt(code.slice(2), 16);
        } else {
          value = Number(code.slice(1));
        }
        return fromCodePoint(value);
      } else {
        var known = KNOWN_ENTITY_NAMES[code];
        if (known) {
          return known;
        }
        return m;
      }
    });
    return text;
  }
  Prism3.languages.md = Prism3.languages.markdown;
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-ruby.js
(function(Prism3) {
  Prism3.languages.ruby = Prism3.languages.extend("clike", {
    "comment": {
      pattern: /#.*|^=begin\s[\s\S]*?^=end/m,
      greedy: true
    },
    "class-name": {
      pattern: /(\b(?:class|module)\s+|\bcatch\s+\()[\w.\\]+|\b[A-Z_]\w*(?=\s*\.\s*new\b)/,
      lookbehind: true,
      inside: {
        "punctuation": /[.\\]/
      }
    },
    "keyword": /\b(?:BEGIN|END|alias|and|begin|break|case|class|def|define_method|defined|do|each|else|elsif|end|ensure|extend|for|if|in|include|module|new|next|nil|not|or|prepend|private|protected|public|raise|redo|require|rescue|retry|return|self|super|then|throw|undef|unless|until|when|while|yield)\b/,
    "operator": /\.{2,3}|&\.|===|<?=>|[!=]?~|(?:&&|\|\||<<|>>|\*\*|[+\-*/%<>!^&|=])=?|[?:]/,
    "punctuation": /[(){}[\].,;]/
  });
  Prism3.languages.insertBefore("ruby", "operator", {
    "double-colon": {
      pattern: /::/,
      alias: "punctuation"
    }
  });
  var interpolation = {
    pattern: /((?:^|[^\\])(?:\\{2})*)#\{(?:[^{}]|\{[^{}]*\})*\}/,
    lookbehind: true,
    inside: {
      "content": {
        pattern: /^(#\{)[\s\S]+(?=\}$)/,
        lookbehind: true,
        inside: Prism3.languages.ruby
      },
      "delimiter": {
        pattern: /^#\{|\}$/,
        alias: "punctuation"
      }
    }
  };
  delete Prism3.languages.ruby.function;
  var percentExpression = "(?:" + [
    /([^a-zA-Z0-9\s{(\[<=])(?:(?!\1)[^\\]|\\[\s\S])*\1/.source,
    /\((?:[^()\\]|\\[\s\S]|\((?:[^()\\]|\\[\s\S])*\))*\)/.source,
    /\{(?:[^{}\\]|\\[\s\S]|\{(?:[^{}\\]|\\[\s\S])*\})*\}/.source,
    /\[(?:[^\[\]\\]|\\[\s\S]|\[(?:[^\[\]\\]|\\[\s\S])*\])*\]/.source,
    /<(?:[^<>\\]|\\[\s\S]|<(?:[^<>\\]|\\[\s\S])*>)*>/.source
  ].join("|") + ")";
  var symbolName = /(?:"(?:\\.|[^"\\\r\n])*"|(?:\b[a-zA-Z_]\w*|[^\s\0-\x7F]+)[?!]?|\$.)/.source;
  Prism3.languages.insertBefore("ruby", "keyword", {
    "regex-literal": [
      {
        pattern: RegExp(/%r/.source + percentExpression + /[egimnosux]{0,6}/.source),
        greedy: true,
        inside: {
          "interpolation": interpolation,
          "regex": /[\s\S]+/
        }
      },
      {
        pattern: /(^|[^/])\/(?!\/)(?:\[[^\r\n\]]+\]|\\.|[^[/\\\r\n])+\/[egimnosux]{0,6}(?=\s*(?:$|[\r\n,.;})#]))/,
        lookbehind: true,
        greedy: true,
        inside: {
          "interpolation": interpolation,
          "regex": /[\s\S]+/
        }
      }
    ],
    "variable": /[@$]+[a-zA-Z_]\w*(?:[?!]|\b)/,
    "symbol": [
      {
        pattern: RegExp(/(^|[^:]):/.source + symbolName),
        lookbehind: true,
        greedy: true
      },
      {
        pattern: RegExp(/([\r\n{(,][ \t]*)/.source + symbolName + /(?=:(?!:))/.source),
        lookbehind: true,
        greedy: true
      }
    ],
    "method-definition": {
      pattern: /(\bdef\s+)\w+(?:\s*\.\s*\w+)?/,
      lookbehind: true,
      inside: {
        "function": /\b\w+$/,
        "keyword": /^self\b/,
        "class-name": /^\w+/,
        "punctuation": /\./
      }
    }
  });
  Prism3.languages.insertBefore("ruby", "string", {
    "string-literal": [
      {
        pattern: RegExp(/%[qQiIwWs]?/.source + percentExpression),
        greedy: true,
        inside: {
          "interpolation": interpolation,
          "string": /[\s\S]+/
        }
      },
      {
        pattern: /("|')(?:#\{[^}]+\}|#(?!\{)|\\(?:\r\n|[\s\S])|(?!\1)[^\\#\r\n])*\1/,
        greedy: true,
        inside: {
          "interpolation": interpolation,
          "string": /[\s\S]+/
        }
      },
      {
        pattern: /<<[-~]?([a-z_]\w*)[\r\n](?:.*[\r\n])*?[\t ]*\1/i,
        alias: "heredoc-string",
        greedy: true,
        inside: {
          "delimiter": {
            pattern: /^<<[-~]?[a-z_]\w*|\b[a-z_]\w*$/i,
            inside: {
              "symbol": /\b\w+/,
              "punctuation": /^<<[-~]?/
            }
          },
          "interpolation": interpolation,
          "string": /[\s\S]+/
        }
      },
      {
        pattern: /<<[-~]?'([a-z_]\w*)'[\r\n](?:.*[\r\n])*?[\t ]*\1/i,
        alias: "heredoc-string",
        greedy: true,
        inside: {
          "delimiter": {
            pattern: /^<<[-~]?'[a-z_]\w*'|\b[a-z_]\w*$/i,
            inside: {
              "symbol": /\b\w+/,
              "punctuation": /^<<[-~]?'|'$/
            }
          },
          "string": /[\s\S]+/
        }
      }
    ],
    "command-literal": [
      {
        pattern: RegExp(/%x/.source + percentExpression),
        greedy: true,
        inside: {
          "interpolation": interpolation,
          "command": {
            pattern: /[\s\S]+/,
            alias: "string"
          }
        }
      },
      {
        pattern: /`(?:#\{[^}]+\}|#(?!\{)|\\(?:\r\n|[\s\S])|[^\\`#\r\n])*`/,
        greedy: true,
        inside: {
          "interpolation": interpolation,
          "command": {
            pattern: /[\s\S]+/,
            alias: "string"
          }
        }
      }
    ]
  });
  delete Prism3.languages.ruby.string;
  Prism3.languages.insertBefore("ruby", "number", {
    "builtin": /\b(?:Array|Bignum|Binding|Class|Continuation|Dir|Exception|FalseClass|File|Fixnum|Float|Hash|IO|Integer|MatchData|Method|Module|NilClass|Numeric|Object|Proc|Range|Regexp|Stat|String|Struct|Symbol|TMS|Thread|ThreadGroup|Time|TrueClass)\b/,
    "constant": /\b[A-Z][A-Z0-9_]*(?:[?!]|\b)/
  });
  Prism3.languages.rb = Prism3.languages.ruby;
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-csharp.js
(function(Prism3) {
  function replace(pattern, replacements) {
    return pattern.replace(/<<(\d+)>>/g, function(m, index) {
      return "(?:" + replacements[+index] + ")";
    });
  }
  function re(pattern, replacements, flags) {
    return RegExp(replace(pattern, replacements), flags || "");
  }
  function nested(pattern, depthLog2) {
    for (var i = 0; i < depthLog2; i++) {
      pattern = pattern.replace(/<<self>>/g, function() {
        return "(?:" + pattern + ")";
      });
    }
    return pattern.replace(/<<self>>/g, "[^\\s\\S]");
  }
  var keywordKinds = {
    // keywords which represent a return or variable type
    type: "bool byte char decimal double dynamic float int long object sbyte short string uint ulong ushort var void",
    // keywords which are used to declare a type
    typeDeclaration: "class enum interface record struct",
    // contextual keywords
    // ("var" and "dynamic" are missing because they are used like types)
    contextual: "add alias and ascending async await by descending from(?=\\s*(?:\\w|$)) get global group into init(?=\\s*;) join let nameof not notnull on or orderby partial remove select set unmanaged value when where with(?=\\s*{)",
    // all other keywords
    other: "abstract as base break case catch checked const continue default delegate do else event explicit extern finally fixed for foreach goto if implicit in internal is lock namespace new null operator out override params private protected public readonly ref return sealed sizeof stackalloc static switch this throw try typeof unchecked unsafe using virtual volatile while yield"
  };
  function keywordsToPattern(words) {
    return "\\b(?:" + words.trim().replace(/ /g, "|") + ")\\b";
  }
  var typeDeclarationKeywords = keywordsToPattern(keywordKinds.typeDeclaration);
  var keywords = RegExp(keywordsToPattern(keywordKinds.type + " " + keywordKinds.typeDeclaration + " " + keywordKinds.contextual + " " + keywordKinds.other));
  var nonTypeKeywords = keywordsToPattern(keywordKinds.typeDeclaration + " " + keywordKinds.contextual + " " + keywordKinds.other);
  var nonContextualKeywords = keywordsToPattern(keywordKinds.type + " " + keywordKinds.typeDeclaration + " " + keywordKinds.other);
  var generic = nested(/<(?:[^<>;=+\-*/%&|^]|<<self>>)*>/.source, 2);
  var nestedRound = nested(/\((?:[^()]|<<self>>)*\)/.source, 2);
  var name = /@?\b[A-Za-z_]\w*\b/.source;
  var genericName = replace(/<<0>>(?:\s*<<1>>)?/.source, [name, generic]);
  var identifier = replace(/(?!<<0>>)<<1>>(?:\s*\.\s*<<1>>)*/.source, [nonTypeKeywords, genericName]);
  var array = /\[\s*(?:,\s*)*\]/.source;
  var typeExpressionWithoutTuple = replace(/<<0>>(?:\s*(?:\?\s*)?<<1>>)*(?:\s*\?)?/.source, [identifier, array]);
  var tupleElement = replace(/[^,()<>[\];=+\-*/%&|^]|<<0>>|<<1>>|<<2>>/.source, [generic, nestedRound, array]);
  var tuple = replace(/\(<<0>>+(?:,<<0>>+)+\)/.source, [tupleElement]);
  var typeExpression = replace(/(?:<<0>>|<<1>>)(?:\s*(?:\?\s*)?<<2>>)*(?:\s*\?)?/.source, [tuple, identifier, array]);
  var typeInside = {
    "keyword": keywords,
    "punctuation": /[<>()?,.:[\]]/
  };
  var character = /'(?:[^\r\n'\\]|\\.|\\[Uux][\da-fA-F]{1,8})'/.source;
  var regularString = /"(?:\\.|[^\\"\r\n])*"/.source;
  var verbatimString = /@"(?:""|\\[\s\S]|[^\\"])*"(?!")/.source;
  Prism3.languages.csharp = Prism3.languages.extend("clike", {
    "string": [
      {
        pattern: re(/(^|[^$\\])<<0>>/.source, [verbatimString]),
        lookbehind: true,
        greedy: true
      },
      {
        pattern: re(/(^|[^@$\\])<<0>>/.source, [regularString]),
        lookbehind: true,
        greedy: true
      }
    ],
    "class-name": [
      {
        // Using static
        // using static System.Math;
        pattern: re(/(\busing\s+static\s+)<<0>>(?=\s*;)/.source, [identifier]),
        lookbehind: true,
        inside: typeInside
      },
      {
        // Using alias (type)
        // using Project = PC.MyCompany.Project;
        pattern: re(/(\busing\s+<<0>>\s*=\s*)<<1>>(?=\s*;)/.source, [name, typeExpression]),
        lookbehind: true,
        inside: typeInside
      },
      {
        // Using alias (alias)
        // using Project = PC.MyCompany.Project;
        pattern: re(/(\busing\s+)<<0>>(?=\s*=)/.source, [name]),
        lookbehind: true
      },
      {
        // Type declarations
        // class Foo<A, B>
        // interface Foo<out A, B>
        pattern: re(/(\b<<0>>\s+)<<1>>/.source, [typeDeclarationKeywords, genericName]),
        lookbehind: true,
        inside: typeInside
      },
      {
        // Single catch exception declaration
        // catch(Foo)
        // (things like catch(Foo e) is covered by variable declaration)
        pattern: re(/(\bcatch\s*\(\s*)<<0>>/.source, [identifier]),
        lookbehind: true,
        inside: typeInside
      },
      {
        // Name of the type parameter of generic constraints
        // where Foo : class
        pattern: re(/(\bwhere\s+)<<0>>/.source, [name]),
        lookbehind: true
      },
      {
        // Casts and checks via as and is.
        // as Foo<A>, is Bar<B>
        // (things like if(a is Foo b) is covered by variable declaration)
        pattern: re(/(\b(?:is(?:\s+not)?|as)\s+)<<0>>/.source, [typeExpressionWithoutTuple]),
        lookbehind: true,
        inside: typeInside
      },
      {
        // Variable, field and parameter declaration
        // (Foo bar, Bar baz, Foo[,,] bay, Foo<Bar, FooBar<Bar>> bax)
        pattern: re(/\b<<0>>(?=\s+(?!<<1>>|with\s*\{)<<2>>(?:\s*[=,;:{)\]]|\s+(?:in|when)\b))/.source, [typeExpression, nonContextualKeywords, name]),
        inside: typeInside
      }
    ],
    "keyword": keywords,
    // https://docs.microsoft.com/en-us/dotnet/csharp/language-reference/language-specification/lexical-structure#literals
    "number": /(?:\b0(?:x[\da-f_]*[\da-f]|b[01_]*[01])|(?:\B\.\d+(?:_+\d+)*|\b\d+(?:_+\d+)*(?:\.\d+(?:_+\d+)*)?)(?:e[-+]?\d+(?:_+\d+)*)?)(?:[dflmu]|lu|ul)?\b/i,
    "operator": />>=?|<<=?|[-=]>|([-+&|])\1|~|\?\?=?|[-+*/%&|^!=<>]=?/,
    "punctuation": /\?\.?|::|[{}[\];(),.:]/
  });
  Prism3.languages.insertBefore("csharp", "number", {
    "range": {
      pattern: /\.\./,
      alias: "operator"
    }
  });
  Prism3.languages.insertBefore("csharp", "punctuation", {
    "named-parameter": {
      pattern: re(/([(,]\s*)<<0>>(?=\s*:)/.source, [name]),
      lookbehind: true,
      alias: "punctuation"
    }
  });
  Prism3.languages.insertBefore("csharp", "class-name", {
    "namespace": {
      // namespace Foo.Bar {}
      // using Foo.Bar;
      pattern: re(/(\b(?:namespace|using)\s+)<<0>>(?:\s*\.\s*<<0>>)*(?=\s*[;{])/.source, [name]),
      lookbehind: true,
      inside: {
        "punctuation": /\./
      }
    },
    "type-expression": {
      // default(Foo), typeof(Foo<Bar>), sizeof(int)
      pattern: re(/(\b(?:default|sizeof|typeof)\s*\(\s*(?!\s))(?:[^()\s]|\s(?!\s)|<<0>>)*(?=\s*\))/.source, [nestedRound]),
      lookbehind: true,
      alias: "class-name",
      inside: typeInside
    },
    "return-type": {
      // Foo<Bar> ForBar(); Foo IFoo.Bar() => 0
      // int this[int index] => 0; T IReadOnlyList<T>.this[int index] => this[index];
      // int Foo => 0; int Foo { get; set } = 0;
      pattern: re(/<<0>>(?=\s+(?:<<1>>\s*(?:=>|[({]|\.\s*this\s*\[)|this\s*\[))/.source, [typeExpression, identifier]),
      inside: typeInside,
      alias: "class-name"
    },
    "constructor-invocation": {
      // new List<Foo<Bar[]>> { }
      pattern: re(/(\bnew\s+)<<0>>(?=\s*[[({])/.source, [typeExpression]),
      lookbehind: true,
      inside: typeInside,
      alias: "class-name"
    },
    /*'explicit-implementation': {
    	// int IFoo<Foo>.Bar => 0; void IFoo<Foo<Foo>>.Foo<T>();
    	pattern: replace(/\b<<0>>(?=\.<<1>>)/, className, methodOrPropertyDeclaration),
    	inside: classNameInside,
    	alias: 'class-name'
    },*/
    "generic-method": {
      // foo<Bar>()
      pattern: re(/<<0>>\s*<<1>>(?=\s*\()/.source, [name, generic]),
      inside: {
        "function": re(/^<<0>>/.source, [name]),
        "generic": {
          pattern: RegExp(generic),
          alias: "class-name",
          inside: typeInside
        }
      }
    },
    "type-list": {
      // The list of types inherited or of generic constraints
      // class Foo<F> : Bar, IList<FooBar>
      // where F : Bar, IList<int>
      pattern: re(
        /\b((?:<<0>>\s+<<1>>|record\s+<<1>>\s*<<5>>|where\s+<<2>>)\s*:\s*)(?:<<3>>|<<4>>|<<1>>\s*<<5>>|<<6>>)(?:\s*,\s*(?:<<3>>|<<4>>|<<6>>))*(?=\s*(?:where|[{;]|=>|$))/.source,
        [typeDeclarationKeywords, genericName, name, typeExpression, keywords.source, nestedRound, /\bnew\s*\(\s*\)/.source]
      ),
      lookbehind: true,
      inside: {
        "record-arguments": {
          pattern: re(/(^(?!new\s*\()<<0>>\s*)<<1>>/.source, [genericName, nestedRound]),
          lookbehind: true,
          greedy: true,
          inside: Prism3.languages.csharp
        },
        "keyword": keywords,
        "class-name": {
          pattern: RegExp(typeExpression),
          greedy: true,
          inside: typeInside
        },
        "punctuation": /[,()]/
      }
    },
    "preprocessor": {
      pattern: /(^[\t ]*)#.*/m,
      lookbehind: true,
      alias: "property",
      inside: {
        // highlight preprocessor directives as keywords
        "directive": {
          pattern: /(#)\b(?:define|elif|else|endif|endregion|error|if|line|nullable|pragma|region|undef|warning)\b/,
          lookbehind: true,
          alias: "keyword"
        }
      }
    }
  });
  var regularStringOrCharacter = regularString + "|" + character;
  var regularStringCharacterOrComment = replace(/\/(?![*/])|\/\/[^\r\n]*[\r\n]|\/\*(?:[^*]|\*(?!\/))*\*\/|<<0>>/.source, [regularStringOrCharacter]);
  var roundExpression = nested(replace(/[^"'/()]|<<0>>|\(<<self>>*\)/.source, [regularStringCharacterOrComment]), 2);
  var attrTarget = /\b(?:assembly|event|field|method|module|param|property|return|type)\b/.source;
  var attr = replace(/<<0>>(?:\s*\(<<1>>*\))?/.source, [identifier, roundExpression]);
  Prism3.languages.insertBefore("csharp", "class-name", {
    "attribute": {
      // Attributes
      // [Foo], [Foo(1), Bar(2, Prop = "foo")], [return: Foo(1), Bar(2)], [assembly: Foo(Bar)]
      pattern: re(/((?:^|[^\s\w>)?])\s*\[\s*)(?:<<0>>\s*:\s*)?<<1>>(?:\s*,\s*<<1>>)*(?=\s*\])/.source, [attrTarget, attr]),
      lookbehind: true,
      greedy: true,
      inside: {
        "target": {
          pattern: re(/^<<0>>(?=\s*:)/.source, [attrTarget]),
          alias: "keyword"
        },
        "attribute-arguments": {
          pattern: re(/\(<<0>>*\)/.source, [roundExpression]),
          inside: Prism3.languages.csharp
        },
        "class-name": {
          pattern: RegExp(identifier),
          inside: {
            "punctuation": /\./
          }
        },
        "punctuation": /[:,]/
      }
    }
  });
  var formatString = /:[^}\r\n]+/.source;
  var mInterpolationRound = nested(replace(/[^"'/()]|<<0>>|\(<<self>>*\)/.source, [regularStringCharacterOrComment]), 2);
  var mInterpolation = replace(/\{(?!\{)(?:(?![}:])<<0>>)*<<1>>?\}/.source, [mInterpolationRound, formatString]);
  var sInterpolationRound = nested(replace(/[^"'/()]|\/(?!\*)|\/\*(?:[^*]|\*(?!\/))*\*\/|<<0>>|\(<<self>>*\)/.source, [regularStringOrCharacter]), 2);
  var sInterpolation = replace(/\{(?!\{)(?:(?![}:])<<0>>)*<<1>>?\}/.source, [sInterpolationRound, formatString]);
  function createInterpolationInside(interpolation, interpolationRound) {
    return {
      "interpolation": {
        pattern: re(/((?:^|[^{])(?:\{\{)*)<<0>>/.source, [interpolation]),
        lookbehind: true,
        inside: {
          "format-string": {
            pattern: re(/(^\{(?:(?![}:])<<0>>)*)<<1>>(?=\}$)/.source, [interpolationRound, formatString]),
            lookbehind: true,
            inside: {
              "punctuation": /^:/
            }
          },
          "punctuation": /^\{|\}$/,
          "expression": {
            pattern: /[\s\S]+/,
            alias: "language-csharp",
            inside: Prism3.languages.csharp
          }
        }
      },
      "string": /[\s\S]+/
    };
  }
  Prism3.languages.insertBefore("csharp", "string", {
    "interpolation-string": [
      {
        pattern: re(/(^|[^\\])(?:\$@|@\$)"(?:""|\\[\s\S]|\{\{|<<0>>|[^\\{"])*"/.source, [mInterpolation]),
        lookbehind: true,
        greedy: true,
        inside: createInterpolationInside(mInterpolation, mInterpolationRound)
      },
      {
        pattern: re(/(^|[^@\\])\$"(?:\\.|\{\{|<<0>>|[^\\"{])*"/.source, [sInterpolation]),
        lookbehind: true,
        greedy: true,
        inside: createInterpolationInside(sInterpolation, sInterpolationRound)
      }
    ],
    "char": {
      pattern: RegExp(character),
      greedy: true
    }
  });
  Prism3.languages.dotnet = Prism3.languages.cs = Prism3.languages.csharp;
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-dart.js
(function(Prism3) {
  var keywords = [
    /\b(?:async|sync|yield)\*/,
    /\b(?:abstract|assert|async|await|break|case|catch|class|const|continue|covariant|default|deferred|do|dynamic|else|enum|export|extends|extension|external|factory|final|finally|for|get|hide|if|implements|import|in|interface|library|mixin|new|null|on|operator|part|rethrow|return|set|show|static|super|switch|sync|this|throw|try|typedef|var|void|while|with|yield)\b/
  ];
  var packagePrefix = /(^|[^\w.])(?:[a-z]\w*\s*\.\s*)*(?:[A-Z]\w*\s*\.\s*)*/.source;
  var className = {
    pattern: RegExp(packagePrefix + /[A-Z](?:[\d_A-Z]*[a-z]\w*)?\b/.source),
    lookbehind: true,
    inside: {
      "namespace": {
        pattern: /^[a-z]\w*(?:\s*\.\s*[a-z]\w*)*(?:\s*\.)?/,
        inside: {
          "punctuation": /\./
        }
      }
    }
  };
  Prism3.languages.dart = Prism3.languages.extend("clike", {
    "class-name": [
      className,
      {
        // variables and parameters
        // this to support class names (or generic parameters) which do not contain a lower case letter (also works for methods)
        pattern: RegExp(packagePrefix + /[A-Z]\w*(?=\s+\w+\s*[;,=()])/.source),
        lookbehind: true,
        inside: className.inside
      }
    ],
    "keyword": keywords,
    "operator": /\bis!|\b(?:as|is)\b|\+\+|--|&&|\|\||<<=?|>>=?|~(?:\/=?)?|[+\-*\/%&^|=!<>]=?|\?/
  });
  Prism3.languages.insertBefore("dart", "string", {
    "string-literal": {
      pattern: /r?(?:("""|''')[\s\S]*?\1|(["'])(?:\\.|(?!\2)[^\\\r\n])*\2(?!\2))/,
      greedy: true,
      inside: {
        "interpolation": {
          pattern: /((?:^|[^\\])(?:\\{2})*)\$(?:\w+|\{(?:[^{}]|\{[^{}]*\})*\})/,
          lookbehind: true,
          inside: {
            "punctuation": /^\$\{?|\}$/,
            "expression": {
              pattern: /[\s\S]+/,
              inside: Prism3.languages.dart
            }
          }
        },
        "string": /[\s\S]+/
      }
    },
    "string": void 0
  });
  Prism3.languages.insertBefore("dart", "class-name", {
    "metadata": {
      pattern: /@\w+/,
      alias: "function"
    }
  });
  Prism3.languages.insertBefore("dart", "class-name", {
    "generics": {
      pattern: /<(?:[\w\s,.&?]|<(?:[\w\s,.&?]|<(?:[\w\s,.&?]|<[\w\s,.&?]*>)*>)*>)*>/,
      inside: {
        "class-name": className,
        "keyword": keywords,
        "punctuation": /[<>(),.:]/,
        "operator": /[?&|]/
      }
    }
  });
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-go.js
Prism.languages.go = Prism.languages.extend("clike", {
  "string": {
    pattern: /(^|[^\\])"(?:\\.|[^"\\\r\n])*"|`[^`]*`/,
    lookbehind: true,
    greedy: true
  },
  "keyword": /\b(?:break|case|chan|const|continue|default|defer|else|fallthrough|for|func|go(?:to)?|if|import|interface|map|package|range|return|select|struct|switch|type|var)\b/,
  "boolean": /\b(?:_|false|iota|nil|true)\b/,
  "number": [
    // binary and octal integers
    /\b0(?:b[01_]+|o[0-7_]+)i?\b/i,
    // hexadecimal integers and floats
    /\b0x(?:[a-f\d_]+(?:\.[a-f\d_]*)?|\.[a-f\d_]+)(?:p[+-]?\d+(?:_\d+)*)?i?(?!\w)/i,
    // decimal integers and floats
    /(?:\b\d[\d_]*(?:\.[\d_]*)?|\B\.\d[\d_]*)(?:e[+-]?[\d_]+)?i?(?!\w)/i
  ],
  "operator": /[*\/%^!=]=?|\+[=+]?|-[=-]?|\|[=|]?|&(?:=|&|\^=?)?|>(?:>=?|=)?|<(?:<=?|=|-)?|:=|\.\.\./,
  "builtin": /\b(?:append|bool|byte|cap|close|complex|complex(?:64|128)|copy|delete|error|float(?:32|64)|u?int(?:8|16|32|64)?|imag|len|make|new|panic|print(?:ln)?|real|recover|rune|string|uintptr)\b/
});
Prism.languages.insertBefore("go", "string", {
  "char": {
    pattern: /'(?:\\.|[^'\\\r\n]){0,10}'/,
    greedy: true
  }
});
delete Prism.languages.go["class-name"];

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-kotlin.js
(function(Prism3) {
  Prism3.languages.kotlin = Prism3.languages.extend("clike", {
    "keyword": {
      // The lookbehind prevents wrong highlighting of e.g. kotlin.properties.get
      pattern: /(^|[^.])\b(?:abstract|actual|annotation|as|break|by|catch|class|companion|const|constructor|continue|crossinline|data|do|dynamic|else|enum|expect|external|final|finally|for|fun|get|if|import|in|infix|init|inline|inner|interface|internal|is|lateinit|noinline|null|object|open|operator|out|override|package|private|protected|public|reified|return|sealed|set|super|suspend|tailrec|this|throw|to|try|typealias|val|var|vararg|when|where|while)\b/,
      lookbehind: true
    },
    "function": [
      {
        pattern: /(?:`[^\r\n`]+`|\b\w+)(?=\s*\()/,
        greedy: true
      },
      {
        pattern: /(\.)(?:`[^\r\n`]+`|\w+)(?=\s*\{)/,
        lookbehind: true,
        greedy: true
      }
    ],
    "number": /\b(?:0[xX][\da-fA-F]+(?:_[\da-fA-F]+)*|0[bB][01]+(?:_[01]+)*|\d+(?:_\d+)*(?:\.\d+(?:_\d+)*)?(?:[eE][+-]?\d+(?:_\d+)*)?[fFL]?)\b/,
    "operator": /\+[+=]?|-[-=>]?|==?=?|!(?:!|==?)?|[\/*%<>]=?|[?:]:?|\.\.|&&|\|\||\b(?:and|inv|or|shl|shr|ushr|xor)\b/
  });
  delete Prism3.languages.kotlin["class-name"];
  var interpolationInside = {
    "interpolation-punctuation": {
      pattern: /^\$\{?|\}$/,
      alias: "punctuation"
    },
    "expression": {
      pattern: /[\s\S]+/,
      inside: Prism3.languages.kotlin
    }
  };
  Prism3.languages.insertBefore("kotlin", "string", {
    // https://kotlinlang.org/spec/expressions.html#string-interpolation-expressions
    "string-literal": [
      {
        pattern: /"""(?:[^$]|\$(?:(?!\{)|\{[^{}]*\}))*?"""/,
        alias: "multiline",
        inside: {
          "interpolation": {
            pattern: /\$(?:[a-z_]\w*|\{[^{}]*\})/i,
            inside: interpolationInside
          },
          "string": /[\s\S]+/
        }
      },
      {
        pattern: /"(?:[^"\\\r\n$]|\\.|\$(?:(?!\{)|\{[^{}]*\}))*"/,
        alias: "singleline",
        inside: {
          "interpolation": {
            pattern: /((?:^|[^\\])(?:\\{2})*)\$(?:[a-z_]\w*|\{[^{}]*\})/i,
            lookbehind: true,
            inside: interpolationInside
          },
          "string": /[\s\S]+/
        }
      }
    ],
    "char": {
      // https://kotlinlang.org/spec/expressions.html#character-literals
      pattern: /'(?:[^'\\\r\n]|\\(?:.|u[a-fA-F0-9]{0,4}))'/,
      greedy: true
    }
  });
  delete Prism3.languages.kotlin["string"];
  Prism3.languages.insertBefore("kotlin", "keyword", {
    "annotation": {
      pattern: /\B@(?:\w+:)?(?:[A-Z]\w*|\[[^\]]+\])/,
      alias: "builtin"
    }
  });
  Prism3.languages.insertBefore("kotlin", "function", {
    "label": {
      pattern: /\b\w+@|@\w+\b/,
      alias: "symbol"
    }
  });
  Prism3.languages.kt = Prism3.languages.kotlin;
  Prism3.languages.kts = Prism3.languages.kotlin;
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-reason.js
Prism.languages.reason = Prism.languages.extend("clike", {
  "string": {
    pattern: /"(?:\\(?:\r\n|[\s\S])|[^\\\r\n"])*"/,
    greedy: true
  },
  // 'class-name' must be matched *after* 'constructor' defined below
  "class-name": /\b[A-Z]\w*/,
  "keyword": /\b(?:and|as|assert|begin|class|constraint|do|done|downto|else|end|exception|external|for|fun|function|functor|if|in|include|inherit|initializer|lazy|let|method|module|mutable|new|nonrec|object|of|open|or|private|rec|sig|struct|switch|then|to|try|type|val|virtual|when|while|with)\b/,
  "operator": /\.{3}|:[:=]|\|>|->|=(?:==?|>)?|<=?|>=?|[|^?'#!~`]|[+\-*\/]\.?|\b(?:asr|land|lor|lsl|lsr|lxor|mod)\b/
});
Prism.languages.insertBefore("reason", "class-name", {
  "char": {
    pattern: /'(?:\\x[\da-f]{2}|\\o[0-3][0-7][0-7]|\\\d{3}|\\.|[^'\\\r\n])'/,
    greedy: true
  },
  // Negative look-ahead prevents from matching things like String.capitalize
  "constructor": /\b[A-Z]\w*\b(?!\s*\.)/,
  "label": {
    pattern: /\b[a-z]\w*(?=::)/,
    alias: "symbol"
  }
});
delete Prism.languages.reason.function;

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-solidity.js
Prism.languages.solidity = Prism.languages.extend("clike", {
  "class-name": {
    pattern: /(\b(?:contract|enum|interface|library|new|struct|using)\s+)(?!\d)[\w$]+/,
    lookbehind: true
  },
  "keyword": /\b(?:_|anonymous|as|assembly|assert|break|calldata|case|constant|constructor|continue|contract|default|delete|do|else|emit|enum|event|external|for|from|function|if|import|indexed|inherited|interface|internal|is|let|library|mapping|memory|modifier|new|payable|pragma|private|public|pure|require|returns?|revert|selfdestruct|solidity|storage|struct|suicide|switch|this|throw|using|var|view|while)\b/,
  "operator": /=>|->|:=|=:|\*\*|\+\+|--|\|\||&&|<<=?|>>=?|[-+*/%^&|<>!=]=?|[~?]/
});
Prism.languages.insertBefore("solidity", "keyword", {
  "builtin": /\b(?:address|bool|byte|u?int(?:8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)?|string|bytes(?:[1-9]|[12]\d|3[0-2])?)\b/
});
Prism.languages.insertBefore("solidity", "number", {
  "version": {
    pattern: /([<>]=?|\^)\d+\.\d+\.\d+\b/,
    lookbehind: true,
    alias: "number"
  }
});
Prism.languages.sol = Prism.languages.solidity;

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-v.js
(function(Prism3) {
  var interpolationExpr = {
    pattern: /[\s\S]+/,
    inside: null
  };
  Prism3.languages.v = Prism3.languages.extend("clike", {
    "string": {
      pattern: /r?(["'])(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
      alias: "quoted-string",
      greedy: true,
      inside: {
        "interpolation": {
          pattern: /((?:^|[^\\])(?:\\{2})*)\$(?:\{[^{}]*\}|\w+(?:\.\w+(?:\([^\(\)]*\))?|\[[^\[\]]+\])*)/,
          lookbehind: true,
          inside: {
            "interpolation-variable": {
              pattern: /^\$\w[\s\S]*$/,
              alias: "variable"
            },
            "interpolation-punctuation": {
              pattern: /^\$\{|\}$/,
              alias: "punctuation"
            },
            "interpolation-expression": interpolationExpr
          }
        }
      }
    },
    "class-name": {
      pattern: /(\b(?:enum|interface|struct|type)\s+)(?:C\.)?\w+/,
      lookbehind: true
    },
    "keyword": /(?:\b(?:__global|as|asm|assert|atomic|break|chan|const|continue|defer|else|embed|enum|fn|for|go(?:to)?|if|import|in|interface|is|lock|match|module|mut|none|or|pub|return|rlock|select|shared|sizeof|static|struct|type(?:of)?|union|unsafe)|\$(?:else|for|if)|#(?:flag|include))\b/,
    "number": /\b(?:0x[a-f\d]+(?:_[a-f\d]+)*|0b[01]+(?:_[01]+)*|0o[0-7]+(?:_[0-7]+)*|\d+(?:_\d+)*(?:\.\d+(?:_\d+)*)?)\b/i,
    "operator": /~|\?|[*\/%^!=]=?|\+[=+]?|-[=-]?|\|[=|]?|&(?:=|&|\^=?)?|>(?:>=?|=)?|<(?:<=?|=|-)?|:=|\.\.\.?/,
    "builtin": /\b(?:any(?:_float|_int)?|bool|byte(?:ptr)?|charptr|f(?:32|64)|i(?:8|16|64|128|nt)|rune|size_t|string|u(?:16|32|64|128)|voidptr)\b/
  });
  interpolationExpr.inside = Prism3.languages.v;
  Prism3.languages.insertBefore("v", "string", {
    "char": {
      pattern: /`(?:\\`|\\?[^`]{1,2})`/,
      // using {1,2} instead of `u` flag for compatibility
      alias: "rune"
    }
  });
  Prism3.languages.insertBefore("v", "operator", {
    "attribute": {
      pattern: /(^[\t ]*)\[(?:deprecated|direct_array_access|flag|inline|live|ref_only|typedef|unsafe_fn|windows_stdcall)\]/m,
      lookbehind: true,
      alias: "annotation",
      inside: {
        "punctuation": /[\[\]]/,
        "keyword": /\w+/
      }
    },
    "generic": {
      pattern: /<\w+>(?=\s*[\)\{])/,
      inside: {
        "punctuation": /[<>]/,
        "class-name": /\w+/
      }
    }
  });
  Prism3.languages.insertBefore("v", "function", {
    "generic-function": {
      // e.g. foo<T>( ...
      pattern: /\b\w+\s*<\w+>(?=\()/,
      inside: {
        "function": /^\w+/,
        "generic": {
          pattern: /<\w+>/,
          inside: Prism3.languages.v.generic.inside
        }
      }
    }
  });
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-protobuf.js
(function(Prism3) {
  var builtinTypes = /\b(?:bool|bytes|double|s?fixed(?:32|64)|float|[su]?int(?:32|64)|string)\b/;
  Prism3.languages.protobuf = Prism3.languages.extend("clike", {
    "class-name": [
      {
        pattern: /(\b(?:enum|extend|message|service)\s+)[A-Za-z_]\w*(?=\s*\{)/,
        lookbehind: true
      },
      {
        pattern: /(\b(?:rpc\s+\w+|returns)\s*\(\s*(?:stream\s+)?)\.?[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*(?=\s*\))/,
        lookbehind: true
      }
    ],
    "keyword": /\b(?:enum|extend|extensions|import|message|oneof|option|optional|package|public|repeated|required|reserved|returns|rpc(?=\s+\w)|service|stream|syntax|to)\b(?!\s*=\s*\d)/,
    "function": /\b[a-z_]\w*(?=\s*\()/i
  });
  Prism3.languages.insertBefore("protobuf", "operator", {
    "map": {
      pattern: /\bmap<\s*[\w.]+\s*,\s*[\w.]+\s*>(?=\s+[a-z_]\w*\s*[=;])/i,
      alias: "class-name",
      inside: {
        "punctuation": /[<>.,]/,
        "builtin": builtinTypes
      }
    },
    "builtin": builtinTypes,
    "positional-class-name": {
      pattern: /(?:\b|\B\.)[a-z_]\w*(?:\.[a-z_]\w*)*(?=\s+[a-z_]\w*\s*[=;])/i,
      alias: "class-name",
      inside: {
        "punctuation": /\./
      }
    },
    "annotation": {
      pattern: /(\[\s*)[a-z_]\w*(?=\s*=)/i,
      lookbehind: true
    }
  });
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-gradle.js
(function(Prism3) {
  var interpolation = {
    pattern: /((?:^|[^\\$])(?:\\{2})*)\$(?:\w+|\{[^{}]*\})/,
    lookbehind: true,
    inside: {
      "interpolation-punctuation": {
        pattern: /^\$\{?|\}$/,
        alias: "punctuation"
      },
      "expression": {
        pattern: /[\s\S]+/,
        inside: null
      }
    }
  };
  Prism3.languages.gradle = Prism3.languages.extend("clike", {
    "string": {
      pattern: /'''(?:[^\\]|\\[\s\S])*?'''|'(?:\\.|[^\\'\r\n])*'/,
      greedy: true
    },
    "keyword": /\b(?:apply|def|dependencies|else|if|implementation|import|plugin|plugins|project|repositories|repository|sourceSets|tasks|val)\b/,
    "number": /\b(?:0b[01_]+|0x[\da-f_]+(?:\.[\da-f_p\-]+)?|[\d_]+(?:\.[\d_]+)?(?:e[+-]?\d+)?)[glidf]?\b/i,
    "operator": {
      pattern: /(^|[^.])(?:~|==?~?|\?[.:]?|\*(?:[.=]|\*=?)?|\.[@&]|\.\.<|\.\.(?!\.)|-[-=>]?|\+[+=]?|!=?|<(?:<=?|=>?)?|>(?:>>?=?|=)?|&[&=]?|\|[|=]?|\/=?|\^=?|%=?)/,
      lookbehind: true
    },
    "punctuation": /\.+|[{}[\];(),:$]/
  });
  Prism3.languages.insertBefore("gradle", "string", {
    "shebang": {
      pattern: /#!.+/,
      alias: "comment",
      greedy: true
    },
    "interpolation-string": {
      pattern: /"""(?:[^\\]|\\[\s\S])*?"""|(["/])(?:\\.|(?!\1)[^\\\r\n])*\1|\$\/(?:[^/$]|\$(?:[/$]|(?![/$]))|\/(?!\$))*\/\$/,
      greedy: true,
      inside: {
        "interpolation": interpolation,
        "string": /[\s\S]+/
      }
    }
  });
  Prism3.languages.insertBefore("gradle", "punctuation", {
    "spock-block": /\b(?:and|cleanup|expect|given|setup|then|when|where):/
  });
  Prism3.languages.insertBefore("gradle", "function", {
    "annotation": {
      pattern: /(^|[^.])@\w+/,
      lookbehind: true,
      alias: "punctuation"
    }
  });
  interpolation.inside.expression.inside = Prism3.languages.gradle;
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-groovy.js
(function(Prism3) {
  var interpolation = {
    pattern: /((?:^|[^\\$])(?:\\{2})*)\$(?:\w+|\{[^{}]*\})/,
    lookbehind: true,
    inside: {
      "interpolation-punctuation": {
        pattern: /^\$\{?|\}$/,
        alias: "punctuation"
      },
      "expression": {
        pattern: /[\s\S]+/,
        inside: null
        // see below
      }
    }
  };
  Prism3.languages.groovy = Prism3.languages.extend("clike", {
    "string": {
      // https://groovy-lang.org/syntax.html#_dollar_slashy_string
      pattern: /'''(?:[^\\]|\\[\s\S])*?'''|'(?:\\.|[^\\'\r\n])*'/,
      greedy: true
    },
    "keyword": /\b(?:abstract|as|assert|boolean|break|byte|case|catch|char|class|const|continue|def|default|do|double|else|enum|extends|final|finally|float|for|goto|if|implements|import|in|instanceof|int|interface|long|native|new|package|private|protected|public|return|short|static|strictfp|super|switch|synchronized|this|throw|throws|trait|transient|try|void|volatile|while)\b/,
    "number": /\b(?:0b[01_]+|0x[\da-f_]+(?:\.[\da-f_p\-]+)?|[\d_]+(?:\.[\d_]+)?(?:e[+-]?\d+)?)[glidf]?\b/i,
    "operator": {
      pattern: /(^|[^.])(?:~|==?~?|\?[.:]?|\*(?:[.=]|\*=?)?|\.[@&]|\.\.<|\.\.(?!\.)|-[-=>]?|\+[+=]?|!=?|<(?:<=?|=>?)?|>(?:>>?=?|=)?|&[&=]?|\|[|=]?|\/=?|\^=?|%=?)/,
      lookbehind: true
    },
    "punctuation": /\.+|[{}[\];(),:$]/
  });
  Prism3.languages.insertBefore("groovy", "string", {
    "shebang": {
      pattern: /#!.+/,
      alias: "comment",
      greedy: true
    },
    "interpolation-string": {
      // TODO: Slash strings (e.g. /foo/) can contain line breaks but this will cause a lot of trouble with
      // simple division (see JS regex), so find a fix maybe?
      pattern: /"""(?:[^\\]|\\[\s\S])*?"""|(["/])(?:\\.|(?!\1)[^\\\r\n])*\1|\$\/(?:[^/$]|\$(?:[/$]|(?![/$]))|\/(?!\$))*\/\$/,
      greedy: true,
      inside: {
        "interpolation": interpolation,
        "string": /[\s\S]+/
      }
    }
  });
  Prism3.languages.insertBefore("groovy", "punctuation", {
    "spock-block": /\b(?:and|cleanup|expect|given|setup|then|when|where):/
  });
  Prism3.languages.insertBefore("groovy", "function", {
    "annotation": {
      pattern: /(^|[^.])@\w+/,
      lookbehind: true,
      alias: "punctuation"
    }
  });
  interpolation.inside.expression.inside = Prism3.languages.groovy;
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-fsharp.js
Prism.languages.fsharp = Prism.languages.extend("clike", {
  "comment": [
    {
      pattern: /(^|[^\\])\(\*(?!\))[\s\S]*?\*\)/,
      lookbehind: true,
      greedy: true
    },
    {
      pattern: /(^|[^\\:])\/\/.*/,
      lookbehind: true,
      greedy: true
    }
  ],
  "string": {
    pattern: /(?:"""[\s\S]*?"""|@"(?:""|[^"])*"|"(?:\\[\s\S]|[^\\"])*")B?/,
    greedy: true
  },
  "class-name": {
    pattern: /(\b(?:exception|inherit|interface|new|of|type)\s+|\w\s*:\s*|\s:\??>\s*)[.\w]+\b(?:\s*(?:->|\*)\s*[.\w]+\b)*(?!\s*[:.])/,
    lookbehind: true,
    inside: {
      "operator": /->|\*/,
      "punctuation": /\./
    }
  },
  "keyword": /\b(?:let|return|use|yield)(?:!\B|\b)|\b(?:abstract|and|as|asr|assert|atomic|base|begin|break|checked|class|component|const|constraint|constructor|continue|default|delegate|do|done|downcast|downto|eager|elif|else|end|event|exception|extern|external|false|finally|fixed|for|fun|function|functor|global|if|in|include|inherit|inline|interface|internal|land|lazy|lor|lsl|lsr|lxor|match|member|method|mixin|mod|module|mutable|namespace|new|not|null|object|of|open|or|override|parallel|private|process|protected|public|pure|rec|sealed|select|sig|static|struct|tailcall|then|to|trait|true|try|type|upcast|val|virtual|void|volatile|when|while|with)\b/,
  "number": [
    /\b0x[\da-fA-F]+(?:LF|lf|un)?\b/,
    /\b0b[01]+(?:uy|y)?\b/,
    /(?:\b\d+(?:\.\d*)?|\B\.\d+)(?:[fm]|e[+-]?\d+)?\b/i,
    /\b\d+(?:[IlLsy]|UL|u[lsy]?)?\b/
  ],
  "operator": /([<>~&^])\1\1|([*.:<>&])\2|<-|->|[!=:]=|<?\|{1,3}>?|\??(?:<=|>=|<>|[-+*/%=<>])\??|[!?^&]|~[+~-]|:>|:\?>?/
});
Prism.languages.insertBefore("fsharp", "keyword", {
  "preprocessor": {
    pattern: /(^[\t ]*)#.*/m,
    lookbehind: true,
    alias: "property",
    inside: {
      "directive": {
        pattern: /(^#)\b(?:else|endif|if|light|line|nowarn)\b/,
        lookbehind: true,
        alias: "keyword"
      }
    }
  }
});
Prism.languages.insertBefore("fsharp", "punctuation", {
  "computation-expression": {
    pattern: /\b[_a-z]\w*(?=\s*\{)/i,
    alias: "keyword"
  }
});
Prism.languages.insertBefore("fsharp", "string", {
  "annotation": {
    pattern: /\[<.+?>\]/,
    greedy: true,
    inside: {
      "punctuation": /^\[<|>\]$/,
      "class-name": {
        pattern: /^\w+$|(^|;\s*)[A-Z]\w*(?=\()/,
        lookbehind: true
      },
      "annotation-content": {
        pattern: /[\s\S]+/,
        inside: Prism.languages.fsharp
      }
    }
  },
  "char": {
    pattern: /'(?:[^\\']|\\(?:.|\d{3}|x[a-fA-F\d]{2}|u[a-fA-F\d]{4}|U[a-fA-F\d]{8}))'B?/,
    greedy: true
  }
});

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-haskell.js
Prism.languages.haskell = {
  "comment": {
    pattern: /(^|[^-!#$%*+=?&@|~.:<>^\\\/])(?:--(?:(?=.)[^-!#$%*+=?&@|~.:<>^\\\/].*|$)|\{-[\s\S]*?-\})/m,
    lookbehind: true
  },
  "char": {
    pattern: /'(?:[^\\']|\\(?:[abfnrtv\\"'&]|\^[A-Z@[\]^_]|ACK|BEL|BS|CAN|CR|DC1|DC2|DC3|DC4|DEL|DLE|EM|ENQ|EOT|ESC|ETB|ETX|FF|FS|GS|HT|LF|NAK|NUL|RS|SI|SO|SOH|SP|STX|SUB|SYN|US|VT|\d+|o[0-7]+|x[0-9a-fA-F]+))'/,
    alias: "string"
  },
  "string": {
    pattern: /"(?:[^\\"]|\\(?:\S|\s+\\))*"/,
    greedy: true
  },
  "keyword": /\b(?:case|class|data|deriving|do|else|if|in|infixl|infixr|instance|let|module|newtype|of|primitive|then|type|where)\b/,
  "import-statement": {
    // The imported or hidden names are not included in this import
    // statement. This is because we want to highlight those exactly like
    // we do for the names in the program.
    pattern: /(^[\t ]*)import\s+(?:qualified\s+)?(?:[A-Z][\w']*)(?:\.[A-Z][\w']*)*(?:\s+as\s+(?:[A-Z][\w']*)(?:\.[A-Z][\w']*)*)?(?:\s+hiding\b)?/m,
    lookbehind: true,
    inside: {
      "keyword": /\b(?:as|hiding|import|qualified)\b/,
      "punctuation": /\./
    }
  },
  // These are builtin variables only. Constructors are highlighted later as a constant.
  "builtin": /\b(?:abs|acos|acosh|all|and|any|appendFile|approxRational|asTypeOf|asin|asinh|atan|atan2|atanh|basicIORun|break|catch|ceiling|chr|compare|concat|concatMap|const|cos|cosh|curry|cycle|decodeFloat|denominator|digitToInt|div|divMod|drop|dropWhile|either|elem|encodeFloat|enumFrom|enumFromThen|enumFromThenTo|enumFromTo|error|even|exp|exponent|fail|filter|flip|floatDigits|floatRadix|floatRange|floor|fmap|foldl|foldl1|foldr|foldr1|fromDouble|fromEnum|fromInt|fromInteger|fromIntegral|fromRational|fst|gcd|getChar|getContents|getLine|group|head|id|inRange|index|init|intToDigit|interact|ioError|isAlpha|isAlphaNum|isAscii|isControl|isDenormalized|isDigit|isHexDigit|isIEEE|isInfinite|isLower|isNaN|isNegativeZero|isOctDigit|isPrint|isSpace|isUpper|iterate|last|lcm|length|lex|lexDigits|lexLitChar|lines|log|logBase|lookup|map|mapM|mapM_|max|maxBound|maximum|maybe|min|minBound|minimum|mod|negate|not|notElem|null|numerator|odd|or|ord|otherwise|pack|pi|pred|primExitWith|print|product|properFraction|putChar|putStr|putStrLn|quot|quotRem|range|rangeSize|read|readDec|readFile|readFloat|readHex|readIO|readInt|readList|readLitChar|readLn|readOct|readParen|readSigned|reads|readsPrec|realToFrac|recip|rem|repeat|replicate|return|reverse|round|scaleFloat|scanl|scanl1|scanr|scanr1|seq|sequence|sequence_|show|showChar|showInt|showList|showLitChar|showParen|showSigned|showString|shows|showsPrec|significand|signum|sin|sinh|snd|sort|span|splitAt|sqrt|subtract|succ|sum|tail|take|takeWhile|tan|tanh|threadToIOResult|toEnum|toInt|toInteger|toLower|toRational|toUpper|truncate|uncurry|undefined|unlines|until|unwords|unzip|unzip3|userError|words|writeFile|zip|zip3|zipWith|zipWith3)\b/,
  // decimal integers and floating point numbers | octal integers | hexadecimal integers
  "number": /\b(?:\d+(?:\.\d+)?(?:e[+-]?\d+)?|0o[0-7]+|0x[0-9a-f]+)\b/i,
  "operator": [
    {
      // infix operator
      pattern: /`(?:[A-Z][\w']*\.)*[_a-z][\w']*`/,
      greedy: true
    },
    {
      // function composition
      pattern: /(\s)\.(?=\s)/,
      lookbehind: true
    },
    // Most of this is needed because of the meaning of a single '.'.
    // If it stands alone freely, it is the function composition.
    // It may also be a separator between a module name and an identifier => no
    // operator. If it comes together with other special characters it is an
    // operator too.
    //
    // This regex means: /[-!#$%*+=?&@|~.:<>^\\\/]+/ without /\./.
    /[-!#$%*+=?&@|~:<>^\\\/][-!#$%*+=?&@|~.:<>^\\\/]*|\.[-!#$%*+=?&@|~.:<>^\\\/]+/
  ],
  // In Haskell, nearly everything is a variable, do not highlight these.
  "hvariable": {
    pattern: /\b(?:[A-Z][\w']*\.)*[_a-z][\w']*/,
    inside: {
      "punctuation": /\./
    }
  },
  "constant": {
    pattern: /\b(?:[A-Z][\w']*\.)*[A-Z][\w']*/,
    inside: {
      "punctuation": /\./
    }
  },
  "punctuation": /[{}[\];(),.:]/
};
Prism.languages.hs = Prism.languages.haskell;

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-basic.js
Prism.languages.basic = {
  "comment": {
    pattern: /(?:!|REM\b).+/i,
    inside: {
      "keyword": /^REM/i
    }
  },
  "string": {
    pattern: /"(?:""|[!#$%&'()*,\/:;<=>?^\w +\-.])*"/,
    greedy: true
  },
  "number": /(?:\b\d+(?:\.\d*)?|\B\.\d+)(?:E[+-]?\d+)?/i,
  "keyword": /\b(?:AS|BEEP|BLOAD|BSAVE|CALL(?: ABSOLUTE)?|CASE|CHAIN|CHDIR|CLEAR|CLOSE|CLS|COM|COMMON|CONST|DATA|DECLARE|DEF(?: FN| SEG|DBL|INT|LNG|SNG|STR)|DIM|DO|DOUBLE|ELSE|ELSEIF|END|ENVIRON|ERASE|ERROR|EXIT|FIELD|FILES|FOR|FUNCTION|GET|GOSUB|GOTO|IF|INPUT|INTEGER|IOCTL|KEY|KILL|LINE INPUT|LOCATE|LOCK|LONG|LOOP|LSET|MKDIR|NAME|NEXT|OFF|ON(?: COM| ERROR| KEY| TIMER)?|OPEN|OPTION BASE|OUT|POKE|PUT|READ|REDIM|REM|RESTORE|RESUME|RETURN|RMDIR|RSET|RUN|SELECT CASE|SHARED|SHELL|SINGLE|SLEEP|STATIC|STEP|STOP|STRING|SUB|SWAP|SYSTEM|THEN|TIMER|TO|TROFF|TRON|TYPE|UNLOCK|UNTIL|USING|VIEW PRINT|WAIT|WEND|WHILE|WRITE)(?:\$|\b)/i,
  "function": /\b(?:ABS|ACCESS|ACOS|ANGLE|AREA|ARITHMETIC|ARRAY|ASIN|ASK|AT|ATN|BASE|BEGIN|BREAK|CAUSE|CEIL|CHR|CLIP|COLLATE|COLOR|CON|COS|COSH|COT|CSC|DATE|DATUM|DEBUG|DECIMAL|DEF|DEG|DEGREES|DELETE|DET|DEVICE|DISPLAY|DOT|ELAPSED|EPS|ERASABLE|EXLINE|EXP|EXTERNAL|EXTYPE|FILETYPE|FIXED|FP|GO|GRAPH|HANDLER|IDN|IMAGE|IN|INT|INTERNAL|IP|IS|KEYED|LBOUND|LCASE|LEFT|LEN|LENGTH|LET|LINE|LINES|LOG|LOG10|LOG2|LTRIM|MARGIN|MAT|MAX|MAXNUM|MID|MIN|MISSING|MOD|NATIVE|NUL|NUMERIC|OF|OPTION|ORD|ORGANIZATION|OUTIN|OUTPUT|PI|POINT|POINTER|POINTS|POS|PRINT|PROGRAM|PROMPT|RAD|RADIANS|RANDOMIZE|RECORD|RECSIZE|RECTYPE|RELATIVE|REMAINDER|REPEAT|REST|RETRY|REWRITE|RIGHT|RND|ROUND|RTRIM|SAME|SEC|SELECT|SEQUENTIAL|SET|SETTER|SGN|SIN|SINH|SIZE|SKIP|SQR|STANDARD|STATUS|STR|STREAM|STYLE|TAB|TAN|TANH|TEMPLATE|TEXT|THERE|TIME|TIMEOUT|TRACE|TRANSFORM|TRUNCATE|UBOUND|UCASE|USE|VAL|VARIABLE|VIEWPORT|WHEN|WINDOW|WITH|ZER|ZONEWIDTH)(?:\$|\b)/i,
  "operator": /<[=>]?|>=?|[+\-*\/^=&]|\b(?:AND|EQV|IMP|NOT|OR|XOR)\b/i,
  "punctuation": /[,;:()]/
};

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-bash.js
(function(Prism3) {
  var envVars = "\\b(?:BASH|BASHOPTS|BASH_ALIASES|BASH_ARGC|BASH_ARGV|BASH_CMDS|BASH_COMPLETION_COMPAT_DIR|BASH_LINENO|BASH_REMATCH|BASH_SOURCE|BASH_VERSINFO|BASH_VERSION|COLORTERM|COLUMNS|COMP_WORDBREAKS|DBUS_SESSION_BUS_ADDRESS|DEFAULTS_PATH|DESKTOP_SESSION|DIRSTACK|DISPLAY|EUID|GDMSESSION|GDM_LANG|GNOME_KEYRING_CONTROL|GNOME_KEYRING_PID|GPG_AGENT_INFO|GROUPS|HISTCONTROL|HISTFILE|HISTFILESIZE|HISTSIZE|HOME|HOSTNAME|HOSTTYPE|IFS|INSTANCE|JOB|LANG|LANGUAGE|LC_ADDRESS|LC_ALL|LC_IDENTIFICATION|LC_MEASUREMENT|LC_MONETARY|LC_NAME|LC_NUMERIC|LC_PAPER|LC_TELEPHONE|LC_TIME|LESSCLOSE|LESSOPEN|LINES|LOGNAME|LS_COLORS|MACHTYPE|MAILCHECK|MANDATORY_PATH|NO_AT_BRIDGE|OLDPWD|OPTERR|OPTIND|ORBIT_SOCKETDIR|OSTYPE|PAPERSIZE|PATH|PIPESTATUS|PPID|PS1|PS2|PS3|PS4|PWD|RANDOM|REPLY|SECONDS|SELINUX_INIT|SESSION|SESSIONTYPE|SESSION_MANAGER|SHELL|SHELLOPTS|SHLVL|SSH_AUTH_SOCK|TERM|UID|UPSTART_EVENTS|UPSTART_INSTANCE|UPSTART_JOB|UPSTART_SESSION|USER|WINDOWID|XAUTHORITY|XDG_CONFIG_DIRS|XDG_CURRENT_DESKTOP|XDG_DATA_DIRS|XDG_GREETER_DATA_DIR|XDG_MENU_PREFIX|XDG_RUNTIME_DIR|XDG_SEAT|XDG_SEAT_PATH|XDG_SESSION_DESKTOP|XDG_SESSION_ID|XDG_SESSION_PATH|XDG_SESSION_TYPE|XDG_VTNR|XMODIFIERS)\\b";
  var commandAfterHeredoc = {
    pattern: /(^(["']?)\w+\2)[ \t]+\S.*/,
    lookbehind: true,
    alias: "punctuation",
    // this looks reasonably well in all themes
    inside: null
    // see below
  };
  var insideString = {
    "bash": commandAfterHeredoc,
    "environment": {
      pattern: RegExp("\\$" + envVars),
      alias: "constant"
    },
    "variable": [
      // [0]: Arithmetic Environment
      {
        pattern: /\$?\(\([\s\S]+?\)\)/,
        greedy: true,
        inside: {
          // If there is a $ sign at the beginning highlight $(( and )) as variable
          "variable": [
            {
              pattern: /(^\$\(\([\s\S]+)\)\)/,
              lookbehind: true
            },
            /^\$\(\(/
          ],
          "number": /\b0x[\dA-Fa-f]+\b|(?:\b\d+(?:\.\d*)?|\B\.\d+)(?:[Ee]-?\d+)?/,
          // Operators according to https://www.gnu.org/software/bash/manual/bashref.html#Shell-Arithmetic
          "operator": /--|\+\+|\*\*=?|<<=?|>>=?|&&|\|\||[=!+\-*/%<>^&|]=?|[?~:]/,
          // If there is no $ sign at the beginning highlight (( and )) as punctuation
          "punctuation": /\(\(?|\)\)?|,|;/
        }
      },
      // [1]: Command Substitution
      {
        pattern: /\$\((?:\([^)]+\)|[^()])+\)|`[^`]+`/,
        greedy: true,
        inside: {
          "variable": /^\$\(|^`|\)$|`$/
        }
      },
      // [2]: Brace expansion
      {
        pattern: /\$\{[^}]+\}/,
        greedy: true,
        inside: {
          "operator": /:[-=?+]?|[!\/]|##?|%%?|\^\^?|,,?/,
          "punctuation": /[\[\]]/,
          "environment": {
            pattern: RegExp("(\\{)" + envVars),
            lookbehind: true,
            alias: "constant"
          }
        }
      },
      /\$(?:\w+|[#?*!@$])/
    ],
    // Escape sequences from echo and printf's manuals, and escaped quotes.
    "entity": /\\(?:[abceEfnrtv\\"]|O?[0-7]{1,3}|U[0-9a-fA-F]{8}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{1,2})/
  };
  Prism3.languages.bash = {
    "shebang": {
      pattern: /^#!\s*\/.*/,
      alias: "important"
    },
    "comment": {
      pattern: /(^|[^"{\\$])#.*/,
      lookbehind: true
    },
    "function-name": [
      // a) function foo {
      // b) foo() {
      // c) function foo() {
      // but not “foo {”
      {
        // a) and c)
        pattern: /(\bfunction\s+)[\w-]+(?=(?:\s*\(?:\s*\))?\s*\{)/,
        lookbehind: true,
        alias: "function"
      },
      {
        // b)
        pattern: /\b[\w-]+(?=\s*\(\s*\)\s*\{)/,
        alias: "function"
      }
    ],
    // Highlight variable names as variables in for and select beginnings.
    "for-or-select": {
      pattern: /(\b(?:for|select)\s+)\w+(?=\s+in\s)/,
      alias: "variable",
      lookbehind: true
    },
    // Highlight variable names as variables in the left-hand part
    // of assignments (“=” and “+=”).
    "assign-left": {
      pattern: /(^|[\s;|&]|[<>]\()\w+(?:\.\w+)*(?=\+?=)/,
      inside: {
        "environment": {
          pattern: RegExp("(^|[\\s;|&]|[<>]\\()" + envVars),
          lookbehind: true,
          alias: "constant"
        }
      },
      alias: "variable",
      lookbehind: true
    },
    // Highlight parameter names as variables
    "parameter": {
      pattern: /(^|\s)-{1,2}(?:\w+:[+-]?)?\w+(?:\.\w+)*(?=[=\s]|$)/,
      alias: "variable",
      lookbehind: true
    },
    "string": [
      // Support for Here-documents https://en.wikipedia.org/wiki/Here_document
      {
        pattern: /((?:^|[^<])<<-?\s*)(\w+)\s[\s\S]*?(?:\r?\n|\r)\2/,
        lookbehind: true,
        greedy: true,
        inside: insideString
      },
      // Here-document with quotes around the tag
      // → No expansion (so no “inside”).
      {
        pattern: /((?:^|[^<])<<-?\s*)(["'])(\w+)\2\s[\s\S]*?(?:\r?\n|\r)\3/,
        lookbehind: true,
        greedy: true,
        inside: {
          "bash": commandAfterHeredoc
        }
      },
      // “Normal” string
      {
        // https://www.gnu.org/software/bash/manual/html_node/Double-Quotes.html
        pattern: /(^|[^\\](?:\\\\)*)"(?:\\[\s\S]|\$\([^)]+\)|\$(?!\()|`[^`]+`|[^"\\`$])*"/,
        lookbehind: true,
        greedy: true,
        inside: insideString
      },
      {
        // https://www.gnu.org/software/bash/manual/html_node/Single-Quotes.html
        pattern: /(^|[^$\\])'[^']*'/,
        lookbehind: true,
        greedy: true
      },
      {
        // https://www.gnu.org/software/bash/manual/html_node/ANSI_002dC-Quoting.html
        pattern: /\$'(?:[^'\\]|\\[\s\S])*'/,
        greedy: true,
        inside: {
          "entity": insideString.entity
        }
      }
    ],
    "environment": {
      pattern: RegExp("\\$?" + envVars),
      alias: "constant"
    },
    "variable": insideString.variable,
    "function": {
      pattern: /(^|[\s;|&]|[<>]\()(?:add|apropos|apt|apt-cache|apt-get|aptitude|aspell|automysqlbackup|awk|basename|bash|bc|bconsole|bg|bzip2|cal|cargo|cat|cfdisk|chgrp|chkconfig|chmod|chown|chroot|cksum|clear|cmp|column|comm|composer|cp|cron|crontab|csplit|curl|cut|date|dc|dd|ddrescue|debootstrap|df|diff|diff3|dig|dir|dircolors|dirname|dirs|dmesg|docker|docker-compose|du|egrep|eject|env|ethtool|expand|expect|expr|fdformat|fdisk|fg|fgrep|file|find|fmt|fold|format|free|fsck|ftp|fuser|gawk|git|gparted|grep|groupadd|groupdel|groupmod|groups|grub-mkconfig|gzip|halt|head|hg|history|host|hostname|htop|iconv|id|ifconfig|ifdown|ifup|import|install|ip|java|jobs|join|kill|killall|less|link|ln|locate|logname|logrotate|look|lpc|lpr|lprint|lprintd|lprintq|lprm|ls|lsof|lynx|make|man|mc|mdadm|mkconfig|mkdir|mke2fs|mkfifo|mkfs|mkisofs|mknod|mkswap|mmv|more|most|mount|mtools|mtr|mutt|mv|nano|nc|netstat|nice|nl|node|nohup|notify-send|npm|nslookup|op|open|parted|passwd|paste|pathchk|ping|pkill|pnpm|podman|podman-compose|popd|pr|printcap|printenv|ps|pushd|pv|quota|quotacheck|quotactl|ram|rar|rcp|reboot|remsync|rename|renice|rev|rm|rmdir|rpm|rsync|scp|screen|sdiff|sed|sendmail|seq|service|sftp|sh|shellcheck|shuf|shutdown|sleep|slocate|sort|split|ssh|stat|strace|su|sudo|sum|suspend|swapon|sync|sysctl|tac|tail|tar|tee|time|timeout|top|touch|tr|traceroute|tsort|tty|umount|uname|unexpand|uniq|units|unrar|unshar|unzip|update-grub|uptime|useradd|userdel|usermod|users|uudecode|uuencode|v|vcpkg|vdir|vi|vim|virsh|vmstat|wait|watch|wc|wget|whereis|which|who|whoami|write|xargs|xdg-open|yarn|yes|zenity|zip|zsh|zypper)(?=$|[)\s;|&])/,
      lookbehind: true
    },
    "keyword": {
      pattern: /(^|[\s;|&]|[<>]\()(?:case|do|done|elif|else|esac|fi|for|function|if|in|select|then|until|while)(?=$|[)\s;|&])/,
      lookbehind: true
    },
    // https://www.gnu.org/software/bash/manual/html_node/Shell-Builtin-Commands.html
    "builtin": {
      pattern: /(^|[\s;|&]|[<>]\()(?:\.|:|alias|bind|break|builtin|caller|cd|command|continue|declare|echo|enable|eval|exec|exit|export|getopts|hash|help|let|local|logout|mapfile|printf|pwd|read|readarray|readonly|return|set|shift|shopt|source|test|times|trap|type|typeset|ulimit|umask|unalias|unset)(?=$|[)\s;|&])/,
      lookbehind: true,
      // Alias added to make those easier to distinguish from strings.
      alias: "class-name"
    },
    "boolean": {
      pattern: /(^|[\s;|&]|[<>]\()(?:false|true)(?=$|[)\s;|&])/,
      lookbehind: true
    },
    "file-descriptor": {
      pattern: /\B&\d\b/,
      alias: "important"
    },
    "operator": {
      // Lots of redirections here, but not just that.
      pattern: /\d?<>|>\||\+=|=[=~]?|!=?|<<[<-]?|[&\d]?>>|\d[<>]&?|[<>][&=]?|&[>&]?|\|[&|]?/,
      inside: {
        "file-descriptor": {
          pattern: /^\d/,
          alias: "important"
        }
      }
    },
    "punctuation": /\$?\(\(?|\)\)?|\.\.|[{}[\];\\]/,
    "number": {
      pattern: /(^|\s)(?:[1-9]\d*|0)(?:[.,]\d+)?\b/,
      lookbehind: true
    }
  };
  commandAfterHeredoc.inside = Prism3.languages.bash;
  var toBeCopied = [
    "comment",
    "function-name",
    "for-or-select",
    "assign-left",
    "parameter",
    "string",
    "environment",
    "function",
    "keyword",
    "builtin",
    "boolean",
    "file-descriptor",
    "operator",
    "punctuation",
    "number"
  ];
  var inside = insideString.variable[1].inside;
  for (var i = 0; i < toBeCopied.length; i++) {
    inside[toBeCopied[i]] = Prism3.languages.bash[toBeCopied[i]];
  }
  Prism3.languages.sh = Prism3.languages.bash;
  Prism3.languages.shell = Prism3.languages.bash;
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-yaml.js
(function(Prism3) {
  var anchorOrAlias = /[*&][^\s[\]{},]+/;
  var tag = /!(?:<[\w\-%#;/?:@&=+$,.!~*'()[\]]+>|(?:[a-zA-Z\d-]*!)?[\w\-%#;/?:@&=+$.~*'()]+)?/;
  var properties = "(?:" + tag.source + "(?:[ 	]+" + anchorOrAlias.source + ")?|" + anchorOrAlias.source + "(?:[ 	]+" + tag.source + ")?)";
  var plainKey = /(?:[^\s\x00-\x08\x0e-\x1f!"#%&'*,\-:>?@[\]`{|}\x7f-\x84\x86-\x9f\ud800-\udfff\ufffe\uffff]|[?:-]<PLAIN>)(?:[ \t]*(?:(?![#:])<PLAIN>|:<PLAIN>))*/.source.replace(/<PLAIN>/g, function() {
    return /[^\s\x00-\x08\x0e-\x1f,[\]{}\x7f-\x84\x86-\x9f\ud800-\udfff\ufffe\uffff]/.source;
  });
  var string = /"(?:[^"\\\r\n]|\\.)*"|'(?:[^'\\\r\n]|\\.)*'/.source;
  function createValuePattern(value, flags) {
    flags = (flags || "").replace(/m/g, "") + "m";
    var pattern = /([:\-,[{]\s*(?:\s<<prop>>[ \t]+)?)(?:<<value>>)(?=[ \t]*(?:$|,|\]|\}|(?:[\r\n]\s*)?#))/.source.replace(/<<prop>>/g, function() {
      return properties;
    }).replace(/<<value>>/g, function() {
      return value;
    });
    return RegExp(pattern, flags);
  }
  Prism3.languages.yaml = {
    "scalar": {
      pattern: RegExp(/([\-:]\s*(?:\s<<prop>>[ \t]+)?[|>])[ \t]*(?:((?:\r?\n|\r)[ \t]+)\S[^\r\n]*(?:\2[^\r\n]+)*)/.source.replace(/<<prop>>/g, function() {
        return properties;
      })),
      lookbehind: true,
      alias: "string"
    },
    "comment": /#.*/,
    "key": {
      pattern: RegExp(/((?:^|[:\-,[{\r\n?])[ \t]*(?:<<prop>>[ \t]+)?)<<key>>(?=\s*:\s)/.source.replace(/<<prop>>/g, function() {
        return properties;
      }).replace(/<<key>>/g, function() {
        return "(?:" + plainKey + "|" + string + ")";
      })),
      lookbehind: true,
      greedy: true,
      alias: "atrule"
    },
    "directive": {
      pattern: /(^[ \t]*)%.+/m,
      lookbehind: true,
      alias: "important"
    },
    "datetime": {
      pattern: createValuePattern(/\d{4}-\d\d?-\d\d?(?:[tT]|[ \t]+)\d\d?:\d{2}:\d{2}(?:\.\d*)?(?:[ \t]*(?:Z|[-+]\d\d?(?::\d{2})?))?|\d{4}-\d{2}-\d{2}|\d\d?:\d{2}(?::\d{2}(?:\.\d*)?)?/.source),
      lookbehind: true,
      alias: "number"
    },
    "boolean": {
      pattern: createValuePattern(/false|true/.source, "i"),
      lookbehind: true,
      alias: "important"
    },
    "null": {
      pattern: createValuePattern(/null|~/.source, "i"),
      lookbehind: true,
      alias: "important"
    },
    "string": {
      pattern: createValuePattern(string),
      lookbehind: true,
      greedy: true
    },
    "number": {
      pattern: createValuePattern(/[+-]?(?:0x[\da-f]+|0o[0-7]+|(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|\.inf|\.nan)/.source, "i"),
      lookbehind: true
    },
    "tag": tag,
    "important": anchorOrAlias,
    "punctuation": /---|[:[\]{}\-,|>?]|\.\.\./
  };
  Prism3.languages.yml = Prism3.languages.yaml;
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-sql.js
Prism.languages.sql = {
  "comment": {
    pattern: /(^|[^\\])(?:\/\*[\s\S]*?\*\/|(?:--|\/\/|#).*)/,
    lookbehind: true
  },
  "variable": [
    {
      pattern: /@(["'`])(?:\\[\s\S]|(?!\1)[^\\])+\1/,
      greedy: true
    },
    /@[\w.$]+/
  ],
  "string": {
    pattern: /(^|[^@\\])("|')(?:\\[\s\S]|(?!\2)[^\\]|\2\2)*\2/,
    greedy: true,
    lookbehind: true
  },
  "identifier": {
    pattern: /(^|[^@\\])`(?:\\[\s\S]|[^`\\]|``)*`/,
    greedy: true,
    lookbehind: true,
    inside: {
      "punctuation": /^`|`$/
    }
  },
  "function": /\b(?:AVG|COUNT|FIRST|FORMAT|LAST|LCASE|LEN|MAX|MID|MIN|MOD|NOW|ROUND|SUM|UCASE)(?=\s*\()/i,
  // Should we highlight user defined functions too?
  "keyword": /\b(?:ACTION|ADD|AFTER|ALGORITHM|ALL|ALTER|ANALYZE|ANY|APPLY|AS|ASC|AUTHORIZATION|AUTO_INCREMENT|BACKUP|BDB|BEGIN|BERKELEYDB|BIGINT|BINARY|BIT|BLOB|BOOL|BOOLEAN|BREAK|BROWSE|BTREE|BULK|BY|CALL|CASCADED?|CASE|CHAIN|CHAR(?:ACTER|SET)?|CHECK(?:POINT)?|CLOSE|CLUSTERED|COALESCE|COLLATE|COLUMNS?|COMMENT|COMMIT(?:TED)?|COMPUTE|CONNECT|CONSISTENT|CONSTRAINT|CONTAINS(?:TABLE)?|CONTINUE|CONVERT|CREATE|CROSS|CURRENT(?:_DATE|_TIME|_TIMESTAMP|_USER)?|CURSOR|CYCLE|DATA(?:BASES?)?|DATE(?:TIME)?|DAY|DBCC|DEALLOCATE|DEC|DECIMAL|DECLARE|DEFAULT|DEFINER|DELAYED|DELETE|DELIMITERS?|DENY|DESC|DESCRIBE|DETERMINISTIC|DISABLE|DISCARD|DISK|DISTINCT|DISTINCTROW|DISTRIBUTED|DO|DOUBLE|DROP|DUMMY|DUMP(?:FILE)?|DUPLICATE|ELSE(?:IF)?|ENABLE|ENCLOSED|END|ENGINE|ENUM|ERRLVL|ERRORS|ESCAPED?|EXCEPT|EXEC(?:UTE)?|EXISTS|EXIT|EXPLAIN|EXTENDED|FETCH|FIELDS|FILE|FILLFACTOR|FIRST|FIXED|FLOAT|FOLLOWING|FOR(?: EACH ROW)?|FORCE|FOREIGN|FREETEXT(?:TABLE)?|FROM|FULL|FUNCTION|GEOMETRY(?:COLLECTION)?|GLOBAL|GOTO|GRANT|GROUP|HANDLER|HASH|HAVING|HOLDLOCK|HOUR|IDENTITY(?:COL|_INSERT)?|IF|IGNORE|IMPORT|INDEX|INFILE|INNER|INNODB|INOUT|INSERT|INT|INTEGER|INTERSECT|INTERVAL|INTO|INVOKER|ISOLATION|ITERATE|JOIN|KEYS?|KILL|LANGUAGE|LAST|LEAVE|LEFT|LEVEL|LIMIT|LINENO|LINES|LINESTRING|LOAD|LOCAL|LOCK|LONG(?:BLOB|TEXT)|LOOP|MATCH(?:ED)?|MEDIUM(?:BLOB|INT|TEXT)|MERGE|MIDDLEINT|MINUTE|MODE|MODIFIES|MODIFY|MONTH|MULTI(?:LINESTRING|POINT|POLYGON)|NATIONAL|NATURAL|NCHAR|NEXT|NO|NONCLUSTERED|NULLIF|NUMERIC|OFF?|OFFSETS?|ON|OPEN(?:DATASOURCE|QUERY|ROWSET)?|OPTIMIZE|OPTION(?:ALLY)?|ORDER|OUT(?:ER|FILE)?|OVER|PARTIAL|PARTITION|PERCENT|PIVOT|PLAN|POINT|POLYGON|PRECEDING|PRECISION|PREPARE|PREV|PRIMARY|PRINT|PRIVILEGES|PROC(?:EDURE)?|PUBLIC|PURGE|QUICK|RAISERROR|READS?|REAL|RECONFIGURE|REFERENCES|RELEASE|RENAME|REPEAT(?:ABLE)?|REPLACE|REPLICATION|REQUIRE|RESIGNAL|RESTORE|RESTRICT|RETURN(?:ING|S)?|REVOKE|RIGHT|ROLLBACK|ROUTINE|ROW(?:COUNT|GUIDCOL|S)?|RTREE|RULE|SAVE(?:POINT)?|SCHEMA|SECOND|SELECT|SERIAL(?:IZABLE)?|SESSION(?:_USER)?|SET(?:USER)?|SHARE|SHOW|SHUTDOWN|SIMPLE|SMALLINT|SNAPSHOT|SOME|SONAME|SQL|START(?:ING)?|STATISTICS|STATUS|STRIPED|SYSTEM_USER|TABLES?|TABLESPACE|TEMP(?:ORARY|TABLE)?|TERMINATED|TEXT(?:SIZE)?|THEN|TIME(?:STAMP)?|TINY(?:BLOB|INT|TEXT)|TOP?|TRAN(?:SACTIONS?)?|TRIGGER|TRUNCATE|TSEQUAL|TYPES?|UNBOUNDED|UNCOMMITTED|UNDEFINED|UNION|UNIQUE|UNLOCK|UNPIVOT|UNSIGNED|UPDATE(?:TEXT)?|USAGE|USE|USER|USING|VALUES?|VAR(?:BINARY|CHAR|CHARACTER|YING)|VIEW|WAITFOR|WARNINGS|WHEN|WHERE|WHILE|WITH(?: ROLLUP|IN)?|WORK|WRITE(?:TEXT)?|YEAR)\b/i,
  "boolean": /\b(?:FALSE|NULL|TRUE)\b/i,
  "number": /\b0x[\da-f]+\b|\b\d+(?:\.\d*)?|\B\.\d+\b/i,
  "operator": /[-+*\/=%^~]|&&?|\|\|?|!=?|<(?:=>?|<|>)?|>[>=]?|\b(?:AND|BETWEEN|DIV|ILIKE|IN|IS|LIKE|NOT|OR|REGEXP|RLIKE|SOUNDS LIKE|XOR)\b/i,
  "punctuation": /[;[\]()`,.]/
};

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-python.js
Prism.languages.python = {
  "comment": {
    pattern: /(^|[^\\])#.*/,
    lookbehind: true,
    greedy: true
  },
  "string-interpolation": {
    pattern: /(?:f|fr|rf)(?:("""|''')[\s\S]*?\1|("|')(?:\\.|(?!\2)[^\\\r\n])*\2)/i,
    greedy: true,
    inside: {
      "interpolation": {
        // "{" <expression> <optional "!s", "!r", or "!a"> <optional ":" format specifier> "}"
        pattern: /((?:^|[^{])(?:\{\{)*)\{(?!\{)(?:[^{}]|\{(?!\{)(?:[^{}]|\{(?!\{)(?:[^{}])+\})+\})+\}/,
        lookbehind: true,
        inside: {
          "format-spec": {
            pattern: /(:)[^:(){}]+(?=\}$)/,
            lookbehind: true
          },
          "conversion-option": {
            pattern: /![sra](?=[:}]$)/,
            alias: "punctuation"
          },
          rest: null
        }
      },
      "string": /[\s\S]+/
    }
  },
  "triple-quoted-string": {
    pattern: /(?:[rub]|br|rb)?("""|''')[\s\S]*?\1/i,
    greedy: true,
    alias: "string"
  },
  "string": {
    pattern: /(?:[rub]|br|rb)?("|')(?:\\.|(?!\1)[^\\\r\n])*\1/i,
    greedy: true
  },
  "function": {
    pattern: /((?:^|\s)def[ \t]+)[a-zA-Z_]\w*(?=\s*\()/g,
    lookbehind: true
  },
  "class-name": {
    pattern: /(\bclass\s+)\w+/i,
    lookbehind: true
  },
  "decorator": {
    pattern: /(^[\t ]*)@\w+(?:\.\w+)*/m,
    lookbehind: true,
    alias: ["annotation", "punctuation"],
    inside: {
      "punctuation": /\./
    }
  },
  "keyword": /\b(?:_(?=\s*:)|and|as|assert|async|await|break|case|class|continue|def|del|elif|else|except|exec|finally|for|from|global|if|import|in|is|lambda|match|nonlocal|not|or|pass|print|raise|return|try|while|with|yield)\b/,
  "builtin": /\b(?:__import__|abs|all|any|apply|ascii|basestring|bin|bool|buffer|bytearray|bytes|callable|chr|classmethod|cmp|coerce|compile|complex|delattr|dict|dir|divmod|enumerate|eval|execfile|file|filter|float|format|frozenset|getattr|globals|hasattr|hash|help|hex|id|input|int|intern|isinstance|issubclass|iter|len|list|locals|long|map|max|memoryview|min|next|object|oct|open|ord|pow|property|range|raw_input|reduce|reload|repr|reversed|round|set|setattr|slice|sorted|staticmethod|str|sum|super|tuple|type|unichr|unicode|vars|xrange|zip)\b/,
  "boolean": /\b(?:False|None|True)\b/,
  "number": /\b0(?:b(?:_?[01])+|o(?:_?[0-7])+|x(?:_?[a-f0-9])+)\b|(?:\b\d+(?:_\d+)*(?:\.(?:\d+(?:_\d+)*)?)?|\B\.\d+(?:_\d+)*)(?:e[+-]?\d+(?:_\d+)*)?j?(?!\w)/i,
  "operator": /[-+%=]=?|!=|:=|\*\*?=?|\/\/?=?|<[<=>]?|>[=>]?|[&|^~]/,
  "punctuation": /[{}[\];(),.:]/
};
Prism.languages.python["string-interpolation"].inside["interpolation"].inside.rest = Prism.languages.python;
Prism.languages.py = Prism.languages.python;

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-lua.js
Prism.languages.lua = {
  "comment": /^#!.+|--(?:\[(=*)\[[\s\S]*?\]\1\]|.*)/m,
  // \z may be used to skip the following space
  "string": {
    pattern: /(["'])(?:(?!\1)[^\\\r\n]|\\z(?:\r\n|\s)|\\(?:\r\n|[^z]))*\1|\[(=*)\[[\s\S]*?\]\2\]/,
    greedy: true
  },
  "number": /\b0x[a-f\d]+(?:\.[a-f\d]*)?(?:p[+-]?\d+)?\b|\b\d+(?:\.\B|(?:\.\d*)?(?:e[+-]?\d+)?\b)|\B\.\d+(?:e[+-]?\d+)?\b/i,
  "keyword": /\b(?:and|break|do|else|elseif|end|false|for|function|goto|if|in|local|nil|not|or|repeat|return|then|true|until|while)\b/,
  "function": /(?!\d)\w+(?=\s*(?:[({]))/,
  "operator": [
    /[-+*%^&|#]|\/\/?|<[<=]?|>[>=]?|[=~]=?/,
    {
      // Match ".." but don't break "..."
      pattern: /(^|[^.])\.\.(?!\.)/,
      lookbehind: true
    }
  ],
  "punctuation": /[\[\](){},;]|\.+|:+/
};

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-scheme.js
(function(Prism3) {
  Prism3.languages.scheme = {
    // this supports "normal" single-line comments:
    //   ; comment
    // and (potentially nested) multiline comments:
    //   #| comment #| nested |# still comment |#
    // (only 1 level of nesting is supported)
    "comment": /;.*|#;\s*(?:\((?:[^()]|\([^()]*\))*\)|\[(?:[^\[\]]|\[[^\[\]]*\])*\])|#\|(?:[^#|]|#(?!\|)|\|(?!#)|#\|(?:[^#|]|#(?!\|)|\|(?!#))*\|#)*\|#/,
    "string": {
      pattern: /"(?:[^"\\]|\\.)*"/,
      greedy: true
    },
    "symbol": {
      pattern: /'[^()\[\]#'\s]+/,
      greedy: true
    },
    "char": {
      pattern: /#\\(?:[ux][a-fA-F\d]+\b|[-a-zA-Z]+\b|[\uD800-\uDBFF][\uDC00-\uDFFF]|\S)/,
      greedy: true
    },
    "lambda-parameter": [
      // https://www.cs.cmu.edu/Groups/AI/html/r4rs/r4rs_6.html#SEC30
      {
        pattern: /((?:^|[^'`#])[(\[]lambda\s+)(?:[^|()\[\]'\s]+|\|(?:[^\\|]|\\.)*\|)/,
        lookbehind: true
      },
      {
        pattern: /((?:^|[^'`#])[(\[]lambda\s+[(\[])[^()\[\]']+/,
        lookbehind: true
      }
    ],
    "keyword": {
      pattern: /((?:^|[^'`#])[(\[])(?:begin|case(?:-lambda)?|cond(?:-expand)?|define(?:-library|-macro|-record-type|-syntax|-values)?|defmacro|delay(?:-force)?|do|else|except|export|guard|if|import|include(?:-ci|-library-declarations)?|lambda|let(?:rec)?(?:-syntax|-values|\*)?|let\*-values|only|parameterize|prefix|(?:quasi-?)?quote|rename|set!|syntax-(?:case|rules)|unless|unquote(?:-splicing)?|when)(?=[()\[\]\s]|$)/,
      lookbehind: true
    },
    "builtin": {
      // all functions of the base library of R7RS plus some of built-ins of R5Rs
      pattern: /((?:^|[^'`#])[(\[])(?:abs|and|append|apply|assoc|ass[qv]|binary-port\?|boolean=?\?|bytevector(?:-append|-copy|-copy!|-length|-u8-ref|-u8-set!|\?)?|caar|cadr|call-with-(?:current-continuation|port|values)|call\/cc|car|cdar|cddr|cdr|ceiling|char(?:->integer|-ready\?|\?|<\?|<=\?|=\?|>\?|>=\?)|close-(?:input-port|output-port|port)|complex\?|cons|current-(?:error|input|output)-port|denominator|dynamic-wind|eof-object\??|eq\?|equal\?|eqv\?|error|error-object(?:-irritants|-message|\?)|eval|even\?|exact(?:-integer-sqrt|-integer\?|\?)?|expt|features|file-error\?|floor(?:-quotient|-remainder|\/)?|flush-output-port|for-each|gcd|get-output-(?:bytevector|string)|inexact\??|input-port(?:-open\?|\?)|integer(?:->char|\?)|lcm|length|list(?:->string|->vector|-copy|-ref|-set!|-tail|\?)?|make-(?:bytevector|list|parameter|string|vector)|map|max|member|memq|memv|min|modulo|negative\?|newline|not|null\?|number(?:->string|\?)|numerator|odd\?|open-(?:input|output)-(?:bytevector|string)|or|output-port(?:-open\?|\?)|pair\?|peek-char|peek-u8|port\?|positive\?|procedure\?|quotient|raise|raise-continuable|rational\?|rationalize|read-(?:bytevector|bytevector!|char|error\?|line|string|u8)|real\?|remainder|reverse|round|set-c[ad]r!|square|string(?:->list|->number|->symbol|->utf8|->vector|-append|-copy|-copy!|-fill!|-for-each|-length|-map|-ref|-set!|\?|<\?|<=\?|=\?|>\?|>=\?)?|substring|symbol(?:->string|\?|=\?)|syntax-error|textual-port\?|truncate(?:-quotient|-remainder|\/)?|u8-ready\?|utf8->string|values|vector(?:->list|->string|-append|-copy|-copy!|-fill!|-for-each|-length|-map|-ref|-set!|\?)?|with-exception-handler|write-(?:bytevector|char|string|u8)|zero\?)(?=[()\[\]\s]|$)/,
      lookbehind: true
    },
    "operator": {
      pattern: /((?:^|[^'`#])[(\[])(?:[-+*%/]|[<>]=?|=>?)(?=[()\[\]\s]|$)/,
      lookbehind: true
    },
    "number": {
      // The number pattern from [the R7RS spec](https://small.r7rs.org/attachment/r7rs.pdf).
      //
      // <number>      := <num 2>|<num 8>|<num 10>|<num 16>
      // <num R>       := <prefix R><complex R>
      // <complex R>   := <real R>(?:@<real R>|<imaginary R>)?|<imaginary R>
      // <imaginary R> := [+-](?:<ureal R>|(?:inf|nan)\.0)?i
      // <real R>      := [+-]?<ureal R>|[+-](?:inf|nan)\.0
      // <ureal R>     := <uint R>(?:\/<uint R>)?
      //                | <decimal R>
      //
      // <decimal 10>  := (?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?
      // <uint R>      := <digit R>+
      // <prefix R>    := <radix R>(?:#[ei])?|(?:#[ei])?<radix R>
      // <radix 2>     := #b
      // <radix 8>     := #o
      // <radix 10>    := (?:#d)?
      // <radix 16>    := #x
      // <digit 2>     := [01]
      // <digit 8>     := [0-7]
      // <digit 10>    := \d
      // <digit 16>    := [0-9a-f]
      //
      // The problem with this grammar is that the resulting regex is way to complex, so we simplify by grouping all
      // non-decimal bases together. This results in a decimal (dec) and combined binary, octal, and hexadecimal (box)
      // pattern:
      pattern: RegExp(SortedBNF({
        "<ureal dec>": /\d+(?:\/\d+)|(?:\d+(?:\.\d*)?|\.\d+)(?:[esfdl][+-]?\d+)?/.source,
        "<real dec>": /[+-]?<ureal dec>|[+-](?:inf|nan)\.0/.source,
        "<imaginary dec>": /[+-](?:<ureal dec>|(?:inf|nan)\.0)?i/.source,
        "<complex dec>": /<real dec>(?:@<real dec>|<imaginary dec>)?|<imaginary dec>/.source,
        "<num dec>": /(?:#d(?:#[ei])?|#[ei](?:#d)?)?<complex dec>/.source,
        "<ureal box>": /[0-9a-f]+(?:\/[0-9a-f]+)?/.source,
        "<real box>": /[+-]?<ureal box>|[+-](?:inf|nan)\.0/.source,
        "<imaginary box>": /[+-](?:<ureal box>|(?:inf|nan)\.0)?i/.source,
        "<complex box>": /<real box>(?:@<real box>|<imaginary box>)?|<imaginary box>/.source,
        "<num box>": /#[box](?:#[ei])?|(?:#[ei])?#[box]<complex box>/.source,
        "<number>": /(^|[()\[\]\s])(?:<num dec>|<num box>)(?=[()\[\]\s]|$)/.source
      }), "i"),
      lookbehind: true
    },
    "boolean": {
      pattern: /(^|[()\[\]\s])#(?:[ft]|false|true)(?=[()\[\]\s]|$)/,
      lookbehind: true
    },
    "function": {
      pattern: /((?:^|[^'`#])[(\[])(?:[^|()\[\]'\s]+|\|(?:[^\\|]|\\.)*\|)(?=[()\[\]\s]|$)/,
      lookbehind: true
    },
    "identifier": {
      pattern: /(^|[()\[\]\s])\|(?:[^\\|]|\\.)*\|(?=[()\[\]\s]|$)/,
      lookbehind: true,
      greedy: true
    },
    "punctuation": /[()\[\]']/
  };
  function SortedBNF(grammar) {
    for (var key in grammar) {
      grammar[key] = grammar[key].replace(/<[\w\s]+>/g, function(key2) {
        return "(?:" + grammar[key2].trim() + ")";
      });
    }
    return grammar[key];
  }
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-uri.js
Prism.languages.uri = {
  "scheme": {
    pattern: /^[a-z][a-z0-9+.-]*:/im,
    greedy: true,
    inside: {
      "scheme-delimiter": /:$/
    }
  },
  "fragment": {
    pattern: /#[\w\-.~!$&'()*+,;=%:@/?]*/,
    inside: {
      "fragment-delimiter": /^#/
    }
  },
  "query": {
    pattern: /\?[\w\-.~!$&'()*+,;=%:@/?]*/,
    inside: {
      "query-delimiter": {
        pattern: /^\?/,
        greedy: true
      },
      "pair-delimiter": /[&;]/,
      "pair": {
        pattern: /^[^=][\s\S]*/,
        inside: {
          "key": /^[^=]+/,
          "value": {
            pattern: /(^=)[\s\S]+/,
            lookbehind: true
          }
        }
      }
    }
  },
  "authority": {
    pattern: RegExp(
      /^\/\//.source + /(?:[\w\-.~!$&'()*+,;=%:]*@)?/.source + ("(?:" + /\[(?:[0-9a-fA-F:.]{2,48}|v[0-9a-fA-F]+\.[\w\-.~!$&'()*+,;=]+)\]/.source + "|" + /[\w\-.~!$&'()*+,;=%]*/.source + ")") + /(?::\d*)?/.source,
      "m"
    ),
    inside: {
      "authority-delimiter": /^\/\//,
      "user-info-segment": {
        pattern: /^[\w\-.~!$&'()*+,;=%:]*@/,
        inside: {
          "user-info-delimiter": /@$/,
          "user-info": /^[\w\-.~!$&'()*+,;=%:]+/
        }
      },
      "port-segment": {
        pattern: /:\d*$/,
        inside: {
          "port-delimiter": /^:/,
          "port": /^\d+/
        }
      },
      "host": {
        pattern: /[\s\S]+/,
        inside: {
          "ip-literal": {
            pattern: /^\[[\s\S]+\]$/,
            inside: {
              "ip-literal-delimiter": /^\[|\]$/,
              "ipv-future": /^v[\s\S]+/,
              "ipv6-address": /^[\s\S]+/
            }
          },
          "ipv4-address": /^(?:(?:[03-9]\d?|[12]\d{0,2})\.){3}(?:[03-9]\d?|[12]\d{0,2})$/
        }
      }
    }
  },
  "path": {
    pattern: /^[\w\-.~!$&'()*+,;=%:@/]+/m,
    inside: {
      "path-separator": /\//
    }
  }
};
Prism.languages.url = Prism.languages.uri;

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-stylus.js
(function(Prism3) {
  var unit = {
    pattern: /(\b\d+)(?:%|[a-z]+)/,
    lookbehind: true
  };
  var number = {
    pattern: /(^|[^\w.-])-?(?:\d+(?:\.\d+)?|\.\d+)/,
    lookbehind: true
  };
  var inside = {
    "comment": {
      pattern: /(^|[^\\])(?:\/\*[\s\S]*?\*\/|\/\/.*)/,
      lookbehind: true
    },
    "url": {
      pattern: /\burl\((["']?).*?\1\)/i,
      greedy: true
    },
    "string": {
      pattern: /("|')(?:(?!\1)[^\\\r\n]|\\(?:\r\n|[\s\S]))*\1/,
      greedy: true
    },
    "interpolation": null,
    // See below
    "func": null,
    // See below
    "important": /\B!(?:important|optional)\b/i,
    "keyword": {
      pattern: /(^|\s+)(?:(?:else|for|if|return|unless)(?=\s|$)|@[\w-]+)/,
      lookbehind: true
    },
    "hexcode": /#[\da-f]{3,6}/i,
    "color": [
      /\b(?:AliceBlue|AntiqueWhite|Aqua|Aquamarine|Azure|Beige|Bisque|Black|BlanchedAlmond|Blue|BlueViolet|Brown|BurlyWood|CadetBlue|Chartreuse|Chocolate|Coral|CornflowerBlue|Cornsilk|Crimson|Cyan|DarkBlue|DarkCyan|DarkGoldenRod|DarkGr[ae]y|DarkGreen|DarkKhaki|DarkMagenta|DarkOliveGreen|DarkOrange|DarkOrchid|DarkRed|DarkSalmon|DarkSeaGreen|DarkSlateBlue|DarkSlateGr[ae]y|DarkTurquoise|DarkViolet|DeepPink|DeepSkyBlue|DimGr[ae]y|DodgerBlue|FireBrick|FloralWhite|ForestGreen|Fuchsia|Gainsboro|GhostWhite|Gold|GoldenRod|Gr[ae]y|Green|GreenYellow|HoneyDew|HotPink|IndianRed|Indigo|Ivory|Khaki|Lavender|LavenderBlush|LawnGreen|LemonChiffon|LightBlue|LightCoral|LightCyan|LightGoldenRodYellow|LightGr[ae]y|LightGreen|LightPink|LightSalmon|LightSeaGreen|LightSkyBlue|LightSlateGr[ae]y|LightSteelBlue|LightYellow|Lime|LimeGreen|Linen|Magenta|Maroon|MediumAquaMarine|MediumBlue|MediumOrchid|MediumPurple|MediumSeaGreen|MediumSlateBlue|MediumSpringGreen|MediumTurquoise|MediumVioletRed|MidnightBlue|MintCream|MistyRose|Moccasin|NavajoWhite|Navy|OldLace|Olive|OliveDrab|Orange|OrangeRed|Orchid|PaleGoldenRod|PaleGreen|PaleTurquoise|PaleVioletRed|PapayaWhip|PeachPuff|Peru|Pink|Plum|PowderBlue|Purple|Red|RosyBrown|RoyalBlue|SaddleBrown|Salmon|SandyBrown|SeaGreen|SeaShell|Sienna|Silver|SkyBlue|SlateBlue|SlateGr[ae]y|Snow|SpringGreen|SteelBlue|Tan|Teal|Thistle|Tomato|Transparent|Turquoise|Violet|Wheat|White|WhiteSmoke|Yellow|YellowGreen)\b/i,
      {
        pattern: /\b(?:hsl|rgb)\(\s*\d{1,3}\s*,\s*\d{1,3}%?\s*,\s*\d{1,3}%?\s*\)\B|\b(?:hsl|rgb)a\(\s*\d{1,3}\s*,\s*\d{1,3}%?\s*,\s*\d{1,3}%?\s*,\s*(?:0|0?\.\d+|1)\s*\)\B/i,
        inside: {
          "unit": unit,
          "number": number,
          "function": /[\w-]+(?=\()/,
          "punctuation": /[(),]/
        }
      }
    ],
    "entity": /\\[\da-f]{1,8}/i,
    "unit": unit,
    "boolean": /\b(?:false|true)\b/,
    "operator": [
      // We want non-word chars around "-" because it is
      // accepted in property names.
      /~|[+!\/%<>?=]=?|[-:]=|\*[*=]?|\.{2,3}|&&|\|\||\B-\B|\b(?:and|in|is(?: a| defined| not|nt)?|not|or)\b/
    ],
    "number": number,
    "punctuation": /[{}()\[\];:,]/
  };
  inside["interpolation"] = {
    pattern: /\{[^\r\n}:]+\}/,
    alias: "variable",
    inside: {
      "delimiter": {
        pattern: /^\{|\}$/,
        alias: "punctuation"
      },
      rest: inside
    }
  };
  inside["func"] = {
    pattern: /[\w-]+\([^)]*\).*/,
    inside: {
      "function": /^[^(]+/,
      rest: inside
    }
  };
  Prism3.languages.stylus = {
    "atrule-declaration": {
      pattern: /(^[ \t]*)@.+/m,
      lookbehind: true,
      inside: {
        "atrule": /^@[\w-]+/,
        rest: inside
      }
    },
    "variable-declaration": {
      pattern: /(^[ \t]*)[\w$-]+\s*.?=[ \t]*(?:\{[^{}]*\}|\S.*|$)/m,
      lookbehind: true,
      inside: {
        "variable": /^\S+/,
        rest: inside
      }
    },
    "statement": {
      pattern: /(^[ \t]*)(?:else|for|if|return|unless)[ \t].+/m,
      lookbehind: true,
      inside: {
        "keyword": /^\S+/,
        rest: inside
      }
    },
    // A property/value pair cannot end with a comma or a brace
    // It cannot have indented content unless it ended with a semicolon
    "property-declaration": {
      pattern: /((?:^|\{)([ \t]*))(?:[\w-]|\{[^}\r\n]+\})+(?:\s*:\s*|[ \t]+)(?!\s)[^{\r\n]*(?:;|[^{\r\n,]$(?!(?:\r?\n|\r)(?:\{|\2[ \t])))/m,
      lookbehind: true,
      inside: {
        "property": {
          pattern: /^[^\s:]+/,
          inside: {
            "interpolation": inside.interpolation
          }
        },
        rest: inside
      }
    },
    // A selector can contain parentheses only as part of a pseudo-element
    // It can span multiple lines.
    // It must end with a comma or an accolade or have indented content.
    "selector": {
      pattern: /(^[ \t]*)(?:(?=\S)(?:[^{}\r\n:()]|::?[\w-]+(?:\([^)\r\n]*\)|(?![\w-]))|\{[^}\r\n]+\})+)(?:(?:\r?\n|\r)(?:\1(?:(?=\S)(?:[^{}\r\n:()]|::?[\w-]+(?:\([^)\r\n]*\)|(?![\w-]))|\{[^}\r\n]+\})+)))*(?:,$|\{|(?=(?:\r?\n|\r)(?:\{|\1[ \t])))/m,
      lookbehind: true,
      inside: {
        "interpolation": inside.interpolation,
        "comment": inside.comment,
        "punctuation": /[{},]/
      }
    },
    "func": inside.func,
    "string": inside.string,
    "comment": {
      pattern: /(^|[^\\])(?:\/\*[\s\S]*?\*\/|\/\/.*)/,
      lookbehind: true,
      greedy: true
    },
    "interpolation": inside.interpolation,
    "punctuation": /[{}()\[\];:.]/
  };
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-perl.js
(function(Prism3) {
  var brackets = /(?:\((?:[^()\\]|\\[\s\S])*\)|\{(?:[^{}\\]|\\[\s\S])*\}|\[(?:[^[\]\\]|\\[\s\S])*\]|<(?:[^<>\\]|\\[\s\S])*>)/.source;
  Prism3.languages.perl = {
    "comment": [
      {
        // POD
        pattern: /(^\s*)=\w[\s\S]*?=cut.*/m,
        lookbehind: true,
        greedy: true
      },
      {
        pattern: /(^|[^\\$])#.*/,
        lookbehind: true,
        greedy: true
      }
    ],
    // TODO Could be nice to handle Heredoc too.
    "string": [
      {
        pattern: RegExp(
          /\b(?:q|qq|qw|qx)(?![a-zA-Z0-9])\s*/.source + "(?:" + [
            // q/.../
            /([^a-zA-Z0-9\s{(\[<])(?:(?!\1)[^\\]|\\[\s\S])*\1/.source,
            // q a...a
            // eslint-disable-next-line regexp/strict
            /([a-zA-Z0-9])(?:(?!\2)[^\\]|\\[\s\S])*\2/.source,
            // q(...)
            // q{...}
            // q[...]
            // q<...>
            brackets
          ].join("|") + ")"
        ),
        greedy: true
      },
      // "...", `...`
      {
        pattern: /("|`)(?:(?!\1)[^\\]|\\[\s\S])*\1/,
        greedy: true
      },
      // '...'
      // FIXME Multi-line single-quoted strings are not supported as they would break variables containing '
      {
        pattern: /'(?:[^'\\\r\n]|\\.)*'/,
        greedy: true
      }
    ],
    "regex": [
      {
        pattern: RegExp(
          /\b(?:m|qr)(?![a-zA-Z0-9])\s*/.source + "(?:" + [
            // m/.../
            /([^a-zA-Z0-9\s{(\[<])(?:(?!\1)[^\\]|\\[\s\S])*\1/.source,
            // m a...a
            // eslint-disable-next-line regexp/strict
            /([a-zA-Z0-9])(?:(?!\2)[^\\]|\\[\s\S])*\2/.source,
            // m(...)
            // m{...}
            // m[...]
            // m<...>
            brackets
          ].join("|") + ")" + /[msixpodualngc]*/.source
        ),
        greedy: true
      },
      // The lookbehinds prevent -s from breaking
      {
        pattern: RegExp(
          /(^|[^-])\b(?:s|tr|y)(?![a-zA-Z0-9])\s*/.source + "(?:" + [
            // s/.../.../
            // eslint-disable-next-line regexp/strict
            /([^a-zA-Z0-9\s{(\[<])(?:(?!\2)[^\\]|\\[\s\S])*\2(?:(?!\2)[^\\]|\\[\s\S])*\2/.source,
            // s a...a...a
            // eslint-disable-next-line regexp/strict
            /([a-zA-Z0-9])(?:(?!\3)[^\\]|\\[\s\S])*\3(?:(?!\3)[^\\]|\\[\s\S])*\3/.source,
            // s(...)(...)
            // s{...}{...}
            // s[...][...]
            // s<...><...>
            // s(...)[...]
            brackets + /\s*/.source + brackets
          ].join("|") + ")" + /[msixpodualngcer]*/.source
        ),
        lookbehind: true,
        greedy: true
      },
      // /.../
      // The look-ahead tries to prevent two divisions on
      // the same line from being highlighted as regex.
      // This does not support multi-line regex.
      {
        pattern: /\/(?:[^\/\\\r\n]|\\.)*\/[msixpodualngc]*(?=\s*(?:$|[\r\n,.;})&|\-+*~<>!?^]|(?:and|cmp|eq|ge|gt|le|lt|ne|not|or|x|xor)\b))/,
        greedy: true
      }
    ],
    // FIXME Not sure about the handling of ::, ', and #
    "variable": [
      // ${^POSTMATCH}
      /[&*$@%]\{\^[A-Z]+\}/,
      // $^V
      /[&*$@%]\^[A-Z_]/,
      // ${...}
      /[&*$@%]#?(?=\{)/,
      // $foo
      /[&*$@%]#?(?:(?:::)*'?(?!\d)[\w$]+(?![\w$]))+(?:::)*/,
      // $1
      /[&*$@%]\d+/,
      // $_, @_, %!
      // The negative lookahead prevents from breaking the %= operator
      /(?!%=)[$@%][!"#$%&'()*+,\-.\/:;<=>?@[\\\]^_`{|}~]/
    ],
    "filehandle": {
      // <>, <FOO>, _
      pattern: /<(?![<=])\S*?>|\b_\b/,
      alias: "symbol"
    },
    "v-string": {
      // v1.2, 1.2.3
      pattern: /v\d+(?:\.\d+)*|\d+(?:\.\d+){2,}/,
      alias: "string"
    },
    "function": {
      pattern: /(\bsub[ \t]+)\w+/,
      lookbehind: true
    },
    "keyword": /\b(?:any|break|continue|default|delete|die|do|else|elsif|eval|for|foreach|given|goto|if|last|local|my|next|our|package|print|redo|require|return|say|state|sub|switch|undef|unless|until|use|when|while)\b/,
    "number": /\b(?:0x[\dA-Fa-f](?:_?[\dA-Fa-f])*|0b[01](?:_?[01])*|(?:(?:\d(?:_?\d)*)?\.)?\d(?:_?\d)*(?:[Ee][+-]?\d+)?)\b/,
    "operator": /-[rwxoRWXOezsfdlpSbctugkTBMAC]\b|\+[+=]?|-[-=>]?|\*\*?=?|\/\/?=?|=[=~>]?|~[~=]?|\|\|?=?|&&?=?|<(?:=>?|<=?)?|>>?=?|![~=]?|[%^]=?|\.(?:=|\.\.?)?|[\\?]|\bx(?:=|\b)|\b(?:and|cmp|eq|ge|gt|le|lt|ne|not|or|xor)\b/,
    "punctuation": /[{}[\];(),:]/
  };
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-r.js
Prism.languages.r = {
  "comment": /#.*/,
  "string": {
    pattern: /(['"])(?:\\.|(?!\1)[^\\\r\n])*\1/,
    greedy: true
  },
  "percent-operator": {
    // Includes user-defined operators
    // and %%, %*%, %/%, %in%, %o%, %x%
    pattern: /%[^%\s]*%/,
    alias: "operator"
  },
  "boolean": /\b(?:FALSE|TRUE)\b/,
  "ellipsis": /\.\.(?:\.|\d+)/,
  "number": [
    /\b(?:Inf|NaN)\b/,
    /(?:\b0x[\dA-Fa-f]+(?:\.\d*)?|\b\d+(?:\.\d*)?|\B\.\d+)(?:[EePp][+-]?\d+)?[iL]?/
  ],
  "keyword": /\b(?:NA|NA_character_|NA_complex_|NA_integer_|NA_real_|NULL|break|else|for|function|if|in|next|repeat|while)\b/,
  "operator": /->?>?|<(?:=|<?-)?|[>=!]=?|::?|&&?|\|\|?|[+*\/^$@~]/,
  "punctuation": /[(){}\[\],;]/
};

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-julia.js
Prism.languages.julia = {
  "comment": {
    // support one level of nested comments
    // https://github.com/JuliaLang/julia/pull/6128
    pattern: /(^|[^\\])(?:#=(?:[^#=]|=(?!#)|#(?!=)|#=(?:[^#=]|=(?!#)|#(?!=))*=#)*=#|#.*)/,
    lookbehind: true
  },
  "regex": {
    // https://docs.julialang.org/en/v1/manual/strings/#Regular-Expressions-1
    pattern: /r"(?:\\.|[^"\\\r\n])*"[imsx]{0,4}/,
    greedy: true
  },
  "string": {
    // https://docs.julialang.org/en/v1/manual/strings/#String-Basics-1
    // https://docs.julialang.org/en/v1/manual/strings/#non-standard-string-literals-1
    // https://docs.julialang.org/en/v1/manual/running-external-programs/#Running-External-Programs-1
    pattern: /"""[\s\S]+?"""|(?:\b\w+)?"(?:\\.|[^"\\\r\n])*"|`(?:[^\\`\r\n]|\\.)*`/,
    greedy: true
  },
  "char": {
    // https://docs.julialang.org/en/v1/manual/strings/#man-characters-1
    pattern: /(^|[^\w'])'(?:\\[^\r\n][^'\r\n]*|[^\\\r\n])'/,
    lookbehind: true,
    greedy: true
  },
  "keyword": /\b(?:abstract|baremodule|begin|bitstype|break|catch|ccall|const|continue|do|else|elseif|end|export|finally|for|function|global|if|immutable|import|importall|in|let|local|macro|module|print|println|quote|return|struct|try|type|typealias|using|while)\b/,
  "boolean": /\b(?:false|true)\b/,
  "number": /(?:\b(?=\d)|\B(?=\.))(?:0[box])?(?:[\da-f]+(?:_[\da-f]+)*(?:\.(?:\d+(?:_\d+)*)?)?|\.\d+(?:_\d+)*)(?:[efp][+-]?\d+(?:_\d+)*)?j?/i,
  // https://docs.julialang.org/en/v1/manual/mathematical-operations/
  // https://docs.julialang.org/en/v1/manual/mathematical-operations/#Operator-Precedence-and-Associativity-1
  "operator": /&&|\|\||[-+*^%÷⊻&$\\]=?|\/[\/=]?|!=?=?|\|[=>]?|<(?:<=?|[=:|])?|>(?:=|>>?=?)?|==?=?|[~≠≤≥'√∛]/,
  "punctuation": /::?|[{}[\]();,.?]/,
  // https://docs.julialang.org/en/v1/base/numbers/#Base.im
  "constant": /\b(?:(?:Inf|NaN)(?:16|32|64)?|im|pi)\b|[πℯ]/
};

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-matlab.js
Prism.languages.matlab = {
  "comment": [
    /%\{[\s\S]*?\}%/,
    /%.+/
  ],
  "string": {
    pattern: /\B'(?:''|[^'\r\n])*'/,
    greedy: true
  },
  // FIXME We could handle imaginary numbers as a whole
  "number": /(?:\b\d+(?:\.\d*)?|\B\.\d+)(?:[eE][+-]?\d+)?(?:[ij])?|\b[ij]\b/,
  "keyword": /\b(?:NaN|break|case|catch|continue|else|elseif|end|for|function|if|inf|otherwise|parfor|pause|pi|return|switch|try|while)\b/,
  "function": /\b(?!\d)\w+(?=\s*\()/,
  "operator": /\.?[*^\/\\']|[+\-:@]|[<>=~]=?|&&?|\|\|?/,
  "punctuation": /\.{3}|[.,;\[\](){}!]/
};

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-clojure.js
Prism.languages.clojure = {
  "comment": {
    pattern: /;.*/,
    greedy: true
  },
  "string": {
    pattern: /"(?:[^"\\]|\\.)*"/,
    greedy: true
  },
  "char": /\\\w+/,
  "symbol": {
    pattern: /(^|[\s()\[\]{},])::?[\w*+!?'<>=/.-]+/,
    lookbehind: true
  },
  "keyword": {
    pattern: /(\()(?:-|->|->>|\.|\.\.|\*|\/|\+|<|<=|=|==|>|>=|accessor|agent|agent-errors|aget|alength|all-ns|alter|and|append-child|apply|array-map|aset|aset-boolean|aset-byte|aset-char|aset-double|aset-float|aset-int|aset-long|aset-short|assert|assoc|await|await-for|bean|binding|bit-and|bit-not|bit-or|bit-shift-left|bit-shift-right|bit-xor|boolean|branch\?|butlast|byte|cast|char|children|class|clear-agent-errors|comment|commute|comp|comparator|complement|concat|cond|conj|cons|constantly|construct-proxy|contains\?|count|create-ns|create-struct|cycle|dec|declare|def|def-|definline|definterface|defmacro|defmethod|defmulti|defn|defn-|defonce|defproject|defprotocol|defrecord|defstruct|deftype|deref|difference|disj|dissoc|distinct|do|doall|doc|dorun|doseq|dosync|dotimes|doto|double|down|drop|drop-while|edit|end\?|ensure|eval|every\?|false\?|ffirst|file-seq|filter|find|find-doc|find-ns|find-var|first|float|flush|fn|fnseq|for|frest|gensym|get|get-proxy-class|hash-map|hash-set|identical\?|identity|if|if-let|if-not|import|in-ns|inc|index|insert-child|insert-left|insert-right|inspect-table|inspect-tree|instance\?|int|interleave|intersection|into|into-array|iterate|join|key|keys|keyword|keyword\?|last|lazy-cat|lazy-cons|left|lefts|let|line-seq|list|list\*|load|load-file|locking|long|loop|macroexpand|macroexpand-1|make-array|make-node|map|map-invert|map\?|mapcat|max|max-key|memfn|merge|merge-with|meta|min|min-key|monitor-enter|name|namespace|neg\?|new|newline|next|nil\?|node|not|not-any\?|not-every\?|not=|ns|ns-imports|ns-interns|ns-map|ns-name|ns-publics|ns-refers|ns-resolve|ns-unmap|nth|nthrest|or|parse|partial|path|peek|pop|pos\?|pr|pr-str|print|print-str|println|println-str|prn|prn-str|project|proxy|proxy-mappings|quot|quote|rand|rand-int|range|re-find|re-groups|re-matcher|re-matches|re-pattern|re-seq|read|read-line|recur|reduce|ref|ref-set|refer|rem|remove|remove-method|remove-ns|rename|rename-keys|repeat|replace|replicate|resolve|rest|resultset-seq|reverse|rfirst|right|rights|root|rrest|rseq|second|select|select-keys|send|send-off|seq|seq-zip|seq\?|set|set!|short|slurp|some|sort|sort-by|sorted-map|sorted-map-by|sorted-set|special-symbol\?|split-at|split-with|str|string\?|struct|struct-map|subs|subvec|symbol|symbol\?|sync|take|take-nth|take-while|test|throw|time|to-array|to-array-2d|tree-seq|true\?|try|union|up|update-proxy|val|vals|var|var-get|var-set|var\?|vector|vector-zip|vector\?|when|when-first|when-let|when-not|with-local-vars|with-meta|with-open|with-out-str|xml-seq|xml-zip|zero\?|zipmap|zipper)(?=[\s)]|$)/,
    lookbehind: true
  },
  "boolean": /\b(?:false|nil|true)\b/,
  "number": {
    pattern: /(^|[^\w$@])(?:\d+(?:[/.]\d+)?(?:e[+-]?\d+)?|0x[a-f0-9]+|[1-9]\d?r[a-z0-9]+)[lmn]?(?![\w$@])/i,
    lookbehind: true
  },
  "function": {
    pattern: /((?:^|[^'])\()[\w*+!?'<>=/.-]+(?=[\s)]|$)/,
    lookbehind: true
  },
  "operator": /[#@^`~]/,
  "punctuation": /[{}\[\](),]/
};

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-elm.js
Prism.languages.elm = {
  "comment": /--.*|\{-[\s\S]*?-\}/,
  "char": {
    pattern: /'(?:[^\\'\r\n]|\\(?:[abfnrtv\\']|\d+|x[0-9a-fA-F]+|u\{[0-9a-fA-F]+\}))'/,
    greedy: true
  },
  "string": [
    {
      // Multiline strings are wrapped in triple ". Quotes may appear unescaped.
      pattern: /"""[\s\S]*?"""/,
      greedy: true
    },
    {
      pattern: /"(?:[^\\"\r\n]|\\.)*"/,
      greedy: true
    }
  ],
  "import-statement": {
    // The imported or hidden names are not included in this import
    // statement. This is because we want to highlight those exactly like
    // we do for the names in the program.
    pattern: /(^[\t ]*)import\s+[A-Z]\w*(?:\.[A-Z]\w*)*(?:\s+as\s+(?:[A-Z]\w*)(?:\.[A-Z]\w*)*)?(?:\s+exposing\s+)?/m,
    lookbehind: true,
    inside: {
      "keyword": /\b(?:as|exposing|import)\b/
    }
  },
  "keyword": /\b(?:alias|as|case|else|exposing|if|in|infixl|infixr|let|module|of|then|type)\b/,
  // These are builtin variables only. Constructors are highlighted later as a constant.
  "builtin": /\b(?:abs|acos|always|asin|atan|atan2|ceiling|clamp|compare|cos|curry|degrees|e|flip|floor|fromPolar|identity|isInfinite|isNaN|logBase|max|min|negate|never|not|pi|radians|rem|round|sin|sqrt|tan|toFloat|toPolar|toString|truncate|turns|uncurry|xor)\b/,
  // decimal integers and floating point numbers | hexadecimal integers
  "number": /\b(?:\d+(?:\.\d+)?(?:e[+-]?\d+)?|0x[0-9a-f]+)\b/i,
  // Most of this is needed because of the meaning of a single '.'.
  // If it stands alone freely, it is the function composition.
  // It may also be a separator between a module name and an identifier => no
  // operator. If it comes together with other special characters it is an
  // operator too.
  // Valid operator characters in 0.18: +-/*=.$<>:&|^?%#@~!
  // Ref: https://groups.google.com/forum/#!msg/elm-dev/0AHSnDdkSkQ/E0SVU70JEQAJ
  "operator": /\s\.\s|[+\-/*=.$<>:&|^?%#@~!]{2,}|[+\-/*=$<>:&|^?%#@~!]/,
  // In Elm, nearly everything is a variable, do not highlight these.
  "hvariable": /\b(?:[A-Z]\w*\.)*[a-z]\w*\b/,
  "constant": /\b(?:[A-Z]\w*\.)*[A-Z]\w*\b/,
  "punctuation": /[{}[\]|(),.:]/
};

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-ocaml.js
Prism.languages.ocaml = {
  "comment": {
    pattern: /\(\*[\s\S]*?\*\)/,
    greedy: true
  },
  "char": {
    pattern: /'(?:[^\\\r\n']|\\(?:.|[ox]?[0-9a-f]{1,3}))'/i,
    greedy: true
  },
  "string": [
    {
      pattern: /"(?:\\(?:[\s\S]|\r\n)|[^\\\r\n"])*"/,
      greedy: true
    },
    {
      pattern: /\{([a-z_]*)\|[\s\S]*?\|\1\}/,
      greedy: true
    }
  ],
  "number": [
    // binary and octal
    /\b(?:0b[01][01_]*|0o[0-7][0-7_]*)\b/i,
    // hexadecimal
    /\b0x[a-f0-9][a-f0-9_]*(?:\.[a-f0-9_]*)?(?:p[+-]?\d[\d_]*)?(?!\w)/i,
    // decimal
    /\b\d[\d_]*(?:\.[\d_]*)?(?:e[+-]?\d[\d_]*)?(?!\w)/i
  ],
  "directive": {
    pattern: /\B#\w+/,
    alias: "property"
  },
  "label": {
    pattern: /\B~\w+/,
    alias: "property"
  },
  "type-variable": {
    pattern: /\B'\w+/,
    alias: "function"
  },
  "variant": {
    pattern: /`\w+/,
    alias: "symbol"
  },
  // For the list of keywords and operators,
  // see: http://caml.inria.fr/pub/docs/manual-ocaml/lex.html#sec84
  "keyword": /\b(?:as|assert|begin|class|constraint|do|done|downto|else|end|exception|external|for|fun|function|functor|if|in|include|inherit|initializer|lazy|let|match|method|module|mutable|new|nonrec|object|of|open|private|rec|sig|struct|then|to|try|type|val|value|virtual|when|where|while|with)\b/,
  "boolean": /\b(?:false|true)\b/,
  "operator-like-punctuation": {
    pattern: /\[[<>|]|[>|]\]|\{<|>\}/,
    alias: "punctuation"
  },
  // Custom operators are allowed
  "operator": /\.[.~]|:[=>]|[=<>@^|&+\-*\/$%!?~][!$%&*+\-.\/:<=>?@^|~]*|\b(?:and|asr|land|lor|lsl|lsr|lxor|mod|or)\b/,
  "punctuation": /;;|::|[(){}\[\].,:;#]|\b_\b/
};

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-lisp.js
(function(Prism3) {
  function simple_form(name) {
    return RegExp(/(\()/.source + "(?:" + name + ")" + /(?=[\s\)])/.source);
  }
  function primitive(pattern) {
    return RegExp(/([\s([])/.source + "(?:" + pattern + ")" + /(?=[\s)])/.source);
  }
  var symbol = /(?!\d)[-+*/~!@$%^=<>{}\w]+/.source;
  var marker = "&" + symbol;
  var par = "(\\()";
  var endpar = "(?=\\))";
  var space = "(?=\\s)";
  var nestedPar = /(?:[^()]|\((?:[^()]|\((?:[^()]|\((?:[^()]|\((?:[^()]|\([^()]*\))*\))*\))*\))*\))*/.source;
  var language = {
    // Three or four semicolons are considered a heading.
    // See https://www.gnu.org/software/emacs/manual/html_node/elisp/Comment-Tips.html
    heading: {
      pattern: /;;;.*/,
      alias: ["comment", "title"]
    },
    comment: /;.*/,
    string: {
      pattern: /"(?:[^"\\]|\\.)*"/,
      greedy: true,
      inside: {
        argument: /[-A-Z]+(?=[.,\s])/,
        symbol: RegExp("`" + symbol + "'")
      }
    },
    "quoted-symbol": {
      pattern: RegExp("#?'" + symbol),
      alias: ["variable", "symbol"]
    },
    "lisp-property": {
      pattern: RegExp(":" + symbol),
      alias: "property"
    },
    splice: {
      pattern: RegExp(",@?" + symbol),
      alias: ["symbol", "variable"]
    },
    keyword: [
      {
        pattern: RegExp(
          par + "(?:and|(?:cl-)?letf|cl-loop|cond|cons|error|if|(?:lexical-)?let\\*?|message|not|null|or|provide|require|setq|unless|use-package|when|while)" + space
        ),
        lookbehind: true
      },
      {
        pattern: RegExp(
          par + "(?:append|by|collect|concat|do|finally|for|in|return)" + space
        ),
        lookbehind: true
      }
    ],
    declare: {
      pattern: simple_form(/declare/.source),
      lookbehind: true,
      alias: "keyword"
    },
    interactive: {
      pattern: simple_form(/interactive/.source),
      lookbehind: true,
      alias: "keyword"
    },
    boolean: {
      pattern: primitive(/nil|t/.source),
      lookbehind: true
    },
    number: {
      pattern: primitive(/[-+]?\d+(?:\.\d*)?/.source),
      lookbehind: true
    },
    defvar: {
      pattern: RegExp(par + "def(?:const|custom|group|var)\\s+" + symbol),
      lookbehind: true,
      inside: {
        keyword: /^def[a-z]+/,
        variable: RegExp(symbol)
      }
    },
    defun: {
      pattern: RegExp(par + /(?:cl-)?(?:defmacro|defun\*?)\s+/.source + symbol + /\s+\(/.source + nestedPar + /\)/.source),
      lookbehind: true,
      greedy: true,
      inside: {
        keyword: /^(?:cl-)?def\S+/,
        // See below, this property needs to be defined later so that it can
        // reference the language object.
        arguments: null,
        function: {
          pattern: RegExp("(^\\s)" + symbol),
          lookbehind: true
        },
        punctuation: /[()]/
      }
    },
    lambda: {
      pattern: RegExp(par + "lambda\\s+\\(\\s*(?:&?" + symbol + "(?:\\s+&?" + symbol + ")*\\s*)?\\)"),
      lookbehind: true,
      greedy: true,
      inside: {
        keyword: /^lambda/,
        // See below, this property needs to be defined later so that it can
        // reference the language object.
        arguments: null,
        punctuation: /[()]/
      }
    },
    car: {
      pattern: RegExp(par + symbol),
      lookbehind: true
    },
    punctuation: [
      // open paren, brackets, and close paren
      /(?:['`,]?\(|[)\[\]])/,
      // cons
      {
        pattern: /(\s)\.(?=\s)/,
        lookbehind: true
      }
    ]
  };
  var arg = {
    "lisp-marker": RegExp(marker),
    "varform": {
      pattern: RegExp(/\(/.source + symbol + /\s+(?=\S)/.source + nestedPar + /\)/.source),
      inside: language
    },
    "argument": {
      pattern: RegExp(/(^|[\s(])/.source + symbol),
      lookbehind: true,
      alias: "variable"
    },
    rest: language
  };
  var forms = "\\S+(?:\\s+\\S+)*";
  var arglist = {
    pattern: RegExp(par + nestedPar + endpar),
    lookbehind: true,
    inside: {
      "rest-vars": {
        pattern: RegExp("&(?:body|rest)\\s+" + forms),
        inside: arg
      },
      "other-marker-vars": {
        pattern: RegExp("&(?:aux|optional)\\s+" + forms),
        inside: arg
      },
      keys: {
        pattern: RegExp("&key\\s+" + forms + "(?:\\s+&allow-other-keys)?"),
        inside: arg
      },
      argument: {
        pattern: RegExp(symbol),
        alias: "variable"
      },
      punctuation: /[()]/
    }
  };
  language["lambda"].inside.arguments = arglist;
  language["defun"].inside.arguments = Prism3.util.clone(arglist);
  language["defun"].inside.arguments.inside.sublist = arglist;
  Prism3.languages.lisp = language;
  Prism3.languages.elisp = language;
  Prism3.languages.emacs = language;
  Prism3.languages["emacs-lisp"] = language;
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-prolog.js
Prism.languages.prolog = {
  // Syntax depends on the implementation
  "comment": {
    pattern: /\/\*[\s\S]*?\*\/|%.*/,
    greedy: true
  },
  // Depending on the implementation, strings may allow escaped newlines and quote-escape
  "string": {
    pattern: /(["'])(?:\1\1|\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1(?!\1)/,
    greedy: true
  },
  "builtin": /\b(?:fx|fy|xf[xy]?|yfx?)\b/,
  // FIXME: Should we list all null-ary predicates (not followed by a parenthesis) like halt, trace, etc.?
  "function": /\b[a-z]\w*(?:(?=\()|\/\d+)/,
  "number": /\b\d+(?:\.\d*)?/,
  // Custom operators are allowed
  "operator": /[:\\=><\-?*@\/;+^|!$.]+|\b(?:is|mod|not|xor)\b/,
  "punctuation": /[(){}\[\],]/
};

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-hcl.js
Prism.languages.hcl = {
  "comment": /(?:\/\/|#).*|\/\*[\s\S]*?(?:\*\/|$)/,
  "heredoc": {
    pattern: /<<-?(\w+\b)[\s\S]*?^[ \t]*\1/m,
    greedy: true,
    alias: "string"
  },
  "keyword": [
    {
      pattern: /(?:data|resource)\s+(?:"(?:\\[\s\S]|[^\\"])*")(?=\s+"[\w-]+"\s+\{)/i,
      inside: {
        "type": {
          pattern: /(resource|data|\s+)(?:"(?:\\[\s\S]|[^\\"])*")/i,
          lookbehind: true,
          alias: "variable"
        }
      }
    },
    {
      pattern: /(?:backend|module|output|provider|provisioner|variable)\s+(?:[\w-]+|"(?:\\[\s\S]|[^\\"])*")\s+(?=\{)/i,
      inside: {
        "type": {
          pattern: /(backend|module|output|provider|provisioner|variable)\s+(?:[\w-]+|"(?:\\[\s\S]|[^\\"])*")\s+/i,
          lookbehind: true,
          alias: "variable"
        }
      }
    },
    /[\w-]+(?=\s+\{)/
  ],
  "property": [
    /[-\w\.]+(?=\s*=(?!=))/,
    /"(?:\\[\s\S]|[^\\"])+"(?=\s*[:=])/
  ],
  "string": {
    pattern: /"(?:[^\\$"]|\\[\s\S]|\$(?:(?=")|\$+(?!\$)|[^"${])|\$\{(?:[^{}"]|"(?:[^\\"]|\\[\s\S])*")*\})*"/,
    greedy: true,
    inside: {
      "interpolation": {
        pattern: /(^|[^$])\$\{(?:[^{}"]|"(?:[^\\"]|\\[\s\S])*")*\}/,
        lookbehind: true,
        inside: {
          "type": {
            pattern: /(\b(?:count|data|local|module|path|self|terraform|var)\b\.)[\w\*]+/i,
            lookbehind: true,
            alias: "variable"
          },
          "keyword": /\b(?:count|data|local|module|path|self|terraform|var)\b/i,
          "function": /\w+(?=\()/,
          "string": {
            pattern: /"(?:\\[\s\S]|[^\\"])*"/,
            greedy: true
          },
          "number": /\b0x[\da-f]+\b|\b\d+(?:\.\d*)?(?:e[+-]?\d+)?/i,
          "punctuation": /[!\$#%&'()*+,.\/;<=>@\[\\\]^`{|}~?:]/
        }
      }
    }
  },
  "number": /\b0x[\da-f]+\b|\b\d+(?:\.\d*)?(?:e[+-]?\d+)?/i,
  "boolean": /\b(?:false|true)\b/i,
  "punctuation": /[=\[\]{}]/
};

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-bicep.js
Prism.languages.bicep = {
  "comment": [
    {
      // multiline comments eg /* ASDF */
      pattern: /(^|[^\\])\/\*[\s\S]*?(?:\*\/|$)/,
      lookbehind: true,
      greedy: true
    },
    {
      // singleline comments eg // ASDF
      pattern: /(^|[^\\:])\/\/.*/,
      lookbehind: true,
      greedy: true
    }
  ],
  "property": [
    {
      pattern: /([\r\n][ \t]*)[a-z_]\w*(?=[ \t]*:)/i,
      lookbehind: true
    },
    {
      pattern: /([\r\n][ \t]*)'(?:\\.|\$(?!\{)|[^'\\\r\n$])*'(?=[ \t]*:)/,
      lookbehind: true,
      greedy: true
    }
  ],
  "string": [
    {
      pattern: /'''[^'][\s\S]*?'''/,
      greedy: true
    },
    {
      pattern: /(^|[^\\'])'(?:\\.|\$(?!\{)|[^'\\\r\n$])*'/,
      lookbehind: true,
      greedy: true
    }
  ],
  "interpolated-string": {
    pattern: /(^|[^\\'])'(?:\\.|\$(?:(?!\{)|\{[^{}\r\n]*\})|[^'\\\r\n$])*'/,
    lookbehind: true,
    greedy: true,
    inside: {
      "interpolation": {
        pattern: /\$\{[^{}\r\n]*\}/,
        inside: {
          "expression": {
            pattern: /(^\$\{)[\s\S]+(?=\}$)/,
            lookbehind: true
          },
          "punctuation": /^\$\{|\}$/
        }
      },
      "string": /[\s\S]+/
    }
  },
  "datatype": {
    pattern: /(\b(?:output|param)\b[ \t]+\w+[ \t]+)\w+\b/,
    lookbehind: true,
    alias: "class-name"
  },
  "boolean": /\b(?:false|true)\b/,
  // https://github.com/Azure/bicep/blob/114a3251b4e6e30082a58729f19a8cc4e374ffa6/src/textmate/bicep.tmlanguage#L184
  "keyword": /\b(?:existing|for|if|in|module|null|output|param|resource|targetScope|var)\b/,
  "decorator": /@\w+\b/,
  "function": /\b[a-z_]\w*(?=[ \t]*\()/i,
  "number": /(?:\b\d+(?:\.\d*)?|\B\.\d+)(?:E[+-]?\d+)?/i,
  "operator": /--|\+\+|\*\*=?|=>|&&=?|\|\|=?|[!=]==|<<=?|>>>?=?|[-+*/%&|^!=<>]=?|\.{3}|\?\?=?|\?\.?|[~:]/,
  "punctuation": /[{}[\];(),.:]/
};
Prism.languages.bicep["interpolated-string"].inside["interpolation"].inside["expression"].inside = Prism.languages.bicep;

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-nix.js
Prism.languages.nix = {
  "comment": {
    pattern: /\/\*[\s\S]*?\*\/|#.*/,
    greedy: true
  },
  "string": {
    pattern: /"(?:[^"\\]|\\[\s\S])*"|''(?:(?!'')[\s\S]|''(?:'|\\|\$\{))*''/,
    greedy: true,
    inside: {
      "interpolation": {
        // The lookbehind ensures the ${} is not preceded by \ or ''
        pattern: /(^|(?:^|(?!'').)[^\\])\$\{(?:[^{}]|\{[^}]*\})*\}/,
        lookbehind: true,
        inside: null
        // see below
      }
    }
  },
  "url": [
    /\b(?:[a-z]{3,7}:\/\/)[\w\-+%~\/.:#=?&]+/,
    {
      pattern: /([^\/])(?:[\w\-+%~.:#=?&]*(?!\/\/)[\w\-+%~\/.:#=?&])?(?!\/\/)\/[\w\-+%~\/.:#=?&]*/,
      lookbehind: true
    }
  ],
  "antiquotation": {
    pattern: /\$(?=\{)/,
    alias: "important"
  },
  "number": /\b\d+\b/,
  "keyword": /\b(?:assert|builtins|else|if|in|inherit|let|null|or|then|with)\b/,
  "function": /\b(?:abort|add|all|any|attrNames|attrValues|baseNameOf|compareVersions|concatLists|currentSystem|deepSeq|derivation|dirOf|div|elem(?:At)?|fetch(?:Tarball|url)|filter(?:Source)?|fromJSON|genList|getAttr|getEnv|hasAttr|hashString|head|import|intersectAttrs|is(?:Attrs|Bool|Function|Int|List|Null|String)|length|lessThan|listToAttrs|map|mul|parseDrvName|pathExists|read(?:Dir|File)|removeAttrs|replaceStrings|seq|sort|stringLength|sub(?:string)?|tail|throw|to(?:File|JSON|Path|String|XML)|trace|typeOf)\b|\bfoldl'\B/,
  "boolean": /\b(?:false|true)\b/,
  "operator": /[=!<>]=?|\+\+?|\|\||&&|\/\/|->?|[?@]/,
  "punctuation": /[{}()[\].,:;]/
};
Prism.languages.nix.string.inside.interpolation.inside = Prism.languages.nix;

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-diff.js
(function(Prism3) {
  Prism3.languages.diff = {
    "coord": [
      // Match all kinds of coord lines (prefixed by "+++", "---" or "***").
      /^(?:\*{3}|-{3}|\+{3}).*$/m,
      // Match "@@ ... @@" coord lines in unified diff.
      /^@@.*@@$/m,
      // Match coord lines in normal diff (starts with a number).
      /^\d.*$/m
    ]
    // deleted, inserted, unchanged, diff
  };
  var PREFIXES = {
    "deleted-sign": "-",
    "deleted-arrow": "<",
    "inserted-sign": "+",
    "inserted-arrow": ">",
    "unchanged": " ",
    "diff": "!"
  };
  Object.keys(PREFIXES).forEach(function(name) {
    var prefix = PREFIXES[name];
    var alias = [];
    if (!/^\w+$/.test(name)) {
      alias.push(/\w+/.exec(name)[0]);
    }
    if (name === "diff") {
      alias.push("bold");
    }
    Prism3.languages.diff[name] = {
      pattern: RegExp("^(?:[" + prefix + "].*(?:\r\n?|\n|(?![\\s\\S])))+", "m"),
      alias,
      inside: {
        "line": {
          pattern: /(.)(?=[\s\S]).*(?:\r\n?|\n)?/,
          lookbehind: true
        },
        "prefix": {
          pattern: /[\s\S]/,
          alias: /\w+/.exec(name)[0]
        }
      }
    };
  });
  Object.defineProperty(Prism3.languages.diff, "PREFIXES", {
    value: PREFIXES
  });
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-git.js
Prism.languages.git = {
  /*
   * A simple one line comment like in a git status command
   * For instance:
   * $ git status
   * # On branch infinite-scroll
   * # Your branch and 'origin/sharedBranches/frontendTeam/infinite-scroll' have diverged,
   * # and have 1 and 2 different commits each, respectively.
   * nothing to commit (working directory clean)
   */
  "comment": /^#.*/m,
  /*
   * Regexp to match the changed lines in a git diff output. Check the example below.
   */
  "deleted": /^[-–].*/m,
  "inserted": /^\+.*/m,
  /*
   * a string (double and simple quote)
   */
  "string": /("|')(?:\\.|(?!\1)[^\\\r\n])*\1/,
  /*
   * a git command. It starts with a random prompt finishing by a $, then "git" then some other parameters
   * For instance:
   * $ git add file.txt
   */
  "command": {
    pattern: /^.*\$ git .*$/m,
    inside: {
      /*
       * A git command can contain a parameter starting by a single or a double dash followed by a string
       * For instance:
       * $ git diff --cached
       * $ git log -p
       */
      "parameter": /\s--?\w+/
    }
  },
  /*
   * Coordinates displayed in a git diff command
   * For instance:
   * $ git diff
   * diff --git file.txt file.txt
   * index 6214953..1d54a52 100644
   * --- file.txt
   * +++ file.txt
   * @@ -1 +1,2 @@
   * -Here's my tetx file
   * +Here's my text file
   * +And this is the second line
   */
  "coord": /^@@.*@@$/m,
  /*
   * Match a "commit [SHA1]" line in a git log output.
   * For instance:
   * $ git log
   * commit a11a14ef7e26f2ca62d4b35eac455ce636d0dc09
   * Author: lgiraudel
   * Date:   Mon Feb 17 11:18:34 2014 +0100
   *
   *     Add of a new line
   */
  "commit-sha1": /^commit \w{40}$/m
};

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-toml.js
(function(Prism3) {
  var key = /(?:[\w-]+|'[^'\n\r]*'|"(?:\\.|[^\\"\r\n])*")/.source;
  function insertKey(pattern) {
    return pattern.replace(/__/g, function() {
      return key;
    });
  }
  Prism3.languages.toml = {
    "comment": {
      pattern: /#.*/,
      greedy: true
    },
    "table": {
      pattern: RegExp(insertKey(/(^[\t ]*\[\s*(?:\[\s*)?)__(?:\s*\.\s*__)*(?=\s*\])/.source), "m"),
      lookbehind: true,
      greedy: true,
      alias: "class-name"
    },
    "key": {
      pattern: RegExp(insertKey(/(^[\t ]*|[{,]\s*)__(?:\s*\.\s*__)*(?=\s*=)/.source), "m"),
      lookbehind: true,
      greedy: true,
      alias: "property"
    },
    "string": {
      pattern: /"""(?:\\[\s\S]|[^\\])*?"""|'''[\s\S]*?'''|'[^'\n\r]*'|"(?:\\.|[^\\"\r\n])*"/,
      greedy: true
    },
    "date": [
      {
        // Offset Date-Time, Local Date-Time, Local Date
        pattern: /\b\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?\b/i,
        alias: "number"
      },
      {
        // Local Time
        pattern: /\b\d{2}:\d{2}:\d{2}(?:\.\d+)?\b/,
        alias: "number"
      }
    ],
    "number": /(?:\b0(?:x[\da-zA-Z]+(?:_[\da-zA-Z]+)*|o[0-7]+(?:_[0-7]+)*|b[10]+(?:_[10]+)*))\b|[-+]?\b\d+(?:_\d+)*(?:\.\d+(?:_\d+)*)?(?:[eE][+-]?\d+(?:_\d+)*)?\b|[-+]?\b(?:inf|nan)\b/,
    "boolean": /\b(?:false|true)\b/,
    "punctuation": /[.,=[\]{}]/
  };
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-ini.js
Prism.languages.ini = {
  /**
   * The component mimics the behavior of the Win32 API parser.
   *
   * @see {@link https://github.com/PrismJS/prism/issues/2775#issuecomment-787477723}
   */
  "comment": {
    pattern: /(^[ \f\t\v]*)[#;][^\n\r]*/m,
    lookbehind: true
  },
  "section": {
    pattern: /(^[ \f\t\v]*)\[[^\n\r\]]*\]?/m,
    lookbehind: true,
    inside: {
      "section-name": {
        pattern: /(^\[[ \f\t\v]*)[^ \f\t\v\]]+(?:[ \f\t\v]+[^ \f\t\v\]]+)*/,
        lookbehind: true,
        alias: "selector"
      },
      "punctuation": /\[|\]/
    }
  },
  "key": {
    pattern: /(^[ \f\t\v]*)[^ \f\n\r\t\v=]+(?:[ \f\t\v]+[^ \f\n\r\t\v=]+)*(?=[ \f\t\v]*=)/m,
    lookbehind: true,
    alias: "attr-name"
  },
  "value": {
    pattern: /(=[ \f\t\v]*)[^ \f\n\r\t\v]+(?:[ \f\t\v]+[^ \f\n\r\t\v]+)*/,
    lookbehind: true,
    alias: "attr-value",
    inside: {
      "inner-value": {
        pattern: /^("|').+(?=\1$)/,
        lookbehind: true
      }
    }
  },
  "punctuation": /=/
};

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-properties.js
Prism.languages.properties = {
  "comment": /^[ \t]*[#!].*$/m,
  "value": {
    pattern: /(^[ \t]*(?:\\(?:\r\n|[\s\S])|[^\\\s:=])+(?: *[=:] *(?! )| ))(?:\\(?:\r\n|[\s\S])|[^\\\r\n])+/m,
    lookbehind: true,
    alias: "attr-value"
  },
  "key": {
    pattern: /^[ \t]*(?:\\(?:\r\n|[\s\S])|[^\\\s:=])+(?= *[=:]| )/m,
    alias: "attr-name"
  },
  "punctuation": /[=:]/
};

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-editorconfig.js
Prism.languages.editorconfig = {
  // https://editorconfig-specification.readthedocs.io
  "comment": /[;#].*/,
  "section": {
    pattern: /(^[ \t]*)\[.+\]/m,
    lookbehind: true,
    alias: "selector",
    inside: {
      "regex": /\\\\[\[\]{},!?.*]/,
      // Escape special characters with '\\'
      "operator": /[!?]|\.\.|\*{1,2}/,
      "punctuation": /[\[\]{},]/
    }
  },
  "key": {
    pattern: /(^[ \t]*)[^\s=]+(?=[ \t]*=)/m,
    lookbehind: true,
    alias: "attr-name"
  },
  "value": {
    pattern: /=.*/,
    alias: "attr-value",
    inside: {
      "punctuation": /^=/
    }
  }
};

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-ignore.js
(function(Prism3) {
  Prism3.languages.ignore = {
    // https://git-scm.com/docs/gitignore
    "comment": /^#.*/m,
    "entry": {
      pattern: /\S(?:.*(?:(?:\\ )|\S))?/,
      alias: "string",
      inside: {
        "operator": /^!|\*\*?|\?/,
        "regex": {
          pattern: /(^|[^\\])\[[^\[\]]*\]/,
          lookbehind: true
        },
        "punctuation": /\//
      }
    }
  };
  Prism3.languages.gitignore = Prism3.languages.ignore;
  Prism3.languages.hgignore = Prism3.languages.ignore;
  Prism3.languages.npmignore = Prism3.languages.ignore;
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-makefile.js
Prism.languages.makefile = {
  "comment": {
    pattern: /(^|[^\\])#(?:\\(?:\r\n|[\s\S])|[^\\\r\n])*/,
    lookbehind: true
  },
  "string": {
    pattern: /(["'])(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
    greedy: true
  },
  "builtin-target": {
    pattern: /\.[A-Z][^:#=\s]+(?=\s*:(?!=))/,
    alias: "builtin"
  },
  "target": {
    pattern: /^(?:[^:=\s]|[ \t]+(?![\s:]))+(?=\s*:(?!=))/m,
    alias: "symbol",
    inside: {
      "variable": /\$+(?:(?!\$)[^(){}:#=\s]+|(?=[({]))/
    }
  },
  "variable": /\$+(?:(?!\$)[^(){}:#=\s]+|\([@*%<^+?][DF]\)|(?=[({]))/,
  // Directives
  "keyword": /-include\b|\b(?:define|else|endef|endif|export|ifn?def|ifn?eq|include|override|private|sinclude|undefine|unexport|vpath)\b/,
  "function": {
    pattern: /(\()(?:abspath|addsuffix|and|basename|call|dir|error|eval|file|filter(?:-out)?|findstring|firstword|flavor|foreach|guile|if|info|join|lastword|load|notdir|or|origin|patsubst|realpath|shell|sort|strip|subst|suffix|value|warning|wildcard|word(?:list|s)?)(?=[ \t])/,
    lookbehind: true
  },
  "operator": /(?:::|[?:+!])?=|[|@]/,
  "punctuation": /[:;(){}]/
};

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-log.js
Prism.languages.log = {
  "string": {
    // Single-quoted strings must not be confused with plain text. E.g. Can't isn't Susan's Chris' toy
    pattern: /"(?:[^"\\\r\n]|\\.)*"|'(?![st] | \w)(?:[^'\\\r\n]|\\.)*'/,
    greedy: true
  },
  "exception": {
    pattern: /(^|[^\w.])[a-z][\w.]*(?:Error|Exception):.*(?:(?:\r\n?|\n)[ \t]*(?:at[ \t].+|\.{3}.*|Caused by:.*))+(?:(?:\r\n?|\n)[ \t]*\.\.\. .*)?/,
    lookbehind: true,
    greedy: true,
    alias: ["javastacktrace", "language-javastacktrace"],
    inside: Prism.languages["javastacktrace"] || {
      "keyword": /\bat\b/,
      "function": /[a-z_][\w$]*(?=\()/,
      "punctuation": /[.:()]/
    }
  },
  "level": [
    {
      pattern: /\b(?:ALERT|CRIT|CRITICAL|EMERG|EMERGENCY|ERR|ERROR|FAILURE|FATAL|SEVERE)\b/,
      alias: ["error", "important"]
    },
    {
      pattern: /\b(?:WARN|WARNING|WRN)\b/,
      alias: ["warning", "important"]
    },
    {
      pattern: /\b(?:DISPLAY|INF|INFO|NOTICE|STATUS)\b/,
      alias: ["info", "keyword"]
    },
    {
      pattern: /\b(?:DBG|DEBUG|FINE)\b/,
      alias: ["debug", "keyword"]
    },
    {
      pattern: /\b(?:FINER|FINEST|TRACE|TRC|VERBOSE|VRB)\b/,
      alias: ["trace", "comment"]
    }
  ],
  "property": {
    pattern: /((?:^|[\]|])[ \t]*)[a-z_](?:[\w-]|\b\/\b)*(?:[. ]\(?\w(?:[\w-]|\b\/\b)*\)?)*:(?=\s)/im,
    lookbehind: true
  },
  "separator": {
    pattern: /(^|[^-+])-{3,}|={3,}|\*{3,}|- - /m,
    lookbehind: true,
    alias: "comment"
  },
  "url": /\b(?:file|ftp|https?):\/\/[^\s|,;'"]*[^\s|,;'">.]/,
  "email": {
    pattern: /(^|\s)[-\w+.]+@[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+(?=\s)/,
    lookbehind: true,
    alias: "url"
  },
  "ip-address": {
    pattern: /\b(?:\d{1,3}(?:\.\d{1,3}){3})\b/,
    alias: "constant"
  },
  "mac-address": {
    pattern: /\b[a-f0-9]{2}(?::[a-f0-9]{2}){5}\b/i,
    alias: "constant"
  },
  "domain": {
    pattern: /(^|\s)[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*\.[a-z][a-z0-9-]+(?=\s)/,
    lookbehind: true,
    alias: "constant"
  },
  "uuid": {
    pattern: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i,
    alias: "constant"
  },
  "hash": {
    pattern: /\b(?:[a-f0-9]{32}){1,2}\b/i,
    alias: "constant"
  },
  "file-path": {
    pattern: /\b[a-z]:[\\/][^\s|,;:(){}\[\]"']+|(^|[\s:\[\](>|])\.{0,2}\/\w[^\s|,;:(){}\[\]"']*/i,
    lookbehind: true,
    greedy: true,
    alias: "string"
  },
  "date": {
    pattern: RegExp(
      /\b\d{4}[-/]\d{2}[-/]\d{2}(?:T(?=\d{1,2}:)|(?=\s\d{1,2}:))/.source + "|" + /\b\d{1,4}[-/ ](?:\d{1,2}|Apr|Aug|Dec|Feb|Jan|Jul|Jun|Mar|May|Nov|Oct|Sep)[-/ ]\d{2,4}T?\b/.source + "|" + /\b(?:(?:Fri|Mon|Sat|Sun|Thu|Tue|Wed)(?:\s{1,2}(?:Apr|Aug|Dec|Feb|Jan|Jul|Jun|Mar|May|Nov|Oct|Sep))?|Apr|Aug|Dec|Feb|Jan|Jul|Jun|Mar|May|Nov|Oct|Sep)\s{1,2}\d{1,2}\b/.source,
      "i"
    ),
    alias: "number"
  },
  "time": {
    pattern: /\b\d{1,2}:\d{1,2}:\d{1,2}(?:[.,:]\d+)?(?:\s?[+-]\d{2}:?\d{2}|Z)?\b/,
    alias: "number"
  },
  "boolean": /\b(?:false|null|true)\b/i,
  "number": {
    pattern: /(^|[^.\w])(?:0x[a-f0-9]+|0o[0-7]+|0b[01]+|v?\d[\da-f]*(?:\.\d+)*(?:e[+-]?\d+)?[a-z]{0,3}\b)\b(?!\.\w)/i,
    lookbehind: true
  },
  "operator": /[;:?<=>~/@!$%&+\-|^(){}*#]/,
  "punctuation": /[\[\].,]/
};

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-csv.js
Prism.languages.csv = {
  "value": /[^\r\n,"]+|"(?:[^"]|"")*"(?!")/,
  "punctuation": /,/
};

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-promql.js
(function(Prism3) {
  var aggregations = [
    "sum",
    "min",
    "max",
    "avg",
    "group",
    "stddev",
    "stdvar",
    "count",
    "count_values",
    "bottomk",
    "topk",
    "quantile"
  ];
  var vectorMatching = [
    "on",
    "ignoring",
    "group_right",
    "group_left",
    "by",
    "without"
  ];
  var offsetModifier = ["offset"];
  var keywords = aggregations.concat(vectorMatching, offsetModifier);
  Prism3.languages.promql = {
    "comment": {
      pattern: /(^[ \t]*)#.*/m,
      lookbehind: true
    },
    "vector-match": {
      // Match the comma-separated label lists inside vector matching:
      pattern: new RegExp("((?:" + vectorMatching.join("|") + ")\\s*)\\([^)]*\\)"),
      lookbehind: true,
      inside: {
        "label-key": {
          pattern: /\b[^,]+\b/,
          alias: "attr-name"
        },
        "punctuation": /[(),]/
      }
    },
    "context-labels": {
      pattern: /\{[^{}]*\}/,
      inside: {
        "label-key": {
          pattern: /\b[a-z_]\w*(?=\s*(?:=|![=~]))/,
          alias: "attr-name"
        },
        "label-value": {
          pattern: /(["'`])(?:\\[\s\S]|(?!\1)[^\\])*\1/,
          greedy: true,
          alias: "attr-value"
        },
        "punctuation": /\{|\}|=~?|![=~]|,/
      }
    },
    "context-range": [
      {
        pattern: /\[[\w\s:]+\]/,
        // [1m]
        inside: {
          "punctuation": /\[|\]|:/,
          "range-duration": {
            pattern: /\b(?:\d+(?:[smhdwy]|ms))+\b/i,
            alias: "number"
          }
        }
      },
      {
        pattern: /(\boffset\s+)\w+/,
        // offset 1m
        lookbehind: true,
        inside: {
          "range-duration": {
            pattern: /\b(?:\d+(?:[smhdwy]|ms))+\b/i,
            alias: "number"
          }
        }
      }
    ],
    "keyword": new RegExp("\\b(?:" + keywords.join("|") + ")\\b", "i"),
    "function": /\b[a-z_]\w*(?=\s*\()/i,
    "number": /[-+]?(?:(?:\b\d+(?:\.\d+)?|\B\.\d+)(?:e[-+]?\d+)?\b|\b(?:0x[0-9a-f]+|nan|inf)\b)/i,
    "operator": /[\^*/%+-]|==|!=|<=|<|>=|>|\b(?:and|or|unless)\b/i,
    "punctuation": /[{};()`,.[\]]/
  };
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-jq.js
(function(Prism3) {
  var interpolation = /\\\((?:[^()]|\([^()]*\))*\)/.source;
  var string = RegExp(/(^|[^\\])"(?:[^"\r\n\\]|\\[^\r\n(]|__)*"/.source.replace(/__/g, function() {
    return interpolation;
  }));
  var stringInterpolation = {
    "interpolation": {
      pattern: RegExp(/((?:^|[^\\])(?:\\{2})*)/.source + interpolation),
      lookbehind: true,
      inside: {
        "content": {
          pattern: /^(\\\()[\s\S]+(?=\)$)/,
          lookbehind: true,
          inside: null
          // see below
        },
        "punctuation": /^\\\(|\)$/
      }
    }
  };
  var jq = Prism3.languages.jq = {
    "comment": /#.*/,
    "property": {
      pattern: RegExp(string.source + /(?=\s*:(?!:))/.source),
      lookbehind: true,
      greedy: true,
      inside: stringInterpolation
    },
    "string": {
      pattern: string,
      lookbehind: true,
      greedy: true,
      inside: stringInterpolation
    },
    "function": {
      pattern: /(\bdef\s+)[a-z_]\w+/i,
      lookbehind: true
    },
    "variable": /\B\$\w+/,
    "property-literal": {
      pattern: /\b[a-z_]\w*(?=\s*:(?!:))/i,
      alias: "property"
    },
    "keyword": /\b(?:as|break|catch|def|elif|else|end|foreach|if|import|include|label|module|modulemeta|null|reduce|then|try|while)\b/,
    "boolean": /\b(?:false|true)\b/,
    "number": /(?:\b\d+\.|\B\.)?\b\d+(?:[eE][+-]?\d+)?\b/,
    "operator": [
      {
        pattern: /\|=?/,
        alias: "pipe"
      },
      /\.\.|[!=<>]?=|\?\/\/|\/\/=?|[-+*/%]=?|[<>?]|\b(?:and|not|or)\b/
    ],
    "c-style-function": {
      pattern: /\b[a-z_]\w*(?=\s*\()/i,
      alias: "function"
    },
    "punctuation": /::|[()\[\]{},:;]|\.(?=\s*[\[\w$])/,
    "dot": {
      pattern: /\./,
      alias: "important"
    }
  };
  stringInterpolation.interpolation.inside.content.inside = jq;
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-rego.js
Prism.languages.rego = {
  "comment": /#.*/,
  "property": {
    pattern: /(^|[^\\.])(?:"(?:\\.|[^\\"\r\n])*"|`[^`]*`|\b[a-z_]\w*\b)(?=\s*:(?!=))/i,
    lookbehind: true,
    greedy: true
  },
  "string": {
    pattern: /(^|[^\\])"(?:\\.|[^\\"\r\n])*"|`[^`]*`/,
    lookbehind: true,
    greedy: true
  },
  "keyword": /\b(?:as|default|else|import|not|null|package|set(?=\s*\()|some|with)\b/,
  "boolean": /\b(?:false|true)\b/,
  "function": {
    pattern: /\b[a-z_]\w*\b(?:\s*\.\s*\b[a-z_]\w*\b)*(?=\s*\()/i,
    inside: {
      "namespace": /\b\w+\b(?=\s*\.)/,
      "punctuation": /\./
    }
  },
  "number": /-?\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/i,
  "operator": /[-+*/%|&]|[<>:=]=?|!=|\b_\b/,
  "punctuation": /[,;.\[\]{}()]/
};

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-rust.js
(function(Prism3) {
  var multilineComment = /\/\*(?:[^*/]|\*(?!\/)|\/(?!\*)|<self>)*\*\//.source;
  for (var i = 0; i < 2; i++) {
    multilineComment = multilineComment.replace(/<self>/g, function() {
      return multilineComment;
    });
  }
  multilineComment = multilineComment.replace(/<self>/g, function() {
    return /[^\s\S]/.source;
  });
  Prism3.languages.rust = {
    "comment": [
      {
        pattern: RegExp(/(^|[^\\])/.source + multilineComment),
        lookbehind: true,
        greedy: true
      },
      {
        pattern: /(^|[^\\:])\/\/.*/,
        lookbehind: true,
        greedy: true
      }
    ],
    "string": {
      pattern: /b?"(?:\\[\s\S]|[^\\"])*"|b?r(#*)"(?:[^"]|"(?!\1))*"\1/,
      greedy: true
    },
    "char": {
      pattern: /b?'(?:\\(?:x[0-7][\da-fA-F]|u\{(?:[\da-fA-F]_*){1,6}\}|.)|[^\\\r\n\t'])'/,
      greedy: true
    },
    "attribute": {
      pattern: /#!?\[(?:[^\[\]"]|"(?:\\[\s\S]|[^\\"])*")*\]/,
      greedy: true,
      alias: "attr-name",
      inside: {
        "string": null
        // see below
      }
    },
    // Closure params should not be confused with bitwise OR |
    "closure-params": {
      pattern: /([=(,:]\s*|\bmove\s*)\|[^|]*\||\|[^|]*\|(?=\s*(?:\{|->))/,
      lookbehind: true,
      greedy: true,
      inside: {
        "closure-punctuation": {
          pattern: /^\||\|$/,
          alias: "punctuation"
        },
        rest: null
        // see below
      }
    },
    "lifetime-annotation": {
      pattern: /'\w+/,
      alias: "symbol"
    },
    "fragment-specifier": {
      pattern: /(\$\w+:)[a-z]+/,
      lookbehind: true,
      alias: "punctuation"
    },
    "variable": /\$\w+/,
    "function-definition": {
      pattern: /(\bfn\s+)\w+/,
      lookbehind: true,
      alias: "function"
    },
    "type-definition": {
      pattern: /(\b(?:enum|struct|trait|type|union)\s+)\w+/,
      lookbehind: true,
      alias: "class-name"
    },
    "module-declaration": [
      {
        pattern: /(\b(?:crate|mod)\s+)[a-z][a-z_\d]*/,
        lookbehind: true,
        alias: "namespace"
      },
      {
        pattern: /(\b(?:crate|self|super)\s*)::\s*[a-z][a-z_\d]*\b(?:\s*::(?:\s*[a-z][a-z_\d]*\s*::)*)?/,
        lookbehind: true,
        alias: "namespace",
        inside: {
          "punctuation": /::/
        }
      }
    ],
    "keyword": [
      // https://github.com/rust-lang/reference/blob/master/src/keywords.md
      /\b(?:Self|abstract|as|async|await|become|box|break|const|continue|crate|do|dyn|else|enum|extern|final|fn|for|if|impl|in|let|loop|macro|match|mod|move|mut|override|priv|pub|ref|return|self|static|struct|super|trait|try|type|typeof|union|unsafe|unsized|use|virtual|where|while|yield)\b/,
      // primitives and str
      // https://doc.rust-lang.org/stable/rust-by-example/primitives.html
      /\b(?:bool|char|f(?:32|64)|[ui](?:8|16|32|64|128|size)|str)\b/
    ],
    // functions can technically start with an upper-case letter, but this will introduce a lot of false positives
    // and Rust's naming conventions recommend snake_case anyway.
    // https://doc.rust-lang.org/1.0.0/style/style/naming/README.html
    "function": /\b[a-z_]\w*(?=\s*(?:::\s*<|\())/,
    "macro": {
      pattern: /\b\w+!/,
      alias: "property"
    },
    "constant": /\b[A-Z_][A-Z_\d]+\b/,
    "class-name": /\b[A-Z]\w*\b/,
    "namespace": {
      pattern: /(?:\b[a-z][a-z_\d]*\s*::\s*)*\b[a-z][a-z_\d]*\s*::(?!\s*<)/,
      inside: {
        "punctuation": /::/
      }
    },
    // Hex, oct, bin, dec numbers with visual separators and type suffix
    "number": /\b(?:0x[\dA-Fa-f](?:_?[\dA-Fa-f])*|0o[0-7](?:_?[0-7])*|0b[01](?:_?[01])*|(?:(?:\d(?:_?\d)*)?\.)?\d(?:_?\d)*(?:[Ee][+-]?\d+)?)(?:_?(?:f32|f64|[iu](?:8|16|32|64|size)?))?\b/,
    "boolean": /\b(?:false|true)\b/,
    "punctuation": /->|\.\.=|\.{1,3}|::|[{}[\];(),:]/,
    "operator": /[-+*\/%!^]=?|=[=>]?|&[&=]?|\|[|=]?|<<?=?|>>?=?|[@?]/
  };
  Prism3.languages.rust["closure-params"].inside.rest = Prism3.languages.rust;
  Prism3.languages.rust["attribute"].inside["string"] = Prism3.languages.rust["string"];
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-zig.js
(function(Prism3) {
  function literal(str) {
    return function() {
      return str;
    };
  }
  var keyword = /\b(?:align|allowzero|and|anyframe|anytype|asm|async|await|break|cancel|catch|comptime|const|continue|defer|else|enum|errdefer|error|export|extern|fn|for|if|inline|linksection|nakedcc|noalias|nosuspend|null|or|orelse|packed|promise|pub|resume|return|stdcallcc|struct|suspend|switch|test|threadlocal|try|undefined|union|unreachable|usingnamespace|var|volatile|while)\b/;
  var IDENTIFIER = "\\b(?!" + keyword.source + ")(?!\\d)\\w+\\b";
  var ALIGN = /align\s*\((?:[^()]|\([^()]*\))*\)/.source;
  var PREFIX_TYPE_OP = /(?:\?|\bpromise->|(?:\[[^[\]]*\]|\*(?!\*)|\*\*)(?:\s*<ALIGN>|\s*const\b|\s*volatile\b|\s*allowzero\b)*)/.source.replace(/<ALIGN>/g, literal(ALIGN));
  var SUFFIX_EXPR = /(?:\bpromise\b|(?:\berror\.)?<ID>(?:\.<ID>)*(?!\s+<ID>))/.source.replace(/<ID>/g, literal(IDENTIFIER));
  var TYPE = "(?!\\s)(?:!?\\s*(?:" + PREFIX_TYPE_OP + "\\s*)*" + SUFFIX_EXPR + ")+";
  Prism3.languages.zig = {
    "comment": [
      {
        pattern: /\/\/[/!].*/,
        alias: "doc-comment"
      },
      /\/{2}.*/
    ],
    "string": [
      {
        // "string" and c"string"
        pattern: /(^|[^\\@])c?"(?:[^"\\\r\n]|\\.)*"/,
        lookbehind: true,
        greedy: true
      },
      {
        // multiline strings and c-strings
        pattern: /([\r\n])([ \t]+c?\\{2}).*(?:(?:\r\n?|\n)\2.*)*/,
        lookbehind: true,
        greedy: true
      }
    ],
    "char": {
      // characters 'a', '\n', '\xFF', '\u{10FFFF}'
      pattern: /(^|[^\\])'(?:[^'\\\r\n]|[\uD800-\uDFFF]{2}|\\(?:.|x[a-fA-F\d]{2}|u\{[a-fA-F\d]{1,6}\}))'/,
      lookbehind: true,
      greedy: true
    },
    "builtin": /\B@(?!\d)\w+(?=\s*\()/,
    "label": {
      pattern: /(\b(?:break|continue)\s*:\s*)\w+\b|\b(?!\d)\w+\b(?=\s*:\s*(?:\{|while\b))/,
      lookbehind: true
    },
    "class-name": [
      // const Foo = struct {};
      /\b(?!\d)\w+(?=\s*=\s*(?:(?:extern|packed)\s+)?(?:enum|struct|union)\s*[({])/,
      {
        // const x: i32 = 9;
        // var x: Bar;
        // fn foo(x: bool, y: f32) void {}
        pattern: RegExp(/(:\s*)<TYPE>(?=\s*(?:<ALIGN>\s*)?[=;,)])|<TYPE>(?=\s*(?:<ALIGN>\s*)?\{)/.source.replace(/<TYPE>/g, literal(TYPE)).replace(/<ALIGN>/g, literal(ALIGN))),
        lookbehind: true,
        inside: null
        // see below
      },
      {
        // extern fn foo(x: f64) f64; (optional alignment)
        pattern: RegExp(/(\)\s*)<TYPE>(?=\s*(?:<ALIGN>\s*)?;)/.source.replace(/<TYPE>/g, literal(TYPE)).replace(/<ALIGN>/g, literal(ALIGN))),
        lookbehind: true,
        inside: null
        // see below
      }
    ],
    "builtin-type": {
      pattern: /\b(?:anyerror|bool|c_u?(?:int|long|longlong|short)|c_longdouble|c_void|comptime_(?:float|int)|f(?:16|32|64|128)|[iu](?:8|16|32|64|128|size)|noreturn|type|void)\b/,
      alias: "keyword"
    },
    "keyword": keyword,
    "function": /\b(?!\d)\w+(?=\s*\()/,
    "number": /\b(?:0b[01]+|0o[0-7]+|0x[a-fA-F\d]+(?:\.[a-fA-F\d]*)?(?:[pP][+-]?[a-fA-F\d]+)?|\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)\b/,
    "boolean": /\b(?:false|true)\b/,
    "operator": /\.[*?]|\.{2,3}|[-=]>|\*\*|\+\+|\|\||(?:<<|>>|[-+*]%|[-+*/%^&|<>!=])=?|[?~]/,
    "punctuation": /[.:,;(){}[\]]/
  };
  Prism3.languages.zig["class-name"].forEach(function(obj) {
    if (obj.inside === null) {
      obj.inside = Prism3.languages.zig;
    }
  });
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-odin.js
(function(Prism3) {
  var escapes = /\\(?:["'\\abefnrtv]|0[0-7]{2}|U[\dA-Fa-f]{6}|u[\dA-Fa-f]{4}|x[\dA-Fa-f]{2})/;
  Prism3.languages.odin = {
    /**
     * The current implementation supports only 1 level of nesting.
     *
     * @author Michael Schmidt
     * @author edukisto
     */
    "comment": [
      {
        pattern: /\/\*(?:[^/*]|\/(?!\*)|\*(?!\/)|\/\*(?:\*(?!\/)|[^*])*(?:\*\/|$))*(?:\*\/|$)/,
        greedy: true
      },
      {
        pattern: /#![^\n\r]*/,
        greedy: true
      },
      {
        pattern: /\/\/[^\n\r]*/,
        greedy: true
      }
    ],
    /**
     * Should be found before strings because of '"'"- and '`'`-like sequences.
     */
    "char": {
      pattern: /'(?:\\(?:.|[0Uux][0-9A-Fa-f]{1,6})|[^\n\r'\\])'/,
      greedy: true,
      inside: {
        "symbol": escapes
      }
    },
    "string": [
      {
        pattern: /`[^`]*`/,
        greedy: true
      },
      {
        pattern: /"(?:\\.|[^\n\r"\\])*"/,
        greedy: true,
        inside: {
          "symbol": escapes
        }
      }
    ],
    "directive": {
      pattern: /#\w+/,
      alias: "property"
    },
    "number": /\b0(?:b[01_]+|d[\d_]+|h_*(?:(?:(?:[\dA-Fa-f]_*){8}){1,2}|(?:[\dA-Fa-f]_*){4})|o[0-7_]+|x[\dA-F_a-f]+|z[\dAB_ab]+)\b|(?:\b\d+(?:\.(?!\.)\d*)?|\B\.\d+)(?:[Ee][+-]?\d*)?[ijk]?(?!\w)/,
    "discard": {
      pattern: /\b_\b/,
      alias: "keyword"
    },
    "procedure-definition": {
      pattern: /\b\w+(?=[ \t]*(?::\s*){2}proc\b)/,
      alias: "function"
    },
    "keyword": /\b(?:asm|auto_cast|bit_set|break|case|cast|context|continue|defer|distinct|do|dynamic|else|enum|fallthrough|for|foreign|if|import|in|map|matrix|not_in|or_else|or_return|package|proc|return|struct|switch|transmute|typeid|union|using|when|where)\b/,
    /**
     * false, nil, true can be used as procedure names. "_" and keywords can't.
     */
    "procedure-name": {
      pattern: /\b\w+(?=[ \t]*\()/,
      alias: "function"
    },
    "boolean": /\b(?:false|nil|true)\b/,
    "constant-parameter-sign": {
      pattern: /\$/,
      alias: "important"
    },
    "undefined": {
      pattern: /---/,
      alias: "operator"
    },
    "arrow": {
      pattern: /->/,
      alias: "punctuation"
    },
    "operator": /\+\+|--|\.\.[<=]?|(?:&~|[-!*+/=~]|[%&<>|]{1,2})=?|[?^]/,
    "punctuation": /[(),.:;@\[\]{}]/
  };
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-nim.js
Prism.languages.nim = {
  "comment": {
    pattern: /#.*/,
    greedy: true
  },
  "string": {
    // Double-quoted strings can be prefixed by an identifier (Generalized raw string literals)
    pattern: /(?:\b(?!\d)(?:\w|\\x[89a-fA-F][0-9a-fA-F])+)?(?:"""[\s\S]*?"""(?!")|"(?:\\[\s\S]|""|[^"\\])*")/,
    greedy: true
  },
  "char": {
    // Character literals are handled specifically to prevent issues with numeric type suffixes
    pattern: /'(?:\\(?:\d+|x[\da-fA-F]{0,2}|.)|[^'])'/,
    greedy: true
  },
  "function": {
    pattern: /(?:(?!\d)(?:\w|\\x[89a-fA-F][0-9a-fA-F])+|`[^`\r\n]+`)\*?(?:\[[^\]]+\])?(?=\s*\()/,
    greedy: true,
    inside: {
      "operator": /\*$/
    }
  },
  // We don't want to highlight operators (and anything really) inside backticks
  "identifier": {
    pattern: /`[^`\r\n]+`/,
    greedy: true,
    inside: {
      "punctuation": /`/
    }
  },
  // The negative look ahead prevents wrong highlighting of the .. operator
  "number": /\b(?:0[xXoObB][\da-fA-F_]+|\d[\d_]*(?:(?!\.\.)\.[\d_]*)?(?:[eE][+-]?\d[\d_]*)?)(?:'?[iuf]\d*)?/,
  "keyword": /\b(?:addr|as|asm|atomic|bind|block|break|case|cast|concept|const|continue|converter|defer|discard|distinct|do|elif|else|end|enum|except|export|finally|for|from|func|generic|if|import|include|interface|iterator|let|macro|method|mixin|nil|object|out|proc|ptr|raise|ref|return|static|template|try|tuple|type|using|var|when|while|with|without|yield)\b/,
  "operator": {
    // Look behind and look ahead prevent wrong highlighting of punctuations [. .] {. .} (. .)
    // but allow the slice operator .. to take precedence over them
    // One can define his own operators in Nim so all combination of operators might be an operator.
    pattern: /(^|[({\[](?=\.\.)|(?![({\[]\.).)(?:(?:[=+\-*\/<>@$~&%|!?^:\\]|\.\.|\.(?![)}\]]))+|\b(?:and|div|in|is|isnot|mod|not|notin|of|or|shl|shr|xor)\b)/m,
    lookbehind: true
  },
  "punctuation": /[({\[]\.|\.[)}\]]|[`(){}\[\],:]/
};

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-wasm.js
Prism.languages.wasm = {
  "comment": [
    /\(;[\s\S]*?;\)/,
    {
      pattern: /;;.*/,
      greedy: true
    }
  ],
  "string": {
    pattern: /"(?:\\[\s\S]|[^"\\])*"/,
    greedy: true
  },
  "keyword": [
    {
      pattern: /\b(?:align|offset)=/,
      inside: {
        "operator": /=/
      }
    },
    {
      pattern: /\b(?:(?:f32|f64|i32|i64)(?:\.(?:abs|add|and|ceil|clz|const|convert_[su]\/i(?:32|64)|copysign|ctz|demote\/f64|div(?:_[su])?|eqz?|extend_[su]\/i32|floor|ge(?:_[su])?|gt(?:_[su])?|le(?:_[su])?|load(?:(?:8|16|32)_[su])?|lt(?:_[su])?|max|min|mul|neg?|nearest|or|popcnt|promote\/f32|reinterpret\/[fi](?:32|64)|rem_[su]|rot[lr]|shl|shr_[su]|sqrt|store(?:8|16|32)?|sub|trunc(?:_[su]\/f(?:32|64))?|wrap\/i64|xor))?|memory\.(?:grow|size))\b/,
      inside: {
        "punctuation": /\./
      }
    },
    /\b(?:anyfunc|block|br(?:_if|_table)?|call(?:_indirect)?|data|drop|elem|else|end|export|func|get_(?:global|local)|global|if|import|local|loop|memory|module|mut|nop|offset|param|result|return|select|set_(?:global|local)|start|table|tee_local|then|type|unreachable)\b/
  ],
  "variable": /\$[\w!#$%&'*+\-./:<=>?@\\^`|~]+/,
  "number": /[+-]?\b(?:\d(?:_?\d)*(?:\.\d(?:_?\d)*)?(?:[eE][+-]?\d(?:_?\d)*)?|0x[\da-fA-F](?:_?[\da-fA-F])*(?:\.[\da-fA-F](?:_?[\da-fA-D])*)?(?:[pP][+-]?\d(?:_?\d)*)?)\b|\binf\b|\bnan(?::0x[\da-fA-F](?:_?[\da-fA-D])*)?\b/,
  "punctuation": /[()]/
};

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-wgsl.js
Prism.languages.wgsl = {
  "comment": {
    pattern: /\/\/.*|\/\*[\s\S]*?(?:\*\/|$)/,
    greedy: true
  },
  "builtin-attribute": {
    pattern: /(@)builtin\(.*?\)/,
    lookbehind: true,
    inside: {
      "attribute": {
        pattern: /^builtin/,
        alias: "attr-name"
      },
      "punctuation": /[(),]/,
      "built-in-values": {
        pattern: /\b(?:frag_depth|front_facing|global_invocation_id|instance_index|local_invocation_id|local_invocation_index|num_workgroups|position|sample_index|sample_mask|vertex_index|workgroup_id)\b/,
        alias: "attr-value"
      }
    }
  },
  "attributes": {
    pattern: /(@)(?:align|binding|compute|const|fragment|group|id|interpolate|invariant|location|size|vertex|workgroup_size)/i,
    lookbehind: true,
    alias: "attr-name"
  },
  "functions": {
    pattern: /\b(fn\s+)[_a-zA-Z]\w*(?=[(<])/,
    lookbehind: true,
    alias: "function"
  },
  "keyword": /\b(?:bitcast|break|case|const|continue|continuing|default|discard|else|enable|fallthrough|fn|for|function|if|let|loop|private|return|storage|struct|switch|type|uniform|var|while|workgroup)\b/,
  "builtin": /\b(?:abs|acos|acosh|all|any|array|asin|asinh|atan|atan2|atanh|atomic|atomicAdd|atomicAnd|atomicCompareExchangeWeak|atomicExchange|atomicLoad|atomicMax|atomicMin|atomicOr|atomicStore|atomicSub|atomicXor|bool|ceil|clamp|cos|cosh|countLeadingZeros|countOneBits|countTrailingZeros|cross|degrees|determinant|distance|dot|dpdx|dpdxCoarse|dpdxFine|dpdy|dpdyCoarse|dpdyFine|exp|exp2|extractBits|f32|f64|faceForward|firstLeadingBit|floor|fma|fract|frexp|fwidth|fwidthCoarse|fwidthFine|i32|i64|insertBits|inverseSqrt|ldexp|length|log|log2|mat[2-4]x[2-4]|max|min|mix|modf|normalize|override|pack2x16float|pack2x16snorm|pack2x16unorm|pack4x8snorm|pack4x8unorm|pow|ptr|quantizeToF16|radians|reflect|refract|reverseBits|round|sampler|sampler_comparison|select|shiftLeft|shiftRight|sign|sin|sinh|smoothstep|sqrt|staticAssert|step|storageBarrier|tan|tanh|textureDimensions|textureGather|textureGatherCompare|textureLoad|textureNumLayers|textureNumLevels|textureNumSamples|textureSample|textureSampleBias|textureSampleCompare|textureSampleCompareLevel|textureSampleGrad|textureSampleLevel|textureStore|texture_1d|texture_2d|texture_2d_array|texture_3d|texture_cube|texture_cube_array|texture_depth_2d|texture_depth_2d_array|texture_depth_cube|texture_depth_cube_array|texture_depth_multisampled_2d|texture_multisampled_2d|texture_storage_1d|texture_storage_2d|texture_storage_2d_array|texture_storage_3d|transpose|trunc|u32|u64|unpack2x16float|unpack2x16snorm|unpack2x16unorm|unpack4x8snorm|unpack4x8unorm|vec[2-4]|workgroupBarrier)\b/,
  "function-calls": {
    pattern: /\b[_a-z]\w*(?=\()/i,
    alias: "function"
  },
  "class-name": /\b(?:[A-Z][A-Za-z0-9]*)\b/,
  "bool-literal": {
    pattern: /\b(?:false|true)\b/,
    alias: "boolean"
  },
  "hex-int-literal": {
    pattern: /\b0[xX][0-9a-fA-F]+[iu]?\b(?![.pP])/,
    alias: "number"
  },
  "hex-float-literal": {
    pattern: /\b0[xX][0-9a-fA-F]*(?:\.[0-9a-fA-F]*)?(?:[pP][+-]?\d+[fh]?)?/,
    alias: "number"
  },
  "decimal-float-literal": [
    { pattern: /\d*\.\d+(?:[eE](?:\+|-)?\d+)?[fh]?/, alias: "number" },
    { pattern: /\d+\.\d*(?:[eE](?:\+|-)?\d+)?[fh]?/, alias: "number" },
    { pattern: /\d+[eE](?:\+|-)?\d+[fh]?/, alias: "number" },
    { pattern: /\b\d+[fh]\b/, alias: "number" }
  ],
  "int-literal": {
    pattern: /\b\d+[iu]?\b/,
    alias: "number"
  },
  "operator": [
    { pattern: /(?:\^|~|\|(?!\|)|\|\||&&|<<|>>|!)(?!=)/ },
    { pattern: /&(?![&=])/ },
    { pattern: /(?:\+=|-=|\*=|\/=|%=|\^=|&=|\|=|<<=|>>=)/ },
    { pattern: /(^|[^<>=!])=(?![=>])/, lookbehind: true },
    { pattern: /(?:==|!=|<=|\+\+|--|(^|[^=])>=)/, lookbehind: true },
    { pattern: /(?:(?:[+%]|(?:\*(?!\w)))(?!=))|(?:-(?!>))|(?:\/(?!\/))/ },
    { pattern: /->/ }
  ],
  "punctuation": /[@(){}[\],;<>:.]/
};

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-llvm.js
(function(Prism3) {
  Prism3.languages.llvm = {
    "comment": /;.*/,
    "string": {
      pattern: /"[^"]*"/,
      greedy: true
    },
    "boolean": /\b(?:false|true)\b/,
    "variable": /[%@!#](?:(?!\d)(?:[-$.\w]|\\[a-f\d]{2})+|\d+)/i,
    "label": /(?!\d)(?:[-$.\w]|\\[a-f\d]{2})+:/i,
    "type": {
      pattern: /\b(?:double|float|fp128|half|i[1-9]\d*|label|metadata|ppc_fp128|token|void|x86_fp80|x86_mmx)\b/,
      alias: "class-name"
    },
    "keyword": /\b[a-z_][a-z_0-9]*\b/,
    "number": /[+-]?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b|\b0x[\dA-Fa-f]+\b|\b0xK[\dA-Fa-f]{20}\b|\b0x[ML][\dA-Fa-f]{32}\b|\b0xH[\dA-Fa-f]{4}\b/,
    "punctuation": /[{}[\];(),.!*=<>]/
  };
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-armasm.js
Prism.languages.armasm = {
  "comment": {
    pattern: /;.*/,
    greedy: true
  },
  "string": {
    pattern: /"(?:[^"\r\n]|"")*"/,
    greedy: true,
    inside: {
      "variable": {
        pattern: /((?:^|[^$])(?:\${2})*)\$\w+/,
        lookbehind: true
      }
    }
  },
  "char": {
    pattern: /'(?:[^'\r\n]{0,4}|'')'/,
    greedy: true
  },
  "version-symbol": {
    pattern: /\|[\w@]+\|/,
    greedy: true,
    alias: "property"
  },
  "boolean": /\b(?:FALSE|TRUE)\b/,
  "directive": {
    pattern: /\b(?:ALIAS|ALIGN|AREA|ARM|ASSERT|ATTR|CN|CODE|CODE16|CODE32|COMMON|CP|DATA|DCB|DCD|DCDO|DCDU|DCFD|DCFDU|DCI|DCQ|DCQU|DCW|DCWU|DN|ELIF|ELSE|END|ENDFUNC|ENDIF|ENDP|ENTRY|EQU|EXPORT|EXPORTAS|EXTERN|FIELD|FILL|FN|FUNCTION|GBLA|GBLL|GBLS|GET|GLOBAL|IF|IMPORT|INCBIN|INCLUDE|INFO|KEEP|LCLA|LCLL|LCLS|LTORG|MACRO|MAP|MEND|MEXIT|NOFP|OPT|PRESERVE8|PROC|QN|READONLY|RELOC|REQUIRE|REQUIRE8|RLIST|ROUT|SETA|SETL|SETS|SN|SPACE|SUBT|THUMB|THUMBX|TTL|WEND|WHILE)\b/,
    alias: "property"
  },
  "instruction": {
    pattern: /((?:^|(?:^|[^\\])(?:\r\n?|\n))[ \t]*(?:(?:[A-Z][A-Z0-9_]*[a-z]\w*|[a-z]\w*|\d+)[ \t]+)?)\b[A-Z.]+\b/,
    lookbehind: true,
    alias: "keyword"
  },
  "variable": /\$\w+/,
  "number": /(?:\b[2-9]_\d+|(?:\b\d+(?:\.\d+)?|\B\.\d+)(?:e-?\d+)?|\b0(?:[fd]_|x)[0-9a-f]+|&[0-9a-f]+)\b/i,
  "register": {
    pattern: /\b(?:r\d|lr)\b/,
    alias: "symbol"
  },
  "operator": /<>|<<|>>|&&|\|\||[=!<>/]=?|[+\-*%#?&|^]|:[A-Z]+:/,
  "punctuation": /[()[\],]/
};
Prism.languages["arm-asm"] = Prism.languages.armasm;

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-nasm.js
Prism.languages.nasm = {
  "comment": /;.*$/m,
  "string": /(["'`])(?:\\.|(?!\1)[^\\\r\n])*\1/,
  "label": {
    pattern: /(^\s*)[A-Za-z._?$][\w.?$@~#]*:/m,
    lookbehind: true,
    alias: "function"
  },
  "keyword": [
    /\[?BITS (?:16|32|64)\]?/,
    {
      pattern: /(^\s*)section\s*[a-z.]+:?/im,
      lookbehind: true
    },
    /(?:extern|global)[^;\r\n]*/i,
    /(?:CPU|DEFAULT|FLOAT).*$/m
  ],
  "register": {
    pattern: /\b(?:st\d|[xyz]mm\d\d?|[cdt]r\d|r\d\d?[bwd]?|[er]?[abcd]x|[abcd][hl]|[er]?(?:bp|di|si|sp)|[cdefgs]s)\b/i,
    alias: "variable"
  },
  "number": /(?:\b|(?=\$))(?:0[hx](?:\.[\da-f]+|[\da-f]+(?:\.[\da-f]+)?)(?:p[+-]?\d+)?|\d[\da-f]+[hx]|\$\d[\da-f]*|0[oq][0-7]+|[0-7]+[oq]|0[by][01]+|[01]+[by]|0[dt]\d+|(?:\d+(?:\.\d+)?|\.\d+)(?:\.?e[+-]?\d+)?[dt]?)\b/i,
  "operator": /[\[\]*+\-\/%<>=&|$!]/
};

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-mermaid.js
Prism.languages.mermaid = {
  "comment": {
    pattern: /%%.*/,
    greedy: true
  },
  "style": {
    pattern: /^([ \t]*(?:classDef|linkStyle|style)[ \t]+[\w$-]+[ \t]+)\w.*[^\s;]/m,
    lookbehind: true,
    inside: {
      "property": /\b\w[\w-]*(?=[ \t]*:)/,
      "operator": /:/,
      "punctuation": /,/
    }
  },
  "inter-arrow-label": {
    pattern: /([^<>ox.=-])(?:-[-.]|==)(?![<>ox.=-])[ \t]*(?:"[^"\r\n]*"|[^\s".=-](?:[^\r\n.=-]*[^\s.=-])?)[ \t]*(?:\.+->?|--+[->]|==+[=>])(?![<>ox.=-])/,
    lookbehind: true,
    greedy: true,
    inside: {
      "arrow": {
        pattern: /(?:\.+->?|--+[->]|==+[=>])$/,
        alias: "operator"
      },
      "label": {
        pattern: /^([\s\S]{2}[ \t]*)\S(?:[\s\S]*\S)?/,
        lookbehind: true,
        alias: "property"
      },
      "arrow-head": {
        pattern: /^\S+/,
        alias: ["arrow", "operator"]
      }
    }
  },
  "arrow": [
    // This might look complex but it really isn't.
    // There are many possible arrows (see tests) and it's impossible to fit all of them into one pattern. The
    // problem is that we only have one lookbehind per pattern. However, we cannot disallow too many arrow
    // characters in the one lookbehind because that would create too many false negatives. So we have to split the
    // arrows into different patterns.
    {
      // ER diagram
      pattern: /(^|[^{}|o.-])[|}][|o](?:--|\.\.)[|o][|{](?![{}|o.-])/,
      lookbehind: true,
      alias: "operator"
    },
    {
      // flow chart
      // (?:==+|--+|-\.*-)
      pattern: /(^|[^<>ox.=-])(?:[<ox](?:==+|--+|-\.*-)[>ox]?|(?:==+|--+|-\.*-)[>ox]|===+|---+|-\.+-)(?![<>ox.=-])/,
      lookbehind: true,
      alias: "operator"
    },
    {
      // sequence diagram
      pattern: /(^|[^<>()x-])(?:--?(?:>>|[x>)])(?![<>()x])|(?:<<|[x<(])--?(?!-))/,
      lookbehind: true,
      alias: "operator"
    },
    {
      // class diagram
      pattern: /(^|[^<>|*o.-])(?:[*o]--|--[*o]|<\|?(?:--|\.\.)|(?:--|\.\.)\|?>|--|\.\.)(?![<>|*o.-])/,
      lookbehind: true,
      alias: "operator"
    }
  ],
  "label": {
    pattern: /(^|[^|<])\|(?:[^\r\n"|]|"[^"\r\n]*")+\|/,
    lookbehind: true,
    greedy: true,
    alias: "property"
  },
  "text": {
    pattern: /(?:[(\[{]+|\b>)(?:[^\r\n"()\[\]{}]|"[^"\r\n]*")+(?:[)\]}]+|>)/,
    alias: "string"
  },
  "string": {
    pattern: /"[^"\r\n]*"/,
    greedy: true
  },
  "annotation": {
    pattern: /<<(?:abstract|choice|enumeration|fork|interface|join|service)>>|\[\[(?:choice|fork|join)\]\]/i,
    alias: "important"
  },
  "keyword": [
    // This language has both case-sensitive and case-insensitive keywords
    {
      pattern: /(^[ \t]*)(?:action|callback|class|classDef|classDiagram|click|direction|erDiagram|flowchart|gantt|gitGraph|graph|journey|link|linkStyle|pie|requirementDiagram|sequenceDiagram|stateDiagram|stateDiagram-v2|style|subgraph)(?![\w$-])/m,
      lookbehind: true,
      greedy: true
    },
    {
      pattern: /(^[ \t]*)(?:activate|alt|and|as|autonumber|deactivate|else|end(?:[ \t]+note)?|loop|opt|par|participant|rect|state|note[ \t]+(?:over|(?:left|right)[ \t]+of))(?![\w$-])/im,
      lookbehind: true,
      greedy: true
    }
  ],
  "entity": /#[a-z0-9]+;/,
  "operator": {
    pattern: /(\w[ \t]*)&(?=[ \t]*\w)|:::|:/,
    lookbehind: true
  },
  "punctuation": /[(){};]/
};

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-dot.js
(function(Prism3) {
  var ID = "(?:" + [
    // an identifier
    /[a-zA-Z_\x80-\uFFFF][\w\x80-\uFFFF]*/.source,
    // a number
    /-?(?:\.\d+|\d+(?:\.\d*)?)/.source,
    // a double-quoted string
    /"[^"\\]*(?:\\[\s\S][^"\\]*)*"/.source,
    // HTML-like string
    /<(?:[^<>]|(?!<!--)<(?:[^<>"']|"[^"]*"|'[^']*')+>|<!--(?:[^-]|-(?!->))*-->)*>/.source
  ].join("|") + ")";
  var IDInside = {
    "markup": {
      pattern: /(^<)[\s\S]+(?=>$)/,
      lookbehind: true,
      alias: ["language-markup", "language-html", "language-xml"],
      inside: Prism3.languages.markup
    }
  };
  function withID(source, flags) {
    return RegExp(source.replace(/<ID>/g, function() {
      return ID;
    }), flags);
  }
  Prism3.languages.dot = {
    "comment": {
      pattern: /\/\/.*|\/\*[\s\S]*?\*\/|^#.*/m,
      greedy: true
    },
    "graph-name": {
      pattern: withID(/(\b(?:digraph|graph|subgraph)[ \t\r\n]+)<ID>/.source, "i"),
      lookbehind: true,
      greedy: true,
      alias: "class-name",
      inside: IDInside
    },
    "attr-value": {
      pattern: withID(/(=[ \t\r\n]*)<ID>/.source),
      lookbehind: true,
      greedy: true,
      inside: IDInside
    },
    "attr-name": {
      pattern: withID(/([\[;, \t\r\n])<ID>(?=[ \t\r\n]*=)/.source),
      lookbehind: true,
      greedy: true,
      inside: IDInside
    },
    "keyword": /\b(?:digraph|edge|graph|node|strict|subgraph)\b/i,
    "compass-point": {
      pattern: /(:[ \t\r\n]*)(?:[ewc_]|[ns][ew]?)(?![\w\x80-\uFFFF])/,
      lookbehind: true,
      alias: "builtin"
    },
    "node": {
      pattern: withID(/(^|[^-.\w\x80-\uFFFF\\])<ID>/.source),
      lookbehind: true,
      greedy: true,
      inside: IDInside
    },
    "operator": /[=:]|-[->]/,
    "punctuation": /[\[\]{};,]/
  };
  Prism3.languages.gv = Prism3.languages.dot;
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-plant-uml.js
(function(Prism3) {
  var variable = /\$\w+|%[a-z]+%/;
  var arrowAttr = /\[[^[\]]*\]/.source;
  var arrowDirection = /(?:[drlu]|do|down|le|left|ri|right|up)/.source;
  var arrowBody = "(?:-+" + arrowDirection + "-+|\\.+" + arrowDirection + "\\.+|-+(?:" + arrowAttr + "-*)?|" + arrowAttr + "-+|\\.+(?:" + arrowAttr + "\\.*)?|" + arrowAttr + "\\.+)";
  var arrowLeft = /(?:<{1,2}|\/{1,2}|\\{1,2}|<\||[#*^+}xo])/.source;
  var arrowRight = /(?:>{1,2}|\/{1,2}|\\{1,2}|\|>|[#*^+{xo])/.source;
  var arrowPrefix = /[[?]?[ox]?/.source;
  var arrowSuffix = /[ox]?[\]?]?/.source;
  var arrow = arrowPrefix + "(?:" + arrowBody + arrowRight + "|" + arrowLeft + arrowBody + "(?:" + arrowRight + ")?)" + arrowSuffix;
  Prism3.languages["plant-uml"] = {
    "comment": {
      pattern: /(^[ \t]*)(?:'.*|\/'[\s\S]*?'\/)/m,
      lookbehind: true,
      greedy: true
    },
    "preprocessor": {
      pattern: /(^[ \t]*)!.*/m,
      lookbehind: true,
      greedy: true,
      alias: "property",
      inside: {
        "variable": variable
      }
    },
    "delimiter": {
      pattern: /(^[ \t]*)@(?:end|start)uml\b/m,
      lookbehind: true,
      greedy: true,
      alias: "punctuation"
    },
    "arrow": {
      pattern: RegExp(/(^|[^-.<>?|\\[\]ox])/.source + arrow + /(?![-.<>?|\\\]ox])/.source),
      lookbehind: true,
      greedy: true,
      alias: "operator",
      inside: {
        "expression": {
          pattern: /(\[)[^[\]]+(?=\])/,
          lookbehind: true,
          inside: null
          // see below
        },
        "punctuation": /\[(?=$|\])|^\]/
      }
    },
    "string": {
      pattern: /"[^"]*"/,
      greedy: true
    },
    "text": {
      pattern: /(\[[ \t]*[\r\n]+(?![\r\n]))[^\]]*(?=\])/,
      lookbehind: true,
      greedy: true,
      alias: "string"
    },
    "keyword": [
      {
        pattern: /^([ \t]*)(?:abstract\s+class|end\s+(?:box|fork|group|merge|note|ref|split|title)|(?:fork|split)(?:\s+again)?|activate|actor|agent|alt|annotation|artifact|autoactivate|autonumber|backward|binary|boundary|box|break|caption|card|case|circle|class|clock|cloud|collections|component|concise|control|create|critical|database|deactivate|destroy|detach|diamond|else|elseif|end|end[hr]note|endif|endswitch|endwhile|entity|enum|file|folder|footer|frame|group|[hr]?note|header|hexagon|hide|if|interface|label|legend|loop|map|namespace|network|newpage|node|nwdiag|object|opt|package|page|par|participant|person|queue|rectangle|ref|remove|repeat|restore|return|robust|scale|set|show|skinparam|stack|start|state|stop|storage|switch|title|together|usecase|usecase\/|while)(?=\s|$)/m,
        lookbehind: true,
        greedy: true
      },
      /\b(?:elseif|equals|not|while)(?=\s*\()/,
      /\b(?:as|is|then)\b/
    ],
    "divider": {
      pattern: /^==.+==$/m,
      greedy: true,
      alias: "important"
    },
    "time": {
      pattern: /@(?:\d+(?:[:/]\d+){2}|[+-]?\d+|:[a-z]\w*(?:[+-]\d+)?)\b/i,
      greedy: true,
      alias: "number"
    },
    "color": {
      pattern: /#(?:[a-z_]+|[a-fA-F0-9]+)\b/,
      alias: "symbol"
    },
    "variable": variable,
    "punctuation": /[:,;()[\]{}]|\.{3}/
  };
  Prism3.languages["plant-uml"].arrow.inside.expression.inside = Prism3.languages["plant-uml"];
  Prism3.languages["plantuml"] = Prism3.languages["plant-uml"];
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-latex.js
(function(Prism3) {
  var funcPattern = /\\(?:[^a-z()[\]]|[a-z*]+)/i;
  var insideEqu = {
    "equation-command": {
      pattern: funcPattern,
      alias: "regex"
    }
  };
  Prism3.languages.latex = {
    "comment": /%.*/,
    // the verbatim environment prints whitespace to the document
    "cdata": {
      pattern: /(\\begin\{((?:lstlisting|verbatim)\*?)\})[\s\S]*?(?=\\end\{\2\})/,
      lookbehind: true
    },
    /*
     * equations can be between $$ $$ or $ $ or \( \) or \[ \]
     * (all are multiline)
     */
    "equation": [
      {
        pattern: /\$\$(?:\\[\s\S]|[^\\$])+\$\$|\$(?:\\[\s\S]|[^\\$])+\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]/,
        inside: insideEqu,
        alias: "string"
      },
      {
        pattern: /(\\begin\{((?:align|eqnarray|equation|gather|math|multline)\*?)\})[\s\S]*?(?=\\end\{\2\})/,
        lookbehind: true,
        inside: insideEqu,
        alias: "string"
      }
    ],
    /*
     * arguments which are keywords or references are highlighted
     * as keywords
     */
    "keyword": {
      pattern: /(\\(?:begin|cite|documentclass|end|label|ref|usepackage)(?:\[[^\]]+\])?\{)[^}]+(?=\})/,
      lookbehind: true
    },
    "url": {
      pattern: /(\\url\{)[^}]+(?=\})/,
      lookbehind: true
    },
    /*
     * section or chapter headlines are highlighted as bold so that
     * they stand out more
     */
    "headline": {
      pattern: /(\\(?:chapter|frametitle|paragraph|part|section|subparagraph|subsection|subsubparagraph|subsubsection|subsubsubparagraph)\*?(?:\[[^\]]+\])?\{)[^}]+(?=\})/,
      lookbehind: true,
      alias: "class-name"
    },
    "function": {
      pattern: funcPattern,
      alias: "selector"
    },
    "punctuation": /[[\]{}&]/
  };
  Prism3.languages.tex = Prism3.languages.latex;
  Prism3.languages.context = Prism3.languages.latex;
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-rest.js
Prism.languages.rest = {
  "table": [
    {
      pattern: /(^[\t ]*)(?:\+[=-]+)+\+(?:\r?\n|\r)(?:\1[+|].+[+|](?:\r?\n|\r))+\1(?:\+[=-]+)+\+/m,
      lookbehind: true,
      inside: {
        "punctuation": /\||(?:\+[=-]+)+\+/
      }
    },
    {
      pattern: /(^[\t ]*)=+ [ =]*=(?:(?:\r?\n|\r)\1.+)+(?:\r?\n|\r)\1=+ [ =]*=(?=(?:\r?\n|\r){2}|\s*$)/m,
      lookbehind: true,
      inside: {
        "punctuation": /[=-]+/
      }
    }
  ],
  // Directive-like patterns
  "substitution-def": {
    pattern: /(^[\t ]*\.\. )\|(?:[^|\s](?:[^|]*[^|\s])?)\| [^:]+::/m,
    lookbehind: true,
    inside: {
      "substitution": {
        pattern: /^\|(?:[^|\s]|[^|\s][^|]*[^|\s])\|/,
        alias: "attr-value",
        inside: {
          "punctuation": /^\||\|$/
        }
      },
      "directive": {
        pattern: /( )(?! )[^:]+::/,
        lookbehind: true,
        alias: "function",
        inside: {
          "punctuation": /::$/
        }
      }
    }
  },
  "link-target": [
    {
      pattern: /(^[\t ]*\.\. )\[[^\]]+\]/m,
      lookbehind: true,
      alias: "string",
      inside: {
        "punctuation": /^\[|\]$/
      }
    },
    {
      pattern: /(^[\t ]*\.\. )_(?:`[^`]+`|(?:[^:\\]|\\.)+):/m,
      lookbehind: true,
      alias: "string",
      inside: {
        "punctuation": /^_|:$/
      }
    }
  ],
  "directive": {
    pattern: /(^[\t ]*\.\. )[^:]+::/m,
    lookbehind: true,
    alias: "function",
    inside: {
      "punctuation": /::$/
    }
  },
  "comment": {
    // The two alternatives try to prevent highlighting of blank comments
    pattern: /(^[\t ]*\.\.)(?:(?: .+)?(?:(?:\r?\n|\r).+)+| .+)(?=(?:\r?\n|\r){2}|$)/m,
    lookbehind: true
  },
  "title": [
    // Overlined and underlined
    {
      pattern: /^(([!"#$%&'()*+,\-.\/:;<=>?@\[\\\]^_`{|}~])\2+)(?:\r?\n|\r).+(?:\r?\n|\r)\1$/m,
      inside: {
        "punctuation": /^[!"#$%&'()*+,\-.\/:;<=>?@\[\\\]^_`{|}~]+|[!"#$%&'()*+,\-.\/:;<=>?@\[\\\]^_`{|}~]+$/,
        "important": /.+/
      }
    },
    // Underlined only
    {
      pattern: /(^|(?:\r?\n|\r){2}).+(?:\r?\n|\r)([!"#$%&'()*+,\-.\/:;<=>?@\[\\\]^_`{|}~])\2+(?=\r?\n|\r|$)/,
      lookbehind: true,
      inside: {
        "punctuation": /[!"#$%&'()*+,\-.\/:;<=>?@\[\\\]^_`{|}~]+$/,
        "important": /.+/
      }
    }
  ],
  "hr": {
    pattern: /((?:\r?\n|\r){2})([!"#$%&'()*+,\-.\/:;<=>?@\[\\\]^_`{|}~])\2{3,}(?=(?:\r?\n|\r){2})/,
    lookbehind: true,
    alias: "punctuation"
  },
  "field": {
    pattern: /(^[\t ]*):[^:\r\n]+:(?= )/m,
    lookbehind: true,
    alias: "attr-name"
  },
  "command-line-option": {
    pattern: /(^[\t ]*)(?:[+-][a-z\d]|(?:--|\/)[a-z\d-]+)(?:[ =](?:[a-z][\w-]*|<[^<>]+>))?(?:, (?:[+-][a-z\d]|(?:--|\/)[a-z\d-]+)(?:[ =](?:[a-z][\w-]*|<[^<>]+>))?)*(?=(?:\r?\n|\r)? {2,}\S)/im,
    lookbehind: true,
    alias: "symbol"
  },
  "literal-block": {
    pattern: /::(?:\r?\n|\r){2}([ \t]+)(?![ \t]).+(?:(?:\r?\n|\r)\1.+)*/,
    inside: {
      "literal-block-punctuation": {
        pattern: /^::/,
        alias: "punctuation"
      }
    }
  },
  "quoted-literal-block": {
    pattern: /::(?:\r?\n|\r){2}([!"#$%&'()*+,\-.\/:;<=>?@\[\\\]^_`{|}~]).*(?:(?:\r?\n|\r)\1.*)*/,
    inside: {
      "literal-block-punctuation": {
        pattern: /^(?:::|([!"#$%&'()*+,\-.\/:;<=>?@\[\\\]^_`{|}~])\1*)/m,
        alias: "punctuation"
      }
    }
  },
  "list-bullet": {
    pattern: /(^[\t ]*)(?:[*+\-•‣⁃]|\(?(?:\d+|[a-z]|[ivxdclm]+)\)|(?:\d+|[a-z]|[ivxdclm]+)\.)(?= )/im,
    lookbehind: true,
    alias: "punctuation"
  },
  "doctest-block": {
    pattern: /(^[\t ]*)>>> .+(?:(?:\r?\n|\r).+)*/m,
    lookbehind: true,
    inside: {
      "punctuation": /^>>>/
    }
  },
  "inline": [
    {
      pattern: /(^|[\s\-:\/'"<(\[{])(?::[^:]+:`.*?`|`.*?`:[^:]+:|(\*\*?|``?|\|)(?!\s)(?:(?!\2).)*\S\2(?=[\s\-.,:;!?\\\/'")\]}]|$))/m,
      lookbehind: true,
      inside: {
        "bold": {
          pattern: /(^\*\*).+(?=\*\*$)/,
          lookbehind: true
        },
        "italic": {
          pattern: /(^\*).+(?=\*$)/,
          lookbehind: true
        },
        "inline-literal": {
          pattern: /(^``).+(?=``$)/,
          lookbehind: true,
          alias: "symbol"
        },
        "role": {
          pattern: /^:[^:]+:|:[^:]+:$/,
          alias: "function",
          inside: {
            "punctuation": /^:|:$/
          }
        },
        "interpreted-text": {
          pattern: /(^`).+(?=`$)/,
          lookbehind: true,
          alias: "attr-value"
        },
        "substitution": {
          pattern: /(^\|).+(?=\|$)/,
          lookbehind: true,
          alias: "attr-value"
        },
        "punctuation": /\*\*?|``?|\|/
      }
    }
  ],
  "link": [
    {
      pattern: /\[[^\[\]]+\]_(?=[\s\-.,:;!?\\\/'")\]}]|$)/,
      alias: "string",
      inside: {
        "punctuation": /^\[|\]_$/
      }
    },
    {
      pattern: /(?:\b[a-z\d]+(?:[_.:+][a-z\d]+)*_?_|`[^`]+`_?_|_`[^`]+`)(?=[\s\-.,:;!?\\\/'")\]}]|$)/i,
      alias: "string",
      inside: {
        "punctuation": /^_?`|`$|`?_?_$/
      }
    }
  ],
  // Line block start,
  // quote attribution,
  // explicit markup start,
  // and anonymous hyperlink target shortcut (__)
  "punctuation": {
    pattern: /(^[\t ]*)(?:\|(?= |$)|(?:---?|—|\.\.|__)(?= )|\.\.$)/m,
    lookbehind: true
  }
};

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-bnf.js
Prism.languages.bnf = {
  "string": {
    pattern: /"[^\r\n"]*"|'[^\r\n']*'/
  },
  "definition": {
    pattern: /<[^<>\r\n\t]+>(?=\s*::=)/,
    alias: ["rule", "keyword"],
    inside: {
      "punctuation": /^<|>$/
    }
  },
  "rule": {
    pattern: /<[^<>\r\n\t]+>/,
    inside: {
      "punctuation": /^<|>$/
    }
  },
  "operator": /::=|[|()[\]{}*+?]|\.{3}/
};
Prism.languages.rbnf = Prism.languages.bnf;

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-ebnf.js
Prism.languages.ebnf = {
  "comment": /\(\*[\s\S]*?\*\)/,
  "string": {
    pattern: /"[^"\r\n]*"|'[^'\r\n]*'/,
    greedy: true
  },
  "special": {
    pattern: /\?[^?\r\n]*\?/,
    greedy: true,
    alias: "class-name"
  },
  "definition": {
    pattern: /^([\t ]*)[a-z]\w*(?:[ \t]+[a-z]\w*)*(?=\s*=)/im,
    lookbehind: true,
    alias: ["rule", "keyword"]
  },
  "rule": /\b[a-z]\w*(?:[ \t]+[a-z]\w*)*\b/i,
  "punctuation": /\([:/]|[:/]\)|[.,;()[\]{}]/,
  "operator": /[-=|*/!]/
};

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-puppet.js
(function(Prism3) {
  Prism3.languages.puppet = {
    "heredoc": [
      // Matches the content of a quoted heredoc string (subject to interpolation)
      {
        pattern: /(@\("([^"\r\n\/):]+)"(?:\/[nrts$uL]*)?\).*(?:\r?\n|\r))(?:.*(?:\r?\n|\r(?!\n)))*?[ \t]*(?:\|[ \t]*)?(?:-[ \t]*)?\2/,
        lookbehind: true,
        alias: "string",
        inside: {
          // Matches the end tag
          "punctuation": /(?=\S).*\S(?= *$)/
          // See interpolation below
        }
      },
      // Matches the content of an unquoted heredoc string (no interpolation)
      {
        pattern: /(@\(([^"\r\n\/):]+)(?:\/[nrts$uL]*)?\).*(?:\r?\n|\r))(?:.*(?:\r?\n|\r(?!\n)))*?[ \t]*(?:\|[ \t]*)?(?:-[ \t]*)?\2/,
        lookbehind: true,
        greedy: true,
        alias: "string",
        inside: {
          // Matches the end tag
          "punctuation": /(?=\S).*\S(?= *$)/
        }
      },
      // Matches the start tag of heredoc strings
      {
        pattern: /@\("?(?:[^"\r\n\/):]+)"?(?:\/[nrts$uL]*)?\)/,
        alias: "string",
        inside: {
          "punctuation": {
            pattern: /(\().+?(?=\))/,
            lookbehind: true
          }
        }
      }
    ],
    "multiline-comment": {
      pattern: /(^|[^\\])\/\*[\s\S]*?\*\//,
      lookbehind: true,
      greedy: true,
      alias: "comment"
    },
    "regex": {
      // Must be prefixed with the keyword "node" or a non-word char
      pattern: /((?:\bnode\s+|[~=\(\[\{,]\s*|[=+]>\s*|^\s*))\/(?:[^\/\\]|\\[\s\S])+\/(?:[imx]+\b|\B)/,
      lookbehind: true,
      greedy: true,
      inside: {
        // Extended regexes must have the x flag. They can contain single-line comments.
        "extended-regex": {
          pattern: /^\/(?:[^\/\\]|\\[\s\S])+\/[im]*x[im]*$/,
          inside: {
            "comment": /#.*/
          }
        }
      }
    },
    "comment": {
      pattern: /(^|[^\\])#.*/,
      lookbehind: true,
      greedy: true
    },
    "string": {
      // Allow for one nested level of double quotes inside interpolation
      pattern: /(["'])(?:\$\{(?:[^'"}]|(["'])(?:(?!\2)[^\\]|\\[\s\S])*\2)+\}|\$(?!\{)|(?!\1)[^\\$]|\\[\s\S])*\1/,
      greedy: true,
      inside: {
        "double-quoted": {
          pattern: /^"[\s\S]*"$/,
          inside: {
            // See interpolation below
          }
        }
      }
    },
    "variable": {
      pattern: /\$(?:::)?\w+(?:::\w+)*/,
      inside: {
        "punctuation": /::/
      }
    },
    "attr-name": /(?:\b\w+|\*)(?=\s*=>)/,
    "function": [
      {
        pattern: /(\.)(?!\d)\w+/,
        lookbehind: true
      },
      /\b(?:contain|debug|err|fail|include|info|notice|realize|require|tag|warning)\b|\b(?!\d)\w+(?=\()/
    ],
    "number": /\b(?:0x[a-f\d]+|\d+(?:\.\d+)?(?:e-?\d+)?)\b/i,
    "boolean": /\b(?:false|true)\b/,
    // Includes words reserved for future use
    "keyword": /\b(?:application|attr|case|class|consumes|default|define|else|elsif|function|if|import|inherits|node|private|produces|type|undef|unless)\b/,
    "datatype": {
      pattern: /\b(?:Any|Array|Boolean|Callable|Catalogentry|Class|Collection|Data|Default|Enum|Float|Hash|Integer|NotUndef|Numeric|Optional|Pattern|Regexp|Resource|Runtime|Scalar|String|Struct|Tuple|Type|Undef|Variant)\b/,
      alias: "symbol"
    },
    "operator": /=[=~>]?|![=~]?|<(?:<\|?|[=~|-])?|>[>=]?|->?|~>|\|>?>?|[*\/%+?]|\b(?:and|in|or)\b/,
    "punctuation": /[\[\]{}().,;]|:+/
  };
  var interpolation = [
    {
      // Allow for one nested level of braces inside interpolation
      pattern: /(^|[^\\])\$\{(?:[^'"{}]|\{[^}]*\}|(["'])(?:(?!\2)[^\\]|\\[\s\S])*\2)+\}/,
      lookbehind: true,
      inside: {
        "short-variable": {
          // Negative look-ahead prevent wrong highlighting of functions
          pattern: /(^\$\{)(?!\w+\()(?:::)?\w+(?:::\w+)*/,
          lookbehind: true,
          alias: "variable",
          inside: {
            "punctuation": /::/
          }
        },
        "delimiter": {
          pattern: /^\$/,
          alias: "variable"
        },
        rest: Prism3.languages.puppet
      }
    },
    {
      pattern: /(^|[^\\])\$(?:::)?\w+(?:::\w+)*/,
      lookbehind: true,
      alias: "variable",
      inside: {
        "punctuation": /::/
      }
    }
  ];
  Prism3.languages.puppet["heredoc"][0].inside.interpolation = interpolation;
  Prism3.languages.puppet["string"].inside["double-quoted"].inside.interpolation = interpolation;
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-awk.js
Prism.languages.awk = {
  "hashbang": {
    pattern: /^#!.*/,
    greedy: true,
    alias: "comment"
  },
  "comment": {
    pattern: /#.*/,
    greedy: true
  },
  "string": {
    pattern: /(^|[^\\])"(?:[^\\"\r\n]|\\.)*"/,
    lookbehind: true,
    greedy: true
  },
  "regex": {
    pattern: /((?:^|[^\w\s)])\s*)\/(?:[^\/\\\r\n]|\\.)*\//,
    lookbehind: true,
    greedy: true
  },
  "variable": /\$\w+/,
  "keyword": /\b(?:BEGIN|BEGINFILE|END|ENDFILE|break|case|continue|default|delete|do|else|exit|for|function|getline|if|in|next|nextfile|printf?|return|switch|while)\b|@(?:include|load)\b/,
  "function": /\b[a-z_]\w*(?=\s*\()/i,
  "number": /\b(?:\d+(?:\.\d+)?(?:e[+-]?\d+)?|0x[a-fA-F0-9]+)\b/,
  "operator": /--|\+\+|!?~|>&|>>|<<|(?:\*\*|[<>!=+\-*/%^])=?|&&|\|[|&]|[?:]/,
  "punctuation": /[()[\]{},;]/
};
Prism.languages.gawk = Prism.languages.awk;

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-tcl.js
Prism.languages.tcl = {
  "comment": {
    pattern: /(^|[^\\])#.*/,
    lookbehind: true
  },
  "string": {
    pattern: /"(?:[^"\\\r\n]|\\(?:\r\n|[\s\S]))*"/,
    greedy: true
  },
  "variable": [
    {
      pattern: /(\$)(?:::)?(?:[a-zA-Z0-9]+::)*\w+/,
      lookbehind: true
    },
    {
      pattern: /(\$)\{[^}]+\}/,
      lookbehind: true
    },
    {
      pattern: /(^[\t ]*set[ \t]+)(?:::)?(?:[a-zA-Z0-9]+::)*\w+/m,
      lookbehind: true
    }
  ],
  "function": {
    pattern: /(^[\t ]*proc[ \t]+)\S+/m,
    lookbehind: true
  },
  "builtin": [
    {
      pattern: /(^[\t ]*)(?:break|class|continue|error|eval|exit|for|foreach|if|proc|return|switch|while)\b/m,
      lookbehind: true
    },
    /\b(?:else|elseif)\b/
  ],
  "scope": {
    pattern: /(^[\t ]*)(?:global|upvar|variable)\b/m,
    lookbehind: true,
    alias: "constant"
  },
  "keyword": {
    pattern: /(^[\t ]*|\[)(?:Safe_Base|Tcl|after|append|apply|array|auto_(?:execok|import|load|mkindex|qualify|reset)|automkindex_old|bgerror|binary|catch|cd|chan|clock|close|concat|dde|dict|encoding|eof|exec|expr|fblocked|fconfigure|fcopy|file(?:event|name)?|flush|gets|glob|history|http|incr|info|interp|join|lappend|lassign|lindex|linsert|list|llength|load|lrange|lrepeat|lreplace|lreverse|lsearch|lset|lsort|math(?:func|op)|memory|msgcat|namespace|open|package|parray|pid|pkg_mkIndex|platform|puts|pwd|re_syntax|read|refchan|regexp|registry|regsub|rename|scan|seek|set|socket|source|split|string|subst|tcl(?:_endOfWord|_findLibrary|startOf(?:Next|Previous)Word|test|vars|wordBreak(?:After|Before))|tell|time|tm|trace|unknown|unload|unset|update|uplevel|vwait)\b/m,
    lookbehind: true
  },
  "operator": /!=?|\*\*?|==|&&?|\|\|?|<[=<]?|>[=>]?|[-+~\/%?^]|\b(?:eq|in|ne|ni)\b/,
  "punctuation": /[{}()\[\]]/
};

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-vim.js
Prism.languages.vim = {
  "string": /"(?:[^"\\\r\n]|\\.)*"|'(?:[^'\r\n]|'')*'/,
  "comment": /".*/,
  "function": /\b\w+(?=\()/,
  "keyword": /\b(?:N|Next|P|Print|X|XMLent|XMLns|ab|abbreviate|abc|abclear|abo|aboveleft|al|all|ar|arga|argadd|argd|argdelete|argdo|arge|argedit|argg|argglobal|argl|arglocal|args|argu|argument|as|ascii|b|bN|bNext|ba|bad|badd|ball|bd|bdelete|be|bel|belowright|bf|bfirst|bl|blast|bm|bmodified|bn|bnext|bo|botright|bp|bprevious|br|brea|break|breaka|breakadd|breakd|breakdel|breakl|breaklist|brewind|bro|browse|bufdo|buffer|buffers|bun|bunload|bw|bwipeout|c|cN|cNext|cNfcNfile|ca|cabbrev|cabc|cabclear|cad|caddb|caddbuffer|caddexpr|caddf|caddfile|cal|call|cat|catch|cb|cbuffer|cc|ccl|cclose|cd|ce|center|cex|cexpr|cf|cfile|cfir|cfirst|cg|cgetb|cgetbuffer|cgete|cgetexpr|cgetfile|change|changes|chd|chdir|che|checkpath|checkt|checktime|cl|cla|clast|clist|clo|close|cmapc|cmapclear|cn|cnew|cnewer|cnext|cnf|cnfile|cnorea|cnoreabbrev|co|col|colder|colo|colorscheme|comc|comclear|comp|compiler|con|conf|confirm|continue|cope|copen|copy|cp|cpf|cpfile|cprevious|cq|cquit|cr|crewind|cu|cuna|cunabbrev|cunmap|cw|cwindow|d|debugg|debuggreedy|delc|delcommand|delete|delf|delfunction|delm|delmarks|di|diffg|diffget|diffoff|diffpatch|diffpu|diffput|diffsplit|diffthis|diffu|diffupdate|dig|digraphs|display|dj|djump|dl|dlist|dr|drop|ds|dsearch|dsp|dsplit|e|earlier|echoe|echoerr|echom|echomsg|echon|edit|el|else|elsei|elseif|em|emenu|en|endf|endfo|endfor|endfun|endfunction|endif|endt|endtry|endw|endwhile|ene|enew|ex|exi|exit|exu|exusage|f|file|files|filetype|fin|fina|finally|find|fini|finish|fir|first|fix|fixdel|fo|fold|foldc|foldclose|foldd|folddoc|folddoclosed|folddoopen|foldo|foldopen|for|fu|fun|function|go|goto|gr|grep|grepa|grepadd|h|ha|hardcopy|help|helpf|helpfind|helpg|helpgrep|helpt|helptags|hid|hide|his|history|ia|iabbrev|iabc|iabclear|if|ij|ijump|il|ilist|imapc|imapclear|in|inorea|inoreabbrev|isearch|isp|isplit|iu|iuna|iunabbrev|iunmap|j|join|ju|jumps|k|kee|keepalt|keepj|keepjumps|keepmarks|l|lN|lNext|lNf|lNfile|la|lad|laddb|laddbuffer|laddexpr|laddf|laddfile|lan|language|last|later|lb|lbuffer|lc|lcd|lch|lchdir|lcl|lclose|left|lefta|leftabove|let|lex|lexpr|lf|lfile|lfir|lfirst|lg|lgetb|lgetbuffer|lgete|lgetexpr|lgetfile|lgr|lgrep|lgrepa|lgrepadd|lh|lhelpgrep|list|ll|lla|llast|lli|llist|lm|lmak|lmake|lmap|lmapc|lmapclear|ln|lne|lnew|lnewer|lnext|lnf|lnfile|lnoremap|lo|loadview|loc|lockmarks|lockv|lockvar|lol|lolder|lop|lopen|lp|lpf|lpfile|lprevious|lr|lrewind|ls|lt|ltag|lu|lunmap|lv|lvimgrep|lvimgrepa|lvimgrepadd|lw|lwindow|m|ma|mak|make|mark|marks|mat|match|menut|menutranslate|mk|mkexrc|mks|mksession|mksp|mkspell|mkv|mkvie|mkview|mkvimrc|mod|mode|move|mz|mzf|mzfile|mzscheme|n|nbkey|new|next|nmapc|nmapclear|noh|nohlsearch|norea|noreabbrev|nu|number|nun|nunmap|o|omapc|omapclear|on|only|open|opt|options|ou|ounmap|p|pc|pclose|pe|ped|pedit|perl|perld|perldo|po|pop|popu|popup|pp|ppop|pre|preserve|prev|previous|print|prof|profd|profdel|profile|promptf|promptfind|promptr|promptrepl|ps|psearch|ptN|ptNext|pta|ptag|ptf|ptfirst|ptj|ptjump|ptl|ptlast|ptn|ptnext|ptp|ptprevious|ptr|ptrewind|pts|ptselect|pu|put|pw|pwd|py|pyf|pyfile|python|q|qa|qall|quit|quita|quitall|r|read|rec|recover|red|redi|redir|redo|redr|redraw|redraws|redrawstatus|reg|registers|res|resize|ret|retab|retu|return|rew|rewind|ri|right|rightb|rightbelow|ru|rub|ruby|rubyd|rubydo|rubyf|rubyfile|runtime|rv|rviminfo|sN|sNext|sa|sal|sall|san|sandbox|sargument|sav|saveas|sb|sbN|sbNext|sba|sball|sbf|sbfirst|sbl|sblast|sbm|sbmodified|sbn|sbnext|sbp|sbprevious|sbr|sbrewind|sbuffer|scrip|scripte|scriptencoding|scriptnames|se|set|setf|setfiletype|setg|setglobal|setl|setlocal|sf|sfind|sfir|sfirst|sh|shell|sign|sil|silent|sim|simalt|sl|sla|slast|sleep|sm|smagic|smap|smapc|smapclear|sme|smenu|sn|snext|sni|sniff|sno|snomagic|snor|snoremap|snoreme|snoremenu|so|sor|sort|source|sp|spe|spelld|spelldump|spellgood|spelli|spellinfo|spellr|spellrepall|spellu|spellundo|spellw|spellwrong|split|spr|sprevious|sre|srewind|st|sta|stag|star|startg|startgreplace|startinsert|startr|startreplace|stj|stjump|stop|stopi|stopinsert|sts|stselect|sun|sunhide|sunm|sunmap|sus|suspend|sv|sview|syncbind|t|tN|tNext|ta|tab|tabN|tabNext|tabc|tabclose|tabd|tabdo|tabe|tabedit|tabf|tabfind|tabfir|tabfirst|tabl|tablast|tabm|tabmove|tabn|tabnew|tabnext|tabo|tabonly|tabp|tabprevious|tabr|tabrewind|tabs|tag|tags|tc|tcl|tcld|tcldo|tclf|tclfile|te|tearoff|tf|tfirst|th|throw|tj|tjump|tl|tlast|tm|tmenu|tn|tnext|to|topleft|tp|tprevious|tr|trewind|try|ts|tselect|tu|tunmenu|u|una|unabbreviate|undo|undoj|undojoin|undol|undolist|unh|unhide|unlet|unlo|unlockvar|unm|unmap|up|update|ve|verb|verbose|version|vert|vertical|vi|vie|view|vim|vimgrep|vimgrepa|vimgrepadd|visual|viu|viusage|vmapc|vmapclear|vne|vnew|vs|vsplit|vu|vunmap|w|wN|wNext|wa|wall|wh|while|win|winc|wincmd|windo|winp|winpos|winsize|wn|wnext|wp|wprevious|wq|wqa|wqall|write|ws|wsverb|wv|wviminfo|x|xa|xall|xit|xm|xmap|xmapc|xmapclear|xme|xmenu|xn|xnoremap|xnoreme|xnoremenu|xu|xunmap|y|yank)\b/,
  "builtin": /\b(?:acd|ai|akm|aleph|allowrevins|altkeymap|ambiwidth|ambw|anti|antialias|arab|arabic|arabicshape|ari|arshape|autochdir|autocmd|autoindent|autoread|autowrite|autowriteall|aw|awa|background|backspace|backup|backupcopy|backupdir|backupext|backupskip|balloondelay|ballooneval|balloonexpr|bdir|bdlay|beval|bex|bexpr|bg|bh|bin|binary|biosk|bioskey|bk|bkc|bomb|breakat|brk|browsedir|bs|bsdir|bsk|bt|bufhidden|buflisted|buftype|casemap|ccv|cdpath|cedit|cfu|ch|charconvert|ci|cin|cindent|cink|cinkeys|cino|cinoptions|cinw|cinwords|clipboard|cmdheight|cmdwinheight|cmp|cms|columns|com|comments|commentstring|compatible|complete|completefunc|completeopt|consk|conskey|copyindent|cot|cpo|cpoptions|cpt|cscopepathcomp|cscopeprg|cscopequickfix|cscopetag|cscopetagorder|cscopeverbose|cspc|csprg|csqf|cst|csto|csverb|cuc|cul|cursorcolumn|cursorline|cwh|debug|deco|def|define|delcombine|dex|dg|dict|dictionary|diff|diffexpr|diffopt|digraph|dip|dir|directory|dy|ea|ead|eadirection|eb|ed|edcompatible|ef|efm|ei|ek|enc|encoding|endofline|eol|ep|equalalways|equalprg|errorbells|errorfile|errorformat|esckeys|et|eventignore|expandtab|exrc|fcl|fcs|fdc|fde|fdi|fdl|fdls|fdm|fdn|fdo|fdt|fen|fenc|fencs|fex|ff|ffs|fileencoding|fileencodings|fileformat|fileformats|fillchars|fk|fkmap|flp|fml|fmr|foldcolumn|foldenable|foldexpr|foldignore|foldlevel|foldlevelstart|foldmarker|foldmethod|foldminlines|foldnestmax|foldtext|formatexpr|formatlistpat|formatoptions|formatprg|fp|fs|fsync|ft|gcr|gd|gdefault|gfm|gfn|gfs|gfw|ghr|gp|grepformat|grepprg|gtl|gtt|guicursor|guifont|guifontset|guifontwide|guiheadroom|guioptions|guipty|guitablabel|guitabtooltip|helpfile|helpheight|helplang|hf|hh|hi|hidden|highlight|hk|hkmap|hkmapp|hkp|hl|hlg|hls|hlsearch|ic|icon|iconstring|ignorecase|im|imactivatekey|imak|imc|imcmdline|imd|imdisable|imi|iminsert|ims|imsearch|inc|include|includeexpr|incsearch|inde|indentexpr|indentkeys|indk|inex|inf|infercase|insertmode|invacd|invai|invakm|invallowrevins|invaltkeymap|invanti|invantialias|invar|invarab|invarabic|invarabicshape|invari|invarshape|invautochdir|invautoindent|invautoread|invautowrite|invautowriteall|invaw|invawa|invbackup|invballooneval|invbeval|invbin|invbinary|invbiosk|invbioskey|invbk|invbl|invbomb|invbuflisted|invcf|invci|invcin|invcindent|invcompatible|invconfirm|invconsk|invconskey|invcopyindent|invcp|invcscopetag|invcscopeverbose|invcst|invcsverb|invcuc|invcul|invcursorcolumn|invcursorline|invdeco|invdelcombine|invdg|invdiff|invdigraph|invdisable|invea|inveb|inved|invedcompatible|invek|invendofline|inveol|invequalalways|inverrorbells|invesckeys|invet|invex|invexpandtab|invexrc|invfen|invfk|invfkmap|invfoldenable|invgd|invgdefault|invguipty|invhid|invhidden|invhk|invhkmap|invhkmapp|invhkp|invhls|invhlsearch|invic|invicon|invignorecase|invim|invimc|invimcmdline|invimd|invincsearch|invinf|invinfercase|invinsertmode|invis|invjoinspaces|invjs|invlazyredraw|invlbr|invlinebreak|invlisp|invlist|invloadplugins|invlpl|invlz|invma|invmacatsui|invmagic|invmh|invml|invmod|invmodeline|invmodifiable|invmodified|invmore|invmousef|invmousefocus|invmousehide|invnu|invnumber|invodev|invopendevice|invpaste|invpi|invpreserveindent|invpreviewwindow|invprompt|invpvw|invreadonly|invremap|invrestorescreen|invrevins|invri|invrightleft|invrightleftcmd|invrl|invrlc|invro|invrs|invru|invruler|invsb|invsc|invscb|invscrollbind|invscs|invsecure|invsft|invshellslash|invshelltemp|invshiftround|invshortname|invshowcmd|invshowfulltag|invshowmatch|invshowmode|invsi|invsm|invsmartcase|invsmartindent|invsmarttab|invsmd|invsn|invsol|invspell|invsplitbelow|invsplitright|invspr|invsr|invssl|invsta|invstartofline|invstmp|invswapfile|invswf|invta|invtagbsearch|invtagrelative|invtagstack|invtbi|invtbidi|invtbs|invtermbidi|invterse|invtextauto|invtextmode|invtf|invtgst|invtildeop|invtimeout|invtitle|invto|invtop|invtr|invttimeout|invttybuiltin|invttyfast|invtx|invvb|invvisualbell|invwa|invwarn|invwb|invweirdinvert|invwfh|invwfw|invwildmenu|invwinfixheight|invwinfixwidth|invwiv|invwmnu|invwrap|invwrapscan|invwrite|invwriteany|invwritebackup|invws|isf|isfname|isi|isident|isk|iskeyword|isprint|joinspaces|js|key|keymap|keymodel|keywordprg|km|kmp|kp|langmap|langmenu|laststatus|lazyredraw|lbr|lcs|linebreak|lines|linespace|lisp|lispwords|listchars|loadplugins|lpl|lsp|lz|macatsui|magic|makeef|makeprg|matchpairs|matchtime|maxcombine|maxfuncdepth|maxmapdepth|maxmem|maxmempattern|maxmemtot|mco|mef|menuitems|mfd|mh|mis|mkspellmem|ml|mls|mm|mmd|mmp|mmt|modeline|modelines|modifiable|modified|more|mouse|mousef|mousefocus|mousehide|mousem|mousemodel|mouses|mouseshape|mouset|mousetime|mp|mps|msm|mzq|mzquantum|nf|noacd|noai|noakm|noallowrevins|noaltkeymap|noanti|noantialias|noar|noarab|noarabic|noarabicshape|noari|noarshape|noautochdir|noautoindent|noautoread|noautowrite|noautowriteall|noaw|noawa|nobackup|noballooneval|nobeval|nobin|nobinary|nobiosk|nobioskey|nobk|nobl|nobomb|nobuflisted|nocf|noci|nocin|nocindent|nocompatible|noconfirm|noconsk|noconskey|nocopyindent|nocp|nocscopetag|nocscopeverbose|nocst|nocsverb|nocuc|nocul|nocursorcolumn|nocursorline|nodeco|nodelcombine|nodg|nodiff|nodigraph|nodisable|noea|noeb|noed|noedcompatible|noek|noendofline|noeol|noequalalways|noerrorbells|noesckeys|noet|noex|noexpandtab|noexrc|nofen|nofk|nofkmap|nofoldenable|nogd|nogdefault|noguipty|nohid|nohidden|nohk|nohkmap|nohkmapp|nohkp|nohls|noic|noicon|noignorecase|noim|noimc|noimcmdline|noimd|noincsearch|noinf|noinfercase|noinsertmode|nois|nojoinspaces|nojs|nolazyredraw|nolbr|nolinebreak|nolisp|nolist|noloadplugins|nolpl|nolz|noma|nomacatsui|nomagic|nomh|noml|nomod|nomodeline|nomodifiable|nomodified|nomore|nomousef|nomousefocus|nomousehide|nonu|nonumber|noodev|noopendevice|nopaste|nopi|nopreserveindent|nopreviewwindow|noprompt|nopvw|noreadonly|noremap|norestorescreen|norevins|nori|norightleft|norightleftcmd|norl|norlc|noro|nors|noru|noruler|nosb|nosc|noscb|noscrollbind|noscs|nosecure|nosft|noshellslash|noshelltemp|noshiftround|noshortname|noshowcmd|noshowfulltag|noshowmatch|noshowmode|nosi|nosm|nosmartcase|nosmartindent|nosmarttab|nosmd|nosn|nosol|nospell|nosplitbelow|nosplitright|nospr|nosr|nossl|nosta|nostartofline|nostmp|noswapfile|noswf|nota|notagbsearch|notagrelative|notagstack|notbi|notbidi|notbs|notermbidi|noterse|notextauto|notextmode|notf|notgst|notildeop|notimeout|notitle|noto|notop|notr|nottimeout|nottybuiltin|nottyfast|notx|novb|novisualbell|nowa|nowarn|nowb|noweirdinvert|nowfh|nowfw|nowildmenu|nowinfixheight|nowinfixwidth|nowiv|nowmnu|nowrap|nowrapscan|nowrite|nowriteany|nowritebackup|nows|nrformats|numberwidth|nuw|odev|oft|ofu|omnifunc|opendevice|operatorfunc|opfunc|osfiletype|pa|para|paragraphs|paste|pastetoggle|patchexpr|patchmode|path|pdev|penc|pex|pexpr|pfn|ph|pheader|pi|pm|pmbcs|pmbfn|popt|preserveindent|previewheight|previewwindow|printdevice|printencoding|printexpr|printfont|printheader|printmbcharset|printmbfont|printoptions|prompt|pt|pumheight|pvh|pvw|qe|quoteescape|readonly|remap|report|restorescreen|revins|rightleft|rightleftcmd|rl|rlc|ro|rs|rtp|ruf|ruler|rulerformat|runtimepath|sbo|sc|scb|scr|scroll|scrollbind|scrolljump|scrolloff|scrollopt|scs|sect|sections|secure|sel|selection|selectmode|sessionoptions|sft|shcf|shellcmdflag|shellpipe|shellquote|shellredir|shellslash|shelltemp|shelltype|shellxquote|shiftround|shiftwidth|shm|shortmess|shortname|showbreak|showcmd|showfulltag|showmatch|showmode|showtabline|shq|si|sidescroll|sidescrolloff|siso|sj|slm|smartcase|smartindent|smarttab|smc|smd|softtabstop|sol|spc|spell|spellcapcheck|spellfile|spelllang|spellsuggest|spf|spl|splitbelow|splitright|sps|sr|srr|ss|ssl|ssop|stal|startofline|statusline|stl|stmp|su|sua|suffixes|suffixesadd|sw|swapfile|swapsync|swb|swf|switchbuf|sws|sxq|syn|synmaxcol|syntax|t_AB|t_AF|t_AL|t_CS|t_CV|t_Ce|t_Co|t_Cs|t_DL|t_EI|t_F1|t_F2|t_F3|t_F4|t_F5|t_F6|t_F7|t_F8|t_F9|t_IE|t_IS|t_K1|t_K3|t_K4|t_K5|t_K6|t_K7|t_K8|t_K9|t_KA|t_KB|t_KC|t_KD|t_KE|t_KF|t_KG|t_KH|t_KI|t_KJ|t_KK|t_KL|t_RI|t_RV|t_SI|t_Sb|t_Sf|t_WP|t_WS|t_ZH|t_ZR|t_al|t_bc|t_cd|t_ce|t_cl|t_cm|t_cs|t_da|t_db|t_dl|t_fs|t_k1|t_k2|t_k3|t_k4|t_k5|t_k6|t_k7|t_k8|t_k9|t_kB|t_kD|t_kI|t_kN|t_kP|t_kb|t_kd|t_ke|t_kh|t_kl|t_kr|t_ks|t_ku|t_le|t_mb|t_md|t_me|t_mr|t_ms|t_nd|t_op|t_se|t_so|t_sr|t_te|t_ti|t_ts|t_ue|t_us|t_ut|t_vb|t_ve|t_vi|t_vs|t_xs|tabline|tabpagemax|tabstop|tagbsearch|taglength|tagrelative|tagstack|tal|tb|tbi|tbidi|tbis|tbs|tenc|term|termbidi|termencoding|terse|textauto|textmode|textwidth|tgst|thesaurus|tildeop|timeout|timeoutlen|title|titlelen|titleold|titlestring|toolbar|toolbariconsize|top|tpm|tsl|tsr|ttimeout|ttimeoutlen|ttm|tty|ttybuiltin|ttyfast|ttym|ttymouse|ttyscroll|ttytype|tw|tx|uc|ul|undolevels|updatecount|updatetime|ut|vb|vbs|vdir|verbosefile|vfile|viewdir|viewoptions|viminfo|virtualedit|visualbell|vop|wak|warn|wb|wc|wcm|wd|weirdinvert|wfh|wfw|whichwrap|wi|wig|wildchar|wildcharm|wildignore|wildmenu|wildmode|wildoptions|wim|winaltkeys|window|winfixheight|winfixwidth|winheight|winminheight|winminwidth|winwidth|wiv|wiw|wm|wmh|wmnu|wmw|wop|wrap|wrapmargin|wrapscan|writeany|writebackup|writedelay|ww)\b/,
  "number": /\b(?:0x[\da-f]+|\d+(?:\.\d+)?)\b/i,
  "operator": /\|\||&&|[-+.]=?|[=!](?:[=~][#?]?)?|[<>]=?[#?]?|[*\/%?]|\b(?:is(?:not)?)\b/,
  "punctuation": /[{}[\](),;:]/
};

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-gdscript.js
Prism.languages.gdscript = {
  "comment": /#.*/,
  "string": {
    pattern: /@?(?:("|')(?:(?!\1)[^\n\\]|\\[\s\S])*\1(?!"|')|"""(?:[^\\]|\\[\s\S])*?""")/,
    greedy: true
  },
  "class-name": {
    // class_name Foo, extends Bar, class InnerClass
    // export(int) var baz, export(int, 0) var i
    // as Node
    // const FOO: int = 9, var bar: bool = true
    // func add(reference: Item, amount: int) -> Item:
    pattern: /(^(?:class|class_name|extends)[ \t]+|^export\([ \t]*|\bas[ \t]+|(?:\b(?:const|var)[ \t]|[,(])[ \t]*\w+[ \t]*:[ \t]*|->[ \t]*)[a-zA-Z_]\w*/m,
    lookbehind: true
  },
  "keyword": /\b(?:and|as|assert|break|breakpoint|class|class_name|const|continue|elif|else|enum|export|extends|for|func|if|in|is|master|mastersync|match|not|null|onready|or|pass|preload|puppet|puppetsync|remote|remotesync|return|self|setget|signal|static|tool|var|while|yield)\b/,
  "function": /\b[a-z_]\w*(?=[ \t]*\()/i,
  "variable": /\$\w+/,
  "number": [
    /\b0b[01_]+\b|\b0x[\da-fA-F_]+\b|(?:\b\d[\d_]*(?:\.[\d_]*)?|\B\.[\d_]+)(?:e[+-]?[\d_]+)?\b/,
    /\b(?:INF|NAN|PI|TAU)\b/
  ],
  "constant": /\b[A-Z][A-Z_\d]*\b/,
  "boolean": /\b(?:false|true)\b/,
  "operator": /->|:=|&&|\|\||<<|>>|[-+*/%&|!<>=]=?|[~^]/,
  "punctuation": /[.:,;()[\]{}]/
};

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-wren.js
Prism.languages.wren = {
  // Multiline comments in Wren can have nested multiline comments
  // Comments: // and /* */
  "comment": [
    {
      // support 3 levels of nesting
      // regex: \/\*(?:[^*/]|\*(?!\/)|\/(?!\*)|<self>)*\*\/
      pattern: /\/\*(?:[^*/]|\*(?!\/)|\/(?!\*)|\/\*(?:[^*/]|\*(?!\/)|\/(?!\*)|\/\*(?:[^*/]|\*(?!\/)|\/(?!\*))*\*\/)*\*\/)*\*\//,
      greedy: true
    },
    {
      pattern: /(^|[^\\:])\/\/.*/,
      lookbehind: true,
      greedy: true
    }
  ],
  // Triple quoted strings are multiline but cannot have interpolation (raw strings)
  // Based on prism-python.js
  "triple-quoted-string": {
    pattern: /"""[\s\S]*?"""/,
    greedy: true,
    alias: "string"
  },
  // see below
  "string-literal": null,
  // #!/usr/bin/env wren on the first line
  "hashbang": {
    pattern: /^#!\/.+/,
    greedy: true,
    alias: "comment"
  },
  // Attributes are special keywords to add meta data to classes
  "attribute": {
    // #! attributes are stored in class properties
    // #!myvar = true
    // #attributes are not stored and dismissed at compilation
    pattern: /#!?[ \t\u3000]*\w+/,
    alias: "keyword"
  },
  "class-name": [
    {
      // class definition
      // class Meta {}
      pattern: /(\bclass\s+)\w+/,
      lookbehind: true
    },
    // A class must always start with an uppercase.
    // File.read
    /\b[A-Z][a-z\d_]*\b/
  ],
  // A constant can be a variable, class, property or method. Just named in all uppercase letters
  "constant": /\b[A-Z][A-Z\d_]*\b/,
  "null": {
    pattern: /\bnull\b/,
    alias: "keyword"
  },
  "keyword": /\b(?:as|break|class|construct|continue|else|for|foreign|if|import|in|is|return|static|super|this|var|while)\b/,
  "boolean": /\b(?:false|true)\b/,
  "number": /\b(?:0x[\da-f]+|\d+(?:\.\d+)?(?:e[+-]?\d+)?)\b/i,
  // Functions can be Class.method()
  "function": /\b[a-z_]\w*(?=\s*[({])/i,
  "operator": /<<|>>|[=!<>]=?|&&|\|\||[-+*/%~^&|?:]|\.{2,3}/,
  "punctuation": /[\[\](){}.,;]/
};
Prism.languages.wren["string-literal"] = {
  // A single quote string is multiline and can have interpolation (similar to JS backticks ``)
  pattern: /(^|[^\\"])"(?:[^\\"%]|\\[\s\S]|%(?!\()|%\((?:[^()]|\((?:[^()]|\([^)]*\))*\))*\))*"/,
  lookbehind: true,
  greedy: true,
  inside: {
    "interpolation": {
      // "%(interpolation)"
      pattern: /((?:^|[^\\])(?:\\{2})*)%\((?:[^()]|\((?:[^()]|\([^)]*\))*\))*\)/,
      lookbehind: true,
      inside: {
        "expression": {
          pattern: /^(%\()[\s\S]+(?=\)$)/,
          lookbehind: true,
          inside: Prism.languages.wren
        },
        "interpolation-punctuation": {
          pattern: /^%\(|\)$/,
          alias: "punctuation"
        }
      }
    },
    "string": /[\s\S]+/
  }
};

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-verilog.js
Prism.languages.verilog = {
  "comment": {
    pattern: /\/\/.*|\/\*[\s\S]*?\*\//,
    greedy: true
  },
  "string": {
    pattern: /"(?:\\(?:\r\n|[\s\S])|[^"\\\r\n])*"/,
    greedy: true
  },
  "kernel-function": {
    // support for any kernel function (ex: $display())
    pattern: /\B\$\w+\b/,
    alias: "property"
  },
  // support for user defined constants (ex: `define)
  "constant": /\B`\w+\b/,
  "function": /\b\w+(?=\()/,
  // support for verilog and system verilog keywords
  "keyword": /\b(?:alias|and|assert|assign|assume|automatic|before|begin|bind|bins|binsof|bit|break|buf|bufif0|bufif1|byte|case|casex|casez|cell|chandle|class|clocking|cmos|config|const|constraint|context|continue|cover|covergroup|coverpoint|cross|deassign|default|defparam|design|disable|dist|do|edge|else|end|endcase|endclass|endclocking|endconfig|endfunction|endgenerate|endgroup|endinterface|endmodule|endpackage|endprimitive|endprogram|endproperty|endsequence|endspecify|endtable|endtask|enum|event|expect|export|extends|extern|final|first_match|for|force|foreach|forever|fork|forkjoin|function|generate|genvar|highz0|highz1|if|iff|ifnone|ignore_bins|illegal_bins|import|incdir|include|initial|inout|input|inside|instance|int|integer|interface|intersect|join|join_any|join_none|large|liblist|library|local|localparam|logic|longint|macromodule|matches|medium|modport|module|nand|negedge|new|nmos|nor|noshowcancelled|not|notif0|notif1|null|or|output|package|packed|parameter|pmos|posedge|primitive|priority|program|property|protected|pull0|pull1|pulldown|pullup|pulsestyle_ondetect|pulsestyle_onevent|pure|rand|randc|randcase|randsequence|rcmos|real|realtime|ref|reg|release|repeat|return|rnmos|rpmos|rtran|rtranif0|rtranif1|scalared|sequence|shortint|shortreal|showcancelled|signed|small|solve|specify|specparam|static|string|strong0|strong1|struct|super|supply0|supply1|table|tagged|task|this|throughout|time|timeprecision|timeunit|tran|tranif0|tranif1|tri|tri0|tri1|triand|trior|trireg|type|typedef|union|unique|unsigned|use|uwire|var|vectored|virtual|void|wait|wait_order|wand|weak0|weak1|while|wildcard|wire|with|within|wor|xnor|xor)\b/,
  // bold highlighting for all verilog and system verilog logic blocks
  "important": /\b(?:always|always_comb|always_ff|always_latch)\b(?: *@)?/,
  // support for time ticks, vectors, and real numbers
  "number": /\B##?\d+|(?:\b\d+)?'[odbh] ?[\da-fzx_?]+|\b(?:\d*[._])?\d+(?:e[-+]?\d+)?/i,
  "operator": /[-+{}^~%*\/?=!<>&|]+/,
  "punctuation": /[[\];(),.:]/
};

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-vhdl.js
Prism.languages.vhdl = {
  "comment": /--.+/,
  // support for all logic vectors
  "vhdl-vectors": {
    "pattern": /\b[oxb]"[\da-f_]+"|"[01uxzwlh-]+"/i,
    "alias": "number"
  },
  // support for operator overloading included
  "quoted-function": {
    pattern: /"\S+?"(?=\()/,
    alias: "function"
  },
  "string": /"(?:[^\\"\r\n]|\\(?:\r\n|[\s\S]))*"/,
  "attribute": {
    pattern: /\b'\w+/,
    alias: "attr-name"
  },
  // support for predefined attributes included
  "keyword": /\b(?:access|after|alias|all|architecture|array|assert|attribute|begin|block|body|buffer|bus|case|component|configuration|constant|disconnect|downto|else|elsif|end|entity|exit|file|for|function|generate|generic|group|guarded|if|impure|in|inertial|inout|is|label|library|linkage|literal|loop|map|new|next|null|of|on|open|others|out|package|port|postponed|private|procedure|process|pure|range|record|register|reject|report|return|select|severity|shared|signal|subtype|then|to|transport|type|unaffected|units|until|use|variable|view|wait|when|while|with)\b/i,
  "boolean": /\b(?:false|true)\b/i,
  "function": /\w+(?=\()/,
  // decimal, based, physical, and exponential numbers supported
  "number": /'[01uxzwlh-]'|\b(?:\d+#[\da-f_.]+#|\d[\d_.]*)(?:e[-+]?\d+)?/i,
  "operator": /[<>]=?|:=|[-+*/&=]|\b(?:abs|and|mod|nand|nor|not|or|rem|rol|ror|sla|sll|sra|srl|xnor|xor)\b/i,
  "punctuation": /[{}[\];(),.:]/
};

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-pascal.js
Prism.languages.pascal = {
  "directive": {
    pattern: /\{\$[\s\S]*?\}/,
    greedy: true,
    alias: ["marco", "property"]
  },
  "comment": {
    pattern: /\(\*[\s\S]*?\*\)|\{[\s\S]*?\}|\/\/.*/,
    greedy: true
  },
  "string": {
    pattern: /(?:'(?:''|[^'\r\n])*'(?!')|#[&$%]?[a-f\d]+)+|\^[a-z]/i,
    greedy: true
  },
  "asm": {
    pattern: /(\basm\b)[\s\S]+?(?=\bend\s*[;[])/i,
    lookbehind: true,
    greedy: true,
    inside: null
    // see below
  },
  "keyword": [
    {
      // Turbo Pascal
      pattern: /(^|[^&])\b(?:absolute|array|asm|begin|case|const|constructor|destructor|do|downto|else|end|file|for|function|goto|if|implementation|inherited|inline|interface|label|nil|object|of|operator|packed|procedure|program|record|reintroduce|repeat|self|set|string|then|to|type|unit|until|uses|var|while|with)\b/i,
      lookbehind: true
    },
    {
      // Free Pascal
      pattern: /(^|[^&])\b(?:dispose|exit|false|new|true)\b/i,
      lookbehind: true
    },
    {
      // Object Pascal
      pattern: /(^|[^&])\b(?:class|dispinterface|except|exports|finalization|finally|initialization|inline|library|on|out|packed|property|raise|resourcestring|threadvar|try)\b/i,
      lookbehind: true
    },
    {
      // Modifiers
      pattern: /(^|[^&])\b(?:absolute|abstract|alias|assembler|bitpacked|break|cdecl|continue|cppdecl|cvar|default|deprecated|dynamic|enumerator|experimental|export|external|far|far16|forward|generic|helper|implements|index|interrupt|iochecks|local|message|name|near|nodefault|noreturn|nostackframe|oldfpccall|otherwise|overload|override|pascal|platform|private|protected|public|published|read|register|reintroduce|result|safecall|saveregisters|softfloat|specialize|static|stdcall|stored|strict|unaligned|unimplemented|varargs|virtual|write)\b/i,
      lookbehind: true
    }
  ],
  "number": [
    // Hexadecimal, octal and binary
    /(?:[&%]\d+|\$[a-f\d]+)/i,
    // Decimal
    /\b\d+(?:\.\d+)?(?:e[+-]?\d+)?/i
  ],
  "operator": [
    /\.\.|\*\*|:=|<[<=>]?|>[>=]?|[+\-*\/]=?|[@^=]/,
    {
      pattern: /(^|[^&])\b(?:and|as|div|exclude|in|include|is|mod|not|or|shl|shr|xor)\b/,
      lookbehind: true
    }
  ],
  "punctuation": /\(\.|\.\)|[()\[\]:;,.]/
};
Prism.languages.pascal.asm.inside = Prism.languages.extend("pascal", {
  "asm": void 0,
  "keyword": void 0,
  "operator": void 0
});
Prism.languages.objectpascal = Prism.languages.pascal;

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-applescript.js
Prism.languages.applescript = {
  "comment": [
    // Allow one level of nesting
    /\(\*(?:\(\*(?:[^*]|\*(?!\)))*\*\)|(?!\(\*)[\s\S])*?\*\)/,
    /--.+/,
    /#.+/
  ],
  "string": /"(?:\\.|[^"\\\r\n])*"/,
  "number": /(?:\b\d+(?:\.\d*)?|\B\.\d+)(?:e-?\d+)?\b/i,
  "operator": [
    /[&=≠≤≥*+\-\/÷^]|[<>]=?/,
    /\b(?:(?:begin|end|start)s? with|(?:contains?|(?:does not|doesn't) contain)|(?:is|isn't|is not) (?:contained by|in)|(?:(?:is|isn't|is not) )?(?:greater|less) than(?: or equal)?(?: to)?|(?:comes|(?:does not|doesn't) come) (?:after|before)|(?:is|isn't|is not) equal(?: to)?|(?:(?:does not|doesn't) equal|equal to|equals|is not|isn't)|(?:a )?(?:ref(?: to)?|reference to)|(?:and|as|div|mod|not|or))\b/
  ],
  "keyword": /\b(?:about|above|after|against|apart from|around|aside from|at|back|before|beginning|behind|below|beneath|beside|between|but|by|considering|continue|copy|does|eighth|else|end|equal|error|every|exit|false|fifth|first|for|fourth|from|front|get|given|global|if|ignoring|in|instead of|into|is|it|its|last|local|me|middle|my|ninth|of|on|onto|out of|over|prop|property|put|repeat|return|returning|second|set|seventh|since|sixth|some|tell|tenth|that|the|then|third|through|thru|timeout|times|to|transaction|true|try|until|where|while|whose|with|without)\b/,
  "class-name": /\b(?:POSIX file|RGB color|alias|application|boolean|centimeters|centimetres|class|constant|cubic centimeters|cubic centimetres|cubic feet|cubic inches|cubic meters|cubic metres|cubic yards|date|degrees Celsius|degrees Fahrenheit|degrees Kelvin|feet|file|gallons|grams|inches|integer|kilograms|kilometers|kilometres|list|liters|litres|meters|metres|miles|number|ounces|pounds|quarts|real|record|reference|script|square feet|square kilometers|square kilometres|square meters|square metres|square miles|square yards|text|yards)\b/,
  "punctuation": /[{}():,¬«»《》]/
};

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-swift.js
Prism.languages.swift = {
  "comment": {
    // Nested comments are supported up to 2 levels
    pattern: /(^|[^\\:])(?:\/\/.*|\/\*(?:[^/*]|\/(?!\*)|\*(?!\/)|\/\*(?:[^*]|\*(?!\/))*\*\/)*\*\/)/,
    lookbehind: true,
    greedy: true
  },
  "string-literal": [
    // https://docs.swift.org/swift-book/LanguageGuide/StringsAndCharacters.html
    {
      pattern: RegExp(
        /(^|[^"#])/.source + "(?:" + /"(?:\\(?:\((?:[^()]|\([^()]*\))*\)|\r\n|[^(])|[^\\\r\n"])*"/.source + "|" + /"""(?:\\(?:\((?:[^()]|\([^()]*\))*\)|[^(])|[^\\"]|"(?!""))*"""/.source + ")" + /(?!["#])/.source
      ),
      lookbehind: true,
      greedy: true,
      inside: {
        "interpolation": {
          pattern: /(\\\()(?:[^()]|\([^()]*\))*(?=\))/,
          lookbehind: true,
          inside: null
          // see below
        },
        "interpolation-punctuation": {
          pattern: /^\)|\\\($/,
          alias: "punctuation"
        },
        "punctuation": /\\(?=[\r\n])/,
        "string": /[\s\S]+/
      }
    },
    {
      pattern: RegExp(
        /(^|[^"#])(#+)/.source + "(?:" + /"(?:\\(?:#+\((?:[^()]|\([^()]*\))*\)|\r\n|[^#])|[^\\\r\n])*?"/.source + "|" + /"""(?:\\(?:#+\((?:[^()]|\([^()]*\))*\)|[^#])|[^\\])*?"""/.source + ")\\2"
      ),
      lookbehind: true,
      greedy: true,
      inside: {
        "interpolation": {
          pattern: /(\\#+\()(?:[^()]|\([^()]*\))*(?=\))/,
          lookbehind: true,
          inside: null
          // see below
        },
        "interpolation-punctuation": {
          pattern: /^\)|\\#+\($/,
          alias: "punctuation"
        },
        "string": /[\s\S]+/
      }
    }
  ],
  "directive": {
    // directives with conditions
    pattern: RegExp(
      /#/.source + "(?:" + (/(?:elseif|if)\b/.source + "(?:[ 	]*" + /(?:![ \t]*)?(?:\b\w+\b(?:[ \t]*\((?:[^()]|\([^()]*\))*\))?|\((?:[^()]|\([^()]*\))*\))(?:[ \t]*(?:&&|\|\|))?/.source + ")+") + "|" + /(?:else|endif)\b/.source + ")"
    ),
    alias: "property",
    inside: {
      "directive-name": /^#\w+/,
      "boolean": /\b(?:false|true)\b/,
      "number": /\b\d+(?:\.\d+)*\b/,
      "operator": /!|&&|\|\||[<>]=?/,
      "punctuation": /[(),]/
    }
  },
  "literal": {
    pattern: /#(?:colorLiteral|column|dsohandle|file(?:ID|Literal|Path)?|function|imageLiteral|line)\b/,
    alias: "constant"
  },
  "other-directive": {
    pattern: /#\w+\b/,
    alias: "property"
  },
  "attribute": {
    pattern: /@\w+/,
    alias: "atrule"
  },
  "function-definition": {
    pattern: /(\bfunc\s+)\w+/,
    lookbehind: true,
    alias: "function"
  },
  "label": {
    // https://docs.swift.org/swift-book/LanguageGuide/ControlFlow.html#ID141
    pattern: /\b(break|continue)\s+\w+|\b[a-zA-Z_]\w*(?=\s*:\s*(?:for|repeat|while)\b)/,
    lookbehind: true,
    alias: "important"
  },
  "keyword": /\b(?:Any|Protocol|Self|Type|actor|as|assignment|associatedtype|associativity|async|await|break|case|catch|class|continue|convenience|default|defer|deinit|didSet|do|dynamic|else|enum|extension|fallthrough|fileprivate|final|for|func|get|guard|higherThan|if|import|in|indirect|infix|init|inout|internal|is|isolated|lazy|left|let|lowerThan|mutating|none|nonisolated|nonmutating|open|operator|optional|override|postfix|precedencegroup|prefix|private|protocol|public|repeat|required|rethrows|return|right|safe|self|set|some|static|struct|subscript|super|switch|throw|throws|try|typealias|unowned|unsafe|var|weak|where|while|willSet)\b/,
  "boolean": /\b(?:false|true)\b/,
  "nil": {
    pattern: /\bnil\b/,
    alias: "constant"
  },
  "short-argument": /\$\d+\b/,
  "omit": {
    pattern: /\b_\b/,
    alias: "keyword"
  },
  "number": /\b(?:[\d_]+(?:\.[\de_]+)?|0x[a-f0-9_]+(?:\.[a-f0-9p_]+)?|0b[01_]+|0o[0-7_]+)\b/i,
  // A class name must start with an upper-case letter and be either 1 letter long or contain a lower-case letter.
  "class-name": /\b[A-Z](?:[A-Z_\d]*[a-z]\w*)?\b/,
  "function": /\b[a-z_]\w*(?=\s*\()/i,
  "constant": /\b(?:[A-Z_]{2,}|k[A-Z][A-Za-z_]+)\b/,
  // Operators are generic in Swift. Developers can even create new operators (e.g. +++).
  // https://docs.swift.org/swift-book/ReferenceManual/zzSummaryOfTheGrammar.html#ID481
  // This regex only supports ASCII operators.
  "operator": /[-+*/%=!<>&|^~?]+|\.[.\-+*/%=!<>&|^~?]+/,
  "punctuation": /[{}[\]();,.:\\]/
};
Prism.languages.swift["string-literal"].forEach(function(rule) {
  rule.inside["interpolation"].inside = Prism.languages.swift;
});

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-powershell.js
(function(Prism3) {
  var powershell = Prism3.languages.powershell = {
    "comment": [
      {
        pattern: /(^|[^`])<#[\s\S]*?#>/,
        lookbehind: true
      },
      {
        pattern: /(^|[^`])#.*/,
        lookbehind: true
      }
    ],
    "string": [
      {
        pattern: /"(?:`[\s\S]|[^`"])*"/,
        greedy: true,
        inside: null
        // see below
      },
      {
        pattern: /'(?:[^']|'')*'/,
        greedy: true
      }
    ],
    // Matches name spaces as well as casts, attribute decorators. Force starting with letter to avoid matching array indices
    // Supports two levels of nested brackets (e.g. `[OutputType([System.Collections.Generic.List[int]])]`)
    "namespace": /\[[a-z](?:\[(?:\[[^\]]*\]|[^\[\]])*\]|[^\[\]])*\]/i,
    "boolean": /\$(?:false|true)\b/i,
    "variable": /\$\w+\b/,
    // Cmdlets and aliases. Aliases should come last, otherwise "write" gets preferred over "write-host" for example
    // Get-Command | ?{ $_.ModuleName -match "Microsoft.PowerShell.(Util|Core|Management)" }
    // Get-Alias | ?{ $_.ReferencedCommand.Module.Name -match "Microsoft.PowerShell.(Util|Core|Management)" }
    "function": [
      /\b(?:Add|Approve|Assert|Backup|Block|Checkpoint|Clear|Close|Compare|Complete|Compress|Confirm|Connect|Convert|ConvertFrom|ConvertTo|Copy|Debug|Deny|Disable|Disconnect|Dismount|Edit|Enable|Enter|Exit|Expand|Export|Find|ForEach|Format|Get|Grant|Group|Hide|Import|Initialize|Install|Invoke|Join|Limit|Lock|Measure|Merge|Move|New|Open|Optimize|Out|Ping|Pop|Protect|Publish|Push|Read|Receive|Redo|Register|Remove|Rename|Repair|Request|Reset|Resize|Resolve|Restart|Restore|Resume|Revoke|Save|Search|Select|Send|Set|Show|Skip|Sort|Split|Start|Step|Stop|Submit|Suspend|Switch|Sync|Tee|Test|Trace|Unblock|Undo|Uninstall|Unlock|Unprotect|Unpublish|Unregister|Update|Use|Wait|Watch|Where|Write)-[a-z]+\b/i,
      /\b(?:ac|cat|chdir|clc|cli|clp|clv|compare|copy|cp|cpi|cpp|cvpa|dbp|del|diff|dir|ebp|echo|epal|epcsv|epsn|erase|fc|fl|ft|fw|gal|gbp|gc|gci|gcs|gdr|gi|gl|gm|gp|gps|group|gsv|gu|gv|gwmi|iex|ii|ipal|ipcsv|ipsn|irm|iwmi|iwr|kill|lp|ls|measure|mi|mount|move|mp|mv|nal|ndr|ni|nv|ogv|popd|ps|pushd|pwd|rbp|rd|rdr|ren|ri|rm|rmdir|rni|rnp|rp|rv|rvpa|rwmi|sal|saps|sasv|sbp|sc|select|set|shcm|si|sl|sleep|sls|sort|sp|spps|spsv|start|sv|swmi|tee|trcm|type|write)\b/i
    ],
    // per http://technet.microsoft.com/en-us/library/hh847744.aspx
    "keyword": /\b(?:Begin|Break|Catch|Class|Continue|Data|Define|Do|DynamicParam|Else|ElseIf|End|Exit|Filter|Finally|For|ForEach|From|Function|If|InlineScript|Parallel|Param|Process|Return|Sequence|Switch|Throw|Trap|Try|Until|Using|Var|While|Workflow)\b/i,
    "operator": {
      pattern: /(^|\W)(?:!|-(?:b?(?:and|x?or)|as|(?:Not)?(?:Contains|In|Like|Match)|eq|ge|gt|is(?:Not)?|Join|le|lt|ne|not|Replace|sh[lr])\b|-[-=]?|\+[+=]?|[*\/%]=?)/i,
      lookbehind: true
    },
    "punctuation": /[|{}[\];(),.]/
  };
  powershell.string[0].inside = {
    "function": {
      // Allow for one level of nesting
      pattern: /(^|[^`])\$\((?:\$\([^\r\n()]*\)|(?!\$\()[^\r\n)])*\)/,
      lookbehind: true,
      inside: powershell
    },
    "boolean": powershell.boolean,
    "variable": powershell.variable
  };
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-batch.js
(function(Prism3) {
  var variable = /%%?[~:\w]+%?|!\S+!/;
  var parameter = {
    pattern: /\/[a-z?]+(?=[ :]|$):?|-[a-z]\b|--[a-z-]+\b/im,
    alias: "attr-name",
    inside: {
      "punctuation": /:/
    }
  };
  var string = /"(?:[\\"]"|[^"])*"(?!")/;
  var number = /(?:\b|-)\d+\b/;
  Prism3.languages.batch = {
    "comment": [
      /^::.*/m,
      {
        pattern: /((?:^|[&(])[ \t]*)rem\b(?:[^^&)\r\n]|\^(?:\r\n|[\s\S]))*/im,
        lookbehind: true
      }
    ],
    "label": {
      pattern: /^:.*/m,
      alias: "property"
    },
    "command": [
      {
        // FOR command
        pattern: /((?:^|[&(])[ \t]*)for(?: \/[a-z?](?:[ :](?:"[^"]*"|[^\s"/]\S*))?)* \S+ in \([^)]+\) do/im,
        lookbehind: true,
        inside: {
          "keyword": /\b(?:do|in)\b|^for\b/i,
          "string": string,
          "parameter": parameter,
          "variable": variable,
          "number": number,
          "punctuation": /[()',]/
        }
      },
      {
        // IF command
        pattern: /((?:^|[&(])[ \t]*)if(?: \/[a-z?](?:[ :](?:"[^"]*"|[^\s"/]\S*))?)* (?:not )?(?:cmdextversion \d+|defined \w+|errorlevel \d+|exist \S+|(?:"[^"]*"|(?!")(?:(?!==)\S)+)?(?:==| (?:equ|geq|gtr|leq|lss|neq) )(?:"[^"]*"|[^\s"]\S*))/im,
        lookbehind: true,
        inside: {
          "keyword": /\b(?:cmdextversion|defined|errorlevel|exist|not)\b|^if\b/i,
          "string": string,
          "parameter": parameter,
          "variable": variable,
          "number": number,
          "operator": /\^|==|\b(?:equ|geq|gtr|leq|lss|neq)\b/i
        }
      },
      {
        // ELSE command
        pattern: /((?:^|[&()])[ \t]*)else\b/im,
        lookbehind: true,
        inside: {
          "keyword": /^else\b/i
        }
      },
      {
        // SET command
        pattern: /((?:^|[&(])[ \t]*)set(?: \/[a-z](?:[ :](?:"[^"]*"|[^\s"/]\S*))?)* (?:[^^&)\r\n]|\^(?:\r\n|[\s\S]))*/im,
        lookbehind: true,
        inside: {
          "keyword": /^set\b/i,
          "string": string,
          "parameter": parameter,
          "variable": [
            variable,
            /\w+(?=(?:[*\/%+\-&^|]|<<|>>)?=)/
          ],
          "number": number,
          "operator": /[*\/%+\-&^|]=?|<<=?|>>=?|[!~_=]/,
          "punctuation": /[()',]/
        }
      },
      {
        // Other commands
        pattern: /((?:^|[&(])[ \t]*@?)\w+\b(?:"(?:[\\"]"|[^"])*"(?!")|[^"^&)\r\n]|\^(?:\r\n|[\s\S]))*/m,
        lookbehind: true,
        inside: {
          "keyword": /^\w+\b/,
          "string": string,
          "parameter": parameter,
          "label": {
            pattern: /(^\s*):\S+/m,
            lookbehind: true,
            alias: "property"
          },
          "variable": variable,
          "number": number,
          "operator": /\^/
        }
      }
    ],
    "operator": /[&@]/,
    "punctuation": /[()']/
  };
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-nginx.js
(function(Prism3) {
  var variable = /\$(?:\w[a-z\d]*(?:_[^\x00-\x1F\s"'\\()$]*)?|\{[^}\s"'\\]+\})/i;
  Prism3.languages.nginx = {
    "comment": {
      pattern: /(^|[\s{};])#.*/,
      lookbehind: true,
      greedy: true
    },
    "directive": {
      pattern: /(^|\s)\w(?:[^;{}"'\\\s]|\\.|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\s+(?:#.*(?!.)|(?![#\s])))*?(?=\s*[;{])/,
      lookbehind: true,
      greedy: true,
      inside: {
        "string": {
          pattern: /((?:^|[^\\])(?:\\\\)*)(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/,
          lookbehind: true,
          greedy: true,
          inside: {
            "escape": {
              pattern: /\\["'\\nrt]/,
              alias: "entity"
            },
            "variable": variable
          }
        },
        "comment": {
          pattern: /(\s)#.*/,
          lookbehind: true,
          greedy: true
        },
        "keyword": {
          pattern: /^\S+/,
          greedy: true
        },
        // other patterns
        "boolean": {
          pattern: /(\s)(?:off|on)(?!\S)/,
          lookbehind: true
        },
        "number": {
          pattern: /(\s)\d+[a-z]*(?!\S)/i,
          lookbehind: true
        },
        "variable": variable
      }
    },
    "punctuation": /[{};]/
  };
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-apacheconf.js
Prism.languages.apacheconf = {
  "comment": /#.*/,
  "directive-inline": {
    pattern: /(^[\t ]*)\b(?:AcceptFilter|AcceptPathInfo|AccessFileName|Action|Add(?:Alt|AltByEncoding|AltByType|Charset|DefaultCharset|Description|Encoding|Handler|Icon|IconByEncoding|IconByType|InputFilter|Language|ModuleInfo|OutputFilter|OutputFilterByType|Type)|Alias|AliasMatch|Allow(?:CONNECT|EncodedSlashes|Methods|Override|OverrideList)?|Anonymous(?:_LogEmail|_MustGiveEmail|_NoUserID|_VerifyEmail)?|AsyncRequestWorkerFactor|Auth(?:BasicAuthoritative|BasicFake|BasicProvider|BasicUseDigestAlgorithm|DBDUserPWQuery|DBDUserRealmQuery|DBMGroupFile|DBMType|DBMUserFile|Digest(?:Algorithm|Domain|NonceLifetime|Provider|Qop|ShmemSize)|Form(?:Authoritative|Body|DisableNoStore|FakeBasicAuth|Location|LoginRequiredLocation|LoginSuccessLocation|LogoutLocation|Method|Mimetype|Password|Provider|SitePassphrase|Size|Username)|GroupFile|LDAP(?:AuthorizePrefix|BindAuthoritative|BindDN|BindPassword|CharsetConfig|CompareAsUser|CompareDNOnServer|DereferenceAliases|GroupAttribute|GroupAttributeIsDN|InitialBindAsUser|InitialBindPattern|MaxSubGroupDepth|RemoteUserAttribute|RemoteUserIsDN|SearchAsUser|SubGroupAttribute|SubGroupClass|Url)|Merging|Name|nCache(?:Context|Enable|ProvideFor|SOCache|Timeout)|nzFcgiCheckAuthnProvider|nzFcgiDefineProvider|Type|UserFile|zDBDLoginToReferer|zDBDQuery|zDBDRedirectQuery|zDBMType|zSendForbiddenOnFailure)|BalancerGrowth|BalancerInherit|BalancerMember|BalancerPersist|BrowserMatch|BrowserMatchNoCase|BufferedLogs|BufferSize|Cache(?:DefaultExpire|DetailHeader|DirLength|DirLevels|Disable|Enable|File|Header|IgnoreCacheControl|IgnoreHeaders|IgnoreNoLastMod|IgnoreQueryString|IgnoreURLSessionIdentifiers|KeyBaseURL|LastModifiedFactor|Lock|LockMaxAge|LockPath|MaxExpire|MaxFileSize|MinExpire|MinFileSize|NegotiatedDocs|QuickHandler|ReadSize|ReadTime|Root|Socache(?:MaxSize|MaxTime|MinTime|ReadSize|ReadTime)?|StaleOnError|StoreExpired|StoreNoStore|StorePrivate)|CGIDScriptTimeout|CGIMapExtension|CharsetDefault|CharsetOptions|CharsetSourceEnc|CheckCaseOnly|CheckSpelling|ChrootDir|ContentDigest|CookieDomain|CookieExpires|CookieName|CookieStyle|CookieTracking|CoreDumpDirectory|CustomLog|Dav|DavDepthInfinity|DavGenericLockDB|DavLockDB|DavMinTimeout|DBDExptime|DBDInitSQL|DBDKeep|DBDMax|DBDMin|DBDParams|DBDPersist|DBDPrepareSQL|DBDriver|DefaultIcon|DefaultLanguage|DefaultRuntimeDir|DefaultType|Define|Deflate(?:BufferSize|CompressionLevel|FilterNote|InflateLimitRequestBody|InflateRatio(?:Burst|Limit)|MemLevel|WindowSize)|Deny|DirectoryCheckHandler|DirectoryIndex|DirectoryIndexRedirect|DirectorySlash|DocumentRoot|DTracePrivileges|DumpIOInput|DumpIOOutput|EnableExceptionHook|EnableMMAP|EnableSendfile|Error|ErrorDocument|ErrorLog|ErrorLogFormat|Example|ExpiresActive|ExpiresByType|ExpiresDefault|ExtendedStatus|ExtFilterDefine|ExtFilterOptions|FallbackResource|FileETag|FilterChain|FilterDeclare|FilterProtocol|FilterProvider|FilterTrace|ForceLanguagePriority|ForceType|ForensicLog|GprofDir|GracefulShutdownTimeout|Group|Header|HeaderName|Heartbeat(?:Address|Listen|MaxServers|Storage)|HostnameLookups|IdentityCheck|IdentityCheckTimeout|ImapBase|ImapDefault|ImapMenu|Include|IncludeOptional|Index(?:HeadInsert|Ignore|IgnoreReset|Options|OrderDefault|StyleSheet)|InputSed|ISAPI(?:AppendLogToErrors|AppendLogToQuery|CacheFile|FakeAsync|LogNotSupported|ReadAheadBuffer)|KeepAlive|KeepAliveTimeout|KeptBodySize|LanguagePriority|LDAP(?:CacheEntries|CacheTTL|ConnectionPoolTTL|ConnectionTimeout|LibraryDebug|OpCacheEntries|OpCacheTTL|ReferralHopLimit|Referrals|Retries|RetryDelay|SharedCacheFile|SharedCacheSize|Timeout|TrustedClientCert|TrustedGlobalCert|TrustedMode|VerifyServerCert)|Limit(?:InternalRecursion|Request(?:Body|Fields|FieldSize|Line)|XMLRequestBody)|Listen|ListenBackLog|LoadFile|LoadModule|LogFormat|LogLevel|LogMessage|LuaAuthzProvider|LuaCodeCache|Lua(?:Hook(?:AccessChecker|AuthChecker|CheckUserID|Fixups|InsertFilter|Log|MapToStorage|TranslateName|TypeChecker)|Inherit|InputFilter|MapHandler|OutputFilter|PackageCPath|PackagePath|QuickHandler|Root|Scope)|Max(?:ConnectionsPerChild|KeepAliveRequests|MemFree|RangeOverlaps|RangeReversals|Ranges|RequestWorkers|SpareServers|SpareThreads|Threads)|MergeTrailers|MetaDir|MetaFiles|MetaSuffix|MimeMagicFile|MinSpareServers|MinSpareThreads|MMapFile|ModemStandard|ModMimeUsePathInfo|MultiviewsMatch|Mutex|NameVirtualHost|NoProxy|NWSSLTrustedCerts|NWSSLUpgradeable|Options|Order|OutputSed|PassEnv|PidFile|PrivilegesMode|Protocol|ProtocolEcho|Proxy(?:AddHeaders|BadHeader|Block|Domain|ErrorOverride|ExpressDBMFile|ExpressDBMType|ExpressEnable|FtpDirCharset|FtpEscapeWildcards|FtpListOnWildcard|HTML(?:BufSize|CharsetOut|DocType|Enable|Events|Extended|Fixups|Interp|Links|Meta|StripComments|URLMap)|IOBufferSize|MaxForwards|Pass(?:Inherit|InterpolateEnv|Match|Reverse|ReverseCookieDomain|ReverseCookiePath)?|PreserveHost|ReceiveBufferSize|Remote|RemoteMatch|Requests|SCGIInternalRedirect|SCGISendfile|Set|SourceAddress|Status|Timeout|Via)|ReadmeName|ReceiveBufferSize|Redirect|RedirectMatch|RedirectPermanent|RedirectTemp|ReflectorHeader|RemoteIP(?:Header|InternalProxy|InternalProxyList|ProxiesHeader|TrustedProxy|TrustedProxyList)|RemoveCharset|RemoveEncoding|RemoveHandler|RemoveInputFilter|RemoveLanguage|RemoveOutputFilter|RemoveType|RequestHeader|RequestReadTimeout|Require|Rewrite(?:Base|Cond|Engine|Map|Options|Rule)|RLimitCPU|RLimitMEM|RLimitNPROC|Satisfy|ScoreBoardFile|Script(?:Alias|AliasMatch|InterpreterSource|Log|LogBuffer|LogLength|Sock)?|SecureListen|SeeRequestTail|SendBufferSize|Server(?:Admin|Alias|Limit|Name|Path|Root|Signature|Tokens)|Session(?:Cookie(?:Name|Name2|Remove)|Crypto(?:Cipher|Driver|Passphrase|PassphraseFile)|DBD(?:CookieName|CookieName2|CookieRemove|DeleteLabel|InsertLabel|PerUser|SelectLabel|UpdateLabel)|Env|Exclude|Header|Include|MaxAge)?|SetEnv|SetEnvIf|SetEnvIfExpr|SetEnvIfNoCase|SetHandler|SetInputFilter|SetOutputFilter|SSIEndTag|SSIErrorMsg|SSIETag|SSILastModified|SSILegacyExprParser|SSIStartTag|SSITimeFormat|SSIUndefinedEcho|SSL(?:CACertificateFile|CACertificatePath|CADNRequestFile|CADNRequestPath|CARevocationCheck|CARevocationFile|CARevocationPath|CertificateChainFile|CertificateFile|CertificateKeyFile|CipherSuite|Compression|CryptoDevice|Engine|FIPS|HonorCipherOrder|InsecureRenegotiation|OCSP(?:DefaultResponder|Enable|OverrideResponder|ResponderTimeout|ResponseMaxAge|ResponseTimeSkew|UseRequestNonce)|OpenSSLConfCmd|Options|PassPhraseDialog|Protocol|Proxy(?:CACertificateFile|CACertificatePath|CARevocation(?:Check|File|Path)|CheckPeer(?:CN|Expire|Name)|CipherSuite|Engine|MachineCertificate(?:ChainFile|File|Path)|Protocol|Verify|VerifyDepth)|RandomSeed|RenegBufferSize|Require|RequireSSL|Session(?:Cache|CacheTimeout|TicketKeyFile|Tickets)|SRPUnknownUserSeed|SRPVerifierFile|Stapling(?:Cache|ErrorCacheTimeout|FakeTryLater|ForceURL|ResponderTimeout|ResponseMaxAge|ResponseTimeSkew|ReturnResponderErrors|StandardCacheTimeout)|StrictSNIVHostCheck|UserName|UseStapling|VerifyClient|VerifyDepth)|StartServers|StartThreads|Substitute|Suexec|SuexecUserGroup|ThreadLimit|ThreadsPerChild|ThreadStackSize|TimeOut|TraceEnable|TransferLog|TypesConfig|UnDefine|UndefMacro|UnsetEnv|Use|UseCanonicalName|UseCanonicalPhysicalPort|User|UserDir|VHostCGIMode|VHostCGIPrivs|VHostGroup|VHostPrivs|VHostSecure|VHostUser|Virtual(?:DocumentRoot|ScriptAlias)(?:IP)?|WatchdogInterval|XBitHack|xml2EncAlias|xml2EncDefault|xml2StartParse)\b/im,
    lookbehind: true,
    alias: "property"
  },
  "directive-block": {
    pattern: /<\/?\b(?:Auth[nz]ProviderAlias|Directory|DirectoryMatch|Else|ElseIf|Files|FilesMatch|If|IfDefine|IfModule|IfVersion|Limit|LimitExcept|Location|LocationMatch|Macro|Proxy|Require(?:All|Any|None)|VirtualHost)\b.*>/i,
    inside: {
      "directive-block": {
        pattern: /^<\/?\w+/,
        inside: {
          "punctuation": /^<\/?/
        },
        alias: "tag"
      },
      "directive-block-parameter": {
        pattern: /.*[^>]/,
        inside: {
          "punctuation": /:/,
          "string": {
            pattern: /("|').*\1/,
            inside: {
              "variable": /[$%]\{?(?:\w\.?[-+:]?)+\}?/
            }
          }
        },
        alias: "attr-value"
      },
      "punctuation": />/
    },
    alias: "tag"
  },
  "directive-flags": {
    pattern: /\[(?:[\w=],?)+\]/,
    alias: "keyword"
  },
  "string": {
    pattern: /("|').*\1/,
    inside: {
      "variable": /[$%]\{?(?:\w\.?[-+:]?)+\}?/
    }
  },
  "variable": /[$%]\{?(?:\w\.?[-+:]?)+\}?/,
  "regex": /\^?.*\$|\^.*\$?/
};

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-systemd.js
(function(Prism3) {
  var comment = {
    pattern: /^[;#].*/m,
    greedy: true
  };
  var quotesSource = /"(?:[^\r\n"\\]|\\(?:[^\r]|\r\n?))*"(?!\S)/.source;
  Prism3.languages.systemd = {
    "comment": comment,
    "section": {
      pattern: /^\[[^\n\r\[\]]*\](?=[ \t]*$)/m,
      greedy: true,
      inside: {
        "punctuation": /^\[|\]$/,
        "section-name": {
          pattern: /[\s\S]+/,
          alias: "selector"
        }
      }
    },
    "key": {
      pattern: /^[^\s=]+(?=[ \t]*=)/m,
      greedy: true,
      alias: "attr-name"
    },
    "value": {
      // This pattern is quite complex because of two properties:
      //  1) Quotes (strings) must be preceded by a space. Since we can't use lookbehinds, we have to "resolve"
      //     the lookbehind. You will see this in the main loop where spaces are handled separately.
      //  2) Line continuations.
      //     After line continuations, empty lines and comments are ignored so we have to consume them.
      pattern: RegExp(
        /(=[ \t]*(?!\s))/.source + // the value either starts with quotes or not
        "(?:" + quotesSource + '|(?=[^"\r\n]))(?:' + (/[^\s\\]/.source + // handle spaces separately because of quotes
        '|[ 	]+(?:(?![ 	"])|' + quotesSource + ")|" + /\\[\r\n]+(?:[#;].*[\r\n]+)*(?![#;])/.source) + ")*"
      ),
      lookbehind: true,
      greedy: true,
      alias: "attr-value",
      inside: {
        "comment": comment,
        "quoted": {
          pattern: RegExp(/(^|\s)/.source + quotesSource),
          lookbehind: true,
          greedy: true
        },
        "punctuation": /\\$/m,
        "boolean": {
          pattern: /^(?:false|no|off|on|true|yes)$/,
          greedy: true
        }
      }
    },
    "punctuation": /=/
  };
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-cmake.js
Prism.languages.cmake = {
  "comment": /#.*/,
  "string": {
    pattern: /"(?:[^\\"]|\\.)*"/,
    greedy: true,
    inside: {
      "interpolation": {
        pattern: /\$\{(?:[^{}$]|\$\{[^{}$]*\})*\}/,
        inside: {
          "punctuation": /\$\{|\}/,
          "variable": /\w+/
        }
      }
    }
  },
  "variable": /\b(?:CMAKE_\w+|\w+_(?:(?:BINARY|SOURCE)_DIR|DESCRIPTION|HOMEPAGE_URL|ROOT|VERSION(?:_MAJOR|_MINOR|_PATCH|_TWEAK)?)|(?:ANDROID|APPLE|BORLAND|BUILD_SHARED_LIBS|CACHE|CPACK_(?:ABSOLUTE_DESTINATION_FILES|COMPONENT_INCLUDE_TOPLEVEL_DIRECTORY|ERROR_ON_ABSOLUTE_INSTALL_DESTINATION|INCLUDE_TOPLEVEL_DIRECTORY|INSTALL_DEFAULT_DIRECTORY_PERMISSIONS|INSTALL_SCRIPT|PACKAGING_INSTALL_PREFIX|SET_DESTDIR|WARN_ON_ABSOLUTE_INSTALL_DESTINATION)|CTEST_(?:BINARY_DIRECTORY|BUILD_COMMAND|BUILD_NAME|BZR_COMMAND|BZR_UPDATE_OPTIONS|CHANGE_ID|CHECKOUT_COMMAND|CONFIGURATION_TYPE|CONFIGURE_COMMAND|COVERAGE_COMMAND|COVERAGE_EXTRA_FLAGS|CURL_OPTIONS|CUSTOM_(?:COVERAGE_EXCLUDE|ERROR_EXCEPTION|ERROR_MATCH|ERROR_POST_CONTEXT|ERROR_PRE_CONTEXT|MAXIMUM_FAILED_TEST_OUTPUT_SIZE|MAXIMUM_NUMBER_OF_(?:ERRORS|WARNINGS)|MAXIMUM_PASSED_TEST_OUTPUT_SIZE|MEMCHECK_IGNORE|POST_MEMCHECK|POST_TEST|PRE_MEMCHECK|PRE_TEST|TESTS_IGNORE|WARNING_EXCEPTION|WARNING_MATCH)|CVS_CHECKOUT|CVS_COMMAND|CVS_UPDATE_OPTIONS|DROP_LOCATION|DROP_METHOD|DROP_SITE|DROP_SITE_CDASH|DROP_SITE_PASSWORD|DROP_SITE_USER|EXTRA_COVERAGE_GLOB|GIT_COMMAND|GIT_INIT_SUBMODULES|GIT_UPDATE_CUSTOM|GIT_UPDATE_OPTIONS|HG_COMMAND|HG_UPDATE_OPTIONS|LABELS_FOR_SUBPROJECTS|MEMORYCHECK_(?:COMMAND|COMMAND_OPTIONS|SANITIZER_OPTIONS|SUPPRESSIONS_FILE|TYPE)|NIGHTLY_START_TIME|P4_CLIENT|P4_COMMAND|P4_OPTIONS|P4_UPDATE_OPTIONS|RUN_CURRENT_SCRIPT|SCP_COMMAND|SITE|SOURCE_DIRECTORY|SUBMIT_URL|SVN_COMMAND|SVN_OPTIONS|SVN_UPDATE_OPTIONS|TEST_LOAD|TEST_TIMEOUT|TRIGGER_SITE|UPDATE_COMMAND|UPDATE_OPTIONS|UPDATE_VERSION_ONLY|USE_LAUNCHERS)|CYGWIN|ENV|EXECUTABLE_OUTPUT_PATH|GHS-MULTI|IOS|LIBRARY_OUTPUT_PATH|MINGW|MSVC(?:10|11|12|14|60|70|71|80|90|_IDE|_TOOLSET_VERSION|_VERSION)?|MSYS|PROJECT_NAME|UNIX|WIN32|WINCE|WINDOWS_PHONE|WINDOWS_STORE|XCODE))\b/,
  "property": /\b(?:cxx_\w+|(?:ARCHIVE_OUTPUT_(?:DIRECTORY|NAME)|COMPILE_DEFINITIONS|COMPILE_PDB_NAME|COMPILE_PDB_OUTPUT_DIRECTORY|EXCLUDE_FROM_DEFAULT_BUILD|IMPORTED_(?:IMPLIB|LIBNAME|LINK_DEPENDENT_LIBRARIES|LINK_INTERFACE_LANGUAGES|LINK_INTERFACE_LIBRARIES|LINK_INTERFACE_MULTIPLICITY|LOCATION|NO_SONAME|OBJECTS|SONAME)|INTERPROCEDURAL_OPTIMIZATION|LIBRARY_OUTPUT_DIRECTORY|LIBRARY_OUTPUT_NAME|LINK_FLAGS|LINK_INTERFACE_LIBRARIES|LINK_INTERFACE_MULTIPLICITY|LOCATION|MAP_IMPORTED_CONFIG|OSX_ARCHITECTURES|OUTPUT_NAME|PDB_NAME|PDB_OUTPUT_DIRECTORY|RUNTIME_OUTPUT_DIRECTORY|RUNTIME_OUTPUT_NAME|STATIC_LIBRARY_FLAGS|VS_CSHARP|VS_DOTNET_REFERENCEPROP|VS_DOTNET_REFERENCE|VS_GLOBAL_SECTION_POST|VS_GLOBAL_SECTION_PRE|VS_GLOBAL|XCODE_ATTRIBUTE)_\w+|\w+_(?:CLANG_TIDY|COMPILER_LAUNCHER|CPPCHECK|CPPLINT|INCLUDE_WHAT_YOU_USE|OUTPUT_NAME|POSTFIX|VISIBILITY_PRESET)|ABSTRACT|ADDITIONAL_MAKE_CLEAN_FILES|ADVANCED|ALIASED_TARGET|ALLOW_DUPLICATE_CUSTOM_TARGETS|ANDROID_(?:ANT_ADDITIONAL_OPTIONS|API|API_MIN|ARCH|ASSETS_DIRECTORIES|GUI|JAR_DEPENDENCIES|NATIVE_LIB_DEPENDENCIES|NATIVE_LIB_DIRECTORIES|PROCESS_MAX|PROGUARD|PROGUARD_CONFIG_PATH|SECURE_PROPS_PATH|SKIP_ANT_STEP|STL_TYPE)|ARCHIVE_OUTPUT_DIRECTORY|ATTACHED_FILES|ATTACHED_FILES_ON_FAIL|AUTOGEN_(?:BUILD_DIR|ORIGIN_DEPENDS|PARALLEL|SOURCE_GROUP|TARGETS_FOLDER|TARGET_DEPENDS)|AUTOMOC|AUTOMOC_(?:COMPILER_PREDEFINES|DEPEND_FILTERS|EXECUTABLE|MACRO_NAMES|MOC_OPTIONS|SOURCE_GROUP|TARGETS_FOLDER)|AUTORCC|AUTORCC_EXECUTABLE|AUTORCC_OPTIONS|AUTORCC_SOURCE_GROUP|AUTOUIC|AUTOUIC_EXECUTABLE|AUTOUIC_OPTIONS|AUTOUIC_SEARCH_PATHS|BINARY_DIR|BUILDSYSTEM_TARGETS|BUILD_RPATH|BUILD_RPATH_USE_ORIGIN|BUILD_WITH_INSTALL_NAME_DIR|BUILD_WITH_INSTALL_RPATH|BUNDLE|BUNDLE_EXTENSION|CACHE_VARIABLES|CLEAN_NO_CUSTOM|COMMON_LANGUAGE_RUNTIME|COMPATIBLE_INTERFACE_(?:BOOL|NUMBER_MAX|NUMBER_MIN|STRING)|COMPILE_(?:DEFINITIONS|FEATURES|FLAGS|OPTIONS|PDB_NAME|PDB_OUTPUT_DIRECTORY)|COST|CPACK_DESKTOP_SHORTCUTS|CPACK_NEVER_OVERWRITE|CPACK_PERMANENT|CPACK_STARTUP_SHORTCUTS|CPACK_START_MENU_SHORTCUTS|CPACK_WIX_ACL|CROSSCOMPILING_EMULATOR|CUDA_EXTENSIONS|CUDA_PTX_COMPILATION|CUDA_RESOLVE_DEVICE_SYMBOLS|CUDA_SEPARABLE_COMPILATION|CUDA_STANDARD|CUDA_STANDARD_REQUIRED|CXX_EXTENSIONS|CXX_STANDARD|CXX_STANDARD_REQUIRED|C_EXTENSIONS|C_STANDARD|C_STANDARD_REQUIRED|DEBUG_CONFIGURATIONS|DEFINE_SYMBOL|DEFINITIONS|DEPENDS|DEPLOYMENT_ADDITIONAL_FILES|DEPLOYMENT_REMOTE_DIRECTORY|DISABLED|DISABLED_FEATURES|ECLIPSE_EXTRA_CPROJECT_CONTENTS|ECLIPSE_EXTRA_NATURES|ENABLED_FEATURES|ENABLED_LANGUAGES|ENABLE_EXPORTS|ENVIRONMENT|EXCLUDE_FROM_ALL|EXCLUDE_FROM_DEFAULT_BUILD|EXPORT_NAME|EXPORT_PROPERTIES|EXTERNAL_OBJECT|EchoString|FAIL_REGULAR_EXPRESSION|FIND_LIBRARY_USE_LIB32_PATHS|FIND_LIBRARY_USE_LIB64_PATHS|FIND_LIBRARY_USE_LIBX32_PATHS|FIND_LIBRARY_USE_OPENBSD_VERSIONING|FIXTURES_CLEANUP|FIXTURES_REQUIRED|FIXTURES_SETUP|FOLDER|FRAMEWORK|Fortran_FORMAT|Fortran_MODULE_DIRECTORY|GENERATED|GENERATOR_FILE_NAME|GENERATOR_IS_MULTI_CONFIG|GHS_INTEGRITY_APP|GHS_NO_SOURCE_GROUP_FILE|GLOBAL_DEPENDS_DEBUG_MODE|GLOBAL_DEPENDS_NO_CYCLES|GNUtoMS|HAS_CXX|HEADER_FILE_ONLY|HELPSTRING|IMPLICIT_DEPENDS_INCLUDE_TRANSFORM|IMPORTED|IMPORTED_(?:COMMON_LANGUAGE_RUNTIME|CONFIGURATIONS|GLOBAL|IMPLIB|LIBNAME|LINK_DEPENDENT_LIBRARIES|LINK_INTERFACE_(?:LANGUAGES|LIBRARIES|MULTIPLICITY)|LOCATION|NO_SONAME|OBJECTS|SONAME)|IMPORT_PREFIX|IMPORT_SUFFIX|INCLUDE_DIRECTORIES|INCLUDE_REGULAR_EXPRESSION|INSTALL_NAME_DIR|INSTALL_RPATH|INSTALL_RPATH_USE_LINK_PATH|INTERFACE_(?:AUTOUIC_OPTIONS|COMPILE_DEFINITIONS|COMPILE_FEATURES|COMPILE_OPTIONS|INCLUDE_DIRECTORIES|LINK_DEPENDS|LINK_DIRECTORIES|LINK_LIBRARIES|LINK_OPTIONS|POSITION_INDEPENDENT_CODE|SOURCES|SYSTEM_INCLUDE_DIRECTORIES)|INTERPROCEDURAL_OPTIMIZATION|IN_TRY_COMPILE|IOS_INSTALL_COMBINED|JOB_POOLS|JOB_POOL_COMPILE|JOB_POOL_LINK|KEEP_EXTENSION|LABELS|LANGUAGE|LIBRARY_OUTPUT_DIRECTORY|LINKER_LANGUAGE|LINK_(?:DEPENDS|DEPENDS_NO_SHARED|DIRECTORIES|FLAGS|INTERFACE_LIBRARIES|INTERFACE_MULTIPLICITY|LIBRARIES|OPTIONS|SEARCH_END_STATIC|SEARCH_START_STATIC|WHAT_YOU_USE)|LISTFILE_STACK|LOCATION|MACOSX_BUNDLE|MACOSX_BUNDLE_INFO_PLIST|MACOSX_FRAMEWORK_INFO_PLIST|MACOSX_PACKAGE_LOCATION|MACOSX_RPATH|MACROS|MANUALLY_ADDED_DEPENDENCIES|MEASUREMENT|MODIFIED|NAME|NO_SONAME|NO_SYSTEM_FROM_IMPORTED|OBJECT_DEPENDS|OBJECT_OUTPUTS|OSX_ARCHITECTURES|OUTPUT_NAME|PACKAGES_FOUND|PACKAGES_NOT_FOUND|PARENT_DIRECTORY|PASS_REGULAR_EXPRESSION|PDB_NAME|PDB_OUTPUT_DIRECTORY|POSITION_INDEPENDENT_CODE|POST_INSTALL_SCRIPT|PREDEFINED_TARGETS_FOLDER|PREFIX|PRE_INSTALL_SCRIPT|PRIVATE_HEADER|PROCESSORS|PROCESSOR_AFFINITY|PROJECT_LABEL|PUBLIC_HEADER|REPORT_UNDEFINED_PROPERTIES|REQUIRED_FILES|RESOURCE|RESOURCE_LOCK|RULE_LAUNCH_COMPILE|RULE_LAUNCH_CUSTOM|RULE_LAUNCH_LINK|RULE_MESSAGES|RUNTIME_OUTPUT_DIRECTORY|RUN_SERIAL|SKIP_AUTOGEN|SKIP_AUTOMOC|SKIP_AUTORCC|SKIP_AUTOUIC|SKIP_BUILD_RPATH|SKIP_RETURN_CODE|SOURCES|SOURCE_DIR|SOVERSION|STATIC_LIBRARY_FLAGS|STATIC_LIBRARY_OPTIONS|STRINGS|SUBDIRECTORIES|SUFFIX|SYMBOLIC|TARGET_ARCHIVES_MAY_BE_SHARED_LIBS|TARGET_MESSAGES|TARGET_SUPPORTS_SHARED_LIBS|TESTS|TEST_INCLUDE_FILE|TEST_INCLUDE_FILES|TIMEOUT|TIMEOUT_AFTER_MATCH|TYPE|USE_FOLDERS|VALUE|VARIABLES|VERSION|VISIBILITY_INLINES_HIDDEN|VS_(?:CONFIGURATION_TYPE|COPY_TO_OUT_DIR|DEBUGGER_(?:COMMAND|COMMAND_ARGUMENTS|ENVIRONMENT|WORKING_DIRECTORY)|DEPLOYMENT_CONTENT|DEPLOYMENT_LOCATION|DOTNET_REFERENCES|DOTNET_REFERENCES_COPY_LOCAL|INCLUDE_IN_VSIX|IOT_STARTUP_TASK|KEYWORD|RESOURCE_GENERATOR|SCC_AUXPATH|SCC_LOCALPATH|SCC_PROJECTNAME|SCC_PROVIDER|SDK_REFERENCES|SHADER_(?:DISABLE_OPTIMIZATIONS|ENABLE_DEBUG|ENTRYPOINT|FLAGS|MODEL|OBJECT_FILE_NAME|OUTPUT_HEADER_FILE|TYPE|VARIABLE_NAME)|STARTUP_PROJECT|TOOL_OVERRIDE|USER_PROPS|WINRT_COMPONENT|WINRT_EXTENSIONS|WINRT_REFERENCES|XAML_TYPE)|WILL_FAIL|WIN32_EXECUTABLE|WINDOWS_EXPORT_ALL_SYMBOLS|WORKING_DIRECTORY|WRAP_EXCLUDE|XCODE_(?:EMIT_EFFECTIVE_PLATFORM_NAME|EXPLICIT_FILE_TYPE|FILE_ATTRIBUTES|LAST_KNOWN_FILE_TYPE|PRODUCT_TYPE|SCHEME_(?:ADDRESS_SANITIZER|ADDRESS_SANITIZER_USE_AFTER_RETURN|ARGUMENTS|DISABLE_MAIN_THREAD_CHECKER|DYNAMIC_LIBRARY_LOADS|DYNAMIC_LINKER_API_USAGE|ENVIRONMENT|EXECUTABLE|GUARD_MALLOC|MAIN_THREAD_CHECKER_STOP|MALLOC_GUARD_EDGES|MALLOC_SCRIBBLE|MALLOC_STACK|THREAD_SANITIZER(?:_STOP)?|UNDEFINED_BEHAVIOUR_SANITIZER(?:_STOP)?|ZOMBIE_OBJECTS))|XCTEST)\b/,
  "keyword": /\b(?:add_compile_definitions|add_compile_options|add_custom_command|add_custom_target|add_definitions|add_dependencies|add_executable|add_library|add_link_options|add_subdirectory|add_test|aux_source_directory|break|build_command|build_name|cmake_host_system_information|cmake_minimum_required|cmake_parse_arguments|cmake_policy|configure_file|continue|create_test_sourcelist|ctest_build|ctest_configure|ctest_coverage|ctest_empty_binary_directory|ctest_memcheck|ctest_read_custom_files|ctest_run_script|ctest_sleep|ctest_start|ctest_submit|ctest_test|ctest_update|ctest_upload|define_property|else|elseif|enable_language|enable_testing|endforeach|endfunction|endif|endmacro|endwhile|exec_program|execute_process|export|export_library_dependencies|file|find_file|find_library|find_package|find_path|find_program|fltk_wrap_ui|foreach|function|get_cmake_property|get_directory_property|get_filename_component|get_property|get_source_file_property|get_target_property|get_test_property|if|include|include_directories|include_external_msproject|include_guard|include_regular_expression|install|install_files|install_programs|install_targets|link_directories|link_libraries|list|load_cache|load_command|macro|make_directory|mark_as_advanced|math|message|option|output_required_files|project|qt_wrap_cpp|qt_wrap_ui|remove|remove_definitions|return|separate_arguments|set|set_directory_properties|set_property|set_source_files_properties|set_target_properties|set_tests_properties|site_name|source_group|string|subdir_depends|subdirs|target_compile_definitions|target_compile_features|target_compile_options|target_include_directories|target_link_directories|target_link_libraries|target_link_options|target_sources|try_compile|try_run|unset|use_mangled_mesa|utility_source|variable_requires|variable_watch|while|write_file)(?=\s*\()\b/,
  "boolean": /\b(?:FALSE|OFF|ON|TRUE)\b/,
  "namespace": /\b(?:INTERFACE|PRIVATE|PROPERTIES|PUBLIC|SHARED|STATIC|TARGET_OBJECTS)\b/,
  "operator": /\b(?:AND|DEFINED|EQUAL|GREATER|LESS|MATCHES|NOT|OR|STREQUAL|STRGREATER|STRLESS|VERSION_EQUAL|VERSION_GREATER|VERSION_LESS)\b/,
  "inserted": {
    pattern: /\b\w+::\w+\b/,
    alias: "class-name"
  },
  "number": /\b\d+(?:\.\d+)*\b/,
  "function": /\b[a-z_]\w*(?=\s*\()\b/i,
  "punctuation": /[()>}]|\$[<{]/
};

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-erlang.js
Prism.languages.erlang = {
  "comment": /%.+/,
  "string": {
    pattern: /"(?:\\.|[^\\"\r\n])*"/,
    greedy: true
  },
  "quoted-function": {
    pattern: /'(?:\\.|[^\\'\r\n])+'(?=\()/,
    alias: "function"
  },
  "quoted-atom": {
    pattern: /'(?:\\.|[^\\'\r\n])+'/,
    alias: "atom"
  },
  "boolean": /\b(?:false|true)\b/,
  "keyword": /\b(?:after|begin|case|catch|end|fun|if|of|receive|try|when)\b/,
  "number": [
    /\$\\?./,
    /\b\d+#[a-z0-9]+/i,
    /(?:\b\d+(?:\.\d*)?|\B\.\d+)(?:e[+-]?\d+)?/i
  ],
  "function": /\b[a-z][\w@]*(?=\()/,
  "variable": {
    // Look-behind is used to prevent wrong highlighting of atoms containing "@"
    pattern: /(^|[^@])(?:\b|\?)[A-Z_][\w@]*/,
    lookbehind: true
  },
  "operator": [
    /[=\/<>:]=|=[:\/]=|\+\+?|--?|[=*\/!]|\b(?:and|andalso|band|bnot|bor|bsl|bsr|bxor|div|not|or|orelse|rem|xor)\b/,
    {
      // We don't want to match <<
      pattern: /(^|[^<])<(?!<)/,
      lookbehind: true
    },
    {
      // We don't want to match >>
      pattern: /(^|[^>])>(?!>)/,
      lookbehind: true
    }
  ],
  "atom": /\b[a-z][\w@]*/,
  "punctuation": /[()[\]{}:;,.#|]|<<|>>/
};

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-rescript.js
Prism.languages.rescript = {
  "comment": {
    pattern: /\/\/.*|\/\*[\s\S]*?(?:\*\/|$)/,
    greedy: true
  },
  "char": { pattern: /'(?:[^\r\n\\]|\\(?:.|\w+))'/, greedy: true },
  "string": {
    pattern: /"(?:\\(?:\r\n|[\s\S])|[^\\\r\n"])*"/,
    greedy: true
  },
  "class-name": /\b[A-Z]\w*|@[a-z.]*|#[A-Za-z]\w*|#\d/,
  "function": {
    pattern: /[a-zA-Z]\w*(?=\()|(\.)[a-z]\w*/,
    lookbehind: true
  },
  "number": /(?:\b0x(?:[\da-f]+(?:\.[\da-f]*)?|\.[\da-f]+)(?:p[+-]?\d+)?|(?:\b\d+(?:\.\d*)?|\B\.\d+)(?:e[+-]?\d+)?)[ful]{0,4}/i,
  "boolean": /\b(?:false|true)\b/,
  "attr-value": /[A-Za-z]\w*(?==)/,
  "constant": {
    pattern: /(\btype\s+)[a-z]\w*/,
    lookbehind: true
  },
  "tag": {
    pattern: /(<)[a-z]\w*|(?:<\/)[a-z]\w*/,
    lookbehind: true,
    inside: {
      "operator": /<|>|\//
    }
  },
  "keyword": /\b(?:and|as|assert|begin|bool|class|constraint|do|done|downto|else|end|exception|external|float|for|fun|function|if|in|include|inherit|initializer|int|lazy|let|method|module|mutable|new|nonrec|object|of|open|or|private|rec|string|switch|then|to|try|type|when|while|with)\b/,
  "operator": /\.{3}|:[:=]?|\|>|->|=(?:==?|>)?|<=?|>=?|[|^?'#!~`]|[+\-*\/]\.?|\b(?:asr|land|lor|lsl|lsr|lxor|mod)\b/,
  "punctuation": /[(){}[\],;.]/
};
Prism.languages.insertBefore("rescript", "string", {
  "template-string": {
    pattern: /`(?:\\[\s\S]|\$\{(?:[^{}]|\{(?:[^{}]|\{[^}]*\})*\})+\}|(?!\$\{)[^\\`])*`/,
    greedy: true,
    inside: {
      "template-punctuation": {
        pattern: /^`|`$/,
        alias: "string"
      },
      "interpolation": {
        pattern: /((?:^|[^\\])(?:\\{2})*)\$\{(?:[^{}]|\{(?:[^{}]|\{[^}]*\})*\})+\}/,
        lookbehind: true,
        inside: {
          "interpolation-punctuation": {
            pattern: /^\$\{|\}$/,
            alias: "tag"
          },
          rest: Prism.languages.rescript
        }
      },
      "string": /[\s\S]+/
    }
  }
});
Prism.languages.res = Prism.languages.rescript;

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-cpp.js
(function(Prism3) {
  var keyword = /\b(?:alignas|alignof|asm|auto|bool|break|case|catch|char|char16_t|char32_t|char8_t|class|co_await|co_return|co_yield|compl|concept|const|const_cast|consteval|constexpr|constinit|continue|decltype|default|delete|do|double|dynamic_cast|else|enum|explicit|export|extern|final|float|for|friend|goto|if|import|inline|int|int16_t|int32_t|int64_t|int8_t|long|module|mutable|namespace|new|noexcept|nullptr|operator|override|private|protected|public|register|reinterpret_cast|requires|return|short|signed|sizeof|static|static_assert|static_cast|struct|switch|template|this|thread_local|throw|try|typedef|typeid|typename|uint16_t|uint32_t|uint64_t|uint8_t|union|unsigned|using|virtual|void|volatile|wchar_t|while)\b/;
  var modName = /\b(?!<keyword>)\w+(?:\s*\.\s*\w+)*\b/.source.replace(/<keyword>/g, function() {
    return keyword.source;
  });
  Prism3.languages.cpp = Prism3.languages.extend("c", {
    "class-name": [
      {
        pattern: RegExp(/(\b(?:class|concept|enum|struct|typename)\s+)(?!<keyword>)\w+/.source.replace(/<keyword>/g, function() {
          return keyword.source;
        })),
        lookbehind: true
      },
      // This is intended to capture the class name of method implementations like:
      //   void foo::bar() const {}
      // However! The `foo` in the above example could also be a namespace, so we only capture the class name if
      // it starts with an uppercase letter. This approximation should give decent results.
      /\b[A-Z]\w*(?=\s*::\s*\w+\s*\()/,
      // This will capture the class name before destructors like:
      //   Foo::~Foo() {}
      /\b[A-Z_]\w*(?=\s*::\s*~\w+\s*\()/i,
      // This also intends to capture the class name of method implementations but here the class has template
      // parameters, so it can't be a namespace (until C++ adds generic namespaces).
      /\b\w+(?=\s*<(?:[^<>]|<(?:[^<>]|<[^<>]*>)*>)*>\s*::\s*\w+\s*\()/
    ],
    "keyword": keyword,
    "number": {
      pattern: /(?:\b0b[01']+|\b0x(?:[\da-f']+(?:\.[\da-f']*)?|\.[\da-f']+)(?:p[+-]?[\d']+)?|(?:\b[\d']+(?:\.[\d']*)?|\B\.[\d']+)(?:e[+-]?[\d']+)?)[ful]{0,4}/i,
      greedy: true
    },
    "operator": />>=?|<<=?|->|--|\+\+|&&|\|\||[?:~]|<=>|[-+*/%&|^!=<>]=?|\b(?:and|and_eq|bitand|bitor|not|not_eq|or|or_eq|xor|xor_eq)\b/,
    "boolean": /\b(?:false|true)\b/
  });
  Prism3.languages.insertBefore("cpp", "string", {
    "module": {
      // https://en.cppreference.com/w/cpp/language/modules
      pattern: RegExp(
        /(\b(?:import|module)\s+)/.source + "(?:" + // header-name
        /"(?:\\(?:\r\n|[\s\S])|[^"\\\r\n])*"|<[^<>\r\n]*>/.source + "|" + // module name or partition or both
        /<mod-name>(?:\s*:\s*<mod-name>)?|:\s*<mod-name>/.source.replace(/<mod-name>/g, function() {
          return modName;
        }) + ")"
      ),
      lookbehind: true,
      greedy: true,
      inside: {
        "string": /^[<"][\s\S]+/,
        "operator": /:/,
        "punctuation": /\./
      }
    },
    "raw-string": {
      pattern: /R"([^()\\ ]{0,16})\([\s\S]*?\)\1"/,
      alias: "string",
      greedy: true
    }
  });
  Prism3.languages.insertBefore("cpp", "keyword", {
    "generic-function": {
      pattern: /\b(?!operator\b)[a-z_]\w*\s*<(?:[^<>]|<[^<>]*>)*>(?=\s*\()/i,
      inside: {
        "function": /^\w+/,
        "generic": {
          pattern: /<[\s\S]+/,
          alias: "class-name",
          inside: Prism3.languages.cpp
        }
      }
    }
  });
  Prism3.languages.insertBefore("cpp", "operator", {
    "double-colon": {
      pattern: /::/,
      alias: "punctuation"
    }
  });
  Prism3.languages.insertBefore("cpp", "class-name", {
    // the base clause is an optional list of parent classes
    // https://en.cppreference.com/w/cpp/language/class
    "base-clause": {
      pattern: /(\b(?:class|struct)\s+\w+\s*:\s*)[^;{}"'\s]+(?:\s+[^;{}"'\s]+)*(?=\s*[;{])/,
      lookbehind: true,
      greedy: true,
      inside: Prism3.languages.extend("cpp", {})
    }
  });
  Prism3.languages.insertBefore("inside", "double-colon", {
    // All untokenized words that are not namespaces should be class names
    "class-name": /\b[a-z_]\w*\b(?!\s*::)/i
  }, Prism3.languages.cpp["base-clause"]);
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-objectivec.js
Prism.languages.objectivec = Prism.languages.extend("c", {
  "string": {
    pattern: /@?"(?:\\(?:\r\n|[\s\S])|[^"\\\r\n])*"/,
    greedy: true
  },
  "keyword": /\b(?:asm|auto|break|case|char|const|continue|default|do|double|else|enum|extern|float|for|goto|if|in|inline|int|long|register|return|self|short|signed|sizeof|static|struct|super|switch|typedef|typeof|union|unsigned|void|volatile|while)\b|(?:@interface|@end|@implementation|@protocol|@class|@public|@protected|@private|@property|@try|@catch|@finally|@throw|@synthesize|@dynamic|@selector)\b/,
  "operator": /-[->]?|\+\+?|!=?|<<?=?|>>?=?|==?|&&?|\|\|?|[~^%?*\/@]/
});
delete Prism.languages.objectivec["class-name"];
Prism.languages.objc = Prism.languages.objectivec;

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-glsl.js
Prism.languages.glsl = Prism.languages.extend("c", {
  "keyword": /\b(?:active|asm|atomic_uint|attribute|[ibdu]?vec[234]|bool|break|buffer|case|cast|centroid|class|coherent|common|const|continue|d?mat[234](?:x[234])?|default|discard|do|double|else|enum|extern|external|false|filter|fixed|flat|float|for|fvec[234]|goto|half|highp|hvec[234]|[iu]?sampler2DMS(?:Array)?|[iu]?sampler2DRect|[iu]?samplerBuffer|[iu]?samplerCube|[iu]?samplerCubeArray|[iu]?sampler[123]D|[iu]?sampler[12]DArray|[iu]?image2DMS(?:Array)?|[iu]?image2DRect|[iu]?imageBuffer|[iu]?imageCube|[iu]?imageCubeArray|[iu]?image[123]D|[iu]?image[12]DArray|if|in|inline|inout|input|int|interface|invariant|layout|long|lowp|mediump|namespace|noinline|noperspective|out|output|partition|patch|precise|precision|public|readonly|resource|restrict|return|sample|sampler[12]DArrayShadow|sampler[12]DShadow|sampler2DRectShadow|sampler3DRect|samplerCubeArrayShadow|samplerCubeShadow|shared|short|sizeof|smooth|static|struct|subroutine|superp|switch|template|this|true|typedef|uint|uniform|union|unsigned|using|varying|void|volatile|while|writeonly)\b/
});

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-java.js
(function(Prism3) {
  var keywords = /\b(?:abstract|assert|boolean|break|byte|case|catch|char|class|const|continue|default|do|double|else|enum|exports|extends|final|finally|float|for|goto|if|implements|import|instanceof|int|interface|long|module|native|new|non-sealed|null|open|opens|package|permits|private|protected|provides|public|record(?!\s*[(){}[\]<>=%~.:,;?+\-*/&|^])|requires|return|sealed|short|static|strictfp|super|switch|synchronized|this|throw|throws|to|transient|transitive|try|uses|var|void|volatile|while|with|yield)\b/;
  var classNamePrefix = /(?:[a-z]\w*\s*\.\s*)*(?:[A-Z]\w*\s*\.\s*)*/.source;
  var className = {
    pattern: RegExp(/(^|[^\w.])/.source + classNamePrefix + /[A-Z](?:[\d_A-Z]*[a-z]\w*)?\b/.source),
    lookbehind: true,
    inside: {
      "namespace": {
        pattern: /^[a-z]\w*(?:\s*\.\s*[a-z]\w*)*(?:\s*\.)?/,
        inside: {
          "punctuation": /\./
        }
      },
      "punctuation": /\./
    }
  };
  Prism3.languages.java = Prism3.languages.extend("clike", {
    "string": {
      pattern: /(^|[^\\])"(?:\\.|[^"\\\r\n])*"/,
      lookbehind: true,
      greedy: true
    },
    "class-name": [
      className,
      {
        // variables, parameters, and constructor references
        // this to support class names (or generic parameters) which do not contain a lower case letter (also works for methods)
        pattern: RegExp(/(^|[^\w.])/.source + classNamePrefix + /[A-Z]\w*(?=\s+\w+\s*[;,=()]|\s*(?:\[[\s,]*\]\s*)?::\s*new\b)/.source),
        lookbehind: true,
        inside: className.inside
      },
      {
        // class names based on keyword
        // this to support class names (or generic parameters) which do not contain a lower case letter (also works for methods)
        pattern: RegExp(/(\b(?:class|enum|extends|implements|instanceof|interface|new|record|throws)\s+)/.source + classNamePrefix + /[A-Z]\w*\b/.source),
        lookbehind: true,
        inside: className.inside
      }
    ],
    "keyword": keywords,
    "function": [
      Prism3.languages.clike.function,
      {
        pattern: /(::\s*)[a-z_]\w*/,
        lookbehind: true
      }
    ],
    "number": /\b0b[01][01_]*L?\b|\b0x(?:\.[\da-f_p+-]+|[\da-f_]+(?:\.[\da-f_p+-]+)?)\b|(?:\b\d[\d_]*(?:\.[\d_]*)?|\B\.\d[\d_]*)(?:e[+-]?\d[\d_]*)?[dfl]?/i,
    "operator": {
      pattern: /(^|[^.])(?:<<=?|>>>?=?|->|--|\+\+|&&|\|\||::|[?:~]|[-+*/%&|^!=<>]=?)/m,
      lookbehind: true
    },
    "constant": /\b[A-Z][A-Z_\d]+\b/
  });
  Prism3.languages.insertBefore("java", "string", {
    "triple-quoted-string": {
      // http://openjdk.java.net/jeps/355#Description
      pattern: /"""[ \t]*[\r\n](?:(?:"|"")?(?:\\.|[^"\\]))*"""/,
      greedy: true,
      alias: "string"
    },
    "char": {
      pattern: /'(?:\\.|[^'\\\r\n]){1,6}'/,
      greedy: true
    }
  });
  Prism3.languages.insertBefore("java", "class-name", {
    "annotation": {
      pattern: /(^|[^.])@\w+(?:\s*\.\s*\w+)*/,
      lookbehind: true,
      alias: "punctuation"
    },
    "generics": {
      pattern: /<(?:[\w\s,.?]|&(?!&)|<(?:[\w\s,.?]|&(?!&)|<(?:[\w\s,.?]|&(?!&)|<(?:[\w\s,.?]|&(?!&))*>)*>)*>)*>/,
      inside: {
        "class-name": className,
        "keyword": keywords,
        "punctuation": /[<>(),.:]/,
        "operator": /[?&|]/
      }
    },
    "import": [
      {
        pattern: RegExp(/(\bimport\s+)/.source + classNamePrefix + /(?:[A-Z]\w*|\*)(?=\s*;)/.source),
        lookbehind: true,
        inside: {
          "namespace": className.inside.namespace,
          "punctuation": /\./,
          "operator": /\*/,
          "class-name": /\w+/
        }
      },
      {
        pattern: RegExp(/(\bimport\s+static\s+)/.source + classNamePrefix + /(?:\w+|\*)(?=\s*;)/.source),
        lookbehind: true,
        alias: "static",
        inside: {
          "namespace": className.inside.namespace,
          "static": /\b\w+$/,
          "punctuation": /\./,
          "operator": /\*/,
          "class-name": /\w+/
        }
      }
    ],
    "namespace": {
      pattern: RegExp(
        /(\b(?:exports|import(?:\s+static)?|module|open|opens|package|provides|requires|to|transitive|uses|with)\s+)(?!<keyword>)[a-z]\w*(?:\.[a-z]\w*)*\.?/.source.replace(/<keyword>/g, function() {
          return keywords.source;
        })
      ),
      lookbehind: true,
      inside: {
        "punctuation": /\./
      }
    }
  });
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-typescript.js
(function(Prism3) {
  Prism3.languages.typescript = Prism3.languages.extend("javascript", {
    "class-name": {
      pattern: /(\b(?:class|extends|implements|instanceof|interface|new|type)\s+)(?!keyof\b)(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?:\s*<(?:[^<>]|<(?:[^<>]|<[^<>]*>)*>)*>)?/,
      lookbehind: true,
      greedy: true,
      inside: null
      // see below
    },
    "builtin": /\b(?:Array|Function|Promise|any|boolean|console|never|number|string|symbol|unknown)\b/
  });
  Prism3.languages.typescript.keyword.push(
    /\b(?:abstract|declare|is|keyof|readonly|require)\b/,
    // keywords that have to be followed by an identifier
    /\b(?:asserts|infer|interface|module|namespace|type)\b(?=\s*(?:[{_$a-zA-Z\xA0-\uFFFF]|$))/,
    // This is for `import type *, {}`
    /\btype\b(?=\s*(?:[\{*]|$))/
  );
  delete Prism3.languages.typescript["parameter"];
  delete Prism3.languages.typescript["literal-property"];
  var typeInside = Prism3.languages.extend("typescript", {});
  delete typeInside["class-name"];
  Prism3.languages.typescript["class-name"].inside = typeInside;
  Prism3.languages.insertBefore("typescript", "function", {
    "decorator": {
      pattern: /@[$\w\xA0-\uFFFF]+/,
      inside: {
        "at": {
          pattern: /^@/,
          alias: "operator"
        },
        "function": /^[\s\S]+/
      }
    },
    "generic-function": {
      // e.g. foo<T extends "bar" | "baz">( ...
      pattern: /#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*\s*<(?:[^<>]|<(?:[^<>]|<[^<>]*>)*>)*>(?=\s*\()/,
      greedy: true,
      inside: {
        "function": /^#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*/,
        "generic": {
          pattern: /<[\s\S]+/,
          // everything after the first <
          alias: "class-name",
          inside: typeInside
        }
      }
    }
  });
  Prism3.languages.ts = Prism3.languages.typescript;
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-coffeescript.js
(function(Prism3) {
  var comment = /#(?!\{).+/;
  var interpolation = {
    pattern: /#\{[^}]+\}/,
    alias: "variable"
  };
  Prism3.languages.coffeescript = Prism3.languages.extend("javascript", {
    "comment": comment,
    "string": [
      // Strings are multiline
      {
        pattern: /'(?:\\[\s\S]|[^\\'])*'/,
        greedy: true
      },
      {
        // Strings are multiline
        pattern: /"(?:\\[\s\S]|[^\\"])*"/,
        greedy: true,
        inside: {
          "interpolation": interpolation
        }
      }
    ],
    "keyword": /\b(?:and|break|by|catch|class|continue|debugger|delete|do|each|else|extend|extends|false|finally|for|if|in|instanceof|is|isnt|let|loop|namespace|new|no|not|null|of|off|on|or|own|return|super|switch|then|this|throw|true|try|typeof|undefined|unless|until|when|while|window|with|yes|yield)\b/,
    "class-member": {
      pattern: /@(?!\d)\w+/,
      alias: "variable"
    }
  });
  Prism3.languages.insertBefore("coffeescript", "comment", {
    "multiline-comment": {
      pattern: /###[\s\S]+?###/,
      alias: "comment"
    },
    // Block regexp can contain comments and interpolation
    "block-regex": {
      pattern: /\/{3}[\s\S]*?\/{3}/,
      alias: "regex",
      inside: {
        "comment": comment,
        "interpolation": interpolation
      }
    }
  });
  Prism3.languages.insertBefore("coffeescript", "string", {
    "inline-javascript": {
      pattern: /`(?:\\[\s\S]|[^\\`])*`/,
      inside: {
        "delimiter": {
          pattern: /^`|`$/,
          alias: "punctuation"
        },
        "script": {
          pattern: /[\s\S]+/,
          alias: "language-javascript",
          inside: Prism3.languages.javascript
        }
      }
    },
    // Block strings
    "multiline-string": [
      {
        pattern: /'''[\s\S]*?'''/,
        greedy: true,
        alias: "string"
      },
      {
        pattern: /"""[\s\S]*?"""/,
        greedy: true,
        alias: "string",
        inside: {
          interpolation
        }
      }
    ]
  });
  Prism3.languages.insertBefore("coffeescript", "keyword", {
    // Object property
    "property": /(?!\d)\w+(?=\s*:(?!:))/
  });
  delete Prism3.languages.coffeescript["template-string"];
  Prism3.languages.coffee = Prism3.languages.coffeescript;
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-js-templates.js
(function(Prism3) {
  var templateString = Prism3.languages.javascript["template-string"];
  var templateLiteralPattern = templateString.pattern.source;
  var interpolationObject = templateString.inside["interpolation"];
  var interpolationPunctuationObject = interpolationObject.inside["interpolation-punctuation"];
  var interpolationPattern = interpolationObject.pattern.source;
  function createTemplate(language, tag) {
    if (!Prism3.languages[language]) {
      return void 0;
    }
    return {
      pattern: RegExp("((?:" + tag + ")\\s*)" + templateLiteralPattern),
      lookbehind: true,
      greedy: true,
      inside: {
        "template-punctuation": {
          pattern: /^`|`$/,
          alias: "string"
        },
        "embedded-code": {
          pattern: /[\s\S]+/,
          alias: language
        }
      }
    };
  }
  Prism3.languages.javascript["template-string"] = [
    // styled-jsx:
    //   css`a { color: #25F; }`
    // styled-components:
    //   styled.h1`color: red;`
    createTemplate("css", /\b(?:styled(?:\([^)]*\))?(?:\s*\.\s*\w+(?:\([^)]*\))*)*|css(?:\s*\.\s*(?:global|resolve))?|createGlobalStyle|keyframes)/.source),
    // html`<p></p>`
    // div.innerHTML = `<p></p>`
    createTemplate("html", /\bhtml|\.\s*(?:inner|outer)HTML\s*\+?=/.source),
    // svg`<path fill="#fff" d="M55.37 ..."/>`
    createTemplate("svg", /\bsvg/.source),
    // md`# h1`, markdown`## h2`
    createTemplate("markdown", /\b(?:markdown|md)/.source),
    // gql`...`, graphql`...`, graphql.experimental`...`
    createTemplate("graphql", /\b(?:gql|graphql(?:\s*\.\s*experimental)?)/.source),
    // sql`...`
    createTemplate("sql", /\bsql/.source),
    // vanilla template string
    templateString
  ].filter(Boolean);
  function getPlaceholder(counter, language) {
    return "___" + language.toUpperCase() + "_" + counter + "___";
  }
  function tokenizeWithHooks(code, grammar, language) {
    var env = {
      code,
      grammar,
      language
    };
    Prism3.hooks.run("before-tokenize", env);
    env.tokens = Prism3.tokenize(env.code, env.grammar);
    Prism3.hooks.run("after-tokenize", env);
    return env.tokens;
  }
  function tokenizeInterpolationExpression(expression) {
    var tempGrammar = {};
    tempGrammar["interpolation-punctuation"] = interpolationPunctuationObject;
    var tokens = Prism3.tokenize(expression, tempGrammar);
    if (tokens.length === 3) {
      var args = [1, 1];
      args.push.apply(args, tokenizeWithHooks(tokens[1], Prism3.languages.javascript, "javascript"));
      tokens.splice.apply(tokens, args);
    }
    return new Prism3.Token("interpolation", tokens, interpolationObject.alias, expression);
  }
  function tokenizeEmbedded(code, grammar, language) {
    var _tokens = Prism3.tokenize(code, {
      "interpolation": {
        pattern: RegExp(interpolationPattern),
        lookbehind: true
      }
    });
    var placeholderCounter = 0;
    var placeholderMap = {};
    var embeddedCode = _tokens.map(function(token) {
      if (typeof token === "string") {
        return token;
      } else {
        var interpolationExpression = token.content;
        var placeholder;
        while (code.indexOf(placeholder = getPlaceholder(placeholderCounter++, language)) !== -1) {
        }
        placeholderMap[placeholder] = interpolationExpression;
        return placeholder;
      }
    }).join("");
    var embeddedTokens = tokenizeWithHooks(embeddedCode, grammar, language);
    var placeholders = Object.keys(placeholderMap);
    placeholderCounter = 0;
    function walkTokens(tokens) {
      for (var i = 0; i < tokens.length; i++) {
        if (placeholderCounter >= placeholders.length) {
          return;
        }
        var token = tokens[i];
        if (typeof token === "string" || typeof token.content === "string") {
          var placeholder = placeholders[placeholderCounter];
          var s = typeof token === "string" ? token : (
            /** @type {string} */
            token.content
          );
          var index = s.indexOf(placeholder);
          if (index !== -1) {
            ++placeholderCounter;
            var before = s.substring(0, index);
            var middle = tokenizeInterpolationExpression(placeholderMap[placeholder]);
            var after = s.substring(index + placeholder.length);
            var replacement = [];
            if (before) {
              replacement.push(before);
            }
            replacement.push(middle);
            if (after) {
              var afterTokens = [after];
              walkTokens(afterTokens);
              replacement.push.apply(replacement, afterTokens);
            }
            if (typeof token === "string") {
              tokens.splice.apply(tokens, [i, 1].concat(replacement));
              i += replacement.length - 1;
            } else {
              token.content = replacement;
            }
          }
        } else {
          var content = token.content;
          if (Array.isArray(content)) {
            walkTokens(content);
          } else {
            walkTokens([content]);
          }
        }
      }
    }
    walkTokens(embeddedTokens);
    return new Prism3.Token(language, embeddedTokens, "language-" + language, code);
  }
  var supportedLanguages = {
    "javascript": true,
    "js": true,
    "typescript": true,
    "ts": true,
    "jsx": true,
    "tsx": true
  };
  Prism3.hooks.add("after-tokenize", function(env) {
    if (!(env.language in supportedLanguages)) {
      return;
    }
    function findTemplateStrings(tokens) {
      for (var i = 0, l = tokens.length; i < l; i++) {
        var token = tokens[i];
        if (typeof token === "string") {
          continue;
        }
        var content = token.content;
        if (!Array.isArray(content)) {
          if (typeof content !== "string") {
            findTemplateStrings([content]);
          }
          continue;
        }
        if (token.type === "template-string") {
          var embedded = content[1];
          if (content.length === 3 && typeof embedded !== "string" && embedded.type === "embedded-code") {
            var code = stringContent(embedded);
            var alias = embedded.alias;
            var language = Array.isArray(alias) ? alias[0] : alias;
            var grammar = Prism3.languages[language];
            if (!grammar) {
              continue;
            }
            content[1] = tokenizeEmbedded(code, grammar, language);
          }
        } else {
          findTemplateStrings(content);
        }
      }
    }
    findTemplateStrings(env.tokens);
  });
  function stringContent(value) {
    if (typeof value === "string") {
      return value;
    } else if (Array.isArray(value)) {
      return value.map(stringContent).join("");
    } else {
      return stringContent(value.content);
    }
  }
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-js-extras.js
(function(Prism3) {
  Prism3.languages.insertBefore("javascript", "function-variable", {
    "method-variable": {
      pattern: RegExp("(\\.\\s*)" + Prism3.languages.javascript["function-variable"].pattern.source),
      lookbehind: true,
      alias: ["function-variable", "method", "function", "property-access"]
    }
  });
  Prism3.languages.insertBefore("javascript", "function", {
    "method": {
      pattern: RegExp("(\\.\\s*)" + Prism3.languages.javascript["function"].source),
      lookbehind: true,
      alias: ["function", "property-access"]
    }
  });
  Prism3.languages.insertBefore("javascript", "constant", {
    "known-class-name": [
      {
        // standard built-ins
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects
        pattern: /\b(?:(?:Float(?:32|64)|(?:Int|Uint)(?:8|16|32)|Uint8Clamped)?Array|ArrayBuffer|BigInt|Boolean|DataView|Date|Error|Function|Intl|JSON|(?:Weak)?(?:Map|Set)|Math|Number|Object|Promise|Proxy|Reflect|RegExp|String|Symbol|WebAssembly)\b/,
        alias: "class-name"
      },
      {
        // errors
        pattern: /\b(?:[A-Z]\w*)Error\b/,
        alias: "class-name"
      }
    ]
  });
  function withId(source, flags) {
    return RegExp(
      source.replace(/<ID>/g, function() {
        return /(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*/.source;
      }),
      flags
    );
  }
  Prism3.languages.insertBefore("javascript", "keyword", {
    "imports": {
      // https://tc39.es/ecma262/#sec-imports
      pattern: withId(/(\bimport\b\s*)(?:<ID>(?:\s*,\s*(?:\*\s*as\s+<ID>|\{[^{}]*\}))?|\*\s*as\s+<ID>|\{[^{}]*\})(?=\s*\bfrom\b)/.source),
      lookbehind: true,
      inside: Prism3.languages.javascript
    },
    "exports": {
      // https://tc39.es/ecma262/#sec-exports
      pattern: withId(/(\bexport\b\s*)(?:\*(?:\s*as\s+<ID>)?(?=\s*\bfrom\b)|\{[^{}]*\})/.source),
      lookbehind: true,
      inside: Prism3.languages.javascript
    }
  });
  Prism3.languages.javascript["keyword"].unshift(
    {
      pattern: /\b(?:as|default|export|from|import)\b/,
      alias: "module"
    },
    {
      pattern: /\b(?:await|break|catch|continue|do|else|finally|for|if|return|switch|throw|try|while|yield)\b/,
      alias: "control-flow"
    },
    {
      pattern: /\bnull\b/,
      alias: ["null", "nil"]
    },
    {
      pattern: /\bundefined\b/,
      alias: "nil"
    }
  );
  Prism3.languages.insertBefore("javascript", "operator", {
    "spread": {
      pattern: /\.{3}/,
      alias: "operator"
    },
    "arrow": {
      pattern: /=>/,
      alias: "operator"
    }
  });
  Prism3.languages.insertBefore("javascript", "punctuation", {
    "property-access": {
      pattern: withId(/(\.\s*)#?<ID>/.source),
      lookbehind: true
    },
    "maybe-class-name": {
      pattern: /(^|[^$\w\xA0-\uFFFF])[A-Z][$\w\xA0-\uFFFF]+/,
      lookbehind: true
    },
    "dom": {
      // this contains only a few commonly used DOM variables
      pattern: /\b(?:document|(?:local|session)Storage|location|navigator|performance|window)\b/,
      alias: "variable"
    },
    "console": {
      pattern: /\bconsole(?=\s*\.)/,
      alias: "class-name"
    }
  });
  var maybeClassNameTokens = ["function", "function-variable", "method", "method-variable", "property-access"];
  for (var i = 0; i < maybeClassNameTokens.length; i++) {
    var token = maybeClassNameTokens[i];
    var value = Prism3.languages.javascript[token];
    if (Prism3.util.type(value) === "RegExp") {
      value = Prism3.languages.javascript[token] = {
        pattern: value
      };
    }
    var inside = value.inside || {};
    value.inside = inside;
    inside["maybe-class-name"] = /^[A-Z][\s\S]*/;
  }
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-json5.js
(function(Prism3) {
  var string = /("|')(?:\\(?:\r\n?|\n|.)|(?!\1)[^\\\r\n])*\1/;
  Prism3.languages.json5 = Prism3.languages.extend("json", {
    "property": [
      {
        pattern: RegExp(string.source + "(?=\\s*:)"),
        greedy: true
      },
      {
        pattern: /(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*:)/,
        alias: "unquoted"
      }
    ],
    "string": {
      pattern: string,
      greedy: true
    },
    "number": /[+-]?\b(?:NaN|Infinity|0x[a-fA-F\d]+)\b|[+-]?(?:\b\d+(?:\.\d*)?|\B\.\d+)(?:[eE][+-]?\d+\b)?/
  });
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-jsonp.js
Prism.languages.jsonp = Prism.languages.extend("json", {
  "punctuation": /[{}[\]();,.]/
});
Prism.languages.insertBefore("jsonp", "punctuation", {
  "function": /(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*\()/
});

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-http.js
(function(Prism3) {
  function headerValueOf(name) {
    return RegExp("(^(?:" + name + "):[ 	]*(?![ 	]))[^]+", "i");
  }
  Prism3.languages.http = {
    "request-line": {
      pattern: /^(?:CONNECT|DELETE|GET|HEAD|OPTIONS|PATCH|POST|PRI|PUT|SEARCH|TRACE)\s(?:https?:\/\/|\/)\S*\sHTTP\/[\d.]+/m,
      inside: {
        // HTTP Method
        "method": {
          pattern: /^[A-Z]+\b/,
          alias: "property"
        },
        // Request Target e.g. http://example.com, /path/to/file
        "request-target": {
          pattern: /^(\s)(?:https?:\/\/|\/)\S*(?=\s)/,
          lookbehind: true,
          alias: "url",
          inside: Prism3.languages.uri
        },
        // HTTP Version
        "http-version": {
          pattern: /^(\s)HTTP\/[\d.]+/,
          lookbehind: true,
          alias: "property"
        }
      }
    },
    "response-status": {
      pattern: /^HTTP\/[\d.]+ \d+ .+/m,
      inside: {
        // HTTP Version
        "http-version": {
          pattern: /^HTTP\/[\d.]+/,
          alias: "property"
        },
        // Status Code
        "status-code": {
          pattern: /^(\s)\d+(?=\s)/,
          lookbehind: true,
          alias: "number"
        },
        // Reason Phrase
        "reason-phrase": {
          pattern: /^(\s).+/,
          lookbehind: true,
          alias: "string"
        }
      }
    },
    "header": {
      pattern: /^[\w-]+:.+(?:(?:\r\n?|\n)[ \t].+)*/m,
      inside: {
        "header-value": [
          {
            pattern: headerValueOf(/Content-Security-Policy/.source),
            lookbehind: true,
            alias: ["csp", "languages-csp"],
            inside: Prism3.languages.csp
          },
          {
            pattern: headerValueOf(/Public-Key-Pins(?:-Report-Only)?/.source),
            lookbehind: true,
            alias: ["hpkp", "languages-hpkp"],
            inside: Prism3.languages.hpkp
          },
          {
            pattern: headerValueOf(/Strict-Transport-Security/.source),
            lookbehind: true,
            alias: ["hsts", "languages-hsts"],
            inside: Prism3.languages.hsts
          },
          {
            pattern: headerValueOf(/[^:]+/.source),
            lookbehind: true
          }
        ],
        "header-name": {
          pattern: /^[^:]+/,
          alias: "keyword"
        },
        "punctuation": /^:/
      }
    }
  };
  var langs = Prism3.languages;
  var httpLanguages = {
    "application/javascript": langs.javascript,
    "application/json": langs.json || langs.javascript,
    "application/xml": langs.xml,
    "text/xml": langs.xml,
    "text/html": langs.html,
    "text/css": langs.css,
    "text/plain": langs.plain
  };
  var suffixTypes = {
    "application/json": true,
    "application/xml": true
  };
  function getSuffixPattern(contentType2) {
    var suffix = contentType2.replace(/^[a-z]+\//, "");
    var suffixPattern = "\\w+/(?:[\\w.-]+\\+)+" + suffix + "(?![+\\w.-])";
    return "(?:" + contentType2 + "|" + suffixPattern + ")";
  }
  var options;
  for (var contentType in httpLanguages) {
    if (httpLanguages[contentType]) {
      options = options || {};
      var pattern = suffixTypes[contentType] ? getSuffixPattern(contentType) : contentType;
      options[contentType.replace(/\//g, "-")] = {
        pattern: RegExp(
          "(" + /content-type:\s*/.source + pattern + /(?:(?:\r\n?|\n)[\w-].*)*(?:\r(?:\n|(?!\n))|\n)/.source + ")" + // This is a little interesting:
          // The HTTP format spec required 1 empty line before the body to make everything unambiguous.
          // However, when writing code by hand (e.g. to display on a website) people can forget about this,
          // so we want to be liberal here. We will allow the empty line to be omitted if the first line of
          // the body does not start with a [\w-] character (as headers do).
          /[^ \t\w-][\s\S]*/.source,
          "i"
        ),
        lookbehind: true,
        inside: httpLanguages[contentType]
      };
    }
  }
  if (options) {
    Prism3.languages.insertBefore("http", "header", options);
  }
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-shell-session.js
(function(Prism3) {
  var strings = [
    // normal string
    /"(?:\\[\s\S]|\$\([^)]+\)|\$(?!\()|`[^`]+`|[^"\\`$])*"/.source,
    /'[^']*'/.source,
    /\$'(?:[^'\\]|\\[\s\S])*'/.source,
    // here doc
    // 2 capturing groups
    /<<-?\s*(["']?)(\w+)\1\s[\s\S]*?[\r\n]\2/.source
  ].join("|");
  Prism3.languages["shell-session"] = {
    "command": {
      pattern: RegExp(
        // user info
        /^/.source + "(?:" + // <user> ":" ( <path> )?
        (/[^\s@:$#%*!/\\]+@[^\r\n@:$#%*!/\\]+(?::[^\0-\x1F$#%*?"<>:;|]+)?/.source + "|" + // <path>
        // Since the path pattern is quite general, we will require it to start with a special character to
        // prevent false positives.
        /[/~.][^\0-\x1F$#%*?"<>@:;|]*/.source) + ")?" + // shell symbol
        /[$#%](?=\s)/.source + // bash command
        /(?:[^\\\r\n \t'"<$]|[ \t](?:(?!#)|#.*$)|\\(?:[^\r]|\r\n?)|\$(?!')|<(?!<)|<<str>>)+/.source.replace(/<<str>>/g, function() {
          return strings;
        }),
        "m"
      ),
      greedy: true,
      inside: {
        "info": {
          // foo@bar:~/files$ exit
          // foo@bar$ exit
          // ~/files$ exit
          pattern: /^[^#$%]+/,
          alias: "punctuation",
          inside: {
            "user": /^[^\s@:$#%*!/\\]+@[^\r\n@:$#%*!/\\]+/,
            "punctuation": /:/,
            "path": /[\s\S]+/
          }
        },
        "bash": {
          pattern: /(^[$#%]\s*)\S[\s\S]*/,
          lookbehind: true,
          alias: "language-bash",
          inside: Prism3.languages.bash
        },
        "shell-symbol": {
          pattern: /^[$#%]/,
          alias: "important"
        }
      }
    },
    "output": /.(?:.*(?:[\r\n]|.$))*/
  };
  Prism3.languages["sh-session"] = Prism3.languages["shellsession"] = Prism3.languages["shell-session"];
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-haml.js
(function(Prism3) {
  Prism3.languages.haml = {
    // Multiline stuff should appear before the rest
    "multiline-comment": {
      pattern: /((?:^|\r?\n|\r)([\t ]*))(?:\/|-#).*(?:(?:\r?\n|\r)\2[\t ].+)*/,
      lookbehind: true,
      alias: "comment"
    },
    "multiline-code": [
      {
        pattern: /((?:^|\r?\n|\r)([\t ]*)(?:[~-]|[&!]?=)).*,[\t ]*(?:(?:\r?\n|\r)\2[\t ].*,[\t ]*)*(?:(?:\r?\n|\r)\2[\t ].+)/,
        lookbehind: true,
        inside: Prism3.languages.ruby
      },
      {
        pattern: /((?:^|\r?\n|\r)([\t ]*)(?:[~-]|[&!]?=)).*\|[\t ]*(?:(?:\r?\n|\r)\2[\t ].*\|[\t ]*)*/,
        lookbehind: true,
        inside: Prism3.languages.ruby
      }
    ],
    // See at the end of the file for known filters
    "filter": {
      pattern: /((?:^|\r?\n|\r)([\t ]*)):[\w-]+(?:(?:\r?\n|\r)(?:\2[\t ].+|\s*?(?=\r?\n|\r)))+/,
      lookbehind: true,
      inside: {
        "filter-name": {
          pattern: /^:[\w-]+/,
          alias: "symbol"
        }
      }
    },
    "markup": {
      pattern: /((?:^|\r?\n|\r)[\t ]*)<.+/,
      lookbehind: true,
      inside: Prism3.languages.markup
    },
    "doctype": {
      pattern: /((?:^|\r?\n|\r)[\t ]*)!!!(?: .+)?/,
      lookbehind: true
    },
    "tag": {
      // Allows for one nested group of braces
      pattern: /((?:^|\r?\n|\r)[\t ]*)[%.#][\w\-#.]*[\w\-](?:\([^)]+\)|\{(?:\{[^}]+\}|[^{}])+\}|\[[^\]]+\])*[\/<>]*/,
      lookbehind: true,
      inside: {
        "attributes": [
          {
            // Lookbehind tries to prevent interpolations from breaking it all
            // Allows for one nested group of braces
            pattern: /(^|[^#])\{(?:\{[^}]+\}|[^{}])+\}/,
            lookbehind: true,
            inside: Prism3.languages.ruby
          },
          {
            pattern: /\([^)]+\)/,
            inside: {
              "attr-value": {
                pattern: /(=\s*)(?:"(?:\\.|[^\\"\r\n])*"|[^)\s]+)/,
                lookbehind: true
              },
              "attr-name": /[\w:-]+(?=\s*!?=|\s*[,)])/,
              "punctuation": /[=(),]/
            }
          },
          {
            pattern: /\[[^\]]+\]/,
            inside: Prism3.languages.ruby
          }
        ],
        "punctuation": /[<>]/
      }
    },
    "code": {
      pattern: /((?:^|\r?\n|\r)[\t ]*(?:[~-]|[&!]?=)).+/,
      lookbehind: true,
      inside: Prism3.languages.ruby
    },
    // Interpolations in plain text
    "interpolation": {
      pattern: /#\{[^}]+\}/,
      inside: {
        "delimiter": {
          pattern: /^#\{|\}$/,
          alias: "punctuation"
        },
        "ruby": {
          pattern: /[\s\S]+/,
          inside: Prism3.languages.ruby
        }
      }
    },
    "punctuation": {
      pattern: /((?:^|\r?\n|\r)[\t ]*)[~=\-&!]+/,
      lookbehind: true
    }
  };
  var filter_pattern = "((?:^|\\r?\\n|\\r)([\\t ]*)):{{filter_name}}(?:(?:\\r?\\n|\\r)(?:\\2[\\t ].+|\\s*?(?=\\r?\\n|\\r)))+";
  var filters = [
    "css",
    { filter: "coffee", language: "coffeescript" },
    "erb",
    "javascript",
    "less",
    "markdown",
    "ruby",
    "scss",
    "textile"
  ];
  var all_filters = {};
  for (var i = 0, l = filters.length; i < l; i++) {
    var filter = filters[i];
    filter = typeof filter === "string" ? { filter, language: filter } : filter;
    if (Prism3.languages[filter.language]) {
      all_filters["filter-" + filter.filter] = {
        pattern: RegExp(filter_pattern.replace("{{filter_name}}", function() {
          return filter.filter;
        })),
        lookbehind: true,
        inside: {
          "filter-name": {
            pattern: /^:[\w-]+/,
            alias: "symbol"
          },
          "text": {
            pattern: /[\s\S]+/,
            alias: [filter.language, "language-" + filter.language],
            inside: Prism3.languages[filter.language]
          }
        }
      };
    }
  }
  Prism3.languages.insertBefore("haml", "filter", all_filters);
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-handlebars.js
(function(Prism3) {
  Prism3.languages.handlebars = {
    "comment": /\{\{![\s\S]*?\}\}/,
    "delimiter": {
      pattern: /^\{\{\{?|\}\}\}?$/,
      alias: "punctuation"
    },
    "string": /(["'])(?:\\.|(?!\1)[^\\\r\n])*\1/,
    "number": /\b0x[\dA-Fa-f]+\b|(?:\b\d+(?:\.\d*)?|\B\.\d+)(?:[Ee][+-]?\d+)?/,
    "boolean": /\b(?:false|true)\b/,
    "block": {
      pattern: /^(\s*(?:~\s*)?)[#\/]\S+?(?=\s*(?:~\s*)?$|\s)/,
      lookbehind: true,
      alias: "keyword"
    },
    "brackets": {
      pattern: /\[[^\]]+\]/,
      inside: {
        punctuation: /\[|\]/,
        variable: /[\s\S]+/
      }
    },
    "punctuation": /[!"#%&':()*+,.\/;<=>@\[\\\]^`{|}~]/,
    "variable": /[^!"#%&'()*+,\/;<=>@\[\\\]^`{|}~\s]+/
  };
  Prism3.hooks.add("before-tokenize", function(env) {
    var handlebarsPattern = /\{\{\{[\s\S]+?\}\}\}|\{\{[\s\S]+?\}\}/g;
    Prism3.languages["markup-templating"].buildPlaceholders(env, "handlebars", handlebarsPattern);
  });
  Prism3.hooks.add("after-tokenize", function(env) {
    Prism3.languages["markup-templating"].tokenizePlaceholders(env, "handlebars");
  });
  Prism3.languages.hbs = Prism3.languages.handlebars;
  Prism3.languages.mustache = Prism3.languages.handlebars;
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-ejs.js
(function(Prism3) {
  Prism3.languages.ejs = {
    "delimiter": {
      pattern: /^<%[-_=]?|[-_]?%>$/,
      alias: "punctuation"
    },
    "comment": /^#[\s\S]*/,
    "language-javascript": {
      pattern: /[\s\S]+/,
      inside: Prism3.languages.javascript
    }
  };
  Prism3.hooks.add("before-tokenize", function(env) {
    var ejsPattern = /<%(?!%)[\s\S]+?%>/g;
    Prism3.languages["markup-templating"].buildPlaceholders(env, "ejs", ejsPattern);
  });
  Prism3.hooks.add("after-tokenize", function(env) {
    Prism3.languages["markup-templating"].tokenizePlaceholders(env, "ejs");
  });
  Prism3.languages.eta = Prism3.languages.ejs;
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-django.js
(function(Prism3) {
  Prism3.languages.django = {
    "comment": /^\{#[\s\S]*?#\}$/,
    "tag": {
      pattern: /(^\{%[+-]?\s*)\w+/,
      lookbehind: true,
      alias: "keyword"
    },
    "delimiter": {
      pattern: /^\{[{%][+-]?|[+-]?[}%]\}$/,
      alias: "punctuation"
    },
    "string": {
      pattern: /("|')(?:\\.|(?!\1)[^\\\r\n])*\1/,
      greedy: true
    },
    "filter": {
      pattern: /(\|)\w+/,
      lookbehind: true,
      alias: "function"
    },
    "test": {
      pattern: /(\bis\s+(?:not\s+)?)(?!not\b)\w+/,
      lookbehind: true,
      alias: "function"
    },
    "function": /\b[a-z_]\w+(?=\s*\()/i,
    "keyword": /\b(?:and|as|by|else|for|if|import|in|is|loop|not|or|recursive|with|without)\b/,
    "operator": /[-+%=]=?|!=|\*\*?=?|\/\/?=?|<[<=>]?|>[=>]?|[&|^~]/,
    "number": /\b\d+(?:\.\d+)?\b/,
    "boolean": /[Ff]alse|[Nn]one|[Tt]rue/,
    "variable": /\b\w+\b/,
    "punctuation": /[{}[\](),.:;]/
  };
  var pattern = /\{\{[\s\S]*?\}\}|\{%[\s\S]*?%\}|\{#[\s\S]*?#\}/g;
  var markupTemplating = Prism3.languages["markup-templating"];
  Prism3.hooks.add("before-tokenize", function(env) {
    markupTemplating.buildPlaceholders(env, "django", pattern);
  });
  Prism3.hooks.add("after-tokenize", function(env) {
    markupTemplating.tokenizePlaceholders(env, "django");
  });
  Prism3.languages.jinja2 = Prism3.languages.django;
  Prism3.hooks.add("before-tokenize", function(env) {
    markupTemplating.buildPlaceholders(env, "jinja2", pattern);
  });
  Prism3.hooks.add("after-tokenize", function(env) {
    markupTemplating.tokenizePlaceholders(env, "jinja2");
  });
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-twig.js
Prism.languages.twig = {
  "comment": /^\{#[\s\S]*?#\}$/,
  "tag-name": {
    pattern: /(^\{%-?\s*)\w+/,
    lookbehind: true,
    alias: "keyword"
  },
  "delimiter": {
    pattern: /^\{[{%]-?|-?[%}]\}$/,
    alias: "punctuation"
  },
  "string": {
    pattern: /("|')(?:\\.|(?!\1)[^\\\r\n])*\1/,
    inside: {
      "punctuation": /^['"]|['"]$/
    }
  },
  "keyword": /\b(?:even|if|odd)\b/,
  "boolean": /\b(?:false|null|true)\b/,
  "number": /\b0x[\dA-Fa-f]+|(?:\b\d+(?:\.\d*)?|\B\.\d+)(?:[Ee][-+]?\d+)?/,
  "operator": [
    {
      pattern: /(\s)(?:and|b-and|b-or|b-xor|ends with|in|is|matches|not|or|same as|starts with)(?=\s)/,
      lookbehind: true
    },
    /[=<>]=?|!=|\*\*?|\/\/?|\?:?|[-+~%|]/
  ],
  "punctuation": /[()\[\]{}:.,]/
};
Prism.hooks.add("before-tokenize", function(env) {
  if (env.language !== "twig") {
    return;
  }
  var pattern = /\{(?:#[\s\S]*?#|%[\s\S]*?%|\{[\s\S]*?\})\}/g;
  Prism.languages["markup-templating"].buildPlaceholders(env, "twig", pattern);
});
Prism.hooks.add("after-tokenize", function(env) {
  Prism.languages["markup-templating"].tokenizePlaceholders(env, "twig");
});

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-liquid.js
Prism.languages.liquid = {
  "comment": {
    pattern: /(^\{%\s*comment\s*%\})[\s\S]+(?=\{%\s*endcomment\s*%\}$)/,
    lookbehind: true
  },
  "delimiter": {
    pattern: /^\{(?:\{\{|[%\{])-?|-?(?:\}\}|[%\}])\}$/,
    alias: "punctuation"
  },
  "string": {
    pattern: /"[^"]*"|'[^']*'/,
    greedy: true
  },
  "keyword": /\b(?:as|assign|break|(?:end)?(?:capture|case|comment|for|form|if|paginate|raw|style|tablerow|unless)|continue|cycle|decrement|echo|else|elsif|in|include|increment|limit|liquid|offset|range|render|reversed|section|when|with)\b/,
  "object": /\b(?:address|all_country_option_tags|article|block|blog|cart|checkout|collection|color|country|country_option_tags|currency|current_page|current_tags|customer|customer_address|date|discount_allocation|discount_application|external_video|filter|filter_value|font|forloop|fulfillment|generic_file|gift_card|group|handle|image|line_item|link|linklist|localization|location|measurement|media|metafield|model|model_source|order|page|page_description|page_image|page_title|part|policy|product|product_option|recommendations|request|robots|routes|rule|script|search|selling_plan|selling_plan_allocation|selling_plan_group|shipping_method|shop|shop_locale|sitemap|store_availability|tax_line|template|theme|transaction|unit_price_measurement|user_agent|variant|video|video_source)\b/,
  "function": [
    {
      pattern: /(\|\s*)\w+/,
      lookbehind: true,
      alias: "filter"
    },
    {
      // array functions
      pattern: /(\.\s*)(?:first|last|size)/,
      lookbehind: true
    }
  ],
  "boolean": /\b(?:false|nil|true)\b/,
  "range": {
    pattern: /\.\./,
    alias: "operator"
  },
  // https://github.com/Shopify/liquid/blob/698f5e0d967423e013f6169d9111bd969bd78337/lib/liquid/lexer.rb#L21
  "number": /\b\d+(?:\.\d+)?\b/,
  "operator": /[!=]=|<>|[<>]=?|[|?:=-]|\b(?:and|contains(?=\s)|or)\b/,
  "punctuation": /[.,\[\]()]/,
  "empty": {
    pattern: /\bempty\b/,
    alias: "keyword"
  }
};
Prism.hooks.add("before-tokenize", function(env) {
  var liquidPattern = /\{%\s*comment\s*%\}[\s\S]*?\{%\s*endcomment\s*%\}|\{(?:%[\s\S]*?%|\{\{[\s\S]*?\}\}|\{[\s\S]*?\})\}/g;
  var insideRaw = false;
  Prism.languages["markup-templating"].buildPlaceholders(env, "liquid", liquidPattern, function(match) {
    var tagMatch = /^\{%-?\s*(\w+)/.exec(match);
    if (tagMatch) {
      var tag = tagMatch[1];
      if (tag === "raw" && !insideRaw) {
        insideRaw = true;
        return true;
      } else if (tag === "endraw") {
        insideRaw = false;
        return true;
      }
    }
    return !insideRaw;
  });
});
Prism.hooks.add("after-tokenize", function(env) {
  Prism.languages["markup-templating"].tokenizePlaceholders(env, "liquid");
});

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-php.js
(function(Prism3) {
  var comment = /\/\*[\s\S]*?\*\/|\/\/.*|#(?!\[).*/;
  var constant = [
    {
      pattern: /\b(?:false|true)\b/i,
      alias: "boolean"
    },
    {
      pattern: /(::\s*)\b[a-z_]\w*\b(?!\s*\()/i,
      greedy: true,
      lookbehind: true
    },
    {
      pattern: /(\b(?:case|const)\s+)\b[a-z_]\w*(?=\s*[;=])/i,
      greedy: true,
      lookbehind: true
    },
    /\b(?:null)\b/i,
    /\b[A-Z_][A-Z0-9_]*\b(?!\s*\()/
  ];
  var number = /\b0b[01]+(?:_[01]+)*\b|\b0o[0-7]+(?:_[0-7]+)*\b|\b0x[\da-f]+(?:_[\da-f]+)*\b|(?:\b\d+(?:_\d+)*\.?(?:\d+(?:_\d+)*)?|\B\.\d+)(?:e[+-]?\d+)?/i;
  var operator = /<?=>|\?\?=?|\.{3}|\??->|[!=]=?=?|::|\*\*=?|--|\+\+|&&|\|\||<<|>>|[?~]|[/^|%*&<>.+-]=?/;
  var punctuation = /[{}\[\](),:;]/;
  Prism3.languages.php = {
    "delimiter": {
      pattern: /\?>$|^<\?(?:php(?=\s)|=)?/i,
      alias: "important"
    },
    "comment": comment,
    "variable": /\$+(?:\w+\b|(?=\{))/,
    "package": {
      pattern: /(namespace\s+|use\s+(?:function\s+)?)(?:\\?\b[a-z_]\w*)+\b(?!\\)/i,
      lookbehind: true,
      inside: {
        "punctuation": /\\/
      }
    },
    "class-name-definition": {
      pattern: /(\b(?:class|enum|interface|trait)\s+)\b[a-z_]\w*(?!\\)\b/i,
      lookbehind: true,
      alias: "class-name"
    },
    "function-definition": {
      pattern: /(\bfunction\s+)[a-z_]\w*(?=\s*\()/i,
      lookbehind: true,
      alias: "function"
    },
    "keyword": [
      {
        pattern: /(\(\s*)\b(?:array|bool|boolean|float|int|integer|object|string)\b(?=\s*\))/i,
        alias: "type-casting",
        greedy: true,
        lookbehind: true
      },
      {
        pattern: /([(,?]\s*)\b(?:array(?!\s*\()|bool|callable|(?:false|null)(?=\s*\|)|float|int|iterable|mixed|object|self|static|string)\b(?=\s*\$)/i,
        alias: "type-hint",
        greedy: true,
        lookbehind: true
      },
      {
        pattern: /(\)\s*:\s*(?:\?\s*)?)\b(?:array(?!\s*\()|bool|callable|(?:false|null)(?=\s*\|)|float|int|iterable|mixed|never|object|self|static|string|void)\b/i,
        alias: "return-type",
        greedy: true,
        lookbehind: true
      },
      {
        pattern: /\b(?:array(?!\s*\()|bool|float|int|iterable|mixed|object|string|void)\b/i,
        alias: "type-declaration",
        greedy: true
      },
      {
        pattern: /(\|\s*)(?:false|null)\b|\b(?:false|null)(?=\s*\|)/i,
        alias: "type-declaration",
        greedy: true,
        lookbehind: true
      },
      {
        pattern: /\b(?:parent|self|static)(?=\s*::)/i,
        alias: "static-context",
        greedy: true
      },
      {
        // yield from
        pattern: /(\byield\s+)from\b/i,
        lookbehind: true
      },
      // `class` is always a keyword unlike other keywords
      /\bclass\b/i,
      {
        // https://www.php.net/manual/en/reserved.keywords.php
        //
        // keywords cannot be preceded by "->"
        // the complex lookbehind means `(?<!(?:->|::)\s*)`
        pattern: /((?:^|[^\s>:]|(?:^|[^-])>|(?:^|[^:]):)\s*)\b(?:abstract|and|array|as|break|callable|case|catch|clone|const|continue|declare|default|die|do|echo|else|elseif|empty|enddeclare|endfor|endforeach|endif|endswitch|endwhile|enum|eval|exit|extends|final|finally|fn|for|foreach|function|global|goto|if|implements|include|include_once|instanceof|insteadof|interface|isset|list|match|namespace|never|new|or|parent|print|private|protected|public|readonly|require|require_once|return|self|static|switch|throw|trait|try|unset|use|var|while|xor|yield|__halt_compiler)\b/i,
        lookbehind: true
      }
    ],
    "argument-name": {
      pattern: /([(,]\s*)\b[a-z_]\w*(?=\s*:(?!:))/i,
      lookbehind: true
    },
    "class-name": [
      {
        pattern: /(\b(?:extends|implements|instanceof|new(?!\s+self|\s+static))\s+|\bcatch\s*\()\b[a-z_]\w*(?!\\)\b/i,
        greedy: true,
        lookbehind: true
      },
      {
        pattern: /(\|\s*)\b[a-z_]\w*(?!\\)\b/i,
        greedy: true,
        lookbehind: true
      },
      {
        pattern: /\b[a-z_]\w*(?!\\)\b(?=\s*\|)/i,
        greedy: true
      },
      {
        pattern: /(\|\s*)(?:\\?\b[a-z_]\w*)+\b/i,
        alias: "class-name-fully-qualified",
        greedy: true,
        lookbehind: true,
        inside: {
          "punctuation": /\\/
        }
      },
      {
        pattern: /(?:\\?\b[a-z_]\w*)+\b(?=\s*\|)/i,
        alias: "class-name-fully-qualified",
        greedy: true,
        inside: {
          "punctuation": /\\/
        }
      },
      {
        pattern: /(\b(?:extends|implements|instanceof|new(?!\s+self\b|\s+static\b))\s+|\bcatch\s*\()(?:\\?\b[a-z_]\w*)+\b(?!\\)/i,
        alias: "class-name-fully-qualified",
        greedy: true,
        lookbehind: true,
        inside: {
          "punctuation": /\\/
        }
      },
      {
        pattern: /\b[a-z_]\w*(?=\s*\$)/i,
        alias: "type-declaration",
        greedy: true
      },
      {
        pattern: /(?:\\?\b[a-z_]\w*)+(?=\s*\$)/i,
        alias: ["class-name-fully-qualified", "type-declaration"],
        greedy: true,
        inside: {
          "punctuation": /\\/
        }
      },
      {
        pattern: /\b[a-z_]\w*(?=\s*::)/i,
        alias: "static-context",
        greedy: true
      },
      {
        pattern: /(?:\\?\b[a-z_]\w*)+(?=\s*::)/i,
        alias: ["class-name-fully-qualified", "static-context"],
        greedy: true,
        inside: {
          "punctuation": /\\/
        }
      },
      {
        pattern: /([(,?]\s*)[a-z_]\w*(?=\s*\$)/i,
        alias: "type-hint",
        greedy: true,
        lookbehind: true
      },
      {
        pattern: /([(,?]\s*)(?:\\?\b[a-z_]\w*)+(?=\s*\$)/i,
        alias: ["class-name-fully-qualified", "type-hint"],
        greedy: true,
        lookbehind: true,
        inside: {
          "punctuation": /\\/
        }
      },
      {
        pattern: /(\)\s*:\s*(?:\?\s*)?)\b[a-z_]\w*(?!\\)\b/i,
        alias: "return-type",
        greedy: true,
        lookbehind: true
      },
      {
        pattern: /(\)\s*:\s*(?:\?\s*)?)(?:\\?\b[a-z_]\w*)+\b(?!\\)/i,
        alias: ["class-name-fully-qualified", "return-type"],
        greedy: true,
        lookbehind: true,
        inside: {
          "punctuation": /\\/
        }
      }
    ],
    "constant": constant,
    "function": {
      pattern: /(^|[^\\\w])\\?[a-z_](?:[\w\\]*\w)?(?=\s*\()/i,
      lookbehind: true,
      inside: {
        "punctuation": /\\/
      }
    },
    "property": {
      pattern: /(->\s*)\w+/,
      lookbehind: true
    },
    "number": number,
    "operator": operator,
    "punctuation": punctuation
  };
  var string_interpolation = {
    pattern: /\{\$(?:\{(?:\{[^{}]+\}|[^{}]+)\}|[^{}])+\}|(^|[^\\{])\$+(?:\w+(?:\[[^\r\n\[\]]+\]|->\w+)?)/,
    lookbehind: true,
    inside: Prism3.languages.php
  };
  var string = [
    {
      pattern: /<<<'([^']+)'[\r\n](?:.*[\r\n])*?\1;/,
      alias: "nowdoc-string",
      greedy: true,
      inside: {
        "delimiter": {
          pattern: /^<<<'[^']+'|[a-z_]\w*;$/i,
          alias: "symbol",
          inside: {
            "punctuation": /^<<<'?|[';]$/
          }
        }
      }
    },
    {
      pattern: /<<<(?:"([^"]+)"[\r\n](?:.*[\r\n])*?\1;|([a-z_]\w*)[\r\n](?:.*[\r\n])*?\2;)/i,
      alias: "heredoc-string",
      greedy: true,
      inside: {
        "delimiter": {
          pattern: /^<<<(?:"[^"]+"|[a-z_]\w*)|[a-z_]\w*;$/i,
          alias: "symbol",
          inside: {
            "punctuation": /^<<<"?|[";]$/
          }
        },
        "interpolation": string_interpolation
      }
    },
    {
      pattern: /`(?:\\[\s\S]|[^\\`])*`/,
      alias: "backtick-quoted-string",
      greedy: true
    },
    {
      pattern: /'(?:\\[\s\S]|[^\\'])*'/,
      alias: "single-quoted-string",
      greedy: true
    },
    {
      pattern: /"(?:\\[\s\S]|[^\\"])*"/,
      alias: "double-quoted-string",
      greedy: true,
      inside: {
        "interpolation": string_interpolation
      }
    }
  ];
  Prism3.languages.insertBefore("php", "variable", {
    "string": string,
    "attribute": {
      pattern: /#\[(?:[^"'\/#]|\/(?![*/])|\/\/.*$|#(?!\[).*$|\/\*(?:[^*]|\*(?!\/))*\*\/|"(?:\\[\s\S]|[^\\"])*"|'(?:\\[\s\S]|[^\\'])*')+\](?=\s*[a-z$#])/im,
      greedy: true,
      inside: {
        "attribute-content": {
          pattern: /^(#\[)[\s\S]+(?=\]$)/,
          lookbehind: true,
          // inside can appear subset of php
          inside: {
            "comment": comment,
            "string": string,
            "attribute-class-name": [
              {
                pattern: /([^:]|^)\b[a-z_]\w*(?!\\)\b/i,
                alias: "class-name",
                greedy: true,
                lookbehind: true
              },
              {
                pattern: /([^:]|^)(?:\\?\b[a-z_]\w*)+/i,
                alias: [
                  "class-name",
                  "class-name-fully-qualified"
                ],
                greedy: true,
                lookbehind: true,
                inside: {
                  "punctuation": /\\/
                }
              }
            ],
            "constant": constant,
            "number": number,
            "operator": operator,
            "punctuation": punctuation
          }
        },
        "delimiter": {
          pattern: /^#\[|\]$/,
          alias: "punctuation"
        }
      }
    }
  });
  Prism3.hooks.add("before-tokenize", function(env) {
    if (!/<\?/.test(env.code)) {
      return;
    }
    var phpPattern = /<\?(?:[^"'/#]|\/(?![*/])|("|')(?:\\[\s\S]|(?!\1)[^\\])*\1|(?:\/\/|#(?!\[))(?:[^?\n\r]|\?(?!>))*(?=$|\?>|[\r\n])|#\[|\/\*(?:[^*]|\*(?!\/))*(?:\*\/|$))*?(?:\?>|$)/g;
    Prism3.languages["markup-templating"].buildPlaceholders(env, "php", phpPattern);
  });
  Prism3.hooks.add("after-tokenize", function(env) {
    Prism3.languages["markup-templating"].tokenizePlaceholders(env, "php");
  });
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-erb.js
(function(Prism3) {
  Prism3.languages.erb = {
    "delimiter": {
      pattern: /^(\s*)<%=?|%>(?=\s*$)/,
      lookbehind: true,
      alias: "punctuation"
    },
    "ruby": {
      pattern: /\s*\S[\s\S]*/,
      alias: "language-ruby",
      inside: Prism3.languages.ruby
    }
  };
  Prism3.hooks.add("before-tokenize", function(env) {
    var erbPattern = /<%=?(?:[^\r\n]|[\r\n](?!=begin)|[\r\n]=begin\s(?:[^\r\n]|[\r\n](?!=end))*[\r\n]=end)+?%>/g;
    Prism3.languages["markup-templating"].buildPlaceholders(env, "erb", erbPattern);
  });
  Prism3.hooks.add("after-tokenize", function(env) {
    Prism3.languages["markup-templating"].tokenizePlaceholders(env, "erb");
  });
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-pug.js
(function(Prism3) {
  Prism3.languages.pug = {
    // Multiline stuff should appear before the rest
    // This handles both single-line and multi-line comments
    "comment": {
      pattern: /(^([\t ]*))\/\/.*(?:(?:\r?\n|\r)\2[\t ].+)*/m,
      lookbehind: true
    },
    // All the tag-related part is in lookbehind
    // so that it can be highlighted by the "tag" pattern
    "multiline-script": {
      pattern: /(^([\t ]*)script\b.*\.[\t ]*)(?:(?:\r?\n|\r(?!\n))(?:\2[\t ].+|\s*?(?=\r?\n|\r)))+/m,
      lookbehind: true,
      inside: Prism3.languages.javascript
    },
    // See at the end of the file for known filters
    "filter": {
      pattern: /(^([\t ]*)):.+(?:(?:\r?\n|\r(?!\n))(?:\2[\t ].+|\s*?(?=\r?\n|\r)))+/m,
      lookbehind: true,
      inside: {
        "filter-name": {
          pattern: /^:[\w-]+/,
          alias: "variable"
        },
        "text": /\S[\s\S]*/
      }
    },
    "multiline-plain-text": {
      pattern: /(^([\t ]*)[\w\-#.]+\.[\t ]*)(?:(?:\r?\n|\r(?!\n))(?:\2[\t ].+|\s*?(?=\r?\n|\r)))+/m,
      lookbehind: true
    },
    "markup": {
      pattern: /(^[\t ]*)<.+/m,
      lookbehind: true,
      inside: Prism3.languages.markup
    },
    "doctype": {
      pattern: /((?:^|\n)[\t ]*)doctype(?: .+)?/,
      lookbehind: true
    },
    // This handle all conditional and loop keywords
    "flow-control": {
      pattern: /(^[\t ]*)(?:case|default|each|else|if|unless|when|while)\b(?: .+)?/m,
      lookbehind: true,
      inside: {
        "each": {
          pattern: /^each .+? in\b/,
          inside: {
            "keyword": /\b(?:each|in)\b/,
            "punctuation": /,/
          }
        },
        "branch": {
          pattern: /^(?:case|default|else|if|unless|when|while)\b/,
          alias: "keyword"
        },
        rest: Prism3.languages.javascript
      }
    },
    "keyword": {
      pattern: /(^[\t ]*)(?:append|block|extends|include|prepend)\b.+/m,
      lookbehind: true
    },
    "mixin": [
      // Declaration
      {
        pattern: /(^[\t ]*)mixin .+/m,
        lookbehind: true,
        inside: {
          "keyword": /^mixin/,
          "function": /\w+(?=\s*\(|\s*$)/,
          "punctuation": /[(),.]/
        }
      },
      // Usage
      {
        pattern: /(^[\t ]*)\+.+/m,
        lookbehind: true,
        inside: {
          "name": {
            pattern: /^\+\w+/,
            alias: "function"
          },
          rest: Prism3.languages.javascript
        }
      }
    ],
    "script": {
      pattern: /(^[\t ]*script(?:(?:&[^(]+)?\([^)]+\))*[\t ]).+/m,
      lookbehind: true,
      inside: Prism3.languages.javascript
    },
    "plain-text": {
      pattern: /(^[\t ]*(?!-)[\w\-#.]*[\w\-](?:(?:&[^(]+)?\([^)]+\))*\/?[\t ]).+/m,
      lookbehind: true
    },
    "tag": {
      pattern: /(^[\t ]*)(?!-)[\w\-#.]*[\w\-](?:(?:&[^(]+)?\([^)]+\))*\/?:?/m,
      lookbehind: true,
      inside: {
        "attributes": [
          {
            pattern: /&[^(]+\([^)]+\)/,
            inside: Prism3.languages.javascript
          },
          {
            pattern: /\([^)]+\)/,
            inside: {
              "attr-value": {
                pattern: /(=\s*(?!\s))(?:\{[^}]*\}|[^,)\r\n]+)/,
                lookbehind: true,
                inside: Prism3.languages.javascript
              },
              "attr-name": /[\w-]+(?=\s*!?=|\s*[,)])/,
              "punctuation": /[!=(),]+/
            }
          }
        ],
        "punctuation": /:/,
        "attr-id": /#[\w\-]+/,
        "attr-class": /\.[\w\-]+/
      }
    },
    "code": [
      {
        pattern: /(^[\t ]*(?:-|!?=)).+/m,
        lookbehind: true,
        inside: Prism3.languages.javascript
      }
    ],
    "punctuation": /[.\-!=|]+/
  };
  var filter_pattern = /(^([\t ]*)):<filter_name>(?:(?:\r?\n|\r(?!\n))(?:\2[\t ].+|\s*?(?=\r?\n|\r)))+/.source;
  var filters = [
    { filter: "atpl", language: "twig" },
    { filter: "coffee", language: "coffeescript" },
    "ejs",
    "handlebars",
    "less",
    "livescript",
    "markdown",
    { filter: "sass", language: "scss" },
    "stylus"
  ];
  var all_filters = {};
  for (var i = 0, l = filters.length; i < l; i++) {
    var filter = filters[i];
    filter = typeof filter === "string" ? { filter, language: filter } : filter;
    if (Prism3.languages[filter.language]) {
      all_filters["filter-" + filter.filter] = {
        pattern: RegExp(filter_pattern.replace("<filter_name>", function() {
          return filter.filter;
        }), "m"),
        lookbehind: true,
        inside: {
          "filter-name": {
            pattern: /^:[\w-]+/,
            alias: "variable"
          },
          "text": {
            pattern: /\S[\s\S]*/,
            alias: [filter.language, "language-" + filter.language],
            inside: Prism3.languages[filter.language]
          }
        }
      };
    }
  }
  Prism3.languages.insertBefore("pug", "filter", all_filters);
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-cshtml.js
(function(Prism3) {
  var commentLike = /\/(?![/*])|\/\/.*[\r\n]|\/\*[^*]*(?:\*(?!\/)[^*]*)*\*\//.source;
  var stringLike = /@(?!")|"(?:[^\r\n\\"]|\\.)*"|@"(?:[^\\"]|""|\\[\s\S])*"(?!")/.source + "|" + /'(?:(?:[^\r\n'\\]|\\.|\\[Uux][\da-fA-F]{1,8})'|(?=[^\\](?!')))/.source;
  function nested(pattern, depthLog2) {
    for (var i = 0; i < depthLog2; i++) {
      pattern = pattern.replace(/<self>/g, function() {
        return "(?:" + pattern + ")";
      });
    }
    return pattern.replace(/<self>/g, "[^\\s\\S]").replace(/<str>/g, "(?:" + stringLike + ")").replace(/<comment>/g, "(?:" + commentLike + ")");
  }
  var round = nested(/\((?:[^()'"@/]|<str>|<comment>|<self>)*\)/.source, 2);
  var square = nested(/\[(?:[^\[\]'"@/]|<str>|<comment>|<self>)*\]/.source, 1);
  var curly = nested(/\{(?:[^{}'"@/]|<str>|<comment>|<self>)*\}/.source, 2);
  var angle = nested(/<(?:[^<>'"@/]|<comment>|<self>)*>/.source, 1);
  var inlineCs = /@/.source + /(?:await\b\s*)?/.source + "(?:" + /(?!await\b)\w+\b/.source + "|" + round + ")(?:" + /[?!]?\.\w+\b/.source + "|(?:" + angle + ")?" + round + "|" + square + ")*" + /(?![?!\.(\[]|<(?!\/))/.source;
  var tagAttrInlineCs = /@(?![\w()])/.source + "|" + inlineCs;
  var tagAttrValue = "(?:" + /"[^"@]*"|'[^'@]*'|[^\s'"@>=]+(?=[\s>])/.source + `|["'][^"'@]*(?:(?:` + tagAttrInlineCs + `)[^"'@]*)+["'])`;
  var tagAttrs = /(?:\s(?:\s*[^\s>\/=]+(?:\s*=\s*<tagAttrValue>|(?=[\s/>])))+)?/.source.replace(/<tagAttrValue>/, tagAttrValue);
  var tagContent = /(?!\d)[^\s>\/=$<%]+/.source + tagAttrs + /\s*\/?>/.source;
  var tagRegion = /\B@?/.source + "(?:" + /<([a-zA-Z][\w:]*)/.source + tagAttrs + /\s*>/.source + "(?:" + (/[^<]/.source + "|" + // all tags that are not the start tag
  // eslint-disable-next-line regexp/strict
  /<\/?(?!\1\b)/.source + tagContent + "|" + // nested start tag
  nested(
    // eslint-disable-next-line regexp/strict
    /<\1/.source + tagAttrs + /\s*>/.source + "(?:" + (/[^<]/.source + "|" + // all tags that are not the start tag
    // eslint-disable-next-line regexp/strict
    /<\/?(?!\1\b)/.source + tagContent + "|<self>") + ")*" + // eslint-disable-next-line regexp/strict
    /<\/\1\s*>/.source,
    2
  )) + ")*" + // eslint-disable-next-line regexp/strict
  /<\/\1\s*>/.source + "|" + /</.source + tagContent + ")";
  Prism3.languages.cshtml = Prism3.languages.extend("markup", {});
  var csharpWithHtml = Prism3.languages.insertBefore("csharp", "string", {
    "html": {
      pattern: RegExp(tagRegion),
      greedy: true,
      inside: Prism3.languages.cshtml
    }
  }, { csharp: Prism3.languages.extend("csharp", {}) });
  var cs = {
    pattern: /\S[\s\S]*/,
    alias: "language-csharp",
    inside: csharpWithHtml
  };
  var inlineValue = {
    pattern: RegExp(/(^|[^@])/.source + inlineCs),
    lookbehind: true,
    greedy: true,
    alias: "variable",
    inside: {
      "keyword": /^@/,
      "csharp": cs
    }
  };
  Prism3.languages.cshtml.tag.pattern = RegExp(/<\/?/.source + tagContent);
  Prism3.languages.cshtml.tag.inside["attr-value"].pattern = RegExp(/=\s*/.source + tagAttrValue);
  Prism3.languages.insertBefore("inside", "punctuation", { "value": inlineValue }, Prism3.languages.cshtml.tag.inside["attr-value"]);
  Prism3.languages.insertBefore("cshtml", "prolog", {
    "razor-comment": {
      pattern: /@\*[\s\S]*?\*@/,
      greedy: true,
      alias: "comment"
    },
    "block": {
      pattern: RegExp(
        /(^|[^@])@/.source + "(?:" + [
          // @{ ... }
          curly,
          // @code{ ... }
          /(?:code|functions)\s*/.source + curly,
          // @for (...) { ... }
          /(?:for|foreach|lock|switch|using|while)\s*/.source + round + /\s*/.source + curly,
          // @do { ... } while (...);
          /do\s*/.source + curly + /\s*while\s*/.source + round + /(?:\s*;)?/.source,
          // @try { ... } catch (...) { ... } finally { ... }
          /try\s*/.source + curly + /\s*catch\s*/.source + round + /\s*/.source + curly + /\s*finally\s*/.source + curly,
          // @if (...) {...} else if (...) {...} else {...}
          /if\s*/.source + round + /\s*/.source + curly + "(?:" + /\s*else/.source + "(?:" + /\s+if\s*/.source + round + ")?" + /\s*/.source + curly + ")*",
          // @helper Ident(params) { ... }
          /helper\s+\w+\s*/.source + round + /\s*/.source + curly
        ].join("|") + ")"
      ),
      lookbehind: true,
      greedy: true,
      inside: {
        "keyword": /^@\w*/,
        "csharp": cs
      }
    },
    "directive": {
      pattern: /^([ \t]*)@(?:addTagHelper|attribute|implements|inherits|inject|layout|model|namespace|page|preservewhitespace|removeTagHelper|section|tagHelperPrefix|using)(?=\s).*/m,
      lookbehind: true,
      greedy: true,
      inside: {
        "keyword": /^@\w+/,
        "csharp": cs
      }
    },
    "value": inlineValue,
    "delegate-operator": {
      pattern: /(^|[^@])@(?=<)/,
      lookbehind: true,
      alias: "operator"
    }
  });
  Prism3.languages.razor = Prism3.languages.cshtml;
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-elixir.js
Prism.languages.elixir = {
  "doc": {
    pattern: /@(?:doc|moduledoc)\s+(?:("""|''')[\s\S]*?\1|("|')(?:\\(?:\r\n|[\s\S])|(?!\2)[^\\\r\n])*\2)/,
    inside: {
      "attribute": /^@\w+/,
      "string": /['"][\s\S]+/
    }
  },
  "comment": {
    pattern: /#.*/,
    greedy: true
  },
  // ~r"""foo""" (multi-line), ~r'''foo''' (multi-line), ~r/foo/, ~r|foo|, ~r"foo", ~r'foo', ~r(foo), ~r[foo], ~r{foo}, ~r<foo>
  "regex": {
    pattern: /~[rR](?:("""|''')(?:\\[\s\S]|(?!\1)[^\\])+\1|([\/|"'])(?:\\.|(?!\2)[^\\\r\n])+\2|\((?:\\.|[^\\)\r\n])+\)|\[(?:\\.|[^\\\]\r\n])+\]|\{(?:\\.|[^\\}\r\n])+\}|<(?:\\.|[^\\>\r\n])+>)[uismxfr]*/,
    greedy: true
  },
  "string": [
    {
      // ~s"""foo""" (multi-line), ~s'''foo''' (multi-line), ~s/foo/, ~s|foo|, ~s"foo", ~s'foo', ~s(foo), ~s[foo], ~s{foo} (with interpolation care), ~s<foo>
      pattern: /~[cCsSwW](?:("""|''')(?:\\[\s\S]|(?!\1)[^\\])+\1|([\/|"'])(?:\\.|(?!\2)[^\\\r\n])+\2|\((?:\\.|[^\\)\r\n])+\)|\[(?:\\.|[^\\\]\r\n])+\]|\{(?:\\.|#\{[^}]+\}|#(?!\{)|[^#\\}\r\n])+\}|<(?:\\.|[^\\>\r\n])+>)[csa]?/,
      greedy: true,
      inside: {
        // See interpolation below
      }
    },
    {
      pattern: /("""|''')[\s\S]*?\1/,
      greedy: true,
      inside: {
        // See interpolation below
      }
    },
    {
      // Multi-line strings are allowed
      pattern: /("|')(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
      greedy: true,
      inside: {
        // See interpolation below
      }
    }
  ],
  "atom": {
    // Look-behind prevents bad highlighting of the :: operator
    pattern: /(^|[^:]):\w+/,
    lookbehind: true,
    alias: "symbol"
  },
  "module": {
    pattern: /\b[A-Z]\w*\b/,
    alias: "class-name"
  },
  // Look-ahead prevents bad highlighting of the :: operator
  "attr-name": /\b\w+\??:(?!:)/,
  "argument": {
    // Look-behind prevents bad highlighting of the && operator
    pattern: /(^|[^&])&\d+/,
    lookbehind: true,
    alias: "variable"
  },
  "attribute": {
    pattern: /@\w+/,
    alias: "variable"
  },
  "function": /\b[_a-zA-Z]\w*[?!]?(?:(?=\s*(?:\.\s*)?\()|(?=\/\d))/,
  "number": /\b(?:0[box][a-f\d_]+|\d[\d_]*)(?:\.[\d_]+)?(?:e[+-]?[\d_]+)?\b/i,
  "keyword": /\b(?:after|alias|and|case|catch|cond|def(?:callback|delegate|exception|impl|macro|module|n|np|p|protocol|struct)?|do|else|end|fn|for|if|import|not|or|quote|raise|require|rescue|try|unless|unquote|use|when)\b/,
  "boolean": /\b(?:false|nil|true)\b/,
  "operator": [
    /\bin\b|&&?|\|[|>]?|\\\\|::|\.\.\.?|\+\+?|-[->]?|<[-=>]|>=|!==?|\B!|=(?:==?|[>~])?|[*\/^]/,
    {
      // We don't want to match <<
      pattern: /([^<])<(?!<)/,
      lookbehind: true
    },
    {
      // We don't want to match >>
      pattern: /([^>])>(?!>)/,
      lookbehind: true
    }
  ],
  "punctuation": /<<|>>|[.,%\[\]{}()]/
};
Prism.languages.elixir.string.forEach(function(o) {
  o.inside = {
    "interpolation": {
      pattern: /#\{[^}]+\}/,
      inside: {
        "delimiter": {
          pattern: /^#\{|\}$/,
          alias: "punctuation"
        },
        rest: Prism.languages.elixir
      }
    }
  };
});

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-racket.js
Prism.languages.racket = Prism.languages.extend("scheme", {
  "lambda-parameter": {
    // the racket lambda syntax is a lot more complex, so we won't even attempt to capture it.
    // this will just prevent false positives of the `function` pattern
    pattern: /([(\[]lambda\s+[(\[])[^()\[\]'\s]+/,
    lookbehind: true
  }
});
Prism.languages.insertBefore("racket", "string", {
  "lang": {
    pattern: /^#lang.+/m,
    greedy: true,
    alias: "keyword"
  }
});
Prism.languages.rkt = Prism.languages.racket;

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-purescript.js
Prism.languages.purescript = Prism.languages.extend("haskell", {
  "keyword": /\b(?:ado|case|class|data|derive|do|else|forall|if|in|infixl|infixr|instance|let|module|newtype|of|primitive|then|type|where)\b|∀/,
  "import-statement": {
    // The imported or hidden names are not included in this import
    // statement. This is because we want to highlight those exactly like
    // we do for the names in the program.
    pattern: /(^[\t ]*)import\s+[A-Z][\w']*(?:\.[A-Z][\w']*)*(?:\s+as\s+[A-Z][\w']*(?:\.[A-Z][\w']*)*)?(?:\s+hiding\b)?/m,
    lookbehind: true,
    inside: {
      "keyword": /\b(?:as|hiding|import)\b/,
      "punctuation": /\./
    }
  },
  // These are builtin functions only. Constructors are highlighted later as a constant.
  "builtin": /\b(?:absurd|add|ap|append|apply|between|bind|bottom|clamp|compare|comparing|compose|conj|const|degree|discard|disj|div|eq|flap|flip|gcd|identity|ifM|join|lcm|liftA1|liftM1|map|max|mempty|min|mod|mul|negate|not|notEq|one|otherwise|recip|show|sub|top|unit|unless|unlessM|void|when|whenM|zero)\b/,
  "operator": [
    // Infix operators
    Prism.languages.haskell.operator[0],
    // ASCII operators
    Prism.languages.haskell.operator[2],
    // All UTF16 Unicode operator symbols
    // This regex is equivalent to /(?=[\x80-\uFFFF])[\p{gc=Math_Symbol}\p{gc=Currency_Symbol}\p{Modifier_Symbol}\p{Other_Symbol}]/u
    // See https://github.com/PrismJS/prism/issues/3006 for more details.
    /[\xa2-\xa6\xa8\xa9\xac\xae-\xb1\xb4\xb8\xd7\xf7\u02c2-\u02c5\u02d2-\u02df\u02e5-\u02eb\u02ed\u02ef-\u02ff\u0375\u0384\u0385\u03f6\u0482\u058d-\u058f\u0606-\u0608\u060b\u060e\u060f\u06de\u06e9\u06fd\u06fe\u07f6\u07fe\u07ff\u09f2\u09f3\u09fa\u09fb\u0af1\u0b70\u0bf3-\u0bfa\u0c7f\u0d4f\u0d79\u0e3f\u0f01-\u0f03\u0f13\u0f15-\u0f17\u0f1a-\u0f1f\u0f34\u0f36\u0f38\u0fbe-\u0fc5\u0fc7-\u0fcc\u0fce\u0fcf\u0fd5-\u0fd8\u109e\u109f\u1390-\u1399\u166d\u17db\u1940\u19de-\u19ff\u1b61-\u1b6a\u1b74-\u1b7c\u1fbd\u1fbf-\u1fc1\u1fcd-\u1fcf\u1fdd-\u1fdf\u1fed-\u1fef\u1ffd\u1ffe\u2044\u2052\u207a-\u207c\u208a-\u208c\u20a0-\u20bf\u2100\u2101\u2103-\u2106\u2108\u2109\u2114\u2116-\u2118\u211e-\u2123\u2125\u2127\u2129\u212e\u213a\u213b\u2140-\u2144\u214a-\u214d\u214f\u218a\u218b\u2190-\u2307\u230c-\u2328\u232b-\u2426\u2440-\u244a\u249c-\u24e9\u2500-\u2767\u2794-\u27c4\u27c7-\u27e5\u27f0-\u2982\u2999-\u29d7\u29dc-\u29fb\u29fe-\u2b73\u2b76-\u2b95\u2b97-\u2bff\u2ce5-\u2cea\u2e50\u2e51\u2e80-\u2e99\u2e9b-\u2ef3\u2f00-\u2fd5\u2ff0-\u2ffb\u3004\u3012\u3013\u3020\u3036\u3037\u303e\u303f\u309b\u309c\u3190\u3191\u3196-\u319f\u31c0-\u31e3\u3200-\u321e\u322a-\u3247\u3250\u3260-\u327f\u328a-\u32b0\u32c0-\u33ff\u4dc0-\u4dff\ua490-\ua4c6\ua700-\ua716\ua720\ua721\ua789\ua78a\ua828-\ua82b\ua836-\ua839\uaa77-\uaa79\uab5b\uab6a\uab6b\ufb29\ufbb2-\ufbc1\ufdfc\ufdfd\ufe62\ufe64-\ufe66\ufe69\uff04\uff0b\uff1c-\uff1e\uff3e\uff40\uff5c\uff5e\uffe0-\uffe6\uffe8-\uffee\ufffc\ufffd]/
  ]
});
Prism.languages.purs = Prism.languages.purescript;

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-vbnet.js
Prism.languages.vbnet = Prism.languages.extend("basic", {
  "comment": [
    {
      pattern: /(?:!|REM\b).+/i,
      inside: {
        "keyword": /^REM/i
      }
    },
    {
      pattern: /(^|[^\\:])'.*/,
      lookbehind: true,
      greedy: true
    }
  ],
  "string": {
    pattern: /(^|[^"])"(?:""|[^"])*"(?!")/,
    lookbehind: true,
    greedy: true
  },
  "keyword": /(?:\b(?:ADDHANDLER|ADDRESSOF|ALIAS|AND|ANDALSO|AS|BEEP|BLOAD|BOOLEAN|BSAVE|BYREF|BYTE|BYVAL|CALL(?: ABSOLUTE)?|CASE|CATCH|CBOOL|CBYTE|CCHAR|CDATE|CDBL|CDEC|CHAIN|CHAR|CHDIR|CINT|CLASS|CLEAR|CLNG|CLOSE|CLS|COBJ|COM|COMMON|CONST|CONTINUE|CSBYTE|CSHORT|CSNG|CSTR|CTYPE|CUINT|CULNG|CUSHORT|DATA|DATE|DECIMAL|DECLARE|DEF(?: FN| SEG|DBL|INT|LNG|SNG|STR)|DEFAULT|DELEGATE|DIM|DIRECTCAST|DO|DOUBLE|ELSE|ELSEIF|END|ENUM|ENVIRON|ERASE|ERROR|EVENT|EXIT|FALSE|FIELD|FILES|FINALLY|FOR(?: EACH)?|FRIEND|FUNCTION|GET|GETTYPE|GETXMLNAMESPACE|GLOBAL|GOSUB|GOTO|HANDLES|IF|IMPLEMENTS|IMPORTS|IN|INHERITS|INPUT|INTEGER|INTERFACE|IOCTL|IS|ISNOT|KEY|KILL|LET|LIB|LIKE|LINE INPUT|LOCATE|LOCK|LONG|LOOP|LSET|ME|MKDIR|MOD|MODULE|MUSTINHERIT|MUSTOVERRIDE|MYBASE|MYCLASS|NAME|NAMESPACE|NARROWING|NEW|NEXT|NOT|NOTHING|NOTINHERITABLE|NOTOVERRIDABLE|OBJECT|OF|OFF|ON(?: COM| ERROR| KEY| TIMER)?|OPEN|OPERATOR|OPTION(?: BASE)?|OPTIONAL|OR|ORELSE|OUT|OVERLOADS|OVERRIDABLE|OVERRIDES|PARAMARRAY|PARTIAL|POKE|PRIVATE|PROPERTY|PROTECTED|PUBLIC|PUT|RAISEEVENT|READ|READONLY|REDIM|REM|REMOVEHANDLER|RESTORE|RESUME|RETURN|RMDIR|RSET|RUN|SBYTE|SELECT(?: CASE)?|SET|SHADOWS|SHARED|SHELL|SHORT|SINGLE|SLEEP|STATIC|STEP|STOP|STRING|STRUCTURE|SUB|SWAP|SYNCLOCK|SYSTEM|THEN|THROW|TIMER|TO|TROFF|TRON|TRUE|TRY|TRYCAST|TYPE|TYPEOF|UINTEGER|ULONG|UNLOCK|UNTIL|USHORT|USING|VIEW PRINT|WAIT|WEND|WHEN|WHILE|WIDENING|WITH|WITHEVENTS|WRITE|WRITEONLY|XOR)|\B(?:#CONST|#ELSE|#ELSEIF|#END|#IF))(?:\$|\b)/i,
  "punctuation": /[,;:(){}]/
});

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-docker.js
(function(Prism3) {
  var spaceAfterBackSlash = /\\[\r\n](?:\s|\\[\r\n]|#.*(?!.))*(?![\s#]|\\[\r\n])/.source;
  var space = /(?:[ \t]+(?![ \t])(?:<SP_BS>)?|<SP_BS>)/.source.replace(/<SP_BS>/g, function() {
    return spaceAfterBackSlash;
  });
  var string = /"(?:[^"\\\r\n]|\\(?:\r\n|[\s\S]))*"|'(?:[^'\\\r\n]|\\(?:\r\n|[\s\S]))*'/.source;
  var option = /--[\w-]+=(?:<STR>|(?!["'])(?:[^\s\\]|\\.)+)/.source.replace(/<STR>/g, function() {
    return string;
  });
  var stringRule = {
    pattern: RegExp(string),
    greedy: true
  };
  var commentRule = {
    pattern: /(^[ \t]*)#.*/m,
    lookbehind: true,
    greedy: true
  };
  function re(source, flags) {
    source = source.replace(/<OPT>/g, function() {
      return option;
    }).replace(/<SP>/g, function() {
      return space;
    });
    return RegExp(source, flags);
  }
  Prism3.languages.docker = {
    "instruction": {
      pattern: /(^[ \t]*)(?:ADD|ARG|CMD|COPY|ENTRYPOINT|ENV|EXPOSE|FROM|HEALTHCHECK|LABEL|MAINTAINER|ONBUILD|RUN|SHELL|STOPSIGNAL|USER|VOLUME|WORKDIR)(?=\s)(?:\\.|[^\r\n\\])*(?:\\$(?:\s|#.*$)*(?![\s#])(?:\\.|[^\r\n\\])*)*/im,
      lookbehind: true,
      greedy: true,
      inside: {
        "options": {
          pattern: re(/(^(?:ONBUILD<SP>)?\w+<SP>)<OPT>(?:<SP><OPT>)*/.source, "i"),
          lookbehind: true,
          greedy: true,
          inside: {
            "property": {
              pattern: /(^|\s)--[\w-]+/,
              lookbehind: true
            },
            "string": [
              stringRule,
              {
                pattern: /(=)(?!["'])(?:[^\s\\]|\\.)+/,
                lookbehind: true
              }
            ],
            "operator": /\\$/m,
            "punctuation": /=/
          }
        },
        "keyword": [
          {
            // https://docs.docker.com/engine/reference/builder/#healthcheck
            pattern: re(/(^(?:ONBUILD<SP>)?HEALTHCHECK<SP>(?:<OPT><SP>)*)(?:CMD|NONE)\b/.source, "i"),
            lookbehind: true,
            greedy: true
          },
          {
            // https://docs.docker.com/engine/reference/builder/#from
            pattern: re(/(^(?:ONBUILD<SP>)?FROM<SP>(?:<OPT><SP>)*(?!--)[^ \t\\]+<SP>)AS/.source, "i"),
            lookbehind: true,
            greedy: true
          },
          {
            // https://docs.docker.com/engine/reference/builder/#onbuild
            pattern: re(/(^ONBUILD<SP>)\w+/.source, "i"),
            lookbehind: true,
            greedy: true
          },
          {
            pattern: /^\w+/,
            greedy: true
          }
        ],
        "comment": commentRule,
        "string": stringRule,
        "variable": /\$(?:\w+|\{[^{}"'\\]*\})/,
        "operator": /\\$/m
      }
    },
    "comment": commentRule
  };
  Prism3.languages.dockerfile = Prism3.languages.docker;
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-go-module.js
Prism.languages["go-mod"] = Prism.languages["go-module"] = {
  "comment": {
    pattern: /\/\/.*/,
    greedy: true
  },
  "version": {
    pattern: /(^|[\s()[\],])v\d+\.\d+\.\d+(?:[+-][-+.\w]*)?(?![^\s()[\],])/,
    lookbehind: true,
    alias: "number"
  },
  "go-version": {
    pattern: /((?:^|\s)go\s+)\d+(?:\.\d+){1,2}/,
    lookbehind: true,
    alias: "number"
  },
  "keyword": {
    pattern: /^([ \t]*)(?:exclude|go|module|replace|require|retract)\b/m,
    lookbehind: true
  },
  "operator": /=>/,
  "punctuation": /[()[\],]/
};

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-graphql.js
Prism.languages.graphql = {
  "comment": /#.*/,
  "description": {
    pattern: /(?:"""(?:[^"]|(?!""")")*"""|"(?:\\.|[^\\"\r\n])*")(?=\s*[a-z_])/i,
    greedy: true,
    alias: "string",
    inside: {
      "language-markdown": {
        pattern: /(^"(?:"")?)(?!\1)[\s\S]+(?=\1$)/,
        lookbehind: true,
        inside: Prism.languages.markdown
      }
    }
  },
  "string": {
    pattern: /"""(?:[^"]|(?!""")")*"""|"(?:\\.|[^\\"\r\n])*"/,
    greedy: true
  },
  "number": /(?:\B-|\b)\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/i,
  "boolean": /\b(?:false|true)\b/,
  "variable": /\$[a-z_]\w*/i,
  "directive": {
    pattern: /@[a-z_]\w*/i,
    alias: "function"
  },
  "attr-name": {
    pattern: /\b[a-z_]\w*(?=\s*(?:\((?:[^()"]|"(?:\\.|[^\\"\r\n])*")*\))?:)/i,
    greedy: true
  },
  "atom-input": {
    pattern: /\b[A-Z]\w*Input\b/,
    alias: "class-name"
  },
  "scalar": /\b(?:Boolean|Float|ID|Int|String)\b/,
  "constant": /\b[A-Z][A-Z_\d]*\b/,
  "class-name": {
    pattern: /(\b(?:enum|implements|interface|on|scalar|type|union)\s+|&\s*|:\s*|\[)[A-Z_]\w*/,
    lookbehind: true
  },
  "fragment": {
    pattern: /(\bfragment\s+|\.{3}\s*(?!on\b))[a-zA-Z_]\w*/,
    lookbehind: true,
    alias: "function"
  },
  "definition-mutation": {
    pattern: /(\bmutation\s+)[a-zA-Z_]\w*/,
    lookbehind: true,
    alias: "function"
  },
  "definition-query": {
    pattern: /(\bquery\s+)[a-zA-Z_]\w*/,
    lookbehind: true,
    alias: "function"
  },
  "keyword": /\b(?:directive|enum|extend|fragment|implements|input|interface|mutation|on|query|repeatable|scalar|schema|subscription|type|union)\b/,
  "operator": /[!=|&]|\.{3}/,
  "property-query": /\w+(?=\s*\()/,
  "object": /\w+(?=\s*\{)/,
  "punctuation": /[!(){}\[\]:=,]/,
  "property": /\w+/
};
Prism.hooks.add("after-tokenize", function afterTokenizeGraphql(env) {
  if (env.language !== "graphql") {
    return;
  }
  var validTokens = env.tokens.filter(function(token) {
    return typeof token !== "string" && token.type !== "comment" && token.type !== "scalar";
  });
  var currentIndex = 0;
  function getToken(offset) {
    return validTokens[currentIndex + offset];
  }
  function isTokenType(types, offset) {
    offset = offset || 0;
    for (var i2 = 0; i2 < types.length; i2++) {
      var token = getToken(i2 + offset);
      if (!token || token.type !== types[i2]) {
        return false;
      }
    }
    return true;
  }
  function findClosingBracket(open, close) {
    var stackHeight = 1;
    for (var i2 = currentIndex; i2 < validTokens.length; i2++) {
      var token = validTokens[i2];
      var content = token.content;
      if (token.type === "punctuation" && typeof content === "string") {
        if (open.test(content)) {
          stackHeight++;
        } else if (close.test(content)) {
          stackHeight--;
          if (stackHeight === 0) {
            return i2;
          }
        }
      }
    }
    return -1;
  }
  function addAlias(token, alias) {
    var aliases = token.alias;
    if (!aliases) {
      token.alias = aliases = [];
    } else if (!Array.isArray(aliases)) {
      token.alias = aliases = [aliases];
    }
    aliases.push(alias);
  }
  for (; currentIndex < validTokens.length; ) {
    var startToken = validTokens[currentIndex++];
    if (startToken.type === "keyword" && startToken.content === "mutation") {
      var inputVariables = [];
      if (isTokenType(["definition-mutation", "punctuation"]) && getToken(1).content === "(") {
        currentIndex += 2;
        var definitionEnd = findClosingBracket(/^\($/, /^\)$/);
        if (definitionEnd === -1) {
          continue;
        }
        for (; currentIndex < definitionEnd; currentIndex++) {
          var t = getToken(0);
          if (t.type === "variable") {
            addAlias(t, "variable-input");
            inputVariables.push(t.content);
          }
        }
        currentIndex = definitionEnd + 1;
      }
      if (isTokenType(["punctuation", "property-query"]) && getToken(0).content === "{") {
        currentIndex++;
        addAlias(getToken(0), "property-mutation");
        if (inputVariables.length > 0) {
          var mutationEnd = findClosingBracket(/^\{$/, /^\}$/);
          if (mutationEnd === -1) {
            continue;
          }
          for (var i = currentIndex; i < mutationEnd; i++) {
            var varToken = validTokens[i];
            if (varToken.type === "variable" && inputVariables.indexOf(varToken.content) >= 0) {
              addAlias(varToken, "variable-input");
            }
          }
        }
      }
    }
  }
});

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-scala.js
Prism.languages.scala = Prism.languages.extend("java", {
  "triple-quoted-string": {
    pattern: /"""[\s\S]*?"""/,
    greedy: true,
    alias: "string"
  },
  "string": {
    pattern: /("|')(?:\\.|(?!\1)[^\\\r\n])*\1/,
    greedy: true
  },
  "keyword": /<-|=>|\b(?:abstract|case|catch|class|def|derives|do|else|enum|extends|extension|final|finally|for|forSome|given|if|implicit|import|infix|inline|lazy|match|new|null|object|opaque|open|override|package|private|protected|return|sealed|self|super|this|throw|trait|transparent|try|type|using|val|var|while|with|yield)\b/,
  "number": /\b0x(?:[\da-f]*\.)?[\da-f]+|(?:\b\d+(?:\.\d*)?|\B\.\d+)(?:e\d+)?[dfl]?/i,
  "builtin": /\b(?:Any|AnyRef|AnyVal|Boolean|Byte|Char|Double|Float|Int|Long|Nothing|Short|String|Unit)\b/,
  "symbol": /'[^\d\s\\]\w*/
});
Prism.languages.insertBefore("scala", "triple-quoted-string", {
  "string-interpolation": {
    pattern: /\b[a-z]\w*(?:"""(?:[^$]|\$(?:[^{]|\{(?:[^{}]|\{[^{}]*\})*\}))*?"""|"(?:[^$"\r\n]|\$(?:[^{]|\{(?:[^{}]|\{[^{}]*\})*\}))*")/i,
    greedy: true,
    inside: {
      "id": {
        pattern: /^\w+/,
        greedy: true,
        alias: "function"
      },
      "escape": {
        pattern: /\\\$"|\$[$"]/,
        greedy: true,
        alias: "symbol"
      },
      "interpolation": {
        pattern: /\$(?:\w+|\{(?:[^{}]|\{[^{}]*\})*\})/,
        greedy: true,
        inside: {
          "punctuation": /^\$\{?|\}$/,
          "expression": {
            pattern: /[\s\S]+/,
            inside: Prism.languages.scala
          }
        }
      },
      "string": /[\s\S]+/
    }
  }
});
delete Prism.languages.scala["class-name"];
delete Prism.languages.scala["function"];
delete Prism.languages.scala["constant"];

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-javadoclike.js
(function(Prism3) {
  var javaDocLike = Prism3.languages.javadoclike = {
    "parameter": {
      pattern: /(^[\t ]*(?:\/{3}|\*|\/\*\*)\s*@(?:arg|arguments|param)\s+)\w+/m,
      lookbehind: true
    },
    "keyword": {
      // keywords are the first word in a line preceded be an `@` or surrounded by curly braces.
      // @word, {@word}
      pattern: /(^[\t ]*(?:\/{3}|\*|\/\*\*)\s*|\{)@[a-z][a-zA-Z-]+\b/m,
      lookbehind: true
    },
    "punctuation": /[{}]/
  };
  function docCommentSupport(lang, callback) {
    var tokenName = "doc-comment";
    var grammar = Prism3.languages[lang];
    if (!grammar) {
      return;
    }
    var token = grammar[tokenName];
    if (!token) {
      var definition = {};
      definition[tokenName] = {
        pattern: /(^|[^\\])\/\*\*[^/][\s\S]*?(?:\*\/|$)/,
        lookbehind: true,
        alias: "comment"
      };
      grammar = Prism3.languages.insertBefore(lang, "comment", definition);
      token = grammar[tokenName];
    }
    if (token instanceof RegExp) {
      token = grammar[tokenName] = { pattern: token };
    }
    if (Array.isArray(token)) {
      for (var i = 0, l = token.length; i < l; i++) {
        if (token[i] instanceof RegExp) {
          token[i] = { pattern: token[i] };
        }
        callback(token[i]);
      }
    } else {
      callback(token);
    }
  }
  function addSupport(languages, docLanguage) {
    if (typeof languages === "string") {
      languages = [languages];
    }
    languages.forEach(function(lang) {
      docCommentSupport(lang, function(pattern) {
        if (!pattern.inside) {
          pattern.inside = {};
        }
        pattern.inside.rest = docLanguage;
      });
    });
  }
  Object.defineProperty(javaDocLike, "addSupport", { value: addSupport });
  javaDocLike.addSupport(["java", "javascript", "php"], javaDocLike);
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-jsx.js
(function(Prism3) {
  var javascript = Prism3.util.clone(Prism3.languages.javascript);
  var space = /(?:\s|\/\/.*(?!.)|\/\*(?:[^*]|\*(?!\/))\*\/)/.source;
  var braces = /(?:\{(?:\{(?:\{[^{}]*\}|[^{}])*\}|[^{}])*\})/.source;
  var spread = /(?:\{<S>*\.{3}(?:[^{}]|<BRACES>)*\})/.source;
  function re(source, flags) {
    source = source.replace(/<S>/g, function() {
      return space;
    }).replace(/<BRACES>/g, function() {
      return braces;
    }).replace(/<SPREAD>/g, function() {
      return spread;
    });
    return RegExp(source, flags);
  }
  spread = re(spread).source;
  Prism3.languages.jsx = Prism3.languages.extend("markup", javascript);
  Prism3.languages.jsx.tag.pattern = re(
    /<\/?(?:[\w.:-]+(?:<S>+(?:[\w.:$-]+(?:=(?:"(?:\\[\s\S]|[^\\"])*"|'(?:\\[\s\S]|[^\\'])*'|[^\s{'"/>=]+|<BRACES>))?|<SPREAD>))*<S>*\/?)?>/.source
  );
  Prism3.languages.jsx.tag.inside["tag"].pattern = /^<\/?[^\s>\/]*/;
  Prism3.languages.jsx.tag.inside["attr-value"].pattern = /=(?!\{)(?:"(?:\\[\s\S]|[^\\"])*"|'(?:\\[\s\S]|[^\\'])*'|[^\s'">]+)/;
  Prism3.languages.jsx.tag.inside["tag"].inside["class-name"] = /^[A-Z]\w*(?:\.[A-Z]\w*)*$/;
  Prism3.languages.jsx.tag.inside["comment"] = javascript["comment"];
  Prism3.languages.insertBefore("inside", "attr-name", {
    "spread": {
      pattern: re(/<SPREAD>/.source),
      inside: Prism3.languages.jsx
    }
  }, Prism3.languages.jsx.tag);
  Prism3.languages.insertBefore("inside", "special-attr", {
    "script": {
      // Allow for two levels of nesting
      pattern: re(/=<BRACES>/.source),
      alias: "language-javascript",
      inside: {
        "script-punctuation": {
          pattern: /^=(?=\{)/,
          alias: "punctuation"
        },
        rest: Prism3.languages.jsx
      }
    }
  }, Prism3.languages.jsx.tag);
  var stringifyToken = function(token) {
    if (!token) {
      return "";
    }
    if (typeof token === "string") {
      return token;
    }
    if (typeof token.content === "string") {
      return token.content;
    }
    return token.content.map(stringifyToken).join("");
  };
  var walkTokens = function(tokens) {
    var openedTags = [];
    for (var i = 0; i < tokens.length; i++) {
      var token = tokens[i];
      var notTagNorBrace = false;
      if (typeof token !== "string") {
        if (token.type === "tag" && token.content[0] && token.content[0].type === "tag") {
          if (token.content[0].content[0].content === "</") {
            if (openedTags.length > 0 && openedTags[openedTags.length - 1].tagName === stringifyToken(token.content[0].content[1])) {
              openedTags.pop();
            }
          } else {
            if (token.content[token.content.length - 1].content === "/>") {
            } else {
              openedTags.push({
                tagName: stringifyToken(token.content[0].content[1]),
                openedBraces: 0
              });
            }
          }
        } else if (openedTags.length > 0 && token.type === "punctuation" && token.content === "{") {
          openedTags[openedTags.length - 1].openedBraces++;
        } else if (openedTags.length > 0 && openedTags[openedTags.length - 1].openedBraces > 0 && token.type === "punctuation" && token.content === "}") {
          openedTags[openedTags.length - 1].openedBraces--;
        } else {
          notTagNorBrace = true;
        }
      }
      if (notTagNorBrace || typeof token === "string") {
        if (openedTags.length > 0 && openedTags[openedTags.length - 1].openedBraces === 0) {
          var plainText = stringifyToken(token);
          if (i < tokens.length - 1 && (typeof tokens[i + 1] === "string" || tokens[i + 1].type === "plain-text")) {
            plainText += stringifyToken(tokens[i + 1]);
            tokens.splice(i + 1, 1);
          }
          if (i > 0 && (typeof tokens[i - 1] === "string" || tokens[i - 1].type === "plain-text")) {
            plainText = stringifyToken(tokens[i - 1]) + plainText;
            tokens.splice(i - 1, 1);
            i--;
          }
          tokens[i] = new Prism3.Token("plain-text", plainText, null, plainText);
        }
      }
      if (token.content && typeof token.content !== "string") {
        walkTokens(token.content);
      }
    }
  };
  Prism3.hooks.add("after-tokenize", function(env) {
    if (env.language !== "jsx" && env.language !== "tsx") {
      return;
    }
    walkTokens(env.tokens);
  });
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-javadoc.js
(function(Prism3) {
  var codeLinePattern = /(^(?:[\t ]*(?:\*\s*)*))[^*\s].*$/m;
  var memberReference = /#\s*\w+(?:\s*\([^()]*\))?/.source;
  var reference = /(?:\b[a-zA-Z]\w+\s*\.\s*)*\b[A-Z]\w*(?:\s*<mem>)?|<mem>/.source.replace(/<mem>/g, function() {
    return memberReference;
  });
  Prism3.languages.javadoc = Prism3.languages.extend("javadoclike", {});
  Prism3.languages.insertBefore("javadoc", "keyword", {
    "reference": {
      pattern: RegExp(/(@(?:exception|link|linkplain|see|throws|value)\s+(?:\*\s*)?)/.source + "(?:" + reference + ")"),
      lookbehind: true,
      inside: {
        "function": {
          pattern: /(#\s*)\w+(?=\s*\()/,
          lookbehind: true
        },
        "field": {
          pattern: /(#\s*)\w+/,
          lookbehind: true
        },
        "namespace": {
          pattern: /\b(?:[a-z]\w*\s*\.\s*)+/,
          inside: {
            "punctuation": /\./
          }
        },
        "class-name": /\b[A-Z]\w*/,
        "keyword": Prism3.languages.java.keyword,
        "punctuation": /[#()[\],.]/
      }
    },
    "class-name": {
      // @param <T> the first generic type parameter
      pattern: /(@param\s+)<[A-Z]\w*>/,
      lookbehind: true,
      inside: {
        "punctuation": /[.<>]/
      }
    },
    "code-section": [
      {
        pattern: /(\{@code\s+(?!\s))(?:[^\s{}]|\s+(?![\s}])|\{(?:[^{}]|\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\})*\})+(?=\s*\})/,
        lookbehind: true,
        inside: {
          "code": {
            // there can't be any HTML inside of {@code} tags
            pattern: codeLinePattern,
            lookbehind: true,
            inside: Prism3.languages.java,
            alias: "language-java"
          }
        }
      },
      {
        pattern: /(<(code|pre|tt)>(?!<code>)\s*)\S(?:\S|\s+\S)*?(?=\s*<\/\2>)/,
        lookbehind: true,
        inside: {
          "line": {
            pattern: codeLinePattern,
            lookbehind: true,
            inside: {
              // highlight HTML tags and entities
              "tag": Prism3.languages.markup.tag,
              "entity": Prism3.languages.markup.entity,
              "code": {
                // everything else is Java code
                pattern: /.+/,
                inside: Prism3.languages.java,
                alias: "language-java"
              }
            }
          }
        }
      }
    ],
    "tag": Prism3.languages.markup.tag,
    "entity": Prism3.languages.markup.entity
  });
  Prism3.languages.javadoclike.addSupport("java", Prism3.languages.javadoc);
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-jsdoc.js
(function(Prism3) {
  var javascript = Prism3.languages.javascript;
  var type = /\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})+\}/.source;
  var parameterPrefix = "(@(?:arg|argument|param|property)\\s+(?:" + type + "\\s+)?)";
  Prism3.languages.jsdoc = Prism3.languages.extend("javadoclike", {
    "parameter": {
      // @param {string} foo - foo bar
      pattern: RegExp(parameterPrefix + /(?:(?!\s)[$\w\xA0-\uFFFF.])+(?=\s|$)/.source),
      lookbehind: true,
      inside: {
        "punctuation": /\./
      }
    }
  });
  Prism3.languages.insertBefore("jsdoc", "keyword", {
    "optional-parameter": {
      // @param {string} [baz.foo="bar"] foo bar
      pattern: RegExp(parameterPrefix + /\[(?:(?!\s)[$\w\xA0-\uFFFF.])+(?:=[^[\]]+)?\](?=\s|$)/.source),
      lookbehind: true,
      inside: {
        "parameter": {
          pattern: /(^\[)[$\w\xA0-\uFFFF\.]+/,
          lookbehind: true,
          inside: {
            "punctuation": /\./
          }
        },
        "code": {
          pattern: /(=)[\s\S]*(?=\]$)/,
          lookbehind: true,
          inside: javascript,
          alias: "language-javascript"
        },
        "punctuation": /[=[\]]/
      }
    },
    "class-name": [
      {
        pattern: RegExp(/(@(?:augments|class|extends|interface|memberof!?|template|this|typedef)\s+(?:<TYPE>\s+)?)[A-Z]\w*(?:\.[A-Z]\w*)*/.source.replace(/<TYPE>/g, function() {
          return type;
        })),
        lookbehind: true,
        inside: {
          "punctuation": /\./
        }
      },
      {
        pattern: RegExp("(@[a-z]+\\s+)" + type),
        lookbehind: true,
        inside: {
          "string": javascript.string,
          "number": javascript.number,
          "boolean": javascript.boolean,
          "keyword": Prism3.languages.typescript.keyword,
          "operator": /=>|\.\.\.|[&|?:*]/,
          "punctuation": /[.,;=<>{}()[\]]/
        }
      }
    ],
    "example": {
      pattern: /(@example\s+(?!\s))(?:[^@\s]|\s+(?!\s))+?(?=\s*(?:\*\s*)?(?:@\w|\*\/))/,
      lookbehind: true,
      inside: {
        "code": {
          pattern: /^([\t ]*(?:\*\s*)?)\S.*$/m,
          lookbehind: true,
          inside: javascript,
          alias: "language-javascript"
        }
      }
    }
  });
  Prism3.languages.javadoclike.addSupport("javascript", Prism3.languages.jsdoc);
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-tsx.js
(function(Prism3) {
  var typescript = Prism3.util.clone(Prism3.languages.typescript);
  Prism3.languages.tsx = Prism3.languages.extend("jsx", typescript);
  delete Prism3.languages.tsx["parameter"];
  delete Prism3.languages.tsx["literal-property"];
  var tag = Prism3.languages.tsx.tag;
  tag.pattern = RegExp(/(^|[^\w$]|(?=<\/))/.source + "(?:" + tag.pattern.source + ")", tag.pattern.flags);
  tag.lookbehind = true;
})(Prism);

// ../node_modules/.pnpm/prismjs@1.30.0/node_modules/prismjs/components/prism-jsstacktrace.js
Prism.languages.jsstacktrace = {
  "error-message": {
    pattern: /^\S.*/m,
    alias: "string"
  },
  "stack-frame": {
    pattern: /(^[ \t]+)at[ \t].*/m,
    lookbehind: true,
    inside: {
      "not-my-code": {
        pattern: /^at[ \t]+(?!\s)(?:node\.js|<unknown>|.*(?:node_modules|\(<anonymous>\)|\(<unknown>|<anonymous>$|\(internal\/|\(node\.js)).*/m,
        alias: "comment"
      },
      "filename": {
        pattern: /(\bat\s+(?!\s)|\()(?:[a-zA-Z]:)?[^():]+(?=:)/,
        lookbehind: true,
        alias: "url"
      },
      "function": {
        pattern: /(\bat\s+(?:new\s+)?)(?!\s)[_$a-zA-Z\xA0-\uFFFF<][.$\w\xA0-\uFFFF<>]*/,
        lookbehind: true,
        inside: {
          "punctuation": /\./
        }
      },
      "punctuation": /[()]/,
      "keyword": /\b(?:at|new)\b/,
      "alias": {
        pattern: /\[(?:as\s+)?(?!\s)[_$a-zA-Z\xA0-\uFFFF][$\w\xA0-\uFFFF]*\]/,
        alias: "variable"
      },
      "line-number": {
        pattern: /:\d+(?::\d+)?\b/,
        alias: "number",
        inside: {
          "punctuation": /:/
        }
      }
    }
  }
};

// scripts/prism-entry.ts
var Prism2 = PrismModule.default ?? PrismModule;
var markdownGrammar = Prism2.languages.md ?? Prism2.languages.markdown;
var jsonGrammar = Prism2.languages.json;
if (markdownGrammar) {
  Prism2.languages.mdx = markdownGrammar;
}
if (jsonGrammar) {
  Prism2.languages.jsonc = jsonGrammar;
}
Prism2.languages.diagram = {
  "box-drawing": /[┌┐└┘├┤┬┴┼─│═║╔╗╚╝╠╣╦╩╬╭╮╯╰┊┈╌┄╶╴╵╷]+/,
  "line-char": /[-_|<>]+/,
  label: /[^\s┌┐└┘├┤┬┴┼─│═║╔╗╚╝╠╣╦╩╬╭╮╯╰┊┈╌┄╶╴╵╷\-_|<>]+/
};
var prismLanguageIds = Object.keys(components_default.languages).filter((id) => id !== "meta");
export {
  Prism2 as Prism,
  prismLanguageIds
};
/*! Bundled license information:

prismjs/prism.js:
  (**
   * Prism: Lightweight, robust, elegant syntax highlighting
   *
   * @license MIT <https://opensource.org/licenses/MIT>
   * @author Lea Verou <https://lea.verou.me>
   * @namespace
   * @public
   *)
*/
