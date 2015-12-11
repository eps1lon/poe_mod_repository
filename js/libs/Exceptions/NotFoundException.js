/* global Class */

(function (__undefined) {
    this.NotFoundException = Class.extend({
        init: function (msg) {
            this.message  = msg;
        }
    });
})();