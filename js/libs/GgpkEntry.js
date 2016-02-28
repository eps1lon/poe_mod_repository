(function (__undefined) {
    var Class = require('./Inheritance');
    require('./concerns/Array');
    
    if ($ === __undefined) {
        var $ = require('./jquery/jquery_node');
    }
    
    /**
     * table row from content.ggpk
     */
    var GgpkEntry = Class.extend({
        init: function (props) {
            if (typeof props !== 'object') {
                console.error(props, "must be an object");
            }
            
            this.props = props;
        },
        /**
         * comma separated values are arrays
         * already int cast if possible
         * 
         * @param {string} key
         * @returns {Array}
         */
        valueAsArray: function (key) {
            // filter(empty) + map(parseInt)
            return $.map(this.getProp(key).split(","), function (n) {
                if (n === null || n === '') {
                    return null;
                }
                
                if (isNaN(+n)) {
                    return n;
                }
                return +n;
            });
        },
        getProp: function (key) {
            if (this.props[key] === __undefined) {
                console.log("key `" + key + "` doesnt exist");
            }
            return this.props[key];
        },
        setProp: function (key, value) {
            if (this.props[key] !== __undefined) {
                this.props[key] = value;
            }
        }
    });
    
    module.exports = GgpkEntry;
}).call(this);