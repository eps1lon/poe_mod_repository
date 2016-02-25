(function (__undefined) {
    var Class = require('../Inheritance');
    
    var NotFoundException = Class.extend({
        init: function (msg) {
            this.message  = msg;
        }
    });
    
    module.exports = NotFoundException;
}).call(this);