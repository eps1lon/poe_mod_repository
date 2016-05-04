(function (__undefined) {
    var Class = require('./Inheritance');
    var Path = require('./Path');
    var $ = require('./jquery/jquery_node');
    
    var Hashbang = Class.extend({
        init: function () {
            this.params = {};
            this.path = new Path("");
        },
        onChange: function (cb) {
            this.on_change = cb;
        },
        triggerChange: function () {
            if (typeof this.on_change === 'function') {
                return this.on_change.apply(this);
            }
        },
        /**
         * 
         * @param {String} key
         * @param {Mixed} value
         * @returns {Hashbang} this to chain
         */
        setParams: function (key, value) {
            this.params[key] = value;
            
            // chainable
            return this;
        },
        getPath: function () {
            return this.path;
        },
        /**
         * 
         * @param {String} path
         * @returns {Hashbang} this to chain
         */
        setPath: function (path) {
            this.path = new Path(path);
            
            // chainable
            return this;
        },
        /**
         * generates url from class properties
         * @returns {String}
         */
        url: function () {
            var url = "#" + this.prefix + this.path;
            
            if (!$.isEmptyObject(this.params)) {
                url += "?" + Hashbang.query_string(this.params);
            }
            
            return url;
        },
        parse: function (url) {
            this.init();
            
            if (typeof url !== 'string') {
                return this;
            }

            var url_match = url.match(/!([\w\/]+)(\?.*)?/);
            if (url_match !== null) {
                this.setPath(url_match[1]);
                this.setParams(url_match[2]);
                this.triggerChange();
            }

            return this;
        },
        withWindow: function (window) {
            return this.parse(window.location.hash.slice(1));
        }
    });
    
    Hashbang.fromWindow = function (window) {
        return new Hashbang().withWindow(window);
    };
    
    Hashbang.parse = function (url) {
        return new Hashbang.parse(url);
    };
    
    Hashbang.query_string = function (params) {
        return $.map(params, function (value, key) {
            return key + "=" + value;
        }).join("&");
    };
    
    module.exports = Hashbang;
}).call(this);