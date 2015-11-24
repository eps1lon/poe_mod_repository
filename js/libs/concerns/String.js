(function (__undefined) {
    String.prototype.ucfirst = function () {
        return this.valueOf().replace(/^([a-z])/, function (g) { return g.toUpperCase(); });    
    };
})();