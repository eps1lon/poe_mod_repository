/* global Class, this */

(function (__undefined) {
    this.Localization = Class.extend({
        init: function (data) {
            this.data = data;
            console.log(data);
        },
        t: function (key) {
            return this.lookupString(key, Array.prototype.slice.call(arguments, 1));
        },
        lookupString: function (key, params) {
            var used_option = null;
            
            $.each(this.data[key], function (i, option) {
                var and_bit = 1;
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
                console.log("no valid match for", this.data[key], "with", params);
                return this.data[key];
            }
            
            if (used_option.handles) {
                $.each(used_option.handles, function (i, handle) {
                    params[i-1] = $.map(params[i-1], Localization.handles[handle]);
                });
            }
            
            return Localization.fillString(used_option.text, params);
        }
    });
    
    this.Localization.fillString = function (string, params) {
        $.each(params, function (i, param) {
            string = string.replace("{param_" + (i + 1) + "}", Localization.rangeString(param));
        });
        
        return string;
    };
    
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