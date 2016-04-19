/* jshint bitwise:false */

(function (__undefined) {
    if (window.jQuery === __undefined) {
        console.error("need jQuery object with window context");
        return;
    }
    var $ = window.jQuery;
    
    // todo if-exists
    var ByteSet = require("../ByteSet");

    ByteSet.human = function(byte_set, localization_path, ignore) {
        var strings = [];
        var bits = [];
        
        Object.keys(
            ByteSet
                .byteBlacklisted(byte_set, ignore)
                .filterBits(function (v) { 
                    return v; 
                })
        ).forEach(function (name) {
            bits.push(name);

            var localized = Object.byString(ByteSet.localization, localization_path + "." + name);
            strings.push(localized ? localized : name);
        });

        return {
            strings: strings,
            bits: bits
        };
    };
    
    ByteSet.localization = null;
    
    ByteSet.initLocalization = function ($legends) {
        ByteSet.localization = {};
        
        $("ul.legend", $legends).each(function () {
            var $legend = $(this);
            var klass = $legend.data("klass");
            var byte_ident = $legend.data("byte-ident");
            
            if (ByteSet.localization[klass] === __undefined) {
                ByteSet.localization[klass] = {};
            }
            
            ByteSet.localization[klass][byte_ident] = {};
            
            $("li", this).each(function () {
                var $li = $(this);
                ByteSet.localization[klass][byte_ident][$li.data(byte_ident)] = $li.text();
            });
        });
        
        console.log(ByteSet.localization);
    };
    
    module.exports = ByteSet;
}).call(this);