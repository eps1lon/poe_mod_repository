/* global Class */

(function (__undefined) {
    var Class = require('./Inheritance');
    
    var Path = Class.extend({
        init: function (path_string) {
            this.path = path_string.split("/");
            
            this.is_absolute = this.path[0] === '';
            if (this.isAbsolute()) {
                this.path.shift();
            }
        },
        getBasename: function () {
            return this.path[this.path.length - 1];
        },
        getDirectories: function () {
            return this.path.slice(0, this.path.length - 1);
        },
        isAbsolute: function () {
            return this.is_absolute;
        },
        nextFile: function () {
            if (this.path[0] !== '') {
                return this.path.shift();
            }
            return this.getBasename();
        }
    });
    
    module.exports = Path;
}).call(this);