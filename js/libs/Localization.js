/* global Class, this, Localization */
/* jshint bitwise:false */

(function (__undefined) {
    require("./Inheritance");
    require('./concerns/Array');
    require('./concerns/Object');
    
    /**
     * class Localization
     * 
     * class for localizing a group of entities
     */
    this.Localization = Class.extend({
        /**
         * 
         * @param {Object} data the localization json data
         * @returns {Localization}
         */
        init: function (data) {
            this.data = data;
        },
        /**
         * 
         * @param {string} key
         * @param {*} ...args params for Localization::lookupString
         * @returns {Localization::lookupString}
         */
        t: function (key) {
            var params = Array.prototype.slice.call(arguments, 1);
            return Localization.fillString(this.lookupString(key, params), params);
        },
        /**
         * checks all possible strings from key against the params
         * @param {string} key
         * @param {array} params
         * @returns {Object|Class@call;extend.fillString.string}
         */
        lookupString: function (key, params) {
            var used_option = null;
            
            if (this.data[key] === __undefined) {
                return null;
            }
            
            // every option
            $.each(this.data[key], function (i, option) {
                if (isNaN(+i)) {
                    // continue on string keys
                    return true;
                }
                
                var and_bit = 1;
                // loop through every and condition
                $.each(option.and, function (j, range_string) {
                    and_bit &= +Localization.inRange(range_string, params[j]);
                    if (!and_bit) {
                        // break;
                        return false;
                    }
                });
                
                if (and_bit) {
                    used_option = option;
                    // break;
                    return false;
                }
            });
            
            if (used_option === null) {
                //console.log("no valid match for", this.data[key], "with", params);
                
                return null;
            }

            if (used_option.handles) {
                $.each(used_option.handles, function (i, handle) {
                    params[i-1] = $.map(params[i-1], Localization.handles[handle]);
                });
            }
            
            if (!used_option.text) {
                console.log(this.data[key], used_option)
            }
            
            return used_option.text;
        }
    });
    
    /**
     * replaces the params within the string with the given params
     * 
     * @param {String} string
     * @param {Array} params
     * @returns {String}
     */
    this.Localization.fillString = function (string, params) {
        $.each(params, function (i, param) {
            string = string.replace("{param_" + (i + 1) + "}", Localization.rangeString(param));
        });
        
        return string;
    };
    
    /**
     * checks if values are within a range_string from the poe desc files 
     * @param {type} range_string
     * @param {type} values
     * @returns {Boolean}
     */
    this.Localization.inRange = function (range_string, values) {
        if (range_string === __undefined || values === __undefined) {
            return false;
        }
        var range = range_string.split("|");
        var value = Math.max.apply(Math, values);
             
        if (range.length === 1 && (+range[0] === +value || range[0] === '#')) {
            return true;
        }
        
        if (range[0] === '#') {
            range[0] = Number.NEGATIVE_INFINITY;
        }
        if (range[1] === '#') {
            range[1] = Number.POSITIVE_INFINITY;
        }
        
        if (+range[0] <= +value && +value <= +range[1]) {
            return true;
        }
        return false;
    };
    
    this.Localization.rangeString = function (range) {
        if (range.length < 2 || range[0] === range[1]) {
            return range[0];
        }
        return "(" + range.join(" to ") + ")";
    };
    
    /**
     * lambdas  for parameter handles
     */
    this.Localization.handles = {
        deciseconds_to_seconds: function (i) {
            return i * 10;
        },
        divide_by_one_hundred: function (i) {
            return i / 100;
        },
        per_minute_to_per_second: function (i) {
            return i / 60;
        },
        milliseconds_to_seconds: function (i) {
            return i / 1000;
        },
        negate: function (i) {
            return -i;
        },
        divide_by_one_hundred_and_negate: function (i) {
            return -i / 100;
        },
        old_leech_percent: function (i) {
            return i / 5;
        },
        old_leech_permyriad: function (i) {
            return i / 50;
        },
        per_minute_to_per_second_0dp: function (i) {
            return parseInt(Math.round(i / 60, 0), 10);
        },
        per_minute_to_per_second_2dp: function (i) {
            return parseInt(Math.round(i / 60, 2), 10);
        },
        milliseconds_to_seconds_0dp: function (i) {
            return parseInt(Math.round(i / 1000, 0), 10);
        },
        milliseconds_to_seconds_2dp: function (i) {
            return parseInt(Math.round(i / 1000, 2), 10);
        },
        multiplicative_damage_modifier: function (i) {
            return i;
        },
        mod_value_to_item_class: function (i) {
            return i;
        }
    };
})();