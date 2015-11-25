(function (__undefined) {
    String.prototype.ucfirst = function () {
        return this.valueOf().replace(/^([a-z])/, function (g) { return g.toUpperCase(); });    
    };
    
    String.prototype.underscoreToHuman = function () {
        return this.valueOf()
                // replace underscore
                .replace(/_(\w)/g, function (g) { return " " + g[1].toUpperCase(); }).ucfirst();
                
    };
})();