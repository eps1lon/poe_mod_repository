(function (__undefined) {
    var Class = require('./Inheritance');
    
    /**
     * interface
     */
    var Localizeable = Class.extend({
        t: function (params) {
            return;
        }
    });
    
    Localizeable.localization = null;
    
    module.exports = Localizeable;
}).call(this);